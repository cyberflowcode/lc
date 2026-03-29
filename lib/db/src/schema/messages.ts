import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  room: text("room").notNull(),
  username: text("username").notNull(),
  avatar: text("avatar").notNull().default("🦁"),
  content: text("content"),
  audioUrl: text("audio_url"),
  messageType: text("message_type").notNull().default("text"),
  replyToId: integer("reply_to_id"),
  editedAt: timestamp("edited_at", { withTimezone: true }),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMessageSchema = createInsertSchema(messagesTable).omit({ id: true, createdAt: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;
