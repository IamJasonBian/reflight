import { Router, type IRouter } from "express";
import healthRouter from "./health";
import tripsRouter from "./trips";
import profileRouter from "./profile";
import discoverRouter from "./discover";

const router: IRouter = Router();

router.use(healthRouter);
router.use(tripsRouter);
router.use(profileRouter);
router.use(discoverRouter);

export default router;
