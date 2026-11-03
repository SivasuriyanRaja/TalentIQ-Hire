import mongoose from "mongoose";

let isConnected = false;

export async function connectDB(): Promise<void> {
  if (isConnected) return;

  // DATABASE_URL is the canonical name; MONGODB_URI is accepted as fallback
  const uri = process.env.DATABASE_URL || process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      "DATABASE_URL (or MONGODB_URI) is required to connect to MongoDB",
    );
  }

  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(uri, {
      dbName: "talentiq",
      serverSelectionTimeoutMS: 15000,
    });
    isConnected = true;
    console.log("Connected to MongoDB successfully");
  } catch (err: any) {
    console.warn(
      `MongoDB connection attempt failed: ${err?.message || err}`,
    );
    throw err;
  }
}

export { mongoose };
export * from "./schema";
