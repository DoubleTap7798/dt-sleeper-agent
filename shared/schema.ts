import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, boolean, real } from "drizzle-orm/pg-core";
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
  bio: text("bio"),
  favoriteTeams: jsonb("favorite_teams"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  paypalSubscriptionId: text("paypal_subscription_id"),
  subscriptionSource: text("subscription_source"),
  subscriptionStatus: text("subscription_status"),
  subscriptionPeriodEnd: timestamp("subscription_period_end"),
  isGrandfathered: boolean("is_grandfathered").default(false),
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
  idpEnabled: boolean("idp_enabled").default(true).notNull(),
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

export const managerProfiles = pgTable("manager_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  leagueId: text("league_id").notNull(),
  profileData: jsonb("profile_data").notNull(),
  tradesAnalyzed: integer("trades_analyzed").default(0),
  transactionsAnalyzed: integer("transactions_analyzed").default(0),
  computedAt: timestamp("computed_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertManagerProfileSchema = createInsertSchema(managerProfiles).omit({
  id: true,
  computedAt: true,
  updatedAt: true,
});

export type ManagerProfile = typeof managerProfiles.$inferSelect;
export type InsertManagerProfile = z.infer<typeof insertManagerProfileSchema>;

export const simulationResults = pgTable("simulation_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  leagueId: text("league_id").notNull(),
  simulationType: text("simulation_type").notNull(),
  week: integer("week"),
  resultData: jsonb("result_data").notNull(),
  explanation: text("explanation"),
  computedAt: timestamp("computed_at").defaultNow(),
});

export const insertSimulationResultSchema = createInsertSchema(simulationResults).omit({
  id: true,
  computedAt: true,
});

export type SimulationResultRecord = typeof simulationResults.$inferSelect;
export type InsertSimulationResult = z.infer<typeof insertSimulationResultSchema>;

export const engineRiskProfiles = pgTable("engine_risk_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  leagueId: text("league_id").notNull(),
  classification: text("classification").notNull(),
  profileData: jsonb("profile_data").notNull(),
  computedAt: timestamp("computed_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertEngineRiskProfileSchema = createInsertSchema(engineRiskProfiles).omit({
  id: true,
  computedAt: true,
  updatedAt: true,
});

export type EngineRiskProfile = typeof engineRiskProfiles.$inferSelect;
export type InsertEngineRiskProfile = z.infer<typeof insertEngineRiskProfileSchema>;

export const portfolioSnapshots = pgTable("portfolio_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  leagueId: text("league_id").notNull(),
  snapshotData: jsonb("snapshot_data").notNull(),
  week: integer("week").notNull(),
  computedAt: timestamp("computed_at").defaultNow(),
});

export const insertPortfolioSnapshotSchema = createInsertSchema(portfolioSnapshots).omit({
  id: true,
  computedAt: true,
});

export type PortfolioSnapshot = typeof portfolioSnapshots.$inferSelect;
export type InsertPortfolioSnapshot = z.infer<typeof insertPortfolioSnapshotSchema>;

export const titleEquitySnapshots = pgTable("title_equity_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  leagueId: text("league_id").notNull(),
  week: integer("week").notNull(),
  championshipOdds: real("championship_odds").notNull(),
  playoffOdds: real("playoff_odds").notNull(),
  computedAt: timestamp("computed_at").defaultNow(),
});

export const insertTitleEquitySnapshotSchema = createInsertSchema(titleEquitySnapshots).omit({
  id: true,
  computedAt: true,
});

export type TitleEquitySnapshot = typeof titleEquitySnapshots.$inferSelect;
export type InsertTitleEquitySnapshot = z.infer<typeof insertTitleEquitySnapshotSchema>;

export const powerRankingSnapshots = pgTable("power_ranking_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leagueId: text("league_id").notNull(),
  rosterId: integer("roster_id").notNull(),
  compositeScore: real("composite_score").notNull(),
  championshipOdds: real("championship_odds").notNull(),
  rosterEV: real("roster_ev").notNull(),
  pickEV: real("pick_ev").notNull(),
  depthScore: real("depth_score").notNull(),
  liquidityScore: real("liquidity_score").notNull(),
  riskScore: real("risk_score").notNull(),
  snapshotWeek: integer("snapshot_week").notNull(),
  snapshotSeason: integer("snapshot_season").notNull(),
  mode: text("mode").default("dynasty").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPowerRankingSnapshotSchema = createInsertSchema(powerRankingSnapshots).omit({
  id: true,
  createdAt: true,
});

export type PowerRankingSnapshot = typeof powerRankingSnapshots.$inferSelect;
export type InsertPowerRankingSnapshot = z.infer<typeof insertPowerRankingSnapshotSchema>;

export const playerMarketMetrics = pgTable("player_market_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id").notNull(),
  playerName: text("player_name"),
  position: text("position"),
  team: text("team"),
  sentimentScore: real("sentiment_score").notNull().default(50),
  hypeVelocity: real("hype_velocity").notNull().default(0),
  demandIndex: real("demand_index").notNull().default(50),
  supplyIndex: real("supply_index").notNull().default(50),
  hypePremiumPct: real("hype_premium_pct").notNull().default(0),
  adjustedMarketValue: real("adjusted_market_value").notNull().default(0),
  baseDynastyValue: real("base_dynasty_value").notNull().default(0),
  marketHeatLevel: text("market_heat_level").notNull().default("NEUTRAL"),
  searchRank: integer("search_rank"),
  rosterPct: real("roster_pct"),
  volatility14d: real("volatility_14d").notNull().default(0),
  betaScore: real("beta_score").notNull().default(1),
  marketLabel: text("market_label"),
  trueSupply: real("true_supply").notNull().default(50),
  gapScore: real("gap_score").notNull().default(0),
  fundamentalRank: integer("fundamental_rank"),
  marketRank: integer("market_rank"),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const insertPlayerMarketMetricsSchema = createInsertSchema(playerMarketMetrics).omit({
  id: true,
  lastUpdated: true,
});

export type PlayerMarketMetrics = typeof playerMarketMetrics.$inferSelect;
export type InsertPlayerMarketMetrics = z.infer<typeof insertPlayerMarketMetricsSchema>;

export const marketIndexCache = pgTable("market_index_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leagueId: varchar("league_id"),
  dynastyMarketIndex: real("dynasty_market_index").notNull().default(0),
  dynastyVolatilityIndex: real("dynasty_volatility_index").notNull().default(0),
  avgHypePremium: real("avg_hype_premium").notNull().default(0),
  leagueTradeVolume7d: integer("league_trade_volume_7d").notNull().default(0),
  leagueAvgVolatility: real("league_avg_volatility").notNull().default(0),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const insertMarketIndexCacheSchema = createInsertSchema(marketIndexCache).omit({
  id: true,
  lastUpdated: true,
});

export type MarketIndexCache = typeof marketIndexCache.$inferSelect;
export type InsertMarketIndexCache = z.infer<typeof insertMarketIndexCacheSchema>;

export const drafts = pgTable("drafts", {
  draftId: varchar("draft_id").primaryKey(),
  leagueId: varchar("league_id").notNull(),
  type: text("type").notNull(),
  format: text("format").notNull(),
  status: text("status").notNull(),
  rounds: integer("rounds").notNull().default(0),
  teams: integer("teams").notNull().default(0),
  season: text("season"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDraftSchema = createInsertSchema(drafts).omit({
  createdAt: true,
});

export type Draft = typeof drafts.$inferSelect;
export type InsertDraft = z.infer<typeof insertDraftSchema>;

export const draftPicks = pgTable("draft_picks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  draftId: varchar("draft_id").notNull(),
  round: integer("round").notNull(),
  pickNo: integer("pick_no").notNull(),
  playerId: varchar("player_id").notNull(),
  playerName: text("player_name"),
  position: text("position"),
  pickedBy: varchar("picked_by"),
  pickedAt: timestamp("picked_at"),
});

export const insertDraftPickSchema = createInsertSchema(draftPicks).omit({
  id: true,
});

export type DraftPick = typeof draftPicks.$inferSelect;
export type InsertDraftPick = z.infer<typeof insertDraftPickSchema>;

export const draftAdp = pgTable("draft_adp", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id").notNull(),
  playerName: text("player_name"),
  position: text("position"),
  adpOverall: real("adp_overall"),
  adp1qb: real("adp_1qb"),
  adpSf: real("adp_sf"),
  adpTep: real("adp_tep"),
  sampleSize: integer("sample_size").notNull().default(0),
  sample1qb: integer("sample_1qb").notNull().default(0),
  sampleSf: integer("sample_sf").notNull().default(0),
  sampleTep: integer("sample_tep").notNull().default(0),
  rookiePickEq: text("rookie_pick_eq"),
  startupPickEq: text("startup_pick_eq"),
  ecr1qb: real("ecr_1qb"),
  ecrSf: real("ecr_sf"),
  consensusRank: real("consensus_rank"),
  dataSources: text("data_sources"),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const insertDraftAdpSchema = createInsertSchema(draftAdp).omit({
  id: true,
  lastUpdated: true,
});

export type DraftAdp = typeof draftAdp.$inferSelect;
export type InsertDraftAdp = z.infer<typeof insertDraftAdpSchema>;

export const pickValueCurve = pgTable("pick_value_curve", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pickNumber: integer("pick_number").notNull(),
  draftType: text("draft_type").notNull(),
  avgDynastyValue: real("avg_dynasty_value").notNull().default(0),
  sampleSize: integer("sample_size").notNull().default(0),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const insertPickValueCurveSchema = createInsertSchema(pickValueCurve).omit({
  id: true,
  lastUpdated: true,
});

export type PickValueCurve = typeof pickValueCurve.$inferSelect;
export type InsertPickValueCurve = z.infer<typeof insertPickValueCurveSchema>;

export const externalRankings = pgTable("external_rankings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerName: text("player_name").notNull(),
  position: text("position"),
  team: text("team"),
  source: text("source").notNull(),
  ecr1qb: real("ecr_1qb"),
  ecrSf: real("ecr_sf"),
  ecrPositional: real("ecr_positional"),
  value1qb: real("value_1qb"),
  valueSf: real("value_sf"),
  fpId: text("fp_id"),
  sleeperId: text("sleeper_id"),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const insertExternalRankingsSchema = createInsertSchema(externalRankings).omit({
  id: true,
  lastUpdated: true,
});

export type ExternalRanking = typeof externalRankings.$inferSelect;
export type InsertExternalRanking = z.infer<typeof insertExternalRankingsSchema>;
