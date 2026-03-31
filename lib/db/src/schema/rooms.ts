import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";

export const roomsTable = pgTable("rooms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdBy: text("created_by").notNull(),
  isPrivate: boolean("is_private").notNull().default(false),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const roomMembersTable = pgTable("room_members", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  username: text("username").notNull(),
  role: text("role").notNull().default("member"),
  status: text("status").notNull().default("accepted"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Room = typeof roomsTable.$inferSelect;
export type RoomMember = typeof roomMembersTable.$inferSelect;
