import { Router, type IRouter } from "express";
import { db, roomsTable, roomMembersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate.js";

const router: IRouter = Router();

// List rooms: all public + all private (private rooms visible to all)
router.get("/rooms", authenticate, async (req, res): Promise<void> => {
  const username = (req as any).user.username;
  try {
    const allRooms = await db.select().from(roomsTable);
    const memberships = await db.select().from(roomMembersTable)
      .where(and(eq(roomMembersTable.username, username), eq(roomMembersTable.status, "accepted")));
    const memberRoomIds = new Set(memberships.map(m => m.roomId));

    const pendingMemberships = await db.select().from(roomMembersTable)
      .where(and(eq(roomMembersTable.username, username), eq(roomMembersTable.status, "pending")));
    const pendingRoomIds = new Set(pendingMemberships.map(m => m.roomId));

    // Count members per room
    const allMembers = await db.select().from(roomMembersTable).where(eq(roomMembersTable.status, "accepted"));
    const memberCount: Record<number, number> = {};
    for (const m of allMembers) {
      memberCount[m.roomId] = (memberCount[m.roomId] || 0) + 1;
    }

    // Count pending requests per room (for owners)
    const pendingReqs = await db.select().from(roomMembersTable).where(eq(roomMembersTable.status, "pending"));
    const pendingCount: Record<number, number> = {};
    for (const p of pendingReqs) {
      pendingCount[p.roomId] = (pendingCount[p.roomId] || 0) + 1;
    }

    const result = allRooms.map(r => ({
      ...r,
      password: undefined,
      hasPassword: r.isPrivate && !!r.password,
      memberCount: memberCount[r.id] || 0,
      pendingCount: r.createdBy === username ? (pendingCount[r.id] || 0) : 0,
      isMember: memberRoomIds.has(r.id) || r.createdBy === username,
      isPending: pendingRoomIds.has(r.id),
      isOwner: r.createdBy === username,
      roomKey: `room:${r.id}`,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch rooms" });
  }
});

// Create room
router.post("/rooms", authenticate, async (req, res): Promise<void> => {
  const username = (req as any).user.username;
  const { name, description, isPrivate, password } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: "Room name is required" }); return; }

  try {
    // Enforce 2-room limit per user
    const ownedRooms = await db.select().from(roomsTable).where(eq(roomsTable.createdBy, username));
    if (ownedRooms.length >= 2) {
      res.status(400).json({ error: "You can only create up to 2 rooms" });
      return;
    }

    const [room] = await db.insert(roomsTable).values({
      name: name.trim(),
      description: description?.trim() || null,
      createdBy: username,
      isPrivate: Boolean(isPrivate),
      password: isPrivate && password?.trim() ? password.trim() : null,
    }).returning();

    // Add creator as owner
    await db.insert(roomMembersTable).values({
      roomId: room.id,
      username,
      role: "owner",
      status: "accepted",
    });

    res.status(201).json({
      ...room,
      password: undefined,
      hasPassword: room.isPrivate && !!room.password,
      roomKey: `room:${room.id}`,
      isMember: true,
      isOwner: true,
      memberCount: 1,
      pendingCount: 0,
      isPending: false,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to create room" });
  }
});

// Get room members (owner or member)
router.get("/rooms/:id/members", authenticate, async (req, res): Promise<void> => {
  const username = (req as any).user.username;
  const roomId = parseInt(req.params.id);
  try {
    const [room] = await db.select().from(roomsTable).where(eq(roomsTable.id, roomId));
    if (!room) { res.status(404).json({ error: "Room not found" }); return; }

    const members = await db.select().from(roomMembersTable).where(eq(roomMembersTable.roomId, roomId));
    const isMember = members.some(m => m.username === username && m.status === "accepted");
    if (!isMember && room.createdBy !== username) {
      res.status(403).json({ error: "Not a member" });
      return;
    }
    res.json(members);
  } catch {
    res.status(500).json({ error: "Failed to fetch members" });
  }
});

// Join room
// - Public room: join immediately
// - Private + password: must provide correct password → join immediately
// - Private + no password: send join request (pending)
router.post("/rooms/:id/join", authenticate, async (req, res): Promise<void> => {
  const username = (req as any).user.username;
  const roomId = parseInt(req.params.id);
  const { password } = req.body;
  try {
    const [room] = await db.select().from(roomsTable).where(eq(roomsTable.id, roomId));
    if (!room) { res.status(404).json({ error: "Room not found" }); return; }

    const existing = await db.select().from(roomMembersTable)
      .where(and(eq(roomMembersTable.roomId, roomId), eq(roomMembersTable.username, username)));

    if (existing.length > 0) {
      if (existing[0].status === "accepted") { res.status(409).json({ error: "Already a member" }); return; }
      if (existing[0].status === "pending") { res.status(409).json({ error: "Request already pending" }); return; }
      if (existing[0].status === "invited") {
        await db.update(roomMembersTable).set({ status: "accepted" }).where(eq(roomMembersTable.id, existing[0].id));
        res.json({ message: "Joined room", status: "accepted" });
        return;
      }
    }

    let status: string;
    if (!room.isPrivate) {
      status = "accepted";
    } else if (room.password) {
      // Password-protected: check password
      if (!password) { res.status(400).json({ error: "This room requires a password" }); return; }
      if (password !== room.password) { res.status(403).json({ error: "Incorrect password" }); return; }
      status = "accepted";
    } else {
      // Private without password: request to join
      status = "pending";
    }

    await db.insert(roomMembersTable).values({ roomId, username, role: "member", status });
    const message = status === "accepted" ? "Joined room" : "Join request sent";
    res.status(201).json({ message, status });
  } catch {
    res.status(500).json({ error: "Failed to join room" });
  }
});

// Invite friend (owner only)
router.post("/rooms/:id/invite/:username", authenticate, async (req, res): Promise<void> => {
  const owner = (req as any).user.username;
  const roomId = parseInt(req.params.id);
  const inviteUsername = req.params.username;
  try {
    const [room] = await db.select().from(roomsTable).where(eq(roomsTable.id, roomId));
    if (!room || room.createdBy !== owner) { res.status(403).json({ error: "Not authorized" }); return; }

    const existing = await db.select().from(roomMembersTable)
      .where(and(eq(roomMembersTable.roomId, roomId), eq(roomMembersTable.username, inviteUsername)));
    if (existing.length > 0 && existing[0].status === "accepted") {
      res.status(409).json({ error: "Already a member" }); return;
    }

    if (existing.length > 0) {
      await db.update(roomMembersTable).set({ status: "invited" }).where(eq(roomMembersTable.id, existing[0].id));
    } else {
      await db.insert(roomMembersTable).values({ roomId, username: inviteUsername, role: "member", status: "invited" });
    }
    res.json({ message: "Invited" });
  } catch {
    res.status(500).json({ error: "Failed to invite" });
  }
});

// Accept join request (owner only)
router.post("/rooms/:id/accept/:username", authenticate, async (req, res): Promise<void> => {
  const owner = (req as any).user.username;
  const roomId = parseInt(req.params.id);
  const targetUsername = req.params.username;
  try {
    const [room] = await db.select().from(roomsTable).where(eq(roomsTable.id, roomId));
    if (!room || room.createdBy !== owner) { res.status(403).json({ error: "Not authorized" }); return; }

    await db.update(roomMembersTable)
      .set({ status: "accepted" })
      .where(and(eq(roomMembersTable.roomId, roomId), eq(roomMembersTable.username, targetUsername)));

    res.json({ message: "Accepted" });
  } catch {
    res.status(500).json({ error: "Failed to accept" });
  }
});

// Remove member / decline request (owner only)
router.delete("/rooms/:id/members/:username", authenticate, async (req, res): Promise<void> => {
  const owner = (req as any).user.username;
  const roomId = parseInt(req.params.id);
  const targetUsername = req.params.username;
  try {
    const [room] = await db.select().from(roomsTable).where(eq(roomsTable.id, roomId));
    if (!room || room.createdBy !== owner) { res.status(403).json({ error: "Not authorized" }); return; }
    await db.delete(roomMembersTable)
      .where(and(eq(roomMembersTable.roomId, roomId), eq(roomMembersTable.username, targetUsername)));
    res.json({ message: "Removed" });
  } catch {
    res.status(500).json({ error: "Failed to remove" });
  }
});

// Leave room
router.delete("/rooms/:id/leave", authenticate, async (req, res): Promise<void> => {
  const username = (req as any).user.username;
  const roomId = parseInt(req.params.id);
  try {
    const [room] = await db.select().from(roomsTable).where(eq(roomsTable.id, roomId));
    if (!room) { res.status(404).json({ error: "Room not found" }); return; }
    if (room.createdBy === username) { res.status(400).json({ error: "Owner cannot leave. Delete the room instead." }); return; }
    await db.delete(roomMembersTable)
      .where(and(eq(roomMembersTable.roomId, roomId), eq(roomMembersTable.username, username)));
    res.json({ message: "Left room" });
  } catch {
    res.status(500).json({ error: "Failed to leave" });
  }
});

// Delete room (owner only)
router.delete("/rooms/:id", authenticate, async (req, res): Promise<void> => {
  const username = (req as any).user.username;
  const roomId = parseInt(req.params.id);
  try {
    const [room] = await db.select().from(roomsTable).where(eq(roomsTable.id, roomId));
    if (!room || room.createdBy !== username) { res.status(403).json({ error: "Not authorized" }); return; }
    await db.delete(roomMembersTable).where(eq(roomMembersTable.roomId, roomId));
    await db.delete(roomsTable).where(eq(roomsTable.id, roomId));
    res.json({ message: "Deleted" });
  } catch {
    res.status(500).json({ error: "Failed to delete" });
  }
});

export default router;
