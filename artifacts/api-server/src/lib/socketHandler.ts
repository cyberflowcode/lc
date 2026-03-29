import { Server as SocketIOServer } from "socket.io";
import { Server as HttpServer } from "http";
import { verifyToken } from "./auth.js";
import { db, messagesTable, matchSessionsTable, messageReactionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger.js";

interface ConnectedUser {
  socketId: string;
  username: string;
  avatar: string;
  currentRoom: string | null;
}

interface MatchQueue {
  socketId: string;
  username: string;
  avatar: string;
}

const connectedUsers = new Map<string, ConnectedUser>();
const matchQueue: MatchQueue[] = [];
const activeMatches = new Map<string, string>();

async function buildMessageWithReactions(message: typeof messagesTable.$inferSelect) {
  const reactions = await db
    .select()
    .from(messageReactionsTable)
    .where(eq(messageReactionsTable.messageId, message.id));

  const reactionsMap: Record<string, string[]> = {};
  for (const r of reactions) {
    if (!reactionsMap[r.emoji]) reactionsMap[r.emoji] = [];
    reactionsMap[r.emoji].push(r.username);
  }
  return { ...message, reactions: reactionsMap };
}

export function setupSocketIO(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    path: "/api/socket.io",
  });

  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id }, "Socket connected");

    socket.on("join-room", async ({ room, token }: { room: string; token: string }) => {
      const payload = verifyToken(token);
      if (!payload) {
        socket.emit("error", { message: "Invalid token" });
        return;
      }

      const existing = connectedUsers.get(socket.id);
      if (existing?.currentRoom) {
        socket.leave(existing.currentRoom);
        emitRoomUsers(io, existing.currentRoom);
      }

      socket.join(room);
      connectedUsers.set(socket.id, {
        socketId: socket.id,
        username: payload.username,
        avatar: payload.avatar,
        currentRoom: room,
      });

      logger.info({ username: payload.username, room }, "User joined room");
      emitRoomUsers(io, room);
      emitAllUsers(io);
    });

    socket.on("leave-room", ({ room }: { room: string }) => {
      socket.leave(room);
      const user = connectedUsers.get(socket.id);
      if (user) {
        user.currentRoom = null;
        connectedUsers.set(socket.id, user);
      }
      emitRoomUsers(io, room);
    });

    socket.on("chat-message", async ({ room, content, messageType, audioUrl, replyToId }: any) => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;
      if (messageType === "text" && (!content || !content.trim())) return;

      try {
        const [message] = await db.insert(messagesTable).values({
          room,
          username: user.username,
          avatar: user.avatar,
          content: content || null,
          audioUrl: audioUrl || null,
          messageType,
          replyToId: replyToId || null,
        }).returning();

        io.to(room).emit("message", { ...message, reactions: {} });
      } catch (err) {
        logger.error({ err }, "Error saving message");
      }
    });

    socket.on("edit-message", async ({ messageId, content, room }: { messageId: number; content: string; room: string }) => {
      const user = connectedUsers.get(socket.id);
      if (!user || !content?.trim()) return;

      try {
        const [existing] = await db.select().from(messagesTable).where(eq(messagesTable.id, messageId));
        if (!existing || existing.username !== user.username) return;

        const [updated] = await db
          .update(messagesTable)
          .set({ content: content.trim(), editedAt: new Date() })
          .where(eq(messagesTable.id, messageId))
          .returning();

        const withReactions = await buildMessageWithReactions(updated);
        io.to(room).emit("message-updated", withReactions);
      } catch (err) {
        logger.error({ err }, "Error editing message");
      }
    });

    socket.on("delete-message", async ({ messageId, room }: { messageId: number; room: string }) => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;

      try {
        const [existing] = await db.select().from(messagesTable).where(eq(messagesTable.id, messageId));
        if (!existing || existing.username !== user.username) return;

        const [updated] = await db
          .update(messagesTable)
          .set({ isDeleted: true, content: null })
          .where(eq(messagesTable.id, messageId))
          .returning();

        const withReactions = await buildMessageWithReactions(updated);
        io.to(room).emit("message-updated", withReactions);
      } catch (err) {
        logger.error({ err }, "Error deleting message");
      }
    });

    socket.on("react-message", async ({ messageId, emoji, room }: { messageId: number; emoji: string; room: string }) => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;

      try {
        const existing = await db
          .select()
          .from(messageReactionsTable)
          .where(
            and(
              eq(messageReactionsTable.messageId, messageId),
              eq(messageReactionsTable.username, user.username),
              eq(messageReactionsTable.emoji, emoji),
            ),
          );

        if (existing.length > 0) {
          await db.delete(messageReactionsTable).where(eq(messageReactionsTable.id, existing[0].id));
        } else {
          await db.insert(messageReactionsTable).values({ messageId, username: user.username, emoji });
        }

        const [msg] = await db.select().from(messagesTable).where(eq(messagesTable.id, messageId));
        if (!msg) return;

        const withReactions = await buildMessageWithReactions(msg);
        io.to(room).emit("message-updated", withReactions);
      } catch (err) {
        logger.error({ err }, "Error reacting to message");
      }
    });

    socket.on("start-match", ({ token }: { token: string }) => {
      const payload = verifyToken(token);
      if (!payload) {
        socket.emit("error", { message: "Invalid token" });
        return;
      }

      const queueIdx = matchQueue.findIndex((q) => q.socketId === socket.id);
      if (queueIdx !== -1) matchQueue.splice(queueIdx, 1);

      const partnerIdx = matchQueue.findIndex((q) => q.socketId !== socket.id && !activeMatches.has(q.socketId));

      if (partnerIdx !== -1) {
        const partner = matchQueue.splice(partnerIdx, 1)[0];
        const matchId = `match-${Date.now()}-${Math.random().toString(36).slice(2)}`;

        activeMatches.set(socket.id, partner.socketId);
        activeMatches.set(partner.socketId, socket.id);

        socket.join(matchId);
        io.sockets.sockets.get(partner.socketId)?.join(matchId);

        db.insert(matchSessionsTable).values({
          matchId,
          user1: payload.username,
          user2: partner.username,
        }).catch(err => logger.error({ err }, "Failed to save match session"));

        socket.emit("match-found", { matchId, partner: { username: partner.username, avatar: partner.avatar } });
        io.to(partner.socketId).emit("match-found", { matchId, partner: { username: payload.username, avatar: payload.avatar } });
      } else {
        matchQueue.push({ socketId: socket.id, username: payload.username, avatar: payload.avatar });
        socket.emit("waiting-for-match", { message: "Searching for a match..." });
      }
    });

    socket.on("match-message", async ({ matchId, content, messageType, audioUrl }: any) => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;
      try {
        const [saved] = await db.insert(messagesTable).values({
          room: matchId,
          username: user.username,
          avatar: user.avatar,
          content: content ?? null,
          audioUrl: audioUrl ?? null,
          messageType,
        }).returning();
        io.to(matchId).emit("match-message", { ...saved, reactions: {} });
      } catch (err) {
        logger.error({ err }, "Failed to save match message");
      }
    });

    socket.on("exit-match", () => {
      const partnerId = activeMatches.get(socket.id);
      if (partnerId) {
        io.to(partnerId).emit("match-ended", { message: "Your match partner has left" });
        activeMatches.delete(partnerId);
      }
      activeMatches.delete(socket.id);
    });

    socket.on("disconnect", () => {
      const user = connectedUsers.get(socket.id);
      const partnerId = activeMatches.get(socket.id);
      if (partnerId) {
        io.to(partnerId).emit("match-ended", { message: "Your match partner has disconnected" });
        activeMatches.delete(partnerId);
      }
      activeMatches.delete(socket.id);
      const queueIdx = matchQueue.findIndex((q) => q.socketId === socket.id);
      if (queueIdx !== -1) matchQueue.splice(queueIdx, 1);
      if (user?.currentRoom) emitRoomUsers(io, user.currentRoom);
      connectedUsers.delete(socket.id);
      emitAllUsers(io);
    });
  });

  return io;
}

function emitRoomUsers(io: SocketIOServer, room: string): void {
  const users = Array.from(connectedUsers.values())
    .filter(u => u.currentRoom === room)
    .map(u => ({ username: u.username, avatar: u.avatar, status: "online" }));
  io.to(room).emit("room-users", { room, users });
}

function emitAllUsers(io: SocketIOServer): void {
  const users = Array.from(new Map(Array.from(connectedUsers.values()).map(u => [u.username, u])).values())
    .map(u => ({ username: u.username, avatar: u.avatar, status: "online", room: u.currentRoom || "" }));
  io.emit("all-users", { users, count: users.length });
}
