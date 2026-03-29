import { Router, type IRouter } from "express";
import { db, friendshipsTable } from "@workspace/db";
import { eq, and, or } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate.js";

const router: IRouter = Router();

router.use(authenticate);

router.get("/friends", async (req, res): Promise<void> => {
  const username = req.user!.username;
  const friends = await db
    .select()
    .from(friendshipsTable)
    .where(
      and(
        or(
          eq(friendshipsTable.requester, username),
          eq(friendshipsTable.recipient, username),
        ),
        eq(friendshipsTable.status, "accepted"),
      ),
    );
  res.json(friends);
});

router.get("/friends/requests", async (req, res): Promise<void> => {
  const username = req.user!.username;
  const requests = await db
    .select()
    .from(friendshipsTable)
    .where(
      and(
        eq(friendshipsTable.recipient, username),
        eq(friendshipsTable.status, "pending"),
      ),
    );
  res.json(requests);
});

router.post("/friends/request/:username", async (req, res): Promise<void> => {
  const me = req.user!.username;
  const target = req.params.username;

  if (me === target) {
    res.status(400).json({ error: "Cannot add yourself as a friend" });
    return;
  }

  const existing = await db
    .select()
    .from(friendshipsTable)
    .where(
      or(
        and(eq(friendshipsTable.requester, me), eq(friendshipsTable.recipient, target)),
        and(eq(friendshipsTable.requester, target), eq(friendshipsTable.recipient, me)),
      ),
    );

  if (existing.length > 0) {
    const f = existing[0];
    if (f.status === "accepted") {
      res.status(409).json({ error: "Already friends" });
    } else {
      res.status(409).json({ error: "Friend request already exists" });
    }
    return;
  }

  const [friendship] = await db
    .insert(friendshipsTable)
    .values({ requester: me, recipient: target, status: "pending" })
    .returning();

  res.status(201).json(friendship);
});

router.post("/friends/accept/:requestId", async (req, res): Promise<void> => {
  const username = req.user!.username;
  const requestId = parseInt(req.params.requestId, 10);

  const [friendship] = await db
    .select()
    .from(friendshipsTable)
    .where(
      and(
        eq(friendshipsTable.id, requestId),
        eq(friendshipsTable.recipient, username),
        eq(friendshipsTable.status, "pending"),
      ),
    );

  if (!friendship) {
    res.status(404).json({ error: "Friend request not found" });
    return;
  }

  const [updated] = await db
    .update(friendshipsTable)
    .set({ status: "accepted" })
    .where(eq(friendshipsTable.id, requestId))
    .returning();

  res.json(updated);
});

router.delete("/friends/:requestId", async (req, res): Promise<void> => {
  const username = req.user!.username;
  const requestId = parseInt(req.params.requestId, 10);

  await db
    .delete(friendshipsTable)
    .where(
      and(
        eq(friendshipsTable.id, requestId),
        or(
          eq(friendshipsTable.requester, username),
          eq(friendshipsTable.recipient, username),
        ),
      ),
    );

  res.json({ success: true });
});

export default router;
