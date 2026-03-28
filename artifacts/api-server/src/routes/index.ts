import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import messagesRouter from "./messages.js";
import usersRouter from "./users.js";
import uploadRouter from "./upload.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(messagesRouter);
router.use(usersRouter);
router.use(uploadRouter);

export default router;
