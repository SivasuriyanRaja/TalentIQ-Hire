import { Router, type Request, type Response } from "express";
import { requireAuth } from "../lib/auth";
import { sseHandler } from "../lib/sse";

const router = Router();

router.get("/events", requireAuth, (_req: Request, res: Response) => {
  sseHandler(_req, res);
});

export default router;