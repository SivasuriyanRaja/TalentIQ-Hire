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

  await mongoose.connect(MONGODB_URI as string, {
    dbName: "talentiq",
  });

  isConnected = true;
  console.log("✅ Connected to MongoDB");
}

export { mongoose };
export * from "./schema";
