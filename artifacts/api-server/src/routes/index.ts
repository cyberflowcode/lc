import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import messagesRouter from "./messages.js";
import usersRouter from "./users.js";
import uploadRouter from "./upload.js";
import friendsRouter from "./friends.js";
import roomsRouter from "./rooms.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(messagesRouter);
router.use(usersRouter);
router.use(uploadRouter);
router.use(friendsRouter);
router.use(roomsRouter);

export default router;
