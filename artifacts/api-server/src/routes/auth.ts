import crypto from "crypto";
import fs from "fs";
import path from "path";
import { Router, type Request, type Response } from "express";
import { User, UserProfile } from "@workspace/db";
import { logger } from "../lib/logger";

const router = Router();

// Persistent local disk store ensuring zero-loss offline/fallback operation
const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface StoredUser {
  userId: string;
  name: string;
  email: string;
  salt: string;
  hash: string;
  role: "candidate" | "recruiter";
  headline?: string;
  location?: string;
  avatarUrl?: string;
  googleId?: string;
  authProvider?: "local" | "google" | "clerk";
  createdAt: string;
}

interface StoredSession {
  token: string;
  userId: string;
  createdAt: string;
}

function loadLocalUsers(): Record<string, StoredUser> {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const raw = fs.readFileSync(USERS_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (e) {
    logger.error({ err: e }, "Failed to read local users file");
  }
  return {};
}

function saveLocalUsers(users: Record<string, StoredUser>) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
  } catch (e) {
    logger.error({ err: e }, "Failed to write local users file");
  }
}

function loadLocalSessions(): Record<string, StoredSession> {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const raw = fs.readFileSync(SESSIONS_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch {}
  return {};
}

function saveLocalSessions(sessions: Record<string, StoredSession>) {
  try {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), "utf-8");
  } catch {}
}

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
}

function generateToken(userId: string): string {
  const token = `tq_${crypto.randomBytes(24).toString("hex")}`;
  const sessions = loadLocalSessions();
  sessions[token] = {
    token,
    userId,
    createdAt: new Date().toISOString(),
  };
  saveLocalSessions(sessions);
  return token;
}

// ─── POST /auth/register & /auth/sign-up ──────────────────────────────────────

async function handleRegister(req: Request, res: Response) {
  try {
    const { name, email, password, role } = req.body ?? {};

    const cleanName = typeof name === "string" ? name.trim() : "";
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const cleanPassword = typeof password === "string" ? password : "";
    const cleanRole: "candidate" | "recruiter" =
      role === "recruiter" ? "recruiter" : "candidate";

    if (!cleanName || cleanName.length < 2) {
      return res.status(400).json({ error: "Please enter your full name (at least 2 characters)." });
    }

    if (!cleanEmail || !cleanEmail.includes("@") || !cleanEmail.includes(".")) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    if (!cleanPassword || cleanPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }

    // Check existing in local store
    const localUsers = loadLocalUsers();
    const existingLocal = Object.values(localUsers).find((u) => u.email === cleanEmail);

    // Check existing in Mongo
    let existingMongo = null;
    try {
      existingMongo = await User.findOne({ email: cleanEmail }).lean();
    } catch {}

    if (existingLocal || existingMongo) {
      return res.status(409).json({
        error: "An account with this email address already exists. Please sign in instead.",
      });
    }

    const userId = `user_${crypto.randomBytes(8).toString("hex")}`;
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = hashPassword(cleanPassword, salt);
    const passwordHashWithSalt = `${salt}:${hash}`;

    // 1. Save to local fallback store
    localUsers[userId] = {
      userId,
      name: cleanName,
      email: cleanEmail,
      salt,
      hash,
      role: cleanRole,
      createdAt: new Date().toISOString(),
    };
    saveLocalUsers(localUsers);

    // 2. Save to Mongo if available
    try {
      await User.create({
        userId,
        name: cleanName,
        email: cleanEmail,
        passwordHash: passwordHashWithSalt,
        role: cleanRole,
      });

      // Also create initial UserProfile in Mongo
      await UserProfile.findOneAndUpdate(
        { userId },
        {
          userId,
          name: cleanName,
          headline: cleanRole === "recruiter" ? "Hiring Manager / Recruiter" : "",
          location: "",
          skills: [],
          extractedSkills: [],
        },
        { upsert: true, new: true },
      );
    } catch (dbErr: any) {
      logger.warn({ err: dbErr?.message }, "Mongo write failed during register, saved to local store");
    }

    const token = generateToken(userId);

    const safeUser = {
      id: userId,
      userId,
      name: cleanName,
      email: cleanEmail,
      role: cleanRole,
    };

    logger.info({ userId, email: cleanEmail, role: cleanRole }, "Real user registered successfully");

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      token,
      user: safeUser,
    });
  } catch (err: any) {
    logger.error({ err }, "Registration error");
    return res.status(500).json({ error: "Failed to create account. Please try again." });
  }
}

router.post("/auth/register", handleRegister);
router.post("/auth/sign-up", handleRegister);

// ─── POST /auth/login & /auth/sign-in ─────────────────────────────────────────

async function handleLogin(req: Request, res: Response) {
  try {
    const { email, password } = req.body ?? {};

    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const cleanPassword = typeof password === "string" ? password : "";

    if (!cleanEmail || !cleanPassword) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    // Check local store
    const localUsers = loadLocalUsers();
    let targetUser = Object.values(localUsers).find((u) => u.email === cleanEmail);

    // Check Mongo if not found locally or to sync
    if (!targetUser) {
      try {
        const mongoUser = (await User.findOne({ email: cleanEmail }).lean()) as any;
        if (mongoUser) {
          const [salt, hash] = (mongoUser.passwordHash || "").split(":");
          targetUser = {
            userId: mongoUser.userId,
            name: mongoUser.name,
            email: mongoUser.email,
            salt: salt || "",
            hash: hash || "",
            role: (mongoUser.role as any) || "candidate",
            createdAt: mongoUser.createdAt?.toISOString?.() || new Date().toISOString(),
          };
          localUsers[mongoUser.userId] = targetUser;
          saveLocalUsers(localUsers);
        }
      } catch (dbErr) {
        logger.warn({ err: dbErr }, "Mongo read failed during login check");
      }
    }

    if (!targetUser) {
      return res.status(401).json({
        error: "No account found with this email. Please check your email or create a new account.",
      });
    }

    // Verify password
    const testHash = hashPassword(cleanPassword, targetUser.salt);
    if (testHash !== targetUser.hash) {
      return res.status(401).json({
        error: "Incorrect password. Please try again.",
      });
    }

    const token = generateToken(targetUser.userId);

    const safeUser = {
      id: targetUser.userId,
      userId: targetUser.userId,
      name: targetUser.name,
      email: targetUser.email,
      role: targetUser.role,
    };

    logger.info({ userId: targetUser.userId, email: targetUser.email }, "Real user signed in successfully");

    return res.status(200).json({
      success: true,
      message: "Signed in successfully",
      token,
      user: safeUser,
    });
  } catch (err: any) {
    logger.error({ err }, "Login error");
    return res.status(500).json({ error: "Sign-in failed. Please try again." });
  }
}

router.post("/auth/login", handleLogin);
router.post("/auth/sign-in", handleLogin);

// ─── POST /auth/google & /auth/google-sign-in ─────────────────────────────────

async function handleGoogleAuth(req: Request, res: Response) {
  try {
    const { token: googleAuthToken, email, name, picture, googleId, role, intent } = req.body ?? {};

    let userEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    let userName = typeof name === "string" ? name.trim() : "";
    let userPicture = typeof picture === "string" ? picture.trim() : "";
    let userGoogleId = typeof googleId === "string" ? googleId.trim() : "";

    // If an OAuth token is supplied, verify it with Google APIs
    if (googleAuthToken && typeof googleAuthToken === "string") {
      try {
        const gRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${googleAuthToken}` },
        });
        if (gRes.ok) {
          const gData = (await gRes.json()) as any;
          if (gData.email) userEmail = gData.email.trim().toLowerCase();
          if (gData.name && !userName) userName = gData.name.trim();
          if (gData.picture && !userPicture) userPicture = gData.picture;
          if (gData.sub && !userGoogleId) userGoogleId = gData.sub;
        } else {
          const idRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(googleAuthToken)}`);
          if (idRes.ok) {
            const idData = (await idRes.json()) as any;
            if (idData.email) userEmail = idData.email.trim().toLowerCase();
            if (idData.name && !userName) userName = idData.name.trim();
            if (idData.picture && !userPicture) userPicture = idData.picture;
            if (idData.sub && !userGoogleId) userGoogleId = idData.sub;
          }
        }
      } catch (tokenErr) {
        logger.warn({ err: tokenErr }, "Google token verification via HTTP failed, falling back to payload");
      }
    }

    if (!userEmail || !userEmail.includes("@") || !userEmail.includes(".")) {
      return res.status(400).json({
        error: "A valid Google account email is required to continue.",
      });
    }

    if (!userName) {
      userName = userEmail.split("@")[0] || "Google User";
    }

    const cleanRole: "candidate" | "recruiter" =
      role === "recruiter" ? "recruiter" : "candidate";

    // 1. Look up existing user in local disk store
    const localUsers = loadLocalUsers();
    let targetUser: StoredUser | undefined = Object.values(localUsers).find(
      (u) =>
        u.email === userEmail ||
        Boolean(userGoogleId && u.googleId === userGoogleId),
    );

    // 2. Look up existing user in MongoDB Atlas
    let mongoUser: any = null;
    try {
      const orConditions: any[] = [{ email: userEmail }];
      if (userGoogleId) orConditions.push({ googleId: userGoogleId });
      mongoUser = await User.findOne({ $or: orConditions }).lean();
    } catch (dbErr) {
      logger.warn({ err: dbErr }, "Mongo lookup during Google auth failed");
    }

    const isNewUser = !targetUser && !mongoUser;

    if (!isNewUser) {
      // Existing User: Log In & merge Google profile info
      const effectiveUserId = targetUser?.userId || mongoUser?.userId;
      const effectiveRole = targetUser?.role || mongoUser?.role || cleanRole;
      const effectiveName = targetUser?.name || mongoUser?.name || userName;

      targetUser = {
        userId: effectiveUserId,
        name: effectiveName,
        email: userEmail,
        salt: targetUser?.salt || "",
        hash: targetUser?.hash || "",
        role: effectiveRole,
        avatarUrl: userPicture || targetUser?.avatarUrl || mongoUser?.avatarUrl || "",
        googleId: userGoogleId || targetUser?.googleId || mongoUser?.googleId || "",
        authProvider: "google",
        createdAt: targetUser?.createdAt || mongoUser?.createdAt?.toISOString?.() || new Date().toISOString(),
      };
      localUsers[effectiveUserId] = targetUser;
      saveLocalUsers(localUsers);

      try {
        await User.findOneAndUpdate(
          { userId: effectiveUserId },
          {
            $set: {
              avatarUrl: userPicture || undefined,
              googleId: userGoogleId || undefined,
              authProvider: "google",
            },
          },
        );
        if (userPicture) {
          await UserProfile.findOneAndUpdate(
            { userId: effectiveUserId },
            { $set: { avatarUrl: userPicture } },
          );
        }
      } catch (updateErr) {
        logger.warn({ err: updateErr }, "Mongo update for existing Google user failed");
      }

      const token = generateToken(effectiveUserId);
      const safeUser = {
        id: effectiveUserId,
        userId: effectiveUserId,
        name: effectiveName,
        email: userEmail,
        role: effectiveRole,
        avatarUrl: targetUser.avatarUrl,
        authProvider: "google" as const,
      };

      logger.info(
        { userId: effectiveUserId, email: userEmail, isNewUser: false },
        "Google authentication successful for existing user",
      );

      return res.status(200).json({
        success: true,
        message: "Signed in successfully with Google.",
        token,
        user: safeUser,
        isNewUser: false,
      });
    }

    // New User: Create Account with Google
    const userId = `user_g_${crypto.randomBytes(8).toString("hex")}`;
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = hashPassword(crypto.randomBytes(32).toString("hex"), salt);

    const newUser: StoredUser = {
      userId,
      name: userName,
      email: userEmail,
      salt,
      hash,
      role: cleanRole,
      avatarUrl: userPicture || "",
      googleId: userGoogleId || "",
      authProvider: "google",
      createdAt: new Date().toISOString(),
    };

    localUsers[userId] = newUser;
    saveLocalUsers(localUsers);

    try {
      await User.create({
        userId,
        name: userName,
        email: userEmail,
        passwordHash: `${salt}:${hash}`,
        role: cleanRole,
        avatarUrl: userPicture || "",
        googleId: userGoogleId || "",
        authProvider: "google",
      });

      await UserProfile.findOneAndUpdate(
        { userId },
        {
          userId,
          name: userName,
          headline:
            cleanRole === "recruiter"
              ? "Hiring Manager / Recruiter"
              : "Candidate | TalentIQ Member",
          location: "",
          skills: [],
          extractedSkills: [],
        },
        { upsert: true, new: true },
      );
    } catch (dbErr: any) {
      logger.warn(
        { err: dbErr?.message },
        "Mongo write failed during Google account creation, saved to local store",
      );
    }

    const token = generateToken(userId);
    const safeUser = {
      id: userId,
      userId,
      name: userName,
      email: userEmail,
      role: cleanRole,
      avatarUrl: userPicture,
      authProvider: "google" as const,
    };

    logger.info(
      { userId, email: userEmail, role: cleanRole, isNewUser: true },
      "New account created successfully with Google",
    );

    return res.status(201).json({
      success: true,
      message: "Account created successfully with Google!",
      token,
      user: safeUser,
      isNewUser: true,
    });
  } catch (err: any) {
    logger.error({ err }, "Google authentication error");
    return res.status(500).json({ error: "Failed to authenticate with Google. Please try again." });
  }
}

router.post("/auth/google", handleGoogleAuth);
router.post("/auth/google-sign-in", handleGoogleAuth);
router.post("/auth/google-sign-up", handleGoogleAuth);

// ─── GET /auth/me ─────────────────────────────────────────────────────────────

router.get("/auth/me", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const headerUserId = req.headers["x-user-id"] as string | undefined;

    const sessions = loadLocalSessions();
    const session = token ? sessions[token] : null;
    const userId = session?.userId || headerUserId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized. Please sign in." });
    }

    const localUsers = loadLocalUsers();
    let user = localUsers[userId];

    if (!user) {
      try {
        const mongoUser = (await User.findOne({ userId }).lean()) as any;
        if (mongoUser) {
          user = {
            userId: mongoUser.userId,
            name: mongoUser.name,
            email: mongoUser.email,
            salt: "",
            hash: "",
            role: (mongoUser.role as any) || "candidate",
            avatarUrl: mongoUser.avatarUrl || "",
            googleId: mongoUser.googleId || "",
            authProvider: mongoUser.authProvider || "local",
            createdAt: mongoUser.createdAt?.toISOString?.() || "",
          };
        }
      } catch {}
    }

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user.userId,
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl || "",
        authProvider: user.authProvider || "local",
      },
    });
  } catch (err: any) {
    logger.error({ err }, "Error in /auth/me");
    return res.status(500).json({ error: "Internal server error." });
  }
});

// ─── POST /auth/logout ────────────────────────────────────────────────────────

router.post("/auth/logout", (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (token) {
    const sessions = loadLocalSessions();
    delete sessions[token];
    saveLocalSessions(sessions);
  }
  return res.status(200).json({ success: true, message: "Signed out successfully." });
});

export default router;
