import mongoose from "mongoose";

const DEFAULT_ATLAS_URI =
  "mongodb+srv://jagathraj0k7_db_user:jagathdb26@cluster0.qfcx2z1.mongodb.net/talentiq?appName=Cluster0";

let isConnected = false;

export async function connectDB(): Promise<void> {
  if (isConnected) return;

  const uri = process.env.MONGODB_URI || DEFAULT_ATLAS_URI;

  try {
    console.log("Connecting to MongoDB Atlas...");
    await mongoose.connect(uri, {
      dbName: "talentiq",
      serverSelectionTimeoutMS: 15000,
    });
    isConnected = true;
    console.log("✅ Connected to MongoDB Atlas successfully");
  } catch (err: any) {
    console.warn(
      `⚠️ MongoDB Atlas connection attempt failed: ${err?.message || err}\nChecking local MongoDB (mongodb://127.0.0.1:27017/talentiq)...`
    );
    try {
      await mongoose.connect("mongodb://127.0.0.1:27017/talentiq", {
        serverSelectionTimeoutMS: 5000,
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
