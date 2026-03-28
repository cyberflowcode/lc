import { Server as SocketIOServer } from "socket.io";
import { Server as HttpServer } from "http";
import { verifyToken, extractToken } from "./auth.js";
import { db, messagesTable } from "@workspace/db";
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
const activeMatches = new Map<string, string>(); // socketId -> partner socketId

export function setupSocketIO(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
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

      // Leave previous room
      const existing = connectedUsers.get(socket.id);
      if (existing?.currentRoom) {
        socket.leave(existing.currentRoom);
        emitRoomUsers(io, existing.currentRoom);
      }

      // Join new room
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

    socket.on("chat-message", async ({ room, content, messageType, audioUrl }: {
      room: string;
      content?: string;
      messageType: string;
      audioUrl?: string;
    }) => {
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
        }).returning();

        io.to(room).emit("message", {
          id: message.id,
          room: message.room,
          username: message.username,
          avatar: message.avatar,
          content: message.content,
          audioUrl: message.audioUrl,
          messageType: message.messageType,
          createdAt: message.createdAt,
        });
      } catch (err) {
        logger.error({ err }, "Error saving message");
      }
    });

    socket.on("start-match", ({ token }: { token: string }) => {
      const payload = verifyToken(token);
      if (!payload) {
        socket.emit("error", { message: "Invalid token" });
        return;
      }

      // Remove from any existing queue
      const queueIdx = matchQueue.findIndex((q) => q.socketId === socket.id);
      if (queueIdx !== -1) matchQueue.splice(queueIdx, 1);

      // Find an available partner (not self, not already matched)
      const partnerIdx = matchQueue.findIndex((q) => q.socketId !== socket.id && !activeMatches.has(q.socketId));

      if (partnerIdx !== -1) {
        const partner = matchQueue.splice(partnerIdx, 1)[0];
        const matchId = `match-${Date.now()}-${Math.random().toString(36).slice(2)}`;

        activeMatches.set(socket.id, partner.socketId);
        activeMatches.set(partner.socketId, socket.id);

        socket.join(matchId);
        io.sockets.sockets.get(partner.socketId)?.join(matchId);

        socket.emit("match-found", {
          matchId,
          partner: { username: partner.username, avatar: partner.avatar },
        });

        io.to(partner.socketId).emit("match-found", {
          matchId,
          partner: { username: payload.username, avatar: payload.avatar },
        });

        logger.info({ matchId, user1: payload.username, user2: partner.username }, "Match found");
      } else {
        matchQueue.push({
          socketId: socket.id,
          username: payload.username,
          avatar: payload.avatar,
        });
        socket.emit("waiting-for-match", { message: "Searching for a match..." });
        logger.info({ username: payload.username }, "Added to match queue");
      }
    });

    socket.on("match-message", ({ matchId, content, messageType, audioUrl }: {
      matchId: string;
      content?: string;
      messageType: string;
      audioUrl?: string;
    }) => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;
      if (messageType === "text" && (!content || !content.trim())) return;

      io.to(matchId).emit("match-message", {
        username: user.username,
        avatar: user.avatar,
        content,
        audioUrl,
        messageType,
        createdAt: new Date(),
      });
    });

    socket.on("exit-match", () => {
      const partnerId = activeMatches.get(socket.id);
      if (partnerId) {
        io.to(partnerId).emit("match-ended", { message: "Your match partner has left" });
        activeMatches.delete(partnerId);
      }
      activeMatches.delete(socket.id);

      // Remove from queue too
      const queueIdx = matchQueue.findIndex((q) => q.socketId === socket.id);
      if (queueIdx !== -1) matchQueue.splice(queueIdx, 1);
    });

    socket.on("disconnect", () => {
      logger.info({ socketId: socket.id }, "Socket disconnected");

      const user = connectedUsers.get(socket.id);
      const partnerId = activeMatches.get(socket.id);
      if (partnerId) {
        io.to(partnerId).emit("match-ended", { message: "Your match partner has disconnected" });
        activeMatches.delete(partnerId);
      }
      activeMatches.delete(socket.id);

      const queueIdx = matchQueue.findIndex((q) => q.socketId === socket.id);
      if (queueIdx !== -1) matchQueue.splice(queueIdx, 1);

      if (user?.currentRoom) {
        emitRoomUsers(io, user.currentRoom);
      }
      connectedUsers.delete(socket.id);
      emitAllUsers(io);
    });
  });

  return io;
}

function emitRoomUsers(io: SocketIOServer, room: string): void {
  const users: { username: string; avatar: string; status: string }[] = [];
  for (const [, user] of connectedUsers) {
    if (user.currentRoom === room) {
      users.push({ username: user.username, avatar: user.avatar, status: "online" });
    }
  }
  io.to(room).emit("room-users", { room, users });
}

function emitAllUsers(io: SocketIOServer): void {
  // Deduplicate by username (a user might have multiple tabs open)
  const seen = new Set<string>();
  const users: { username: string; avatar: string; status: string; room: string }[] = [];
  for (const [, user] of connectedUsers) {
    if (!seen.has(user.username)) {
      seen.add(user.username);
      users.push({
        username: user.username,
        avatar: user.avatar,
        status: "online",
        room: user.currentRoom || "",
      });
    }
  }
  io.emit("all-users", { users, count: users.length });
}
