import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export auth and chat models
export * from "./models/auth";
export * from "./models/chat";

// User profiles with Sleeper integration
export const userProfiles = pgTable("user_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  sleeperUsername: text("sleeper_username"),
  sleeperUserId: text("sleeper_user_id"),
  selectedLeagueId: text("selected_league_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;

// Cached league data
export const cachedLeagues = pgTable("cached_leagues", {
  id: varchar("id").primaryKey(),
  sleeperUserId: text("sleeper_user_id").notNull(),
  name: text("name").notNull(),
  season: text("season").notNull(),
  totalRosters: integer("total_rosters"),
  rosterPositions: jsonb("roster_positions"),
  scoringSettings: jsonb("scoring_settings"),
  playoffSettings: jsonb("playoff_settings"),
  status: text("status"),
  cachedAt: timestamp("cached_at").defaultNow(),
});

export type CachedLeague = typeof cachedLeagues.$inferSelect;

// Trade analysis cache
export const tradeAnalyses = pgTable("trade_analyses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leagueId: text("league_id").notNull(),
  teamAId: text("team_a_id").notNull(),
  teamBId: text("team_b_id").notNull(),
  teamAPlayers: jsonb("team_a_players").notNull(),
  teamBPlayers: jsonb("team_b_players").notNull(),
  teamAValue: integer("team_a_value").notNull(),
  teamBValue: integer("team_b_value").notNull(),
  grade: text("grade").notNull(),
  aiAnalysis: text("ai_analysis"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type TradeAnalysis = typeof tradeAnalyses.$inferSelect;
