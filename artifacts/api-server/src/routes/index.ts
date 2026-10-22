import { Router, type IRouter } from "express";
import healthRouter from "./health";
import talentiqRouter from "./talentiq";
import syncRouter from "./sync";

const router: IRouter = Router();

router.use(healthRouter);
router.use(talentiqRouter);
router.use(syncRouter);

export default router;
