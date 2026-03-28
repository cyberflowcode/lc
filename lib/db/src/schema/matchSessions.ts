import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const matchSessionsTable = pgTable("match_sessions", {
  id: serial("id").primaryKey(),
  matchId: text("match_id").notNull().unique(),
  user1: text("user1").notNull(),
  user2: text("user2").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export type MatchSession = typeof matchSessionsTable.$inferSelect;
