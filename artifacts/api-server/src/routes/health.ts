import { Router, type IRouter } from "express";
import { dbState } from "../lib/dbStatus";

const router: IRouter = Router();

// Always return 200; db reflects live MongoDB connectivity status.
router.get(["/healthz", "/health"], (_req, res) => {
  res.status(200).json({ status: "ok", db: dbState.status });
});

export default router;
