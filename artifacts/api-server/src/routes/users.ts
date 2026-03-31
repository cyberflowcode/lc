import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, ilike, ne, and } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate.js";

const router: IRouter = Router();

// Search users by username prefix (real-time, excludes self)
router.get("/users/search", authenticate, async (req, res): Promise<void> => {
  const me = (req as any).user.username;
  const q = (req.query.q as string || '').trim();
  if (!q || q.length < 1) { res.json([]); return; }
  try {
    const results = await db
      .select({ username: usersTable.username, avatar: usersTable.avatar })
      .from(usersTable)
      .where(and(ilike(usersTable.username, `${q}%`), ne(usersTable.username, me)))
      .limit(8);
    res.json(results);
  } catch {
    res.status(500).json({ error: "Search failed" });
  }
});

router.patch("/users/:username/avatar", authenticate, async (req, res): Promise<void> => {
  const username = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;
  const { avatar } = req.body;

  if (!avatar) {
    res.status(400).json({ error: "Avatar is required" });
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set({ avatar })
    .where(eq(usersTable.username, username))
    .returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    username: user.username,
    avatar: user.avatar,
    status: user.status,
    createdAt: user.createdAt,
  });
});

export default router;
