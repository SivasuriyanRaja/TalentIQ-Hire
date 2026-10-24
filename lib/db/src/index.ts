import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    "MONGODB_URI must be set. Did you forget to add it to your .env file?",
  );
}

let isConnected = false;

export async function connectDB(): Promise<void> {
  if (isConnected) return;

  try {
    await mongoose.connect(MONGODB_URI as string, {
      dbName: "talentiq",
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log("✅ Connected to MongoDB Atlas");
  } catch (err: any) {
    console.warn(
      `⚠️ Failed to connect to primary MongoDB URI: ${err?.message || err}\nChecking local MongoDB (mongodb://127.0.0.1:27017/talentiq)...`
    );
    try {
      await mongoose.connect("mongodb://127.0.0.1:27017/talentiq", {
        serverSelectionTimeoutMS: 3000,
      });
      isConnected = true;
      console.log("✅ Successfully connected to local MongoDB fallback!");
    } catch (localErr) {
      throw err;
    }
  }
}

export { mongoose };
export * from "./schema";
