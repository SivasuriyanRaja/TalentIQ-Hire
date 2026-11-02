import "dotenv/config";
import app from "./app";
import { connectDB } from "@workspace/db";

let isDbConnected = false;

/**
 * Serverless HTTP entry handler for Vercel.
 * Lazily connects to MongoDB Atlas and delegates requests to Express.
 */
export default async function handler(req: any, res: any) {
  if (!isDbConnected) {
    try {
      await connectDB();
      isDbConnected = true;
    } catch (err: any) {
      console.error("MongoDB Atlas connection error in serverless handler:", err?.message || err);
    }
  }

  // Ensure leading /api exists if URL was stripped by rewrites
  if (req.url && !req.url.startsWith("/api") && !req.url.startsWith("/auth")) {
    req.url = `/api${req.url}`;
  }

  return app(req, res);
}
