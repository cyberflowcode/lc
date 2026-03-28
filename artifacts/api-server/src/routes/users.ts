import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate.js";

const router: IRouter = Router();

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
