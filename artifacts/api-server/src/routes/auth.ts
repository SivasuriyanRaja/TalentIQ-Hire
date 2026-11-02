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

interface GoogleIdTokenPayload {
  iss: string;
  sub: string;
  azp?: string;
  aud: string;
  email: string;
  email_verified: boolean | string;
  name?: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
  exp: number | string;
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

function getFrontendUrl(req: Request): string {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL.replace(/\/+$/, "");
  const host = req.get("host") || "localhost:5000";
  // If host is localhost:5000, frontend dev server is likely localhost:8081
  if (host.includes("localhost:5000") || host.includes("127.0.0.1:5000")) {
    return "http://localhost:8081";
  }
  return `${req.protocol}://${host}`;
}

// ─── GOOGLE OAUTH 2.0 / OPENID CONNECT SERVER VERIFICATION ──────────────────

/**
 * Exchanges authorization code with Google using server-side GOOGLE_CLIENT_SECRET
 */
async function exchangeGoogleCodeForTokens({
  code,
  redirectUri,
  codeVerifier,
}: {
  code: string;
  redirectUri: string;
  codeVerifier?: string;
}): Promise<{ access_token?: string; id_token?: string; error?: string }> {
  const clientId =
    process.env.GOOGLE_CLIENT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
    "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";

  if (!clientId || !clientSecret) {
    return {
      error:
        "GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing from server environment.",
    };
  }

  const params = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  if (codeVerifier) {
    params.append("code_verifier", codeVerifier);
  }

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });

    const data = (await res.json()) as any;
    if (!res.ok) {
      logger.warn({ data }, "Google token exchange failed");
      return {
        error: data.error_description || data.error || "Token exchange with Google failed.",
      };
    }

    return { access_token: data.access_token, id_token: data.id_token };
  } catch (err: any) {
    logger.error({ err }, "Network error during Google token exchange");
    return { error: err?.message || "Failed to reach Google token endpoint." };
  }
}

/**
 * Verifies ID token signature, issuer, audience, expiry, and email_verified via Google API
 */
async function verifyGoogleIdToken(idToken: string): Promise<{
  valid: boolean;
  user?: {
    email: string;
    name: string;
    picture: string;
    sub: string;
  };
  error?: string;
}> {
  try {
    const clientId =
      process.env.GOOGLE_CLIENT_ID ||
      process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
      "";

    const verifyRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    );

    if (!verifyRes.ok) {
      return { valid: false, error: "Invalid Google ID token signature or expired." };
    }

    const payload = (await verifyRes.json()) as GoogleIdTokenPayload;

    // 1. Audience verification (must match our client ID)
    if (clientId && payload.aud !== clientId) {
      logger.warn({ aud: payload.aud, expected: clientId }, "Google token audience mismatch");
      return { valid: false, error: "Google token audience does not match this application." };
    }

    // 2. Issuer verification
    if (
      payload.iss !== "accounts.google.com" &&
      payload.iss !== "https://accounts.google.com"
    ) {
      return { valid: false, error: "Invalid Google token issuer." };
    }

    // 3. Expiry check
    const nowSec = Math.floor(Date.now() / 1000);
    if (Number(payload.exp) < nowSec) {
      return { valid: false, error: "Google ID token has expired." };
    }

    // 4. email_verified check (STRICT requirement)
    const isVerified =
      payload.email_verified === true || payload.email_verified === "true";
    if (!isVerified) {
      return {
        valid: false,
        error:
          "Your Google email address is unverified. Please verify your email with Google first.",
      };
    }

    if (!payload.email || !payload.email.includes("@")) {
      return { valid: false, error: "No email address found in Google ID token." };
    }

    return {
      valid: true,
      user: {
        email: payload.email.trim().toLowerCase(),
        name: payload.name?.trim() || payload.email.split("@")[0],
        picture: payload.picture || "",
        sub: payload.sub,
      },
    };
  } catch (err: any) {
    logger.error({ err }, "Error verifying Google ID token");
    return { valid: false, error: err?.message || "Token verification failed" };
  }
}

/**
 * Verifies access token via Google userinfo endpoint
 */
async function verifyGoogleAccessToken(accessToken: string): Promise<{
  valid: boolean;
  user?: {
    email: string;
    name: string;
    picture: string;
    sub: string;
  };
  error?: string;
}> {
  try {
    const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userinfoRes.ok) {
      return { valid: false, error: "Invalid Google access token." };
    }
    const data = (await userinfoRes.json()) as any;
    if (data.email_verified !== true && data.email_verified !== "true") {
      return {
        valid: false,
        error: "Your Google email address is unverified.",
      };
    }
    return {
      valid: true,
      user: {
        email: data.email.trim().toLowerCase(),
        name: data.name?.trim() || data.email.split("@")[0],
        picture: data.picture || "",
        sub: data.sub,
      },
    };
  } catch (err: any) {
    return { valid: false, error: err?.message || "Userinfo verification error" };
  }
}

/**
 * Finds existing user or registers a new user with Google identity
 */
async function getOrCreateGoogleUser({
  email,
  name,
  picture,
  googleId,
  role = "candidate",
}: {
  email: string;
  name: string;
  picture: string;
  googleId: string;
  role?: "candidate" | "recruiter";
}): Promise<{ user: StoredUser; isNewUser: boolean }> {
  const cleanEmail = email.toLowerCase().trim();
  const cleanRole: "candidate" | "recruiter" =
    role === "recruiter" ? "recruiter" : "candidate";

  // Check local users
  const localUsers = loadLocalUsers();
  let targetUser = Object.values(localUsers).find(
    (u) =>
      u.email === cleanEmail ||
      Boolean(googleId && u.googleId === googleId),
  );

  // Check MongoDB Atlas
  let mongoUser: any = null;
  try {
    const orConditions: any[] = [{ email: cleanEmail }];
    if (googleId) orConditions.push({ googleId });
    mongoUser = await User.findOne({ $or: orConditions }).lean();
  } catch (dbErr) {
    logger.warn({ err: dbErr }, "Mongo lookup during Google user resolution failed");
  }

  const isNewUser = !targetUser && !mongoUser;

  if (!isNewUser) {
    // Existing User: Link Google account & update avatar if available
    const effectiveUserId = targetUser?.userId || mongoUser?.userId;
    const effectiveRole = targetUser?.role || mongoUser?.role || cleanRole;
    const effectiveName = targetUser?.name || mongoUser?.name || name;
    const effectiveAvatar =
      picture || targetUser?.avatarUrl || mongoUser?.avatarUrl || "";

    targetUser = {
      userId: effectiveUserId,
      name: effectiveName,
      email: cleanEmail,
      salt: targetUser?.salt || "",
      hash: targetUser?.hash || "",
      role: effectiveRole,
      avatarUrl: effectiveAvatar,
      googleId: googleId || targetUser?.googleId || mongoUser?.googleId || "",
      authProvider: "google",
      createdAt:
        targetUser?.createdAt ||
        mongoUser?.createdAt?.toISOString?.() ||
        new Date().toISOString(),
    };
    localUsers[effectiveUserId] = targetUser;
    saveLocalUsers(localUsers);

    try {
      await User.findOneAndUpdate(
        { userId: effectiveUserId },
        {
          $set: {
            avatarUrl: effectiveAvatar || undefined,
            googleId: googleId || undefined,
            authProvider: "google",
            emailVerified: true,
          },
        },
      );
      if (effectiveAvatar) {
        await UserProfile.findOneAndUpdate(
          { userId: effectiveUserId },
          { $set: { avatarUrl: effectiveAvatar } },
        );
      }
    } catch (updateErr) {
      logger.warn({ err: updateErr }, "Mongo update for existing Google user failed");
    }

    return { user: targetUser, isNewUser: false };
  }

  // New User: Create user record in local fallback store & MongoDB
  const userId = `user_g_${crypto.randomBytes(8).toString("hex")}`;
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = hashPassword(crypto.randomBytes(32).toString("hex"), salt);

  const newUser: StoredUser = {
    userId,
    name,
    email: cleanEmail,
    salt,
    hash,
    role: cleanRole,
    avatarUrl: picture || "",
    googleId: googleId || "",
    authProvider: "google",
    createdAt: new Date().toISOString(),
  };

  localUsers[userId] = newUser;
  saveLocalUsers(localUsers);

  try {
    await User.create({
      userId,
      name,
      email: cleanEmail,
      passwordHash: `${salt}:${hash}`,
      role: cleanRole,
      avatarUrl: picture || "",
      googleId: googleId || "",
      authProvider: "google",
      emailVerified: true,
    });

    await UserProfile.findOneAndUpdate(
      { userId },
      {
        userId,
        name,
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

  return { user: newUser, isNewUser: true };
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

    const localUsers = loadLocalUsers();
    let targetUser = Object.values(localUsers).find((u) => u.email === cleanEmail);

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

// ─── GET /auth/google/callback (Browser OAuth Redirect Landing) ──────────────

router.get("/auth/google/callback", async (req: Request, res: Response) => {
  const frontendUrl = getFrontendUrl(req);

  try {
    const { code, state, error, error_description } = req.query as Record<
      string,
      string | undefined
    >;

    // 1. If Google returned an error (user cancelled or access_denied)
    if (error) {
      logger.info({ error, error_description }, "Google OAuth redirect returned error");
      const userMessage =
        error === "access_denied"
          ? "Google sign-in was cancelled."
          : error_description || error;
      return res.redirect(
        `${frontendUrl}/(auth)/sign-in?error=${encodeURIComponent(userMessage)}`,
      );
    }

    if (!code) {
      return res.redirect(
        `${frontendUrl}/(auth)/sign-in?error=${encodeURIComponent("No authorization code received from Google.")}`,
      );
    }

    // 2. Decode state parameter to extract CSRF nonce, role, intent, and verifier
    let role: "candidate" | "recruiter" = "candidate";
    let intent: "sign-in" | "sign-up" = "sign-in";
    let codeVerifier: string | undefined = req.cookies?.tq_code_verifier;

    if (state) {
      try {
        let base64 = state.replace(/-/g, "+").replace(/_/g, "/");
        while (base64.length % 4) base64 += "=";
        const decoded = JSON.parse(
          Buffer.from(base64, "base64").toString("utf-8"),
        );
        if (decoded.role === "recruiter") role = "recruiter";
        if (decoded.intent === "sign-up") intent = "sign-up";
        if (!codeVerifier && decoded.verifier) codeVerifier = decoded.verifier;
      } catch {}
    }

    // Determine redirect URI matching configuration
    const baseUrl =
      process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
    const redirectUri =
      process.env.GOOGLE_REDIRECT_URI ||
      `${baseUrl}/api/auth/google/callback`;

    // 3. Exchange code for tokens at oauth2.googleapis.com
    const exchange = await exchangeGoogleCodeForTokens({
      code,
      redirectUri,
      codeVerifier,
    });

    if (exchange.error || (!exchange.id_token && !exchange.access_token)) {
      logger.error({ error: exchange.error }, "Code exchange failed in GET /auth/google/callback");
      return res.redirect(
        `${frontendUrl}/(auth)/sign-in?error=${encodeURIComponent(
          exchange.error || "Failed to exchange authorization code with Google.",
        )}`,
      );
    }

    // 4. Verify ID Token cryptographically with Google APIs
    let verifiedUser:
      | { email: string; name: string; picture: string; sub: string }
      | undefined;

    if (exchange.id_token) {
      const vResult = await verifyGoogleIdToken(exchange.id_token);
      if (!vResult.valid || !vResult.user) {
        return res.redirect(
          `${frontendUrl}/(auth)/sign-in?error=${encodeURIComponent(
            vResult.error || "Google ID token verification failed.",
          )}`,
        );
      }
      verifiedUser = vResult.user;
    } else if (exchange.access_token) {
      const aResult = await verifyGoogleAccessToken(exchange.access_token);
      if (!aResult.valid || !aResult.user) {
        return res.redirect(
          `${frontendUrl}/(auth)/sign-in?error=${encodeURIComponent(
            aResult.error || "Google access token verification failed.",
          )}`,
        );
      }
      verifiedUser = aResult.user;
    }

    if (!verifiedUser) {
      return res.redirect(
        `${frontendUrl}/(auth)/sign-in?error=${encodeURIComponent("Could not verify Google identity.")}`,
      );
    }

    // 5. Automatic sign in vs sign up
    const { user, isNewUser } = await getOrCreateGoogleUser({
      email: verifiedUser.email,
      name: verifiedUser.name,
      picture: verifiedUser.picture,
      googleId: verifiedUser.sub,
      role,
    });

    // 6. Issue secure session token and httpOnly cookie
    const token = generateToken(user.userId);
    res.cookie("tq_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: "/",
    });
    res.clearCookie("tq_code_verifier", { path: "/" });
    res.clearCookie("tq_oauth_state", { path: "/" });

    logger.info(
      { userId: user.userId, email: user.email, isNewUser },
      "Google OAuth 2.0 login complete, redirecting to frontend dashboard",
    );

    // Redirect to frontend callback route with token
    return res.redirect(
      `${frontendUrl}/auth/callback?token=${encodeURIComponent(token)}`,
    );
  } catch (err: any) {
    logger.error({ err }, "Unhandled error in GET /auth/google/callback");
    return res.redirect(
      `${frontendUrl}/(auth)/sign-in?error=${encodeURIComponent("An unexpected error occurred during Google sign-in.")}`,
    );
  }
});

// ─── POST /auth/google/callback & /auth/google (API Token Exchange) ───────────

router.post(
  ["/auth/google/callback", "/auth/google", "/auth/google-sign-in", "/auth/google-sign-up"],
  async (req: Request, res: Response) => {
    try {
      const {
        code,
        code_verifier,
        token: clientToken,
        redirect_uri,
        redirectUri,
        state,
        role = "candidate",
        intent = "sign-in",
      } = req.body ?? {};

      // STRICT SECURITY: Completely reject any request lacking Google code or verified token.
      // (Removes trusting an email or name typed by the user as a Google identity).
      if (!code && !clientToken) {
        return res.status(400).json({
          success: false,
          error:
            "A verified Google authorization code or token is required. Direct submission of email/name is not permitted.",
        });
      }

      let effectiveIdToken: string | undefined = undefined;
      let effectiveAccessToken: string | undefined = undefined;

      if (code && typeof code === "string") {
        const baseUrl =
          process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
        const targetRedirectUri =
          redirect_uri ||
          redirectUri ||
          process.env.GOOGLE_REDIRECT_URI ||
          `${baseUrl}/api/auth/google/callback`;

        const exchange = await exchangeGoogleCodeForTokens({
          code,
          redirectUri: targetRedirectUri,
          codeVerifier: code_verifier,
        });

        if (exchange.error || (!exchange.id_token && !exchange.access_token)) {
          return res.status(400).json({
            success: false,
            error:
              exchange.error ||
              "Failed to exchange authorization code with Google.",
          });
        }

        effectiveIdToken = exchange.id_token;
        effectiveAccessToken = exchange.access_token;
      } else if (clientToken && typeof clientToken === "string") {
        effectiveIdToken = clientToken;
        effectiveAccessToken = clientToken;
      }

      // Verify token authenticity with Google APIs
      let verifiedUser:
        | { email: string; name: string; picture: string; sub: string }
        | undefined;

      if (effectiveIdToken) {
        const vResult = await verifyGoogleIdToken(effectiveIdToken);
        if (vResult.valid && vResult.user) {
          verifiedUser = vResult.user;
        }
      }

      if (!verifiedUser && effectiveAccessToken) {
        const aResult = await verifyGoogleAccessToken(effectiveAccessToken);
        if (aResult.valid && aResult.user) {
          verifiedUser = aResult.user;
        }
      }

      if (!verifiedUser) {
        return res.status(401).json({
          success: false,
          error:
            "Google identity verification failed. The provided token or code could not be verified by Google.",
        });
      }

      // Resolve role from state if provided
      let effectiveRole: "candidate" | "recruiter" =
        role === "recruiter" ? "recruiter" : "candidate";
      if (state && typeof state === "string") {
        try {
          let base64 = state.replace(/-/g, "+").replace(/_/g, "/");
          while (base64.length % 4) base64 += "=";
          const decoded = JSON.parse(
            Buffer.from(base64, "base64").toString("utf-8"),
          );
          if (decoded.role === "recruiter") effectiveRole = "recruiter";
        } catch {}
      }

      // Automatic sign in vs sign up
      const { user, isNewUser } = await getOrCreateGoogleUser({
        email: verifiedUser.email,
        name: verifiedUser.name,
        picture: verifiedUser.picture,
        googleId: verifiedUser.sub,
        role: effectiveRole,
      });

      const sessionToken = generateToken(user.userId);
      res.cookie("tq_session", sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: "/",
      });

      const safeUser = {
        id: user.userId,
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        authProvider: "google" as const,
      };

      logger.info(
        { userId: user.userId, email: user.email, isNewUser },
        "Google OAuth authenticated successfully via POST",
      );

      return res.status(isNewUser ? 201 : 200).json({
        success: true,
        message: isNewUser
          ? "Account created successfully with Google!"
          : "Signed in successfully with Google.",
        token: sessionToken,
        user: safeUser,
        isNewUser,
      });
    } catch (err: any) {
      logger.error({ err }, "Google authentication error in POST handler");
      return res
        .status(500)
        .json({ error: "Failed to authenticate with Google. Please try again." });
    }
  },
);

// ─── GET /auth/me ─────────────────────────────────────────────────────────────

router.get("/auth/me", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : (req.cookies?.tq_session as string | undefined) || null;
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
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : (req.cookies?.tq_session as string | undefined) || null;

  if (token) {
    const sessions = loadLocalSessions();
    delete sessions[token];
    saveLocalSessions(sessions);
  }

  res.clearCookie("tq_session", { path: "/" });
  return res.status(200).json({ success: true, message: "Signed out successfully." });
});

export default router;
