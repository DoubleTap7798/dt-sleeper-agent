CREATE TABLE "cached_leagues" (
	"id" varchar PRIMARY KEY NOT NULL,
	"sleeper_user_id" text NOT NULL,
	"name" text NOT NULL,
	"season" text NOT NULL,
	"total_rosters" integer,
	"roster_positions" jsonb,
	"scoring_settings" jsonb,
	"playoff_settings" jsonb,
	"status" text,
	"cached_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"username" text NOT NULL,
	"avatar_url" text,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "devy_portfolio" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"player_name" text NOT NULL,
	"position" text NOT NULL,
	"school" text,
	"league_id" text,
	"league_name" text,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "draft_adp" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" varchar NOT NULL,
	"player_name" text,
	"position" text,
	"adp_overall" real,
	"adp_1qb" real,
	"adp_sf" real,
	"adp_tep" real,
	"sample_size" integer DEFAULT 0 NOT NULL,
	"sample_1qb" integer DEFAULT 0 NOT NULL,
	"sample_sf" integer DEFAULT 0 NOT NULL,
	"sample_tep" integer DEFAULT 0 NOT NULL,
	"rookie_pick_eq" text,
	"startup_pick_eq" text,
	"ecr_1qb" real,
	"ecr_sf" real,
	"consensus_rank" real,
	"data_sources" text,
	"draft_type" text,
	"last_updated" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "draft_picks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draft_id" varchar NOT NULL,
	"round" integer NOT NULL,
	"pick_no" integer NOT NULL,
	"player_id" varchar NOT NULL,
	"player_name" text,
	"position" text,
	"picked_by" varchar,
	"picked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "drafts" (
	"draft_id" varchar PRIMARY KEY NOT NULL,
	"league_id" varchar NOT NULL,
	"type" text NOT NULL,
	"format" text NOT NULL,
	"status" text NOT NULL,
	"rounds" integer DEFAULT 0 NOT NULL,
	"teams" integer DEFAULT 0 NOT NULL,
	"season" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "engine_risk_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"league_id" text NOT NULL,
	"classification" text NOT NULL,
	"profile_data" jsonb NOT NULL,
	"computed_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "external_rankings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_name" text NOT NULL,
	"position" text,
	"team" text,
	"source" text NOT NULL,
	"ecr_1qb" real,
	"ecr_sf" real,
	"ecr_positional" real,
	"value_1qb" real,
	"value_sf" real,
	"fp_id" text,
	"sleeper_id" text,
	"last_updated" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "friends" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" varchar NOT NULL,
	"addressee_id" varchar NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "league_finances" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"league_id" text NOT NULL,
	"league_name" text NOT NULL,
	"season" text NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "league_notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" text NOT NULL,
	"type" text NOT NULL,
	"transaction_id" text,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "league_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"league_id" text NOT NULL,
	"devy_enabled" boolean DEFAULT true NOT NULL,
	"idp_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "league_sync_status" (
	"league_id" varchar PRIMARY KEY NOT NULL,
	"last_transaction_check" timestamp,
	"last_scoring_check" timestamp,
	"last_known_week" integer
);
--> statement-breakpoint
CREATE TABLE "manager_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"league_id" text NOT NULL,
	"profile_data" jsonb NOT NULL,
	"trades_analyzed" integer DEFAULT 0,
	"transactions_analyzed" integer DEFAULT 0,
	"computed_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "market_index_cache" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" varchar,
	"dynasty_market_index" real DEFAULT 0 NOT NULL,
	"dynasty_volatility_index" real DEFAULT 0 NOT NULL,
	"avg_hype_premium" real DEFAULT 0 NOT NULL,
	"league_trade_volume_7d" integer DEFAULT 0 NOT NULL,
	"league_avg_volatility" real DEFAULT 0 NOT NULL,
	"last_updated" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"trades" boolean DEFAULT true,
	"waivers" boolean DEFAULT true,
	"injuries" boolean DEFAULT true,
	"scoring_updates" boolean DEFAULT true,
	"free_agents" boolean DEFAULT true,
	"draft_picks" boolean DEFAULT true,
	"league_announcements" boolean DEFAULT true,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "notification_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "pick_value_curve" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pick_number" integer NOT NULL,
	"draft_type" text NOT NULL,
	"avg_dynasty_value" real DEFAULT 0 NOT NULL,
	"sample_size" integer DEFAULT 0 NOT NULL,
	"last_updated" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "player_market_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" varchar NOT NULL,
	"player_name" text,
	"position" text,
	"team" text,
	"sentiment_score" real DEFAULT 50 NOT NULL,
	"hype_velocity" real DEFAULT 0 NOT NULL,
	"demand_index" real DEFAULT 50 NOT NULL,
	"supply_index" real DEFAULT 50 NOT NULL,
	"hype_premium_pct" real DEFAULT 0 NOT NULL,
	"adjusted_market_value" real DEFAULT 0 NOT NULL,
	"base_dynasty_value" real DEFAULT 0 NOT NULL,
	"market_heat_level" text DEFAULT 'NEUTRAL' NOT NULL,
	"search_rank" integer,
	"roster_pct" real,
	"volatility_14d" real DEFAULT 0 NOT NULL,
	"beta_score" real DEFAULT 1 NOT NULL,
	"market_label" text,
	"true_supply" real DEFAULT 50 NOT NULL,
	"gap_score" real DEFAULT 0 NOT NULL,
	"fundamental_rank" integer,
	"market_rank" integer,
	"last_updated" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "player_watchlist" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"player_id" text NOT NULL,
	"player_name" text NOT NULL,
	"position" text NOT NULL,
	"team" text,
	"value_at_add" integer NOT NULL,
	"current_value" integer NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portfolio_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"league_id" text NOT NULL,
	"snapshot_data" jsonb NOT NULL,
	"week" integer NOT NULL,
	"computed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "power_ranking_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" text NOT NULL,
	"roster_id" integer NOT NULL,
	"composite_score" real NOT NULL,
	"championship_odds" real NOT NULL,
	"roster_ev" real NOT NULL,
	"pick_ev" real NOT NULL,
	"depth_score" real NOT NULL,
	"liquidity_score" real NOT NULL,
	"risk_score" real NOT NULL,
	"snapshot_week" integer NOT NULL,
	"snapshot_season" integer NOT NULL,
	"mode" text DEFAULT 'dynasty' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "simulation_results" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"league_id" text NOT NULL,
	"simulation_type" text NOT NULL,
	"week" integer,
	"result_data" jsonb NOT NULL,
	"explanation" text,
	"computed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "title_equity_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"league_id" text NOT NULL,
	"week" integer NOT NULL,
	"championship_odds" real NOT NULL,
	"playoff_odds" real NOT NULL,
	"computed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "trade_analyses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" text NOT NULL,
	"team_a_id" text NOT NULL,
	"team_b_id" text NOT NULL,
	"team_a_players" jsonb NOT NULL,
	"team_b_players" jsonb NOT NULL,
	"team_a_value" integer NOT NULL,
	"team_b_value" integer NOT NULL,
	"grade" text NOT NULL,
	"ai_analysis" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_league_takeover" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"league_id" text NOT NULL,
	"takeover_season" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_notification_status" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"notification_id" varchar NOT NULL,
	"read_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"sleeper_username" text,
	"sleeper_user_id" text,
	"selected_league_id" text,
	"bio" text,
	"favorite_teams" jsonb,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"paypal_subscription_id" text,
	"subscription_source" text,
	"subscription_status" text,
	"subscription_period_end" timestamp,
	"is_grandfathered" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_stats" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"sleeper_user_id" text,
	"sleeper_username" text,
	"display_name" text,
	"avatar_url" text,
	"total_wins" integer DEFAULT 0,
	"total_losses" integer DEFAULT 0,
	"total_ties" integer DEFAULT 0,
	"championships" integer DEFAULT 0,
	"runner_ups" integer DEFAULT 0,
	"playoff_appearances" integer DEFAULT 0,
	"best_finish" integer,
	"total_leagues" integer DEFAULT 0,
	"active_leagues" integer DEFAULT 0,
	"total_points_for" integer DEFAULT 0,
	"dynasty_value_rank" integer,
	"computed_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "user_stats_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "weekly_predictions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"league_id" text NOT NULL,
	"week" integer NOT NULL,
	"matchup_id" integer NOT NULL,
	"predicted_winner_id" text NOT NULL,
	"actual_winner_id" text,
	"correct" boolean,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar NOT NULL,
	"password_hash" varchar NOT NULL,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"title" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");