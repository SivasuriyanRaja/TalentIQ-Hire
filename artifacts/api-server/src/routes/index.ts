import { Router, type IRouter } from "express";
import healthRouter from "./health";
import talentiqRouter from "./talentiq";

const router: IRouter = Router();

router.use(healthRouter);
router.use(talentiqRouter);

export default router;
