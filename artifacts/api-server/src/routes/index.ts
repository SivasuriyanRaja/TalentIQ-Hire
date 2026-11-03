import { Router, type IRouter } from "express";
import healthRouter from "./health";
import talentiqRouter from "./talentiq";
import syncRouter from "./sync";
import authRouter from "./auth";
import recruiterRouter from "./recruiter";
import eventsRouter from "./events";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(talentiqRouter);
router.use(syncRouter);
router.use(recruiterRouter);
router.use(eventsRouter);

export default router;