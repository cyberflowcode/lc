import { Router, type IRouter } from "express";
import { db, messagesTable, messageReactionsTable } from "@workspace/db";
import { eq, desc, inArray } from "drizzle-orm";

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

  const reversed = messages.reverse();

  if (reversed.length === 0) {
    res.json([]);
    return;
  }

  const messageIds = reversed.map(m => m.id);
  const reactions = await db
    .select()
    .from(messageReactionsTable)
    .where(inArray(messageReactionsTable.messageId, messageIds));

  const reactionsMap: Record<number, Record<string, string[]>> = {};
  for (const r of reactions) {
    if (!reactionsMap[r.messageId]) reactionsMap[r.messageId] = {};
    if (!reactionsMap[r.messageId][r.emoji]) reactionsMap[r.messageId][r.emoji] = [];
    reactionsMap[r.messageId][r.emoji].push(r.username);
  }

  const messagesWithReactions = reversed.map(m => ({
    ...m,
    reactions: reactionsMap[m.id] || {},
  }));

  res.json(messagesWithReactions);
});

export default router;
