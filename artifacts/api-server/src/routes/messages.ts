import { Router, type IRouter } from "express";
import { db, messagesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate.js";

const router: IRouter = Router();

router.get("/messages/:room", async (req, res): Promise<void> => {
  const room = Array.isArray(req.params.room) ? req.params.room[0] : req.params.room;
  const limit = parseInt(String(req.query.limit || "50"), 10);

  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.room, room))
    .orderBy(desc(messagesTable.createdAt))
    .limit(limit);

  res.json(messages.reverse());
});

export default router;
