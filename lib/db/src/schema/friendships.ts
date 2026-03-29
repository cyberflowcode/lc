import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const friendshipsTable = pgTable("friendships", {
  id: serial("id").primaryKey(),
  requester: text("requester").notNull(),
  recipient: text("recipient").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFriendshipSchema = createInsertSchema(friendshipsTable).omit({ id: true, createdAt: true });
export type InsertFriendship = z.infer<typeof insertFriendshipSchema>;
export type Friendship = typeof friendshipsTable.$inferSelect;
