import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export auth and chat models
export * from "./models/auth";
export * from "./models/chat";

// User profiles with Sleeper integration and Stripe subscription
export const userProfiles = pgTable("user_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  sleeperUsername: text("sleeper_username"),
  sleeperUserId: text("sleeper_user_id"),
  selectedLeagueId: text("selected_league_id"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  paypalSubscriptionId: text("paypal_subscription_id"), // Legacy field (deprecated)
  subscriptionSource: text("subscription_source"), // 'stripe' or null
  subscriptionStatus: text("subscription_status"), // 'active', 'canceled', 'past_due', 'trialing', null
  subscriptionPeriodEnd: timestamp("subscription_period_end"),
  isGrandfathered: boolean("is_grandfathered").default(false), // Lifetime premium for early users
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

// League notifications for real-time updates
export const leagueNotifications = pgTable("league_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leagueId: text("league_id").notNull(),
  type: text("type").notNull(), // 'trade', 'waiver', 'free_agent', 'scoring_update'
  transactionId: text("transaction_id"), // Sleeper transaction ID to prevent duplicates
  title: text("title").notNull(),
  message: text("message").notNull(),
  metadata: jsonb("metadata"), // Additional data about the notification
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertLeagueNotificationSchema = createInsertSchema(leagueNotifications).omit({
  id: true,
  createdAt: true,
});

export type LeagueNotification = typeof leagueNotifications.$inferSelect;
export type InsertLeagueNotification = z.infer<typeof insertLeagueNotificationSchema>;

// Track which notifications a user has seen
export const userNotificationStatus = pgTable("user_notification_status", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  notificationId: varchar("notification_id").notNull(),
  readAt: timestamp("read_at").defaultNow(),
});

export type UserNotificationStatus = typeof userNotificationStatus.$inferSelect;

// Track last sync timestamp per league
export const leagueSyncStatus = pgTable("league_sync_status", {
  leagueId: varchar("league_id").primaryKey(),
  lastTransactionCheck: timestamp("last_transaction_check"),
  lastScoringCheck: timestamp("last_scoring_check"),
  lastKnownWeek: integer("last_known_week"),
});

export type LeagueSyncStatus = typeof leagueSyncStatus.$inferSelect;

// Track when users took over orphan leagues (to exclude previous owner stats)
export const userLeagueTakeover = pgTable("user_league_takeover", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  leagueId: text("league_id").notNull(), // The current/latest league ID in the dynasty chain
  takeoverSeason: integer("takeover_season").notNull(), // First season the user actually managed this team
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserLeagueTakeoverSchema = createInsertSchema(userLeagueTakeover).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UserLeagueTakeover = typeof userLeagueTakeover.$inferSelect;
export type InsertUserLeagueTakeover = z.infer<typeof insertUserLeagueTakeoverSchema>;

// Player watchlist for tracking value changes
export const playerWatchlist = pgTable("player_watchlist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  playerId: text("player_id").notNull(), // Sleeper player ID
  playerName: text("player_name").notNull(),
  position: text("position").notNull(),
  team: text("team"),
  valueAtAdd: integer("value_at_add").notNull(), // Dynasty value when added (0-100 scale)
  currentValue: integer("current_value").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPlayerWatchlistSchema = createInsertSchema(playerWatchlist).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PlayerWatchlist = typeof playerWatchlist.$inferSelect;
export type InsertPlayerWatchlist = z.infer<typeof insertPlayerWatchlistSchema>;

export const devyPortfolio = pgTable("devy_portfolio", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  playerName: text("player_name").notNull(),
  position: text("position").notNull(),
  school: text("school"),
  leagueId: text("league_id"),
  leagueName: text("league_name"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDevyPortfolioSchema = createInsertSchema(devyPortfolio).omit({
  id: true,
  createdAt: true,
});

export type DevyPortfolioEntry = typeof devyPortfolio.$inferSelect;
export type InsertDevyPortfolioEntry = z.infer<typeof insertDevyPortfolioSchema>;

export const leagueSettings = pgTable("league_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  leagueId: text("league_id").notNull(),
  devyEnabled: boolean("devy_enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertLeagueSettingsSchema = createInsertSchema(leagueSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type LeagueSettings = typeof leagueSettings.$inferSelect;
export type InsertLeagueSettings = z.infer<typeof insertLeagueSettingsSchema>;

export const friends = pgTable("friends", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requesterId: varchar("requester_id").notNull(),
  addresseeId: varchar("addressee_id").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertFriendSchema = createInsertSchema(friends).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Friend = typeof friends.$inferSelect;
export type InsertFriend = z.infer<typeof insertFriendSchema>;

export const userStats = pgTable("user_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  sleeperUserId: text("sleeper_user_id"),
  sleeperUsername: text("sleeper_username"),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  totalWins: integer("total_wins").default(0),
  totalLosses: integer("total_losses").default(0),
  totalTies: integer("total_ties").default(0),
  championships: integer("championships").default(0),
  runnerUps: integer("runner_ups").default(0),
  playoffAppearances: integer("playoff_appearances").default(0),
  bestFinish: integer("best_finish"),
  totalLeagues: integer("total_leagues").default(0),
  activeLeagues: integer("active_leagues").default(0),
  totalPointsFor: integer("total_points_for").default(0),
  dynastyValueRank: integer("dynasty_value_rank"),
  computedAt: timestamp("computed_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserStatsSchema = createInsertSchema(userStats).omit({
  id: true,
  createdAt: true,
});

export type UserStatsEntry = typeof userStats.$inferSelect;
export type InsertUserStats = z.infer<typeof insertUserStatsSchema>;

export const leagueFinances = pgTable("league_finances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  leagueId: text("league_id").notNull(),
  leagueName: text("league_name").notNull(),
  season: text("season").notNull(),
  type: text("type").notNull(),
  description: text("description").notNull(),
  amount: integer("amount").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertLeagueFinanceSchema = createInsertSchema(leagueFinances).omit({
  id: true,
  createdAt: true,
});

export type LeagueFinance = typeof leagueFinances.$inferSelect;
export type InsertLeagueFinance = z.infer<typeof insertLeagueFinanceSchema>;

export const weeklyPredictions = pgTable("weekly_predictions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  leagueId: text("league_id").notNull(),
  week: integer("week").notNull(),
  matchupId: integer("matchup_id").notNull(),
  predictedWinnerId: text("predicted_winner_id").notNull(),
  actualWinnerId: text("actual_winner_id"),
  correct: boolean("correct"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWeeklyPredictionSchema = createInsertSchema(weeklyPredictions).omit({
  id: true,
  createdAt: true,
});

export type WeeklyPrediction = typeof weeklyPredictions.$inferSelect;
export type InsertWeeklyPrediction = z.infer<typeof insertWeeklyPredictionSchema>;

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  username: text("username").notNull(),
  avatarUrl: text("avatar_url"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;

export const notificationPreferences = pgTable("notification_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  trades: boolean("trades").default(true),
  waivers: boolean("waivers").default(true),
  injuries: boolean("injuries").default(true),
  scoringUpdates: boolean("scoring_updates").default(true),
  freeAgents: boolean("free_agents").default(true),
  draftPicks: boolean("draft_picks").default(true),
  leagueAnnouncements: boolean("league_announcements").default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertNotificationPreferencesSchema = createInsertSchema(notificationPreferences).omit({
  id: true,
  updatedAt: true,
});

export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreference = z.infer<typeof insertNotificationPreferencesSchema>;
