import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken } from "../lib/auth.js";
import { authenticate } from "../middlewares/authenticate.js";

const router: IRouter = Router();

const SALT_ROUNDS = 10;

const AVATARS = ["🦁", "🐯", "🦊", "🐺", "🐼", "🦝", "🐨", "🦄"];

router.post("/auth/register", async (req, res): Promise<void> => {
  const { username, password, avatar } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  if (username.length < 3 || username.length > 20) {
    res.status(400).json({ error: "Username must be 3-20 characters" });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.username, username));
  if (existing.length > 0) {
    res.status(409).json({ error: "Username already taken" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const selectedAvatar = avatar || AVATARS[Math.floor(Math.random() * AVATARS.length)];

  const [user] = await db.insert(usersTable).values({
    username,
    passwordHash,
    avatar: selectedAvatar,
    status: "online",
  }).returning();

  const token = signToken({ userId: user.id, username: user.username, avatar: user.avatar });

  res.status(201).json({
    user: {
      id: user.id,
      username: user.username,
      avatar: user.avatar,
      status: user.status,
      createdAt: user.createdAt,
    },
    token,
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username));

  if (!user) {
    res.status(400).json({ error: "Invalid username or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(400).json({ error: "Invalid username or password" });
    return;
  }

  await db.update(usersTable).set({ status: "online" }).where(eq(usersTable.id, user.id));

  const token = signToken({ userId: user.id, username: user.username, avatar: user.avatar });

  res.json({
    user: {
      id: user.id,
      username: user.username,
      avatar: user.avatar,
      status: "online",
      createdAt: user.createdAt,
    },
    token,
  });
});

router.post("/auth/logout", authenticate, async (req, res): Promise<void> => {
  if (req.user) {
    await db.update(usersTable).set({ status: "offline" }).where(eq(usersTable.username, req.user.username));
  }
  res.json({ success: true });
});

router.get("/auth/me", authenticate, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, req.user!.username));
  if (!user) {
    res.status(401).json({ error: "User not found" });
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
