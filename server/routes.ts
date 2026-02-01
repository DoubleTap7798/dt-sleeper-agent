import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import * as sleeperApi from "./sleeper-api";
import * as ktcValues from "./ktc-values";
import * as dynastyEngine from "./dynasty-value-engine";
import { dynastyConsensusService } from "./dynasty-consensus-service";
import * as newsService from "./news-service";
import * as oddsService from "./odds-service";
import * as playerStatsService from "./player-stats-service";
import OpenAI from "openai";
import { z } from "zod";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";

// Validation schemas
const connectSleeperSchema = z.object({
  username: z.string().min(1, "Username is required").max(100),
});

const selectLeagueSchema = z.object({
  leagueId: z.string().min(1, "League ID is required").or(z.literal("all")),
});

const tradeAssetSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["player", "pick"]),
  position: z.string().optional(),
  team: z.string().optional().nullable(),
  value: z.number(),
});

const analyzeTradeSchema = z.object({
  leagueId: z.string().min(1),
  teamAId: z.string().min(1),
  teamBId: z.string().min(1),
  teamAName: z.string().optional(),
  teamBName: z.string().optional(),
  teamAAssets: z.array(tradeAssetSchema),
  teamBAssets: z.array(tradeAssetSchema),
});

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // SEO Routes - serve before auth to ensure crawlers can access
  app.get("/robots.txt", (_req: Request, res: Response) => {
    const robotsTxt = `# DT Sleeper Agent - robots.txt
# https://dt-sleeper-agent.replit.app

User-agent: *
Allow: /

# Sitemap location
Sitemap: https://dt-sleeper-agent.replit.app/sitemap.xml

# Disallow API routes from indexing
Disallow: /api/
`;
    res.type("text/plain").send(robotsTxt);
  });

  // Plain text app info for AI review tools (bypasses robots.txt issues)
  app.get("/app-info", (_req: Request, res: Response) => {
    const appInfo = `DT Sleeper Agent - Fantasy Football Companion App
====================================================

OVERVIEW
--------
DT Sleeper Agent is a comprehensive companion application for Sleeper fantasy football dynasty leagues. It connects directly to your Sleeper account to provide advanced analytics, trade tools, and AI-powered recommendations.

URL: https://dt-sleeper-agent.replit.app

CORE FEATURES
-------------

1. TRADE CALCULATOR
   - Custom dynasty player values (0-100 scale)
   - Multi-year Value Over Replacement (VOR) algorithm
   - AI-powered trade analysis and recommendations
   - Factor analysis: age, injury risk, team context, draft capital

2. CAREER STATS DASHBOARD
   - Aggregated statistics across ALL historical seasons
   - Total W-L-T record, championships, runner-ups
   - Playoff appearances tracking
   - Season-by-season breakdown with navigation

3. LINEUP ADVICE
   - AI-powered start/sit recommendations
   - Matchup analysis with projected points
   - Confidence ratings and game script predictions
   - Smart swap suggestions

4. STANDINGS & PLAYOFFS
   - League standings with playoff predictions
   - Visual playoff bracket display
   - Clickable teams showing roster and draft picks

5. NEWS FEED
   - Real-time fantasy football news
   - AI-generated analysis with 5-minute refresh
   - Injury updates, trade rumors, waiver recommendations

6. WAIVER WIRE
   - Available players with stats
   - Position-specific analysis

7. NFL PLAYERS DATABASE
   - Player rankings by fantasy points
   - Snap percentages, position-specific stats
   - Click to view full player profile with:
     * Bio (height, weight, college, draft info)
     * Career stats and season history
     * Game logs and performance splits

8. DEVY RANKINGS
   - 200+ college prospect profiles
   - Players NOT yet drafted to NFL
   - AI scouting analysis
   - ESPN college stats integration
   - Draft eligibility tracking (2026-2028)

9. PLAYER TRENDS & COMPARISONS
   - Multi-season performance tracking
   - Year-over-year analysis
   - Side-by-side comparison tool (2-4 players)

10. ROS PROJECTIONS
    - Rest-of-season projections
    - AI-generated outlooks
    - Schedule strength and injury risk analysis

11. TROPHY ROOM
    - Champions display
    - All-time standings
    - Season records

12. RIVALRIES
    - Head-to-head records between teams
    - Historical matchup data

13. ORPHAN TEAM TAKEOVER
    - Exclude previous owner stats from career totals
    - Set takeover season for accurate tracking

TECHNICAL STACK
---------------
- Frontend: React + TypeScript + Vite
- Backend: Express.js + Node.js
- Database: PostgreSQL with Drizzle ORM
- Authentication: Replit Auth (OpenID Connect)
- AI: OpenAI integration for analysis
- APIs: Sleeper API, ESPN API

DESIGN
------
- Modern tech theme with black background
- Electric blue/cyan accent color (#00D4FF)
- Glow effects on interactive elements
- PWA-enabled for mobile app install

INTEGRATIONS
------------
- Sleeper API: League data, rosters, matchups
- ESPN API: Player stats, game logs, career data
- OpenAI: Trade analysis, lineup advice, news generation

Created for fantasy football enthusiasts who want advanced tools to dominate their dynasty leagues.
`;
    res.type("text/plain").send(appInfo);
  });

  app.get("/sitemap.xml", (_req: Request, res: Response) => {
    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://dt-sleeper-agent.replit.app/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://dt-sleeper-agent.replit.app/standings</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://dt-sleeper-agent.replit.app/matchups</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://dt-sleeper-agent.replit.app/roster</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://dt-sleeper-agent.replit.app/trade</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://dt-sleeper-agent.replit.app/devy</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://dt-sleeper-agent.replit.app/players</loc>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://dt-sleeper-agent.replit.app/waiver</loc>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://dt-sleeper-agent.replit.app/news</loc>
    <changefreq>hourly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://dt-sleeper-agent.replit.app/lineup</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://dt-sleeper-agent.replit.app/trophies</loc>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://dt-sleeper-agent.replit.app/rivalries</loc>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://dt-sleeper-agent.replit.app/schedule</loc>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://dt-sleeper-agent.replit.app/playoff-bracket</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://dt-sleeper-agent.replit.app/trends</loc>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://dt-sleeper-agent.replit.app/projections</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://dt-sleeper-agent.replit.app/compare</loc>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>
</urlset>`;
    res.type("application/xml").send(sitemapXml);
  });

  // Setup authentication
  await setupAuth(app);
  registerAuthRoutes(app);

  // Helper to check if user has active subscription
  async function hasActiveSubscription(userId: string): Promise<boolean> {
    const profile = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).limit(1);
    if (!profile[0]) return false;
    
    const { subscriptionStatus, subscriptionPeriodEnd } = profile[0];
    if (subscriptionStatus !== 'active' && subscriptionStatus !== 'trialing') return false;
    if (subscriptionPeriodEnd && new Date(subscriptionPeriodEnd) < new Date()) return false;
    return true;
  }

  // Subscription middleware - returns 403 if no active subscription
  const requireSubscription = async (req: any, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const hasAccess = await hasActiveSubscription(userId);
      if (!hasAccess) {
        return res.status(403).json({ 
          error: "Premium subscription required",
          code: "SUBSCRIPTION_REQUIRED"
        });
      }
      next();
    } catch (error) {
      console.error("Subscription check error:", error);
      return res.status(500).json({ error: "Failed to verify subscription" });
    }
  };

  // Stripe subscription routes
  app.get("/api/stripe/publishable-key", async (_req: Request, res: Response) => {
    try {
      const key = await getStripePublishableKey();
      res.json({ publishableKey: key });
    } catch (error) {
      console.error("Error getting publishable key:", error);
      res.status(500).json({ error: "Failed to get Stripe key" });
    }
  });

  app.get("/api/subscription/status", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).limit(1);
      
      if (!profile[0]) {
        return res.json({ 
          hasSubscription: false,
          status: null,
          periodEnd: null
        });
      }

      const { subscriptionStatus, subscriptionPeriodEnd, stripeSubscriptionId } = profile[0];
      const isActive = subscriptionStatus === 'active' || subscriptionStatus === 'trialing';
      const periodEnd = subscriptionPeriodEnd ? new Date(subscriptionPeriodEnd) : null;
      const isValid = isActive && (!periodEnd || periodEnd > new Date());

      res.json({
        hasSubscription: isValid,
        status: subscriptionStatus,
        periodEnd: subscriptionPeriodEnd,
        subscriptionId: stripeSubscriptionId
      });
    } catch (error) {
      console.error("Error checking subscription:", error);
      res.status(500).json({ error: "Failed to check subscription" });
    }
  });

  app.post("/api/subscription/create-checkout", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { priceId } = req.body;

      if (!priceId) {
        return res.status(400).json({ error: "Price ID required" });
      }

      const stripe = await getUncachableStripeClient();

      // Get or create user profile
      let profile = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).limit(1);
      
      let customerId = profile[0]?.stripeCustomerId;

      // Create Stripe customer if needed
      if (!customerId) {
        const customer = await stripe.customers.create({
          metadata: { userId }
        });
        customerId = customer.id;

        if (profile[0]) {
          await db.update(schema.userProfiles)
            .set({ stripeCustomerId: customerId })
            .where(eq(schema.userProfiles.userId, userId));
        } else {
          await db.insert(schema.userProfiles).values({
            userId,
            stripeCustomerId: customerId
          });
        }
      }

      // Create checkout session
      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        success_url: `${baseUrl}/upgrade?success=true`,
        cancel_url: `${baseUrl}/upgrade?canceled=true`,
        metadata: { userId }
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Error creating checkout:", error);
      res.status(500).json({ error: error.message || "Failed to create checkout session" });
    }
  });

  app.post("/api/subscription/create-portal", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      
      const profile = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).limit(1);
      
      if (!profile[0]?.stripeCustomerId) {
        return res.status(400).json({ error: "No subscription found" });
      }

      const stripe = await getUncachableStripeClient();
      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
      
      const session = await stripe.billingPortal.sessions.create({
        customer: profile[0].stripeCustomerId,
        return_url: `${baseUrl}/settings`
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Error creating portal:", error);
      res.status(500).json({ error: error.message || "Failed to create portal session" });
    }
  });

  // Get available prices
  app.get("/api/subscription/prices", async (_req: Request, res: Response) => {
    try {
      const result = await db.execute(sql`
        SELECT p.id, p.name, p.description, pr.id as price_id, pr.unit_amount, pr.currency, pr.recurring
        FROM stripe.products p
        JOIN stripe.prices pr ON pr.product = p.id
        WHERE p.active = true AND pr.active = true
        ORDER BY pr.unit_amount
      `);
      
      res.json({ prices: result.rows });
    } catch (error) {
      console.error("Error fetching prices:", error);
      res.status(500).json({ error: "Failed to fetch prices" });
    }
  });

  // Webhook handler for subscription updates
  app.post("/api/subscription/webhook-sync", async (req: Request, res: Response) => {
    try {
      // This endpoint syncs subscription status from Stripe tables to user profiles
      const { customerId, subscriptionId } = req.body;
      
      if (!customerId) {
        return res.status(400).json({ error: "Customer ID required" });
      }

      // Find subscription in stripe schema
      const subResult = await db.execute(sql`
        SELECT id, status, current_period_end 
        FROM stripe.subscriptions 
        WHERE customer = ${customerId}
        ORDER BY created DESC
        LIMIT 1
      `);

      const subscription = subResult.rows[0] as any;
      
      if (!subscription) {
        return res.json({ synced: false, message: "No subscription found" });
      }

      // Find user by stripe customer ID and update
      await db.update(schema.userProfiles)
        .set({
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          subscriptionPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null
        })
        .where(eq(schema.userProfiles.stripeCustomerId, customerId));

      res.json({ synced: true });
    } catch (error) {
      console.error("Error syncing subscription:", error);
      res.status(500).json({ error: "Failed to sync subscription" });
    }
  });

  // User Profile Routes
  app.get("/api/user/profile", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getUserProfile(userId);
      
      if (!profile) {
        return res.json({
          sleeperUsername: null,
          sleeperUserId: null,
          selectedLeagueId: null,
        });
      }
      
      res.json({
        sleeperUsername: profile.sleeperUsername,
        sleeperUserId: profile.sleeperUserId,
        selectedLeagueId: profile.selectedLeagueId,
      });
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  app.post("/api/user/select-league", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = selectLeagueSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid request" });
      }

      await storage.updateSelectedLeague(userId, parsed.data.leagueId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating selected league:", error);
      res.status(500).json({ message: "Failed to update selected league" });
    }
  });

  // Sleeper Connection
  app.post("/api/sleeper/connect", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = connectSleeperSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid request" });
      }

      const sleeperUser = await sleeperApi.getSleeperUser(parsed.data.username);
      if (!sleeperUser) {
        return res.status(404).json({ message: "Sleeper username not found" });
      }

      await storage.upsertUserProfile({
        userId,
        sleeperUsername: sleeperUser.username,
        sleeperUserId: sleeperUser.user_id,
      });

      res.json({
        success: true,
        sleeperUsername: sleeperUser.username,
        sleeperUserId: sleeperUser.user_id,
      });
    } catch (error) {
      console.error("Error connecting Sleeper account:", error);
      res.status(500).json({ message: "Failed to connect Sleeper account" });
    }
  });

  // Get user's leagues
  app.get("/api/sleeper/leagues", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getUserProfile(userId);

      if (!profile?.sleeperUserId) {
        return res.json([]);
      }

      const state = await sleeperApi.getState();
      // Use league_season (2026) for dynasty leagues that have rolled over, not season (2025 NFL playoffs)
      const leagueSeason = state?.league_season || state?.season || "2026";
      const leagues = await sleeperApi.getUserLeagues(profile.sleeperUserId, leagueSeason);

      res.json(leagues);
    } catch (error) {
      console.error("Error fetching leagues:", error);
      res.status(500).json({ message: "Failed to fetch leagues" });
    }
  });

  // Get league transactions
  app.get("/api/sleeper/transactions/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      
      const state = await sleeperApi.getState();
      const currentWeek = state?.week || 1;
      
      // Get transactions from the last few weeks
      const weeksToCheck = [];
      for (let w = currentWeek; w >= Math.max(1, currentWeek - 3); w--) {
        weeksToCheck.push(w);
      }
      
      const transactionPromises = weeksToCheck.map(week => sleeperApi.getLeagueTransactions(leagueId, week));
      const transactionArrays = await Promise.all(transactionPromises);
      const allTransactions = transactionArrays.flat();
      
      // Sort by timestamp descending
      allTransactions.sort((a, b) => (b.status_updated || b.created || 0) - (a.status_updated || a.created || 0));
      
      res.json({ transactions: allTransactions.slice(0, 20) });
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Get league info (settings and scoring)
  app.get("/api/sleeper/league-info/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      const league = await sleeperApi.getLeague(leagueId);
      
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      // Parse roster positions to count each slot type
      const rosterPositions = league.roster_positions || [];
      const positionCounts: Record<string, number> = {};
      const starterPositions: string[] = [];
      const benchCount = rosterPositions.filter(p => p === "BN").length;
      
      rosterPositions.forEach(pos => {
        if (pos !== "BN") {
          starterPositions.push(pos);
        }
        positionCounts[pos] = (positionCounts[pos] || 0) + 1;
      });

      // Format scoring settings into readable categories - comprehensive mapping
      const scoring = league.scoring_settings || {};
      
      // Track which keys we've mapped to identify custom/unmapped settings
      const mappedKeys = new Set<string>();
      const getValue = (key: string): number => {
        mappedKeys.add(key);
        return scoring[key] ?? 0;
      };
      
      // Safe fallback that checks for undefined (not just falsy 0)
      const getValueWithFallback = (primary: string, fallback: string): number => {
        mappedKeys.add(primary);
        mappedKeys.add(fallback);
        if (scoring[primary] !== undefined) return scoring[primary];
        if (scoring[fallback] !== undefined) return scoring[fallback];
        return 0;
      };
      
      const scoringCategories = {
        passing: {
          passYards: getValue('pass_yd'),
          passTd: getValue('pass_td'),
          passInt: getValue('pass_int'),
          pass2pt: getValue('pass_2pt'),
          passFd: getValue('pass_fd'),
          passAtt: getValue('pass_att'),
          passCmp: getValue('pass_cmp'),
          passInc: getValue('pass_inc'),
          passSack: getValue('pass_sack'),
          passCmp40p: getValue('pass_cmp_40p'),
          passIntTd: getValue('pass_int_td'),
        },
        rushing: {
          rushYards: getValue('rush_yd'),
          rushTd: getValue('rush_td'),
          rush2pt: getValue('rush_2pt'),
          rushFd: getValue('rush_fd'),
          rushAtt: getValue('rush_att'),
          rush40p: getValue('rush_40p'),
        },
        receiving: {
          reception: getValue('rec'),
          recYards: getValue('rec_yd'),
          recTd: getValue('rec_td'),
          rec2pt: getValue('rec_2pt'),
          recFd: getValue('rec_fd'),
          rec40p: getValue('rec_40p'),
          bonusRecTe: getValue('bonus_rec_te'),
          bonusRecRb: getValue('bonus_rec_rb'),
          bonusRecWr: getValue('bonus_rec_wr'),
        },
        bonuses: {
          bonus100RushYards: getValue('bonus_rush_yd_100'),
          bonus200RushYards: getValue('bonus_rush_yd_200'),
          bonus100RecYards: getValue('bonus_rec_yd_100'),
          bonus200RecYards: getValue('bonus_rec_yd_200'),
          bonus300PassYards: getValue('bonus_pass_yd_300'),
          bonus400PassYards: getValue('bonus_pass_yd_400'),
          bonus40RushTd: getValue('bonus_rush_td_40p'),
          bonus50RushTd: getValue('bonus_rush_td_50p'),
          bonus40RecTd: getValue('bonus_rec_td_40p'),
          bonus50RecTd: getValue('bonus_rec_td_50p'),
          bonus40PassTd: getValue('bonus_pass_td_40p'),
          bonus50PassTd: getValue('bonus_pass_td_50p'),
        },
        misc: {
          fumble: getValue('fum'),
          fumbleLost: getValue('fum_lost'),
          fumbleRec: getValue('fum_rec'),
          fumbleRecTd: getValue('fum_rec_td'),
        },
        dst: {
          sack: getValueWithFallback('sack', 'def_sack'),
          interception: getValueWithFallback('def_int', 'int'),
          fumbleRecovery: getValueWithFallback('def_st_fum_rec', 'fum_rec'),
          forcedFumble: getValueWithFallback('def_st_ff', 'ff'),
          td: getValueWithFallback('def_td', 'def_st_td'),
          safety: getValueWithFallback('safe', 'def_safe'),
          blockedKick: getValueWithFallback('blk_kick', 'def_blk_kick'),
          ptsAllow0: getValue('pts_allow_0'),
          ptsAllow1_6: getValue('pts_allow_1_6'),
          ptsAllow7_13: getValue('pts_allow_7_13'),
          ptsAllow14_20: getValue('pts_allow_14_20'),
          ptsAllow21_27: getValue('pts_allow_21_27'),
          ptsAllow28_34: getValue('pts_allow_28_34'),
          ptsAllow35p: getValue('pts_allow_35p'),
        },
        idp: {
          idpTkl: getValueWithFallback('idp_tkl', 'tkl'),
          idpTklSolo: getValueWithFallback('idp_tkl_solo', 'tkl_solo'),
          idpTklAst: getValueWithFallback('idp_tkl_ast', 'tkl_ast'),
          idpTklLoss: getValueWithFallback('idp_tkl_loss', 'tkl_loss'),
          idpSack: getValue('idp_sack'),
          idpQbHit: getValueWithFallback('idp_qb_hit', 'qb_hit'),
          idpInt: getValue('idp_int'),
          idpPassDef: getValueWithFallback('idp_pass_def', 'pass_def'),
          idpFf: getValue('idp_ff'),
          idpFumRec: getValue('idp_fum_rec'),
          idpTd: getValueWithFallback('idp_def_td', 'def_td'),
          idpSafe: getValue('idp_safe'),
        },
        kicking: {
          fgMade: getValue('fgm'),
          fgMissed: getValue('fgmiss'),
          fgMade0_19: getValue('fgm_0_19'),
          fgMade20_29: getValue('fgm_20_29'),
          fgMade30_39: getValue('fgm_30_39'),
          fgMade40_49: getValue('fgm_40_49'),
          fgMade50p: getValue('fgm_50p'),
          xpMade: getValue('xpm'),
          xpMissed: getValue('xpmiss'),
        },
        specialTeams: {
          krTd: getValue('kr_td'),
          prTd: getValue('pr_td'),
          stTd: getValue('st_td'),
          stFf: getValue('st_ff'),
          stFumRec: getValue('st_fum_rec'),
        },
      };
      
      // Find any unmapped scoring settings (custom league settings)
      const unmappedScoring: Record<string, number> = {};
      Object.entries(scoring).forEach(([key, value]) => {
        if (!mappedKeys.has(key) && typeof value === 'number' && value !== 0) {
          unmappedScoring[key] = value;
        }
      });

      // Determine league format (Redraft, Keeper, Dynasty)
      const leagueType = league.settings?.type || 0;
      let format = "Redraft";
      if (leagueType === 1) format = "Keeper";
      if (leagueType === 2) format = "Dynasty";

      // Determine waiver type
      const waiverType = league.settings?.waiver_type || 0;
      let waiverSystem = "Normal";
      if (waiverType === 1) waiverSystem = "Rolling";
      if (waiverType === 2) waiverSystem = "FAAB";

      // Detect if league has IDP positions
      const idpPositionTypes = ["DL", "LB", "DB", "DE", "DT", "CB", "S", "IDP_FLEX", "ILB", "OLB", "MLB", "NT", "FS", "SS", "ED"];
      const isIDPLeague = starterPositions.some(pos => idpPositionTypes.includes(pos));

      res.json({
        leagueId: league.league_id,
        name: league.name,
        season: league.season,
        status: league.status,
        avatar: league.avatar,
        format,
        totalTeams: league.total_rosters,
        isIDPLeague,
        rosterSettings: {
          starterPositions,
          positionCounts,
          benchCount,
          totalStarters: starterPositions.length,
          totalRoster: rosterPositions.length,
        },
        leagueSettings: {
          playoffTeams: league.settings?.playoff_teams || 6,
          playoffWeekStart: league.settings?.playoff_week_start || 15,
          tradeDeadline: league.settings?.trade_deadline || 0,
          waiverSystem,
          waiverBudget: league.settings?.waiver_budget || 100,
        },
        scoringCategories,
        unmappedScoring,
        rawScoring: scoring,
      });
    } catch (error) {
      console.error("Error fetching league info:", error);
      res.status(500).json({ message: "Failed to fetch league info" });
    }
  });

  // Get league standings
  app.get("/api/sleeper/standings/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;

      const [league, rosters, users, state] = await Promise.all([
        sleeperApi.getLeague(leagueId),
        sleeperApi.getLeagueRosters(leagueId),
        sleeperApi.getLeagueUsers(leagueId),
        sleeperApi.getState(),
      ]);

      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      const userMap = new Map(users.map((u) => [u.user_id, u]));
      const playoffTeams = league.settings?.playoff_teams || 6;
      const currentWeek = state?.week || 1;

      // Calculate playoff odds
      const playoffOdds = sleeperApi.calculatePlayoffOdds(rosters, playoffTeams, currentWeek);

      // Build standings
      const standings = rosters
        .map((roster) => {
          const user = userMap.get(roster.owner_id);
          const fpts = (roster.settings.fpts || 0) + (roster.settings.fpts_decimal || 0) / 100;
          const fptsAgainst = (roster.settings.fpts_against || 0) + (roster.settings.fpts_against_decimal || 0) / 100;
          const maxPts = (roster.settings.ppts || 0) + (roster.settings.ppts_decimal || 0) / 100;
          const totalGames = (roster.settings.wins || 0) + (roster.settings.losses || 0) + (roster.settings.ties || 0);

          // Calculate waiver budget remaining (FAAB)
          const totalBudget = league.settings?.waiver_budget || 100;
          const budgetUsed = roster.settings?.waiver_budget_used || 0;
          const waiverBudget = totalBudget - budgetUsed;

          return {
            rosterId: roster.roster_id,
            ownerId: roster.owner_id,
            ownerName: user?.display_name || user?.username || "Unknown",
            avatar: sleeperApi.getAvatarUrl(user?.avatar || null),
            wins: roster.settings.wins || 0,
            losses: roster.settings.losses || 0,
            ties: roster.settings.ties || 0,
            pointsFor: fpts,
            pointsAgainst: fptsAgainst,
            maxPoints: maxPts,
            winPercentage: totalGames > 0 ? (roster.settings.wins || 0) / totalGames : 0,
            playoffOdds: playoffOdds.get(roster.roster_id) || 50,
            waiverBudget,
            waiverPosition: roster.settings?.waiver_position || 0,
          };
        })
        .sort((a, b) => {
          if (a.wins !== b.wins) return b.wins - a.wins;
          return b.pointsFor - a.pointsFor;
        });

      res.json({
        standings,
        playoffTeams,
        currentWeek,
      });
    } catch (error) {
      console.error("Error fetching standings:", error);
      res.status(500).json({ message: "Failed to fetch standings" });
    }
  });

  // Get waiver wire players
  app.get("/api/sleeper/waivers/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;

      const [rosters, allPlayers, state] = await Promise.all([
        sleeperApi.getLeagueRosters(leagueId),
        sleeperApi.getAllPlayers(),
        sleeperApi.getState(),
      ]);

      if (!rosters || !allPlayers) {
        return res.json({ players: [], week: state?.week || 1 });
      }

      // Get all rostered player IDs
      const rosteredPlayers = new Set<string>();
      rosters.forEach((roster) => {
        (roster.players || []).forEach((p) => rosteredPlayers.add(p));
        (roster.reserve || []).forEach((p) => rosteredPlayers.add(p));
        (roster.taxi || []).forEach((p) => rosteredPlayers.add(p));
      });

      // Filter to available players
      const availablePlayers = Object.entries(allPlayers)
        .filter(([playerId, player]: [string, any]) => {
          if (rosteredPlayers.has(playerId)) return false;
          if (!player.fantasy_positions?.length) return false;
          const pos = player.fantasy_positions[0];
          return ["QB", "RB", "WR", "TE", "K", "DEF"].includes(pos);
        })
        .map(([playerId, player]: [string, any]) => ({
          playerId,
          name: player.full_name || `${player.first_name} ${player.last_name}`,
          position: player.fantasy_positions?.[0] || "?",
          team: player.team,
          age: player.age,
          status: player.status || "Active",
          injuryStatus: player.injury_status,
          seasonPoints: Math.random() * 150, // Placeholder - would come from stats API
          avgPoints: Math.random() * 12,
          lastWeekPoints: Math.random() * 25,
          projectedPoints: Math.random() * 15,
          percentRostered: Math.floor(Math.random() * 30),
        }))
        .sort((a, b) => b.avgPoints - a.avgPoints)
        .slice(0, 200);

      res.json({
        players: availablePlayers,
        week: state?.week || 1,
      });
    } catch (error) {
      console.error("Error fetching waivers:", error);
      res.status(500).json({ message: "Failed to fetch waiver wire" });
    }
  });

  // Get personalized waiver recommendations based on roster needs
  app.get("/api/fantasy/waiver-recommendations/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      const userId = req.user.claims.sub;

      // Get user profile to find their Sleeper ID
      const userProfile = await storage.getUserProfile(userId);
      if (!userProfile?.sleeperUserId) {
        return res.status(400).json({ message: "No Sleeper account connected" });
      }

      const [league, rosters, users, allPlayers, state] = await Promise.all([
        sleeperApi.getLeague(leagueId),
        sleeperApi.getLeagueRosters(leagueId),
        sleeperApi.getLeagueUsers(leagueId),
        sleeperApi.getAllPlayers(),
        sleeperApi.getState(),
      ]);

      if (!rosters || !allPlayers) {
        return res.json({ recommendations: [], needs: [] });
      }

      // Find user's roster
      const userMap = new Map((users || []).map((u) => [u.user_id, u]));
      const userRoster = rosters.find((r) => {
        const owner = userMap.get(r.owner_id);
        return r.owner_id === userProfile.sleeperUserId || owner?.user_id === userProfile.sleeperUserId;
      });

      if (!userRoster) {
        return res.json({ recommendations: [], needs: [] });
      }

      // Get all rostered player IDs across all teams
      const rosteredPlayers = new Set<string>();
      rosters.forEach((roster) => {
        (roster.players || []).forEach((p: string) => rosteredPlayers.add(p));
        (roster.reserve || []).forEach((p: string) => rosteredPlayers.add(p));
        (roster.taxi || []).forEach((p: string) => rosteredPlayers.add(p));
      });

      // Analyze user's roster by position (include players, taxi, reserve)
      const positionCounts: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
      const positionStrengths: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
      const userPlayerIds = [
        ...(userRoster.players || []),
        ...(userRoster.taxi || []),
        ...(userRoster.reserve || []),
      ];

      for (const playerId of userPlayerIds) {
        const player = allPlayers[playerId];
        if (!player) continue;
        const pos = player.fantasy_positions?.[0];
        if (pos && positionCounts[pos] !== undefined) {
          positionCounts[pos]++;
          // Calculate strength based on player quality (use dynasty value if available)
          const value = dynastyEngine.getQuickPlayerValue(
            playerId,
            pos,
            player.age || 25,
            player.years_exp || 0,
            player.injury_status || null,
            { points: 0, games: 0, ppg: 0 },
            1,
            null
          );
          positionStrengths[pos] += value;
        }
      }

      // Determine position needs (lower strength = higher need)
      const positionNeeds: { position: string; need: number; count: number }[] = [];
      const idealCounts: Record<string, number> = { QB: 2, RB: 5, WR: 5, TE: 2 };
      
      for (const pos of ["QB", "RB", "WR", "TE"]) {
        const countRatio = positionCounts[pos] / idealCounts[pos];
        const avgStrength = positionCounts[pos] > 0 ? positionStrengths[pos] / positionCounts[pos] : 0;
        // Need = inverse of depth + quality
        const need = Math.max(0, 100 - (countRatio * 30 + avgStrength * 0.7));
        positionNeeds.push({ position: pos, need, count: positionCounts[pos] });
      }
      positionNeeds.sort((a, b) => b.need - a.need);

      // Get available players and score them based on roster fit
      const recommendations = Object.entries(allPlayers)
        .filter(([playerId, player]: [string, any]) => {
          if (rosteredPlayers.has(playerId)) return false;
          if (!player.fantasy_positions?.length) return false;
          const pos = player.fantasy_positions[0];
          return ["QB", "RB", "WR", "TE"].includes(pos) && player.team; // Must be on NFL team
        })
        .map(([playerId, player]: [string, any]) => {
          const pos = player.fantasy_positions[0];
          const playerValue = dynastyEngine.getQuickPlayerValue(
            playerId,
            pos,
            player.age || 25,
            player.years_exp || 0,
            player.injury_status || null,
            { points: 0, games: 0, ppg: 0 },
            1,
            null
          );
          const positionNeed = positionNeeds.find(p => p.position === pos);
          
          // Calculate fit score: combines player value with position need bonus
          // Need bonus ranges from 0 to 20 based on position need level
          const needBonus = positionNeed ? (positionNeed.need / 100) * 20 : 0;
          const fitScore = Math.round(Math.min(100, playerValue + needBonus));
          
          return {
            playerId,
            name: player.full_name || `${player.first_name} ${player.last_name}`,
            position: pos,
            team: player.team,
            age: player.age,
            injuryStatus: player.injury_status,
            dynastyValue: Math.round(playerValue * 10) / 10,
            fitScore,
            needLevel: positionNeed?.need ? (positionNeed.need >= 70 ? "high" : positionNeed.need >= 40 ? "medium" : "low") : "low",
            reason: positionNeed && positionNeed.need >= 50 
              ? `Fills ${pos} need (only ${positionNeed.count} on roster)` 
              : playerValue >= 30 
                ? `High-value upside player` 
                : `Depth/handcuff option`,
          };
        })
        .filter(p => p.fitScore >= 10 && p.dynastyValue >= 5) // Only include players with decent value
        .sort((a, b) => b.fitScore - a.fitScore)
        .slice(0, 20);

      res.json({
        recommendations,
        needs: positionNeeds.map(p => ({
          position: p.position,
          level: p.need >= 70 ? "high" : p.need >= 40 ? "medium" : "low",
          count: p.count,
        })),
        week: state?.week || 1,
      });
    } catch (error) {
      console.error("Error fetching waiver recommendations:", error);
      res.status(500).json({ message: "Failed to fetch recommendations" });
    }
  });

  // ===== PLAYER SEARCH ENDPOINT =====

  // Search players for watchlist add dialog
  app.get("/api/fantasy/players", isAuthenticated, async (req: any, res: Response) => {
    try {
      const search = (req.query.search as string)?.toLowerCase() || "";
      const limit = parseInt(req.query.limit as string) || 20;

      const allPlayers = await sleeperApi.getAllPlayers();
      if (!allPlayers) {
        return res.json({ players: [] });
      }

      const results = Object.entries(allPlayers)
        .filter(([playerId, player]: [string, any]) => {
          if (!player.fantasy_positions?.length) return false;
          const pos = player.fantasy_positions[0];
          if (!["QB", "RB", "WR", "TE"].includes(pos)) return false;
          
          const name = (player.full_name || `${player.first_name} ${player.last_name}`).toLowerCase();
          return name.includes(search) && player.team; // Must be on NFL team
        })
        .map(([playerId, player]: [string, any]) => ({
          id: playerId,
          name: player.full_name || `${player.first_name} ${player.last_name}`,
          position: player.fantasy_positions[0],
          team: player.team,
          age: player.age,
          dynastyValue: Math.round(dynastyEngine.getQuickPlayerValue(
            playerId,
            player.fantasy_positions[0],
            player.age || 25,
            player.years_exp || 0,
            player.injury_status || null,
            { points: 0, games: 0, ppg: 0 },
            1,
            null
          )),
        }))
        .sort((a, b) => b.dynastyValue - a.dynastyValue)
        .slice(0, limit);

      res.json({ players: results });
    } catch (error) {
      console.error("Error searching players:", error);
      res.status(500).json({ message: "Failed to search players" });
    }
  });

  // ===== PLAYER WATCHLIST ENDPOINTS =====

  // Get user's watchlist
  app.get("/api/watchlist", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      
      const watchlistItems = await db
        .select()
        .from(schema.playerWatchlist)
        .where(eq(schema.playerWatchlist.userId, userId))
        .orderBy(desc(schema.playerWatchlist.createdAt));

      // Update current values
      const allPlayers = await sleeperApi.getAllPlayers();
      const updatedItems = watchlistItems.map(item => {
        const player = allPlayers?.[item.playerId];
        const currentValue = player ? Math.round(dynastyEngine.getQuickPlayerValue(
          item.playerId,
          player.position || item.position,
          player.age || 25,
          player.years_exp || 0,
          player.injury_status || null,
          { points: 0, games: 0, ppg: 0 },
          1,
          null
        )) : item.currentValue;
        const valueChange = currentValue - item.valueAtAdd;
        return {
          ...item,
          currentValue,
          valueChange,
          team: player?.team || item.team,
        };
      });

      res.json({ watchlist: updatedItems });
    } catch (error) {
      console.error("Error fetching watchlist:", error);
      res.status(500).json({ message: "Failed to fetch watchlist" });
    }
  });

  // Add player to watchlist
  app.post("/api/watchlist", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { playerId, notes } = req.body;

      if (!playerId) {
        return res.status(400).json({ message: "Player ID is required" });
      }

      // Check if already in watchlist
      const existing = await db
        .select()
        .from(schema.playerWatchlist)
        .where(and(
          eq(schema.playerWatchlist.userId, userId),
          eq(schema.playerWatchlist.playerId, playerId)
        ))
        .limit(1);

      if (existing.length > 0) {
        return res.status(400).json({ message: "Player already in watchlist" });
      }

      // Get player info
      const allPlayers = await sleeperApi.getAllPlayers();
      const player = allPlayers?.[playerId];
      
      if (!player) {
        return res.status(404).json({ message: "Player not found" });
      }

      const currentValue = Math.round(dynastyEngine.getQuickPlayerValue(
        playerId,
        player.fantasy_positions?.[0] || player.position,
        player.age || 25,
        player.years_exp || 0,
        player.injury_status || null,
        { points: 0, games: 0, ppg: 0 },
        1,
        null
      ));

      const [newItem] = await db
        .insert(schema.playerWatchlist)
        .values({
          userId,
          playerId,
          playerName: player.full_name || `${player.first_name} ${player.last_name}`,
          position: player.fantasy_positions?.[0] || "?",
          team: player.team,
          valueAtAdd: currentValue,
          currentValue,
          notes: notes || null,
        })
        .returning();

      res.json({ item: { ...newItem, valueChange: 0 } });
    } catch (error) {
      console.error("Error adding to watchlist:", error);
      res.status(500).json({ message: "Failed to add to watchlist" });
    }
  });

  // Remove player from watchlist
  app.delete("/api/watchlist/:playerId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { playerId } = req.params;

      await db
        .delete(schema.playerWatchlist)
        .where(and(
          eq(schema.playerWatchlist.userId, userId),
          eq(schema.playerWatchlist.playerId, playerId)
        ));

      res.json({ success: true });
    } catch (error) {
      console.error("Error removing from watchlist:", error);
      res.status(500).json({ message: "Failed to remove from watchlist" });
    }
  });

  // Update watchlist entry notes
  app.patch("/api/watchlist/:playerId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { playerId } = req.params;
      const { notes } = req.body;

      const [updated] = await db
        .update(schema.playerWatchlist)
        .set({ 
          notes,
          updatedAt: new Date(),
        })
        .where(and(
          eq(schema.playerWatchlist.userId, userId),
          eq(schema.playerWatchlist.playerId, playerId)
        ))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Watchlist entry not found" });
      }

      res.json({ item: updated });
    } catch (error) {
      console.error("Error updating watchlist:", error);
      res.status(500).json({ message: "Failed to update watchlist" });
    }
  });

  // Get current week matchups with scoring
  app.get("/api/sleeper/matchups/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      const requestedWeek = req.query.week ? parseInt(req.query.week as string) : null;

      const [league, state, rosters, users, allPlayers] = await Promise.all([
        sleeperApi.getLeague(leagueId),
        sleeperApi.getState(),
        sleeperApi.getLeagueRosters(leagueId),
        sleeperApi.getLeagueUsers(leagueId),
        sleeperApi.getAllPlayers(),
      ]);

      if (!league || !state) {
        return res.status(404).json({ message: "League or state not found" });
      }

      const currentWeek = state.display_week || state.week || 1;
      const selectedWeek = requestedWeek || currentWeek;

      const matchupsRaw = await sleeperApi.getMatchups(leagueId, selectedWeek);

      if (!matchupsRaw || matchupsRaw.length === 0) {
        return res.json({
          matchups: [],
          currentWeek,
          selectedWeek,
          seasonType: "regular",
          gamesInProgress: false,
        });
      }

      const userMap = new Map((users || []).map((u) => [u.user_id, u]));
      const rosterMap = new Map((rosters || []).map((r) => [r.roster_id, r]));
      const playerData = allPlayers || {};

      // Group matchups by matchup_id
      const matchupGroups = new Map<number, typeof matchupsRaw>();
      for (const m of matchupsRaw) {
        if (m.matchup_id === null || m.matchup_id === undefined) continue;
        if (!matchupGroups.has(m.matchup_id)) {
          matchupGroups.set(m.matchup_id, []);
        }
        matchupGroups.get(m.matchup_id)!.push(m);
      }

      // Determine if games are in progress (rough heuristic based on current week)
      const gamesInProgress = selectedWeek === currentWeek && state.season === league.season;

      // Get roster positions from league settings (excludes bench positions)
      const rosterPositions = (league.roster_positions || []).filter((pos: string) => pos !== "BN");

      const formatTeam = (matchupData: sleeperApi.SleeperMatchup) => {
        const roster = rosterMap.get(matchupData.roster_id);
        const user = roster ? userMap.get(roster.owner_id) : null;

        const players = (matchupData.starters || []).map((playerId, idx) => {
          const player = playerData[playerId];
          const points = matchupData.starters_points?.[idx] || 0;
          const slotPosition = rosterPositions[idx] || "FLEX";

          return {
            playerId,
            name: player?.full_name || player?.first_name || playerId,
            position: player?.fantasy_positions?.[0] || "?",
            slotPosition, // The lineup slot (QB, RB, FLEX, SUPER_FLEX, etc.)
            team: player?.team || "?",
            points,
            isStarter: true,
          };
        });

        // Add bench players
        const starterIds = new Set(matchupData.starters || []);
        const benchPlayers = Object.entries(matchupData.players_points || {})
          .filter(([playerId]) => !starterIds.has(playerId))
          .map(([playerId, points]) => {
            const player = playerData[playerId];
            return {
              playerId,
              name: player?.full_name || player?.first_name || playerId,
              position: player?.fantasy_positions?.[0] || "?",
              slotPosition: "BN", // Bench
              team: player?.team || "?",
              points: points || 0,
              isStarter: false,
            };
          })
          .sort((a, b) => b.points - a.points);

        return {
          rosterId: matchupData.roster_id,
          ownerId: roster?.owner_id || "",
          ownerName: user?.display_name || user?.username || `Team ${matchupData.roster_id}`,
          avatar: user?.avatar ? sleeperApi.getAvatarUrl(user.avatar) : null,
          totalPoints: matchupData.points || 0,
          players: [...players, ...benchPlayers],
        };
      };

      const matchups = Array.from(matchupGroups.entries())
        .map(([matchupId, teams]) => {
          const teamA = teams[0] ? formatTeam(teams[0]) : null;
          const teamB = teams[1] ? formatTeam(teams[1]) : null;

          return {
            matchupId,
            teamA: teamA!,
            teamB,
          };
        })
        .filter((m) => m.teamA)
        .sort((a, b) => a.matchupId - b.matchupId);

      res.json({
        matchups,
        currentWeek,
        selectedWeek,
        seasonType: selectedWeek >= (league.settings?.playoff_week_start || 15) ? "playoff" : "regular",
        gamesInProgress,
      });
    } catch (error) {
      console.error("Error fetching matchups:", error);
      res.status(500).json({ message: "Failed to fetch matchups" });
    }
  });

  // Get user's schedule for the entire season
  app.get("/api/sleeper/schedule/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      const userId = req.user.claims.sub;

      // Get user profile to find their sleeper user id
      const profile = await storage.getUserProfile(userId);
      if (!profile || !profile.sleeperUserId) {
        return res.status(400).json({ message: "Sleeper account not connected" });
      }

      const [league, state, rosters, users] = await Promise.all([
        sleeperApi.getLeague(leagueId),
        sleeperApi.getState(),
        sleeperApi.getLeagueRosters(leagueId),
        sleeperApi.getLeagueUsers(leagueId),
      ]);

      if (!league || !state) {
        return res.status(404).json({ message: "League or state not found" });
      }

      // Find user's roster
      const userRoster = rosters.find(r => r.owner_id === profile.sleeperUserId);
      if (!userRoster) {
        return res.status(404).json({ message: "User roster not found in this league" });
      }

      const userRosterId = userRoster.roster_id;
      const userMap = new Map((users || []).map((u) => [u.user_id, u]));
      const rosterMap = new Map((rosters || []).map((r) => [r.roster_id, r]));

      const currentWeek = state.display_week || state.week || 1;
      const playoffWeekStart = league.settings?.playoff_week_start || 15;

      // Fetch matchups for all regular season weeks in parallel
      const regularSeasonWeeks = playoffWeekStart - 1;
      const weekPromises = Array.from({ length: regularSeasonWeeks }, (_, i) =>
        sleeperApi.getMatchups(leagueId, i + 1).then(matchups => ({ week: i + 1, matchups }))
      );
      const weekResults = await Promise.all(weekPromises);

      // Build schedule from matchups
      const schedule = weekResults.map(({ week, matchups }) => {
        if (!matchups || matchups.length === 0) {
          return {
            week,
            opponent: null,
            userPoints: 0,
            opponentPoints: 0,
            result: "upcoming" as const,
            isPastWeek: week < currentWeek,
            isCurrentWeek: week === currentWeek,
          };
        }

        // Find user's matchup
        const userMatchup = matchups.find(m => m.roster_id === userRosterId);
        if (!userMatchup || userMatchup.matchup_id === null || userMatchup.matchup_id === undefined) {
          return {
            week,
            opponent: null,
            userPoints: 0,
            opponentPoints: 0,
            result: "bye" as const,
            isPastWeek: week < currentWeek,
            isCurrentWeek: week === currentWeek,
          };
        }

        // Find opponent in the same matchup
        const opponentMatchup = matchups.find(
          m => m.matchup_id === userMatchup.matchup_id && m.roster_id !== userRosterId
        );

        let opponent = null;
        let opponentPoints = 0;

        if (opponentMatchup) {
          const opponentRoster = rosterMap.get(opponentMatchup.roster_id);
          const opponentUser = opponentRoster ? userMap.get(opponentRoster.owner_id) : null;
          opponentPoints = opponentMatchup.points || 0;

          opponent = {
            rosterId: opponentMatchup.roster_id,
            ownerId: opponentRoster?.owner_id || "",
            ownerName: opponentUser?.display_name || opponentUser?.username || `Team ${opponentMatchup.roster_id}`,
            avatar: opponentUser?.avatar ? sleeperApi.getAvatarUrl(opponentUser.avatar) : null,
          };
        }

        const userPoints = userMatchup.points || 0;
        const isPastWeek = week < currentWeek;
        const isCurrentWeek = week === currentWeek;

        let result: "win" | "loss" | "tie" | "upcoming" | "in_progress" | "bye" = "upcoming";
        if (isPastWeek) {
          if (userPoints > opponentPoints) result = "win";
          else if (userPoints < opponentPoints) result = "loss";
          else result = "tie";
        } else if (isCurrentWeek) {
          result = "in_progress";
        }

        return {
          week,
          opponent,
          userPoints,
          opponentPoints,
          result,
          isPastWeek,
          isCurrentWeek,
        };
      });

      // Calculate record
      const wins = schedule.filter(s => s.result === "win").length;
      const losses = schedule.filter(s => s.result === "loss").length;
      const ties = schedule.filter(s => s.result === "tie").length;

      // Get user info for display
      const currentUser = userMap.get(profile.sleeperUserId);

      res.json({
        schedule,
        currentWeek,
        playoffWeekStart,
        record: { wins, losses, ties },
        user: {
          rosterId: userRosterId,
          ownerName: currentUser?.display_name || currentUser?.username || `Team ${userRosterId}`,
          avatar: currentUser?.avatar ? sleeperApi.getAvatarUrl(currentUser.avatar) : null,
        },
        leagueName: league.name,
        season: league.season,
      });
    } catch (error) {
      console.error("Error fetching schedule:", error);
      res.status(500).json({ message: "Failed to fetch schedule" });
    }
  });

  // Get playoff bracket
  app.get("/api/sleeper/bracket/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;

      const [league, bracket, rosters, users, state] = await Promise.all([
        sleeperApi.getLeague(leagueId),
        sleeperApi.getPlayoffBracket(leagueId),
        sleeperApi.getLeagueRosters(leagueId),
        sleeperApi.getLeagueUsers(leagueId),
        sleeperApi.getState(),
      ]);

      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      const userMap = new Map((users || []).map((u) => [u.user_id, u]));
      const rosterMap = new Map((rosters || []).map((r) => [r.roster_id, r]));

      const getTeamInfo = (rosterId: number | null) => {
        if (rosterId === null) return null;
        const roster = rosterMap.get(rosterId);
        if (!roster) return { rosterId, ownerName: "TBD", avatar: null };
        const user = userMap.get(roster.owner_id);
        return {
          rosterId,
          ownerName: user?.display_name || "Unknown",
          avatar: user?.avatar ? `https://sleepercdn.com/avatars/${user.avatar}` : null,
        };
      };

      const playoffWeekStart = league.settings?.playoff_week_start || 15;
      const playoffTeams = league.settings?.playoff_teams || 6;
      const currentWeek = state?.display_week || state?.week || 1;

      // Determine number of rounds based on playoff teams
      const numRounds = Math.ceil(Math.log2(playoffTeams));

      // First pass: build a map of losers by round
      // Track which roster IDs lost in each round
      const losersByRound: Record<number, Set<number>> = {};
      (bracket || []).forEach((match) => {
        if (match.l !== null) {
          if (!losersByRound[match.r]) losersByRound[match.r] = new Set();
          losersByRound[match.r].add(match.l);
        }
      });

      // Transform bracket matchups
      const matchups = (bracket || []).map((match) => {
        // Check if metadata says both teams are from losers
        const isBothFromLosersMetadata = !!(match.t1_from?.l && match.t2_from?.l);
        
        // Also check if both teams in this matchup lost in the previous round
        // (for consolation games where Sleeper doesn't set the loser-feed metadata)
        const previousRound = match.r - 1;
        const previousRoundLosers = losersByRound[previousRound] || new Set();
        const team1LostPreviousRound = match.t1 !== null && previousRoundLosers.has(match.t1);
        const team2LostPreviousRound = match.t2 !== null && previousRoundLosers.has(match.t2);
        const isBothFromLosersByHistory = match.r > 1 && team1LostPreviousRound && team2LostPreviousRound;
        
        const isConsolation = isBothFromLosersMetadata || isBothFromLosersByHistory;
        
        return {
          round: match.r,
          matchId: match.m,
          team1: getTeamInfo(match.t1),
          team2: getTeamInfo(match.t2),
          winner: match.w,
          loser: match.l,
          team1From: match.t1_from,
          team2From: match.t2_from,
          isConsolation,
        };
      });

      // Championship bracket: exclude consolation games
      const championshipMatchups = matchups.filter((m) => !m.isConsolation);
      
      // All consolation games (where both teams lost in the previous round)
      const consolationMatchups = matchups
        .filter((m) => m.isConsolation)
        .map((m) => {
          // Determine placement label based on round
          // Final round consolation = 3rd place, semi-final round consolation = 5th place, etc.
          const roundsFromFinal = numRounds - m.round;
          let placementLabel = "";
          if (roundsFromFinal === 0) {
            placementLabel = "3rd Place Game";
          } else if (roundsFromFinal === 1) {
            placementLabel = "5th Place Game";
          } else if (roundsFromFinal === 2) {
            placementLabel = "7th Place Game";
          } else {
            placementLabel = `Consolation Round ${m.round}`;
          }
          return { ...m, placementLabel };
        })
        .sort((a, b) => b.round - a.round); // Sort by round descending (3rd place first, then 5th, etc.)

      // Group matchups by round (championship only)
      const rounds: Record<number, typeof championshipMatchups> = {};
      championshipMatchups.forEach((m) => {
        if (!rounds[m.round]) rounds[m.round] = [];
        rounds[m.round].push(m);
      });

      res.json({
        leagueId,
        leagueName: league.name,
        season: league.season,
        playoffWeekStart,
        playoffTeams,
        currentWeek,
        numRounds,
        rounds,
        matchups: championshipMatchups,
        consolationMatchups,
        isPlayoffsStarted: currentWeek >= playoffWeekStart,
        isComplete: league.status === "complete",
      });
    } catch (error) {
      console.error("Error fetching playoff bracket:", error);
      res.status(500).json({ message: "Failed to fetch playoff bracket" });
    }
  });

  // Get devy players with rankings and draft eligibility
  // Devy = college players NOT yet drafted or rostered on an NFL team
  app.get("/api/sleeper/devy", isAuthenticated, async (req: any, res: Response) => {
    try {
      // Use devy player data for rankings, calculate values with dynasty engine
      const devyPlayers = ktcValues.getDevyPlayers();
      const currentYear = new Date().getFullYear();

      // Fetch all Sleeper NFL players to filter out any who have been drafted/signed
      const allNflPlayers = await sleeperApi.getAllPlayers();
      
      // Build a name-based lookup for NFL players (lowercase for case-insensitive matching)
      const nflPlayersByName = new Map<string, any>();
      Object.values(allNflPlayers).forEach((player: any) => {
        if (player?.full_name) {
          const nameKey = player.full_name.toLowerCase().trim();
          nflPlayersByName.set(nameKey, player);
        }
      });

      // Filter to only include TRUE devy players (college players not in NFL)
      const trueDevyPlayers = devyPlayers.filter(player => {
        // Look up by name (KTC IDs may not match Sleeper IDs)
        const nameKey = player.name.toLowerCase().trim();
        const nflPlayer = nflPlayersByName.get(nameKey);
        
        if (nflPlayer) {
          // Check if they have an NFL team or have experience
          if (nflPlayer.team || nflPlayer.years_exp > 0) {
            console.log(`[Devy Filter] Excluding ${player.name} - now in NFL (team: ${nflPlayer.team}, exp: ${nflPlayer.years_exp})`);
            return false;
          }
        }
        return true;
      });

      // Transform to match expected format with dynasty engine values (0-100 scale)
      const rankedPlayers = trueDevyPlayers.map((player, index) => {
        // Calculate dynasty value using the engine
        const dynastyValue = dynastyEngine.calculateDevyValue(
          player.tier,
          player.draftEligibleYear,
          1, // Assume 1st round projected for top prospects
          currentYear
        );
        
        return {
          playerId: player.id,
          name: player.name,
          position: player.position,
          positionRank: player.positionRank,
          college: player.college,
          draftEligibleYear: player.draftEligibleYear,
          tier: player.tier,
          trend7Day: player.trend7Day,
          trend30Day: player.trend30Day,
          seasonChange: player.seasonChange,
          value: dynastyValue, // Now 0-100 scale
          rank: index + 1,
          // Breakout/Bust probability
          starterPct: player.starterPct,
          elitePct: player.elitePct,
          bustPct: player.bustPct,
          // Draft capital confidence
          top10Pct: player.top10Pct,
          round1Pct: player.round1Pct,
          round2PlusPct: player.round2PlusPct,
          // Trade value equivalent
          pickEquivalent: player.pickEquivalent,
          pickMultiplier: player.pickMultiplier,
          // Market share metrics
          dominatorRating: player.dominatorRating,
          yardShare: player.yardShare,
          tdShare: player.tdShare,
          breakoutAge: player.breakoutAge,
          // Historical comps
          comps: player.comps,
          // Path to production
          depthRole: player.depthRole,
          pathContext: player.pathContext,
          // Age vs Class indicator
          ageClass: player.ageClass,
        };
      });

      // Get unique positions and years for filters
      const positions = Array.from(new Set(rankedPlayers.map(p => p.position))).sort();
      const years = Array.from(new Set(rankedPlayers.map(p => p.draftEligibleYear))).sort((a, b) => a - b);

      res.json({
        players: rankedPlayers,
        positions,
        years,
        totalCount: rankedPlayers.length,
        source: "DT Dynasty",
      });
    } catch (error) {
      console.error("Error fetching devy players:", error);
      res.status(500).json({ message: "Failed to fetch devy players" });
    }
  });

  // Get AI-generated insights for a devy player
  app.get("/api/sleeper/devy/:playerId/insights", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { playerId } = req.params;
      
      // Get player from devy data
      const player = ktcValues.getDevyPlayerById(playerId);
      if (!player) {
        return res.status(404).json({ message: "Player not found" });
      }

      // Generate AI insights about the player
      const prompt = `You are a college football and NFL draft expert providing dynasty fantasy football analysis. Generate a comprehensive scouting report for the following college prospect:

Player: ${player.name}
Position: ${player.position}
College: ${player.college}
Draft Eligible: ${player.draftEligibleYear}
Dynasty Ranking: #${player.rank} overall, ${player.position}${player.positionRank}
Dynasty Value Tier: ${player.tier}
Dynasty Value: ${player.value}
30-Day Trend: ${player.trend30Day > 0 ? '+' + player.trend30Day : player.trend30Day}

Please provide:
1. **Player Overview**: A 2-3 sentence summary of who this player is and their current status
2. **College Performance**: Key stats, achievements, and highlights from their college career (be specific with stats if known)
3. **Strengths**: 3-4 key strengths that make them a valuable dynasty asset
4. **Areas to Improve**: 2-3 areas where they need development
5. **NFL Comparison**: 1-2 NFL player comparisons for their play style
6. **Draft Outlook**: Expected draft position and landing spot analysis
7. **Dynasty Value**: Analysis of their fantasy football ceiling and floor, and whether they're a buy/hold/sell at current value

Format your response with clear section headers using markdown. Be concise but informative. Focus on actionable fantasy football insights.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert college football analyst and dynasty fantasy football advisor. Provide accurate, up-to-date information about college prospects. If you don't have specific information about a player, provide reasonable context based on their school, position, and ranking. Always be helpful and provide actionable dynasty fantasy advice."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      });

      const insights = response.choices[0]?.message?.content || "Unable to generate insights at this time.";

      res.json({
        player: {
          id: player.id,
          name: player.name,
          position: player.position,
          positionRank: player.positionRank,
          college: player.college,
          draftEligibleYear: player.draftEligibleYear,
          tier: player.tier,
          value: player.value,
          trend30Day: player.trend30Day,
          rank: player.rank,
        },
        insights,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error generating devy player insights:", error);
      res.status(500).json({ message: "Failed to generate player insights" });
    }
  });

  // Get devy player full profile with bio, college stats, game logs, and news
  app.get("/api/sleeper/devy/:playerId/profile", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { playerId } = req.params;
      
      const player = ktcValues.getDevyPlayerById(playerId);
      if (!player) {
        return res.status(404).json({ message: "Player not found" });
      }

      // Import college stats service
      const { getCollegePlayerProfile, getCollegePlayerHeadshotUrl } = await import("./college-stats-service");
      
      // Fetch real ESPN college stats
      const espnProfile = await getCollegePlayerProfile(player.name, player.college);
      
      // Format ESPN stats to our structure
      let collegeStats = { seasons: [] as any[], careerTotals: {} as Record<string, any> };
      let gameLogs: any[] = [];
      let bio = {
        height: "N/A",
        weight: "N/A",
        hometown: "N/A",
        highSchoolRank: "N/A",
        class: "N/A",
        conference: "N/A"
      };
      let headshot: string | null = null;
      let teamLogo: string | null = null;
      
      if (espnProfile) {
        // Use real ESPN bio data
        bio = {
          height: espnProfile.bio.height || "N/A",
          weight: espnProfile.bio.weight || "N/A",
          hometown: espnProfile.bio.hometown || "N/A",
          highSchoolRank: "N/A", // ESPN doesn't provide this
          class: espnProfile.bio.class || "N/A",
          conference: "N/A" // Will be extracted from team if needed
        };
        
        headshot = espnProfile.bio.headshot || getCollegePlayerHeadshotUrl(espnProfile.espnId || "");
        teamLogo = espnProfile.bio.teamLogo || null;
        
        // Format seasons from ESPN data
        collegeStats.seasons = espnProfile.seasons.map(s => ({
          year: s.year,
          games: s.games,
          stats: {
            passYds: s.stats["YDS"] || s.stats["PYDS"] || s.stats["PassingYDS"] || 0,
            passTd: s.stats["TD"] || s.stats["PTD"] || s.stats["PassingTD"] || 0,
            passInt: s.stats["INT"] || 0,
            completions: s.stats["CMP"] || s.stats["Completions"] || 0,
            attempts: s.stats["ATT"] || s.stats["Attempts"] || 0,
            rushYds: s.stats["RYDS"] || s.stats["RushingYDS"] || s.stats["YDS"] || 0,
            rushTd: s.stats["RTD"] || s.stats["RushingTD"] || s.stats["TD"] || 0,
            rushAtt: s.stats["CAR"] || s.stats["ATT"] || s.stats["Carries"] || 0,
            rushAvg: s.stats["AVG"] || s.stats["YPC"] || 0,
            rushLng: s.stats["LNG"] || s.stats["Long"] || 0,
            recYds: s.stats["RECYDS"] || s.stats["ReceivingYDS"] || 0,
            recTd: s.stats["RECTD"] || s.stats["ReceivingTD"] || 0,
            receptions: s.stats["REC"] || s.stats["Receptions"] || 0,
            targets: s.stats["TAR"] || s.stats["Targets"] || 0,
            recAvg: s.stats["RECAVG"] || s.stats["YPR"] || 0,
            recLng: s.stats["RECLNG"] || 0,
            fumbles: s.stats["FUM"] || 0,
            fumblesLost: s.stats["LOST"] || s.stats["FL"] || 0,
            ...s.stats // Include all raw stats too
          }
        }));
        
        // Format career totals
        collegeStats.careerTotals = {
          games: espnProfile.careerTotals["GP"] || espnProfile.careerTotals["G"] || 0,
          passYds: espnProfile.careerTotals["YDS"] || espnProfile.careerTotals["PYDS"] || 0,
          passTd: espnProfile.careerTotals["TD"] || espnProfile.careerTotals["PTD"] || 0,
          rushYds: espnProfile.careerTotals["RYDS"] || 0,
          rushTd: espnProfile.careerTotals["RTD"] || 0,
          rushAtt: espnProfile.careerTotals["CAR"] || 0,
          recYds: espnProfile.careerTotals["RECYDS"] || 0,
          recTd: espnProfile.careerTotals["RECTD"] || 0,
          receptions: espnProfile.careerTotals["REC"] || 0,
          ...espnProfile.careerTotals // Include all raw stats
        };
        
        // Format game logs from ESPN (g.stats is already a formatted string)
        gameLogs = espnProfile.gameLogs.slice(0, 15).map(g => ({
          week: g.week,
          opponent: g.opponent,
          result: g.result || `${g.homeAway === "home" ? "vs" : "@"} ${g.score}`,
          stats: g.stats, // Already formatted as string from college-stats-service
          date: g.date,
          season: g.season
        }));
      }
      
      // Use AI only for scouting analysis (not stats)
      const scoutingPrompt = `You are a dynasty fantasy football expert analyzing ${player.name} (${player.position}) from ${player.college}.

Return a JSON object with this EXACT structure (no markdown, just valid JSON):
{
  "analysisNotes": [
    {
      "title": "Dynasty Fantasy Analysis Note",
      "insight": "Detailed insight about player's value, production, or projection",
      "category": "scouting|production|projection|concern"
    }
  ],
  "scoutingReport": {
    "strengths": ["strength 1", "strength 2", "strength 3"],
    "weaknesses": ["weakness 1", "weakness 2"],
    "nflComparison": "NFL player comparison",
    "draftProjection": "Round 1, top 15 pick",
    "fantasyOutlook": "Brief dynasty value outlook"
  },
  "highSchoolRank": "string like 5-star, #3 nationally or 4-star recruit",
  "conference": "string like SEC or Big Ten"
}

Dynasty Value: ${player.value}
Draft Eligible: ${player.draftEligibleYear}
Position Rank: ${player.position}${player.positionRank}
Overall Rank: #${player.rank}

IMPORTANT:
- Include 3-4 analysis notes with dynasty fantasy insights (scouting observations, production analysis, projection notes, or concerns)
- Provide accurate high school recruiting ranking if known
- Provide their college conference (SEC, Big Ten, ACC, etc.)
Return ONLY valid JSON, no other text.`;

      let scoutingData: any = {
        analysisNotes: [],
        scoutingReport: { strengths: [], weaknesses: [], nflComparison: "N/A", draftProjection: "N/A", fantasyOutlook: "N/A" },
        highSchoolRank: "N/A",
        conference: "N/A"
      };

      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are a dynasty fantasy football analyst. Return ONLY valid JSON with no markdown formatting."
            },
            {
              role: "user",
              content: scoutingPrompt
            }
          ],
          max_tokens: 1500,
          temperature: 0.3,
          response_format: { type: "json_object" },
        });

        const content = response.choices[0]?.message?.content || "{}";
        let cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        cleanContent = cleanContent.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
        scoutingData = JSON.parse(cleanContent);
      } catch (aiError) {
        console.error("Failed to get AI scouting data:", aiError);
      }

      // Merge AI scouting data with bio
      if (scoutingData.highSchoolRank && scoutingData.highSchoolRank !== "N/A") {
        bio.highSchoolRank = scoutingData.highSchoolRank;
      }
      if (scoutingData.conference && scoutingData.conference !== "N/A") {
        bio.conference = scoutingData.conference;
      }

      // If no headshot or ESPN lookup failed, get team logo as fallback
      const { getCollegeTeamLogo } = await import("./college-stats-service");
      if (!teamLogo) {
        teamLogo = getCollegeTeamLogo(player.college);
      }

      res.json({
        player: {
          id: player.id,
          name: player.name,
          position: player.position,
          positionRank: player.positionRank,
          college: player.college,
          draftEligibleYear: player.draftEligibleYear,
          tier: player.tier,
          value: player.value,
          trend30Day: player.trend30Day,
          rank: player.rank,
          headshot: headshot,
          teamLogo: teamLogo,
        },
        bio,
        collegeStats,
        gameLogs,
        analysisNotes: scoutingData.analysisNotes || [],
        scoutingReport: scoutingData.scoutingReport || { strengths: [], weaknesses: [], nflComparison: "N/A", draftProjection: "N/A", fantasyOutlook: "N/A" },
        news: [], // Backward compatibility
        espnId: espnProfile?.espnId || null,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching devy player profile:", error);
      res.status(500).json({ message: "Failed to fetch player profile" });
    }
  });

  // Helper function to format game log stats based on position
  function formatGameLogStats(stats: Record<string, any>, position: string): string {
    const parts: string[] = [];
    
    if (position === "QB") {
      if (stats["CMP"] || stats["ATT"]) parts.push(`${stats["CMP"] || 0}/${stats["ATT"] || 0}`);
      if (stats["YDS"] || stats["PYDS"]) parts.push(`${stats["YDS"] || stats["PYDS"]} yds`);
      if (stats["TD"] || stats["PTD"]) parts.push(`${stats["TD"] || stats["PTD"]} TD`);
      if (stats["INT"]) parts.push(`${stats["INT"]} INT`);
    } else if (position === "RB") {
      if (stats["CAR"]) parts.push(`${stats["CAR"]} car`);
      if (stats["YDS"] || stats["RYDS"]) parts.push(`${stats["YDS"] || stats["RYDS"]} yds`);
      if (stats["TD"] || stats["RTD"]) parts.push(`${stats["TD"] || stats["RTD"]} TD`);
      if (stats["REC"]) parts.push(`${stats["REC"]} rec`);
      if (stats["RECYDS"]) parts.push(`${stats["RECYDS"]} rec yds`);
    } else if (position === "WR" || position === "TE") {
      if (stats["REC"]) parts.push(`${stats["REC"]} rec`);
      if (stats["YDS"] || stats["RECYDS"]) parts.push(`${stats["YDS"] || stats["RECYDS"]} yds`);
      if (stats["TD"] || stats["RECTD"]) parts.push(`${stats["TD"] || stats["RECTD"]} TD`);
      if (stats["TAR"]) parts.push(`${stats["TAR"]} tar`);
    }
    
    return parts.length > 0 ? parts.join(", ") : "No stats";
  }

  // Get NFL players list (excluding devy players)
  app.get("/api/sleeper/players", isAuthenticated, async (req: any, res: Response) => {
    try {
      const leagueId = req.query.leagueId as string | undefined;
      const yearParam = req.query.year as string | undefined;
      
      // Fetch consensus values for blended dynasty values
      try {
        await dynastyConsensusService.fetchAndCacheValues();
      } catch (e) {
        console.log(`[NFL Players] Failed to fetch consensus values: ${e}`);
      }
      
      // Get league scoring settings if leagueId provided
      let scoringSettings: Record<string, number> = {
        // Default PPR scoring if no league specified
        pass_yd: 0.04,
        pass_td: 4,
        pass_int: -2,
        rush_yd: 0.1,
        rush_td: 6,
        rec: 1,
        rec_yd: 0.1,
        rec_td: 6,
        fum_lost: -2,
      };
      
      // Detect if the selected league is an IDP league or Superflex
      let isIDPLeague = false;
      let isSuperflex = false;
      
      if (leagueId) {
        const league = await sleeperApi.getLeague(leagueId);
        if (league?.scoring_settings) {
          scoringSettings = league.scoring_settings;
        }
        // Check roster positions for IDP slots
        if (league?.roster_positions) {
          const idpPositionTypes = ["DL", "LB", "DB", "DE", "DT", "CB", "S", "IDP_FLEX", "ILB", "OLB", "MLB", "NT", "FS", "SS", "ED"];
          isIDPLeague = league.roster_positions.some((pos: string) => 
            pos !== "BN" && idpPositionTypes.includes(pos)
          );
        }
        // Check if league is Superflex/2QB
        isSuperflex = dynastyEngine.isLeagueSuperflex(league);
      }

      // Determine the correct season for stats:
      // If year parameter provided, use it; otherwise auto-detect
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth(); // 0-indexed (0 = Jan, 7 = Aug)
      const currentYear = currentDate.getFullYear();
      
      let statsSeason: string;
      if (yearParam) {
        // Use the provided year parameter
        statsSeason = yearParam;
      } else {
        // Auto-detect: Before September, use the previous year's season (which has complete stats)
        // After September, use the current year's season
        if (currentMonth < 8) { // Before September
          statsSeason = String(currentYear - 1);
        } else {
          statsSeason = String(currentYear);
        }
      }
      
      // Position-specific reception bonuses
      const tePremium = scoringSettings.bonus_rec_te || 0;
      const rbBonus = scoringSettings.bonus_rec_rb || 0;
      const wrBonus = scoringSettings.bonus_rec_wr || 0;
      
      const [allPlayers, seasonStats] = await Promise.all([
        sleeperApi.getAllPlayers(),
        sleeperApi.getSeasonStats(statsSeason, "regular"),
      ]);
      
      const devyPlayerIds = new Set(ktcValues.KTC_DEVY_PLAYERS.map(p => p.id));
      
      // Filter to active NFL players (exclude devy/college players)
      const nflPlayers: any[] = [];
      const offensePositions = ["QB", "RB", "WR", "TE"];
      const idpPositions = ["DL", "LB", "DB", "DE", "DT", "CB", "S", "ILB", "OLB", "MLB", "NT", "FS", "SS"];
      const allPositions = [...offensePositions, ...idpPositions];
      
      // Map detailed IDP positions to display groups
      const idpPositionGroupMap: Record<string, string> = {
        DE: "DL", DT: "DL", NT: "DL",
        ILB: "LB", OLB: "LB", MLB: "LB",
        CB: "DB", S: "DB", FS: "DB", SS: "DB"
      };
      
      Object.entries(allPlayers).forEach(([playerId, player]: [string, any]) => {
        // Skip devy players
        if (devyPlayerIds.has(playerId)) return;
        
        // Only include active NFL players with valid positions
        const rawPosition = player.position || player.fantasy_positions?.[0];
        if (!allPositions.includes(rawPosition)) return;
        
        // Map detailed IDP positions to display groups (DL, LB, DB)
        const position = idpPositionGroupMap[rawPosition] || rawPosition;
        const isIDP = idpPositions.includes(rawPosition);
        
        // Must be on an NFL team
        if (!player.team) return;
        
        // Get player stats
        const playerStats = seasonStats[playerId];
        
        // Calculate fantasy points based on league scoring settings
        let fantasyPoints: number;
        
        if (isIDP) {
          // Calculate IDP fantasy points
          const idpSettings = {
            idp_tkl: scoringSettings.idp_tkl || 1,
            idp_tkl_solo: scoringSettings.idp_tkl_solo || 0,
            idp_tkl_ast: scoringSettings.idp_tkl_ast || 0,
            idp_tkl_loss: scoringSettings.idp_tkl_loss || 0,
            idp_sack: scoringSettings.idp_sack || 2,
            idp_qb_hit: scoringSettings.idp_qb_hit || 0,
            idp_int: scoringSettings.idp_int || 3,
            idp_pass_def: scoringSettings.idp_pass_def || 1,
            idp_ff: scoringSettings.idp_ff || 1,
            idp_fum_rec: scoringSettings.idp_fum_rec || 1,
            idp_td: scoringSettings.idp_td || 6,
            idp_safe: scoringSettings.idp_safe || 2,
          };
          
          // Calculate IDP points
          const tackles = (playerStats?.idp_tkl || 0) + (playerStats?.idp_tkl_solo || 0) + (playerStats?.idp_tkl_ast || 0);
          const sacks = playerStats?.idp_sack || 0;
          const interceptions = playerStats?.idp_int || 0;
          const passesDefended = playerStats?.idp_pass_def || 0;
          const forcedFumbles = playerStats?.idp_ff || 0;
          const fumbleRecoveries = playerStats?.idp_fum_rec || 0;
          const tds = playerStats?.idp_td || 0;
          const qbHits = playerStats?.idp_qb_hit || 0;
          const tackleLoss = playerStats?.idp_tkl_loss || 0;
          const safeties = playerStats?.idp_safe || 0;
          
          fantasyPoints = (
            tackles * idpSettings.idp_tkl +
            sacks * idpSettings.idp_sack +
            interceptions * idpSettings.idp_int +
            passesDefended * idpSettings.idp_pass_def +
            forcedFumbles * idpSettings.idp_ff +
            fumbleRecoveries * idpSettings.idp_fum_rec +
            tds * idpSettings.idp_td +
            qbHits * idpSettings.idp_qb_hit +
            tackleLoss * idpSettings.idp_tkl_loss +
            safeties * idpSettings.idp_safe
          );
        } else {
          // Offensive fantasy points
          fantasyPoints = sleeperApi.calculateFantasyPoints(playerStats, scoringSettings);
          
          // Apply position-specific reception bonuses
          const receptions = playerStats?.rec || 0;
          if (position === "TE" && tePremium > 0 && receptions > 0) {
            fantasyPoints += receptions * tePremium;
          }
          if (position === "RB" && rbBonus > 0 && receptions > 0) {
            fantasyPoints += receptions * rbBonus;
          }
          if (position === "WR" && wrBonus > 0 && receptions > 0) {
            fantasyPoints += receptions * wrBonus;
          }
        }
        fantasyPoints = Math.round(fantasyPoints * 100) / 100;
        
        // Only include players with actual production (minimum 10 points for offense, 5 for IDP)
        const minPoints = isIDP ? 5 : 10;
        if (fantasyPoints < minPoints) return;
        
        // Get games played
        const gamesPlayed = playerStats?.gp || 0;
        const pointsPerGame = gamesPlayed > 0 ? Math.round((fantasyPoints / gamesPlayed) * 10) / 10 : 0;
        
        // Use standard PPR points for dynasty value calculation (for consistency with other endpoints)
        const standardPprPoints = playerStats?.pts_ppr || 0;
        const standardPpg = gamesPlayed > 0 ? standardPprPoints / gamesPlayed : 0;
        
        // Get blended dynasty value (league + KTC consensus)
        const playerName = player.full_name || `${player.first_name} ${player.last_name}`;
        const consensusValue = dynastyConsensusService.getNormalizedValue(playerName, position, isSuperflex);
        const valueResult = dynastyEngine.getBlendedPlayerValue(
          playerId,
          playerName,
          position,
          player.age,
          player.years_exp || 0,
          player.injury_status,
          { points: standardPprPoints, games: gamesPlayed, ppg: standardPpg },
          null,
          null,
          consensusValue
        );
        const dynastyValue = valueResult.value;
        
        // ESPN headshot URL
        const headshot = player.espn_id 
          ? `https://a.espncdn.com/i/headshots/nfl/players/full/${player.espn_id}.png`
          : null;
        
        nflPlayers.push({
          id: playerId,
          name: player.position === "DEF" 
            ? `${player.first_name} ${player.last_name}`
            : `${player.first_name?.charAt(0) || ""}. ${player.last_name || ""}`.trim(),
          fullName: `${player.first_name || ""} ${player.last_name || ""}`.trim(),
          position,
          team: player.team,
          age: player.age,
          yearsExp: player.years_exp || 0,
          fantasyPoints,
          pointsPerGame,
          gamesPlayed,
          dynastyValue,
          injuryStatus: player.injury_status || null,
          number: player.number,
          college: player.college,
          height: player.height,
          weight: player.weight,
          headshot,
          snapPct: isIDP 
            ? (playerStats?.def_snp && playerStats?.tm_def_snp 
              ? Math.round((playerStats.def_snp / playerStats.tm_def_snp) * 100 * 10) / 10
              : null)
            : (playerStats?.off_snp && playerStats?.tm_off_snp 
              ? Math.round((playerStats.off_snp / playerStats.tm_off_snp) * 100 * 10) / 10
              : null),
          isIDP,
          stats: {
            passYd: playerStats?.pass_yd || 0,
            passTd: playerStats?.pass_td || 0,
            passInt: playerStats?.pass_int || 0,
            passAtt: playerStats?.pass_att || 0,
            passCmp: playerStats?.pass_cmp || 0,
            passFd: playerStats?.pass_fd || 0,
            rushYd: playerStats?.rush_yd || 0,
            rushTd: playerStats?.rush_td || 0,
            rushAtt: playerStats?.rush_att || 0,
            rushFd: playerStats?.rush_fd || 0,
            rec: playerStats?.rec || 0,
            recYd: playerStats?.rec_yd || 0,
            recTd: playerStats?.rec_td || 0,
            recTgt: playerStats?.rec_tgt || 0,
            recFd: playerStats?.rec_fd || 0,
          },
          idpStats: isIDP ? {
            tackles: (playerStats?.idp_tkl || 0) + (playerStats?.idp_tkl_solo || 0) + (playerStats?.idp_tkl_ast || 0),
            soloTackles: playerStats?.idp_tkl_solo || 0,
            assistTackles: playerStats?.idp_tkl_ast || 0,
            tacklesForLoss: playerStats?.idp_tkl_loss || 0,
            sacks: playerStats?.idp_sack || 0,
            qbHits: playerStats?.idp_qb_hit || 0,
            interceptions: playerStats?.idp_int || 0,
            passesDefended: playerStats?.idp_pass_def || 0,
            forcedFumbles: playerStats?.idp_ff || 0,
            fumbleRecoveries: playerStats?.idp_fum_rec || 0,
            tds: playerStats?.idp_td || 0,
            safeties: playerStats?.idp_safe || 0,
          } : null,
        });
      });
      
      // Filter out IDP players if league is not an IDP league (and a specific league is selected)
      // When no leagueId is provided (All Leagues view), show all players including IDP
      let playersToReturn = nflPlayers;
      if (leagueId && !isIDPLeague) {
        playersToReturn = nflPlayers.filter(p => !p.isIDP);
      }
      
      // Sort by fantasy points descending (actual production)
      playersToReturn.sort((a, b) => b.fantasyPoints - a.fantasyPoints);
      
      // Add overall rank and position rank
      const positionRanks: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0, DL: 0, LB: 0, DB: 0 };
      
      playersToReturn.forEach((player, index) => {
        player.overallRank = index + 1;
        positionRanks[player.position] = (positionRanks[player.position] || 0) + 1;
        player.positionRank = positionRanks[player.position];
      });
      
      // Determine scoring type label
      const scoringType = sleeperApi.getScoringType(scoringSettings);
      const scoringLabel = scoringType === "ppr" ? "PPR" : scoringType === "half_ppr" ? "Half PPR" : "Standard";
      
      // Check if this league has custom scoring beyond standard formats
      const hasPositionBonuses = tePremium !== 0 || rbBonus !== 0 || wrBonus !== 0;
      const hasNonStandardTds = (scoringSettings.pass_td || 4) !== 4;
      const isCustomScoring = hasPositionBonuses || hasNonStandardTds;
      
      res.json({
        players: playersToReturn,
        totalCount: playersToReturn.length,
        season: statsSeason,
        scoringType: isCustomScoring ? `${scoringLabel} (custom)` : scoringLabel,
        isCustomScoring,
        isIDPLeague,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching NFL players:", error);
      res.status(500).json({ message: "Failed to fetch players" });
    }
  });

  // Get NFL depth charts organized by team and position
  app.get("/api/sleeper/depth-chart", isAuthenticated, async (req: any, res: Response) => {
    try {
      const leagueId = req.query.leagueId as string | undefined;
      
      // Fetch consensus values for proper dynasty value calculation
      try {
        await dynastyConsensusService.fetchAndCacheValues();
      } catch (e) {
        console.log(`[Depth Chart] Failed to fetch consensus values: ${e}`);
      }
      
      // Determine if league is superflex for proper value calculation
      let isSuperflex = false;
      if (leagueId) {
        const league = await sleeperApi.getLeague(leagueId);
        isSuperflex = dynastyEngine.isLeagueSuperflex(league);
      }
      
      const allPlayers = await sleeperApi.getAllPlayers();
      
      // Define position mappings
      const offensePositions = ["QB", "RB", "WR", "TE"];
      const defensePositions = ["DL", "LB", "DB", "DE", "DT", "S", "CB"];
      const allPositions = [...offensePositions, ...defensePositions];
      
      // Map detailed positions to groups
      const positionGroupMap: Record<string, string> = {
        QB: "QB", RB: "RB", WR: "WR", TE: "TE",
        DE: "DL", DT: "DL", NT: "DL",
        ILB: "LB", OLB: "LB", MLB: "LB",
        CB: "DB", S: "DB", FS: "DB", SS: "DB"
      };
      
      // NFL team full names
      const teamNames: Record<string, string> = {
        ARI: "Arizona Cardinals", ATL: "Atlanta Falcons", BAL: "Baltimore Ravens",
        BUF: "Buffalo Bills", CAR: "Carolina Panthers", CHI: "Chicago Bears",
        CIN: "Cincinnati Bengals", CLE: "Cleveland Browns", DAL: "Dallas Cowboys",
        DEN: "Denver Broncos", DET: "Detroit Lions", GB: "Green Bay Packers",
        HOU: "Houston Texans", IND: "Indianapolis Colts", JAX: "Jacksonville Jaguars",
        KC: "Kansas City Chiefs", LAC: "Los Angeles Chargers", LAR: "Los Angeles Rams",
        LV: "Las Vegas Raiders", MIA: "Miami Dolphins", MIN: "Minnesota Vikings",
        NE: "New England Patriots", NO: "New Orleans Saints", NYG: "New York Giants",
        NYJ: "New York Jets", PHI: "Philadelphia Eagles", PIT: "Pittsburgh Steelers",
        SEA: "Seattle Seahawks", SF: "San Francisco 49ers", TB: "Tampa Bay Buccaneers",
        TEN: "Tennessee Titans", WAS: "Washington Commanders"
      };
      
      // Build depth charts for each team
      const teamDepthCharts: Record<string, Record<string, any[]>> = {};
      
      Object.entries(allPlayers).forEach(([playerId, player]: [string, any]) => {
        const team = player.team;
        if (!team || !teamNames[team]) return;
        
        const position = player.position || player.fantasy_positions?.[0];
        const positionGroup = positionGroupMap[position] || position;
        
        if (!allPositions.includes(positionGroup)) return;
        
        // Initialize team if not exists
        if (!teamDepthCharts[team]) {
          teamDepthCharts[team] = {};
        }
        if (!teamDepthCharts[team][positionGroup]) {
          teamDepthCharts[team][positionGroup] = [];
        }
        
        // Get depth chart order (lower is better) - important for value calculation
        const depthOrder = player.depth_chart_order || 99;
        
        // Get dynasty value using blended calculation with consensus data
        // Pass depth order so role security multiplier can properly penalize backups
        const playerName = player.full_name || `${player.first_name} ${player.last_name}`;
        const consensusValue = dynastyConsensusService.getNormalizedValue(playerName, positionGroup, isSuperflex);
        const valueResult = dynastyEngine.getBlendedPlayerValue(
          playerId,
          playerName,
          positionGroup,
          player.age,
          player.years_exp || 0,
          player.injury_status,
          { points: 0, games: 0, ppg: 0 },
          depthOrder,  // Pass actual depth order for role security calculation
          null,        // No snap% data available here
          consensusValue
        );
        const dynastyValue = valueResult.value;
        
        teamDepthCharts[team][positionGroup].push({
          id: playerId,
          name: `${player.first_name?.charAt(0) || ""}. ${player.last_name || ""}`.trim(),
          fullName: `${player.first_name || ""} ${player.last_name || ""}`.trim(),
          position: positionGroup,
          team,
          depthOrder,
          age: player.age,
          yearsExp: player.years_exp || 0,
          injuryStatus: player.injury_status || null,
          dynastyValue,
        });
      });
      
      // Sort players within each position by depth order and dynasty value
      Object.keys(teamDepthCharts).forEach(team => {
        Object.keys(teamDepthCharts[team]).forEach(pos => {
          teamDepthCharts[team][pos].sort((a, b) => {
            // First by depth order
            if (a.depthOrder !== b.depthOrder) {
              return a.depthOrder - b.depthOrder;
            }
            // Then by dynasty value (higher is better)
            return b.dynastyValue - a.dynastyValue;
          });
        });
      });
      
      // Convert to array format sorted by team
      const sortedTeams = Object.keys(teamNames).sort();
      const teams = sortedTeams.map(team => ({
        team,
        teamName: teamNames[team],
        positions: teamDepthCharts[team] || {},
      }));
      
      res.json({
        teams,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching depth charts:", error);
      res.status(500).json({ message: "Failed to fetch depth charts" });
    }
  });

  // Get player insights with real news from ESPN and AI-generated analysis
  app.get("/api/sleeper/players/:playerId/insights", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { playerId } = req.params;
      const [allPlayers, state] = await Promise.all([
        sleeperApi.getAllPlayers(),
        sleeperApi.getState(),
      ]);
      const player = allPlayers[playerId];
      
      if (!player) {
        return res.status(404).json({ message: "Player not found" });
      }
      
      // Get current date and NFL week for context
      const currentDate = new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      const currentWeek = state?.week || 1;
      const currentSeason = state?.season || new Date().getFullYear().toString();
      const seasonType = state?.season_type || "regular"; // Sleeper returns: "regular", "post", "pre", or "off"
      
      // Use Sleeper's season_type to determine phase
      // Sleeper season_types: "pre" (preseason), "regular", "post" (playoffs), "off" (offseason)
      let seasonPhase: "regular" | "playoffs" | "offseason" = "regular";
      if (seasonType === "post") {
        seasonPhase = "playoffs";
      } else if (seasonType === "off" || seasonType === "pre") {
        seasonPhase = "offseason";
      }
      
      const position = player.position || player.fantasy_positions?.[0] || "N/A";
      const value = dynastyEngine.getQuickPlayerValue(
        playerId,
        position,
        player.age,
        player.years_exp || 0,
        player.injury_status
      );
      
      const playerName = `${player.first_name || ""} ${player.last_name || ""}`.trim();
      const team = player.team || "Free Agent";
      const age = player.age || "Unknown";
      const yearsExp = player.years_exp || 0;
      
      // Fetch real news from ESPN for this player
      const playerNews = await newsService.fetchPlayerNews(playerName, team);
      
      // Build news section from real articles
      let newsSection = "";
      if (playerNews.length > 0) {
        newsSection = playerNews.map(article => 
          `- ${article.title} (${article.source})`
        ).join("\n");
      } else {
        newsSection = "No recent news articles found for this player.";
      }
      
      // Build phase-appropriate prompt
      let phaseContext = "";
      let fantasyOutlookSection = "";
      // For offseason, the "next" season is the current season shown in Sleeper
      // During regular/post season, next season is current + 1
      const nextSeason = seasonPhase === "offseason" 
        ? currentSeason 
        : (parseInt(currentSeason) + 1).toString();
      
      if (seasonPhase === "playoffs") {
        phaseContext = `We are currently in the NFL Playoffs (Week ${currentWeek}). Teams are competing in the postseason with championship implications.`;
        fantasyOutlookSection = `**Fantasy Outlook**: Current playoff performance and championship impact. If their team is still competing, discuss their role and recent production. If eliminated, note their season summary.`;
      } else if (seasonPhase === "offseason") {
        phaseContext = `It is the ${nextSeason} NFL offseason. The regular season has ended and teams are in free agency/draft preparation mode.`;
        fantasyOutlookSection = `**${nextSeason} Outlook**: Next season projections including potential free agency moves, draft capital that could affect their role, offseason storylines, and early ${nextSeason} fantasy value expectations.`;
      } else {
        phaseContext = `We are in Week ${currentWeek} of the ${currentSeason} NFL regular season.`;
        fantasyOutlookSection = `**Fantasy Outlook**: Week ${currentWeek} fantasy value, current role on team, and upcoming matchup expectations.`;
      }
      
      const prompt = `Today is ${currentDate}. ${phaseContext}

You are a fantasy football expert. Provide a brief analysis for ${playerName}, ${position} for the ${team}.

Player Info:
- Age: ${age}
- Experience: ${yearsExp} year${yearsExp !== 1 ? 's' : ''} in the NFL
- Injury Status: ${player.injury_status || 'Healthy'}
- College: ${player.college || 'Unknown'}
- Dynasty Trade Value: ${value.toLocaleString()}

Provide a concise response with these 2 sections (keep each section to 2-3 sentences max):

${fantasyOutlookSection}

**Dynasty Analysis**: Long-term value, age curve considerations, and whether to buy/hold/sell.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 400,
        temperature: 0.7,
      });

      const aiInsights = response.choices[0]?.message?.content || "Unable to generate insights.";
      
      // Combine real news with AI analysis
      const insights = `**Latest News**:\n${newsSection}\n\n${aiInsights}`;
      
      res.json({
        player: {
          id: playerId,
          name: playerName,
          position,
          team,
          age,
          yearsExp,
          value,
          injuryStatus: player.injury_status || null,
          number: player.number,
          college: player.college,
          height: player.height,
          weight: player.weight,
        },
        insights,
        news: playerNews, // Also include raw news articles for potential UI use
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error generating player insights:", error);
      res.status(500).json({ message: "Failed to generate player insights" });
    }
  });

  // Get rosters for trade calculator
  app.get("/api/sleeper/rosters/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;

      const [rosters, users, allPlayers, draftPicks, stats, league] = await Promise.all([
        sleeperApi.getLeagueRosters(leagueId),
        sleeperApi.getLeagueUsers(leagueId),
        sleeperApi.getAllPlayers(),
        sleeperApi.getLeagueDraftPicks(leagueId),
        sleeperApi.getSeasonStats("2025", "regular"),
        sleeperApi.getLeague(leagueId),
      ]);

      // Fetch consensus values for blended dynasty values
      try {
        await dynastyConsensusService.fetchAndCacheValues();
      } catch (e) {
        console.log(`[Trade Calculator] Failed to fetch consensus values: ${e}`);
      }

      // Check if league is Superflex/2QB
      const isSuperflex = dynastyEngine.isLeagueSuperflex(league);

      if (!rosters || rosters.length === 0) {
        return res.json({ rosters: [] });
      }

      const userMap = new Map((users || []).map((u) => [u.user_id, u]));
      const playerData = allPlayers || {};

      const rostersWithAssets = rosters.map((roster) => {
        const user = userMap.get(roster.owner_id);
        
        // Get player assets with blended dynasty values (league + KTC consensus)
        const players = (roster.players || []).map((playerId) => {
          const player = playerData[playerId];
          if (!player) return null;
          
          const position = player.fantasy_positions?.[0] || "?";
          const playerName = player.full_name || `${player.first_name} ${player.last_name}`;
          
          // Get player stats for consistent value calculation
          const playerStats = stats?.[playerId] || {};
          const gamesPlayed = playerStats.gp || 0;
          const fantasyPoints = playerStats.pts_ppr || 0;
          const pointsPerGame = gamesPlayed > 0 ? fantasyPoints / gamesPlayed : 0;
          
          // Get consensus value from DynastyProcess (1QB or 2QB based on league type)
          const consensusValue = dynastyConsensusService.getNormalizedValue(playerName, position, isSuperflex);
          
          // Use blended value (50/50 average of league + KTC)
          const valueResult = dynastyEngine.getBlendedPlayerValue(
            playerId,
            playerName,
            position,
            player.age,
            player.years_exp || 0,
            player.injury_status,
            { points: fantasyPoints, games: gamesPlayed, ppg: pointsPerGame },
            null, // No depth chart order
            null, // No league scoring settings
            consensusValue
          );
          const value = valueResult.value;

          return {
            id: playerId,
            name: player.full_name || `${player.first_name} ${player.last_name}`,
            type: "player" as const,
            position,
            team: player.team,
            value,
          };
        }).filter(Boolean);

        // Get draft pick assets for this roster
        const picks = (draftPicks || [])
          .filter((p) => p.owner_id === roster.roster_id)
          .map((pick) => {
            const originalOwner = pick.previous_owner_id !== pick.owner_id
              ? rosters.find((r) => r.roster_id === pick.previous_owner_id)
              : null;
            const originalOwnerUser = originalOwner 
              ? userMap.get(originalOwner.owner_id)
              : null;

            const pickValue = dynastyEngine.getDraftPickValue(pick.season, pick.round);
            const ownerSuffix = originalOwnerUser?.display_name || originalOwnerUser?.username;
            return {
              id: `${pick.season}-${pick.round}-${pick.roster_id}`,
              name: ownerSuffix ? `${pickValue.displayName} (${ownerSuffix})` : pickValue.displayName,
              type: "pick" as const,
              value: pickValue.value,
            };
          });

        // Add standard future picks (2026-2028, rounds 1-4)
        const currentYear = new Date().getFullYear();
        const currentPicks = new Set(picks.map((p) => p.id));
        [String(currentYear), String(currentYear + 1), String(currentYear + 2)].forEach((season) => {
          [1, 2, 3, 4].forEach((round) => {
            const id = `${season}-${round}-${roster.roster_id}`;
            if (!currentPicks.has(id) && !(draftPicks || []).find(
              (p) => p.season === season && p.round === round && p.previous_owner_id === roster.roster_id
            )) {
              const pickValue = dynastyEngine.getDraftPickValue(season, round);
              picks.push({
                id,
                name: pickValue.displayName,
                type: "pick" as const,
                value: pickValue.value,
              });
            }
          });
        });

        return {
          rosterId: roster.roster_id,
          ownerId: roster.owner_id,
          ownerName: user?.display_name || user?.username || "Unknown",
          players: players.sort((a: any, b: any) => b.value - a.value),
          picks: picks.sort((a, b) => b.value - a.value),
        };
      });

      res.json({ rosters: rostersWithAssets });
    } catch (error) {
      console.error("Error fetching rosters:", error);
      res.status(500).json({ message: "Failed to fetch rosters" });
    }
  });

  // Get single team roster with players and picks
  app.get("/api/sleeper/team/:leagueId/:rosterId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId, rosterId } = req.params;
      const rosterIdNum = parseInt(rosterId);

      const [rosters, users, allPlayers, draftPicks, league, stats] = await Promise.all([
        sleeperApi.getLeagueRosters(leagueId),
        sleeperApi.getLeagueUsers(leagueId),
        sleeperApi.getAllPlayers(),
        sleeperApi.getLeagueDraftPicks(leagueId),
        sleeperApi.getLeague(leagueId),
        sleeperApi.getSeasonStats("2025", "regular"),
      ]);

      // Fetch consensus values for blended dynasty values
      try {
        await dynastyConsensusService.fetchAndCacheValues();
      } catch (e) {
        console.log(`[Team Roster] Failed to fetch consensus values: ${e}`);
      }

      // Check if league is Superflex/2QB
      const isSuperflex = dynastyEngine.isLeagueSuperflex(league);

      if (!rosters || rosters.length === 0) {
        return res.status(404).json({ message: "Rosters not found" });
      }

      const roster = rosters.find((r) => r.roster_id === rosterIdNum);
      if (!roster) {
        return res.status(404).json({ message: "Team not found" });
      }

      const userMap = new Map((users || []).map((u) => [u.user_id, u]));
      const playerData = allPlayers || {};
      const user = userMap.get(roster.owner_id);

      // Helper for display name
      const getDisplayName = (player: any): string => {
        if (player.position === "DEF") {
          return player.first_name + " " + player.last_name;
        }
        const firstName = player.first_name || "";
        const lastName = player.last_name || "";
        const firstInitial = firstName ? firstName.charAt(0) + "." : "";
        return `${firstInitial} ${lastName}`.trim();
      };
      
      // Helper for blended dynasty value (using player stats for consistency with NFL Players endpoint)
      const getBlendedValue = (playerId: string, player: any, position: string): number => {
        const playerName = player.full_name || `${player.first_name} ${player.last_name}`;
        const consensusValue = dynastyConsensusService.getNormalizedValue(playerName, position, isSuperflex);
        
        // Get player stats for consistent value calculation
        const playerStats = stats?.[playerId] || {};
        const gamesPlayed = playerStats.gp || 0;
        const fantasyPoints = playerStats.pts_ppr || 0;
        const pointsPerGame = gamesPlayed > 0 ? fantasyPoints / gamesPlayed : 0;
        
        const valueResult = dynastyEngine.getBlendedPlayerValue(
          playerId,
          playerName,
          position,
          player.age,
          player.years_exp || 0,
          player.injury_status,
          { points: fantasyPoints, games: gamesPlayed, ppg: pointsPerGame },
          null,
          null,
          consensusValue
        );
        return valueResult.value;
      };

      // Get roster slot positions from league settings (excluding BN = bench)
      const rosterPositions = (league?.roster_positions || []).filter((pos: string) => pos !== "BN");
      
      // Build starters in slot order using roster.starters (which is already ordered by slot)
      const starters: any[] = [];
      const bench: any[] = [];
      const taxi: any[] = [];
      const ir: any[] = [];

      const starterIds = new Set(roster.starters || []);
      const taxiIds = new Set(roster.taxi || []);
      const reserveIds = new Set(roster.reserve || []);

      // Process starters in order to match with slot positions
      (roster.starters || []).forEach((playerId, index) => {
        if (!playerId) return; // Empty slot
        const player = playerData[playerId];
        if (!player) return;

        const position = player.position || player.fantasy_positions?.[0] || "N/A";
        const slotPosition = rosterPositions[index] || position;
        
        starters.push({
          id: playerId,
          name: getDisplayName(player),
          fullName: `${player.first_name} ${player.last_name}`,
          position,
          slotPosition,
          team: player.team || "FA",
          age: player.age,
          value: getBlendedValue(playerId, player, position),
        });
      });

      // Process non-starters (bench, taxi, IR)
      (roster.players || []).forEach((playerId) => {
        if (starterIds.has(playerId)) return; // Already processed as starter
        
        const player = playerData[playerId];
        if (!player) return;

        const position = player.position || player.fantasy_positions?.[0] || "N/A";
        const playerInfo = {
          id: playerId,
          name: getDisplayName(player),
          fullName: `${player.first_name} ${player.last_name}`,
          position,
          team: player.team || "FA",
          age: player.age,
          value: getBlendedValue(playerId, player, position),
        };

        if (taxiIds.has(playerId)) {
          taxi.push(playerInfo);
        } else if (reserveIds.has(playerId)) {
          ir.push(playerInfo);
        } else {
          bench.push(playerInfo);
        }
      });

      // Sort bench, taxi, IR by value descending (starters stay in slot order)
      const sortByValue = (a: any, b: any) => b.value - a.value;
      bench.sort(sortByValue);
      taxi.sort(sortByValue);
      ir.sort(sortByValue);

      // Get draft picks for this roster
      const tradedPicks = (draftPicks || []).filter((p) => p.owner_id === rosterIdNum);
      const totalRosters = league?.total_rosters || rosters.length;

      const picks: any[] = [];
      const currentYear = new Date().getFullYear();
      
      // Generate picks for next 3 years
      for (let season = currentYear; season <= currentYear + 2; season++) {
        for (let round = 1; round <= 5; round++) {
          const id = `${season}-${round}-${rosterIdNum}`;
          const tradedAway = tradedPicks.find(
            (p) => p.season === String(season) && p.round === round && p.previous_owner_id === rosterIdNum
          );
          const tradedIn = tradedPicks.find(
            (p) => p.season === String(season) && p.round === round && p.owner_id === rosterIdNum && p.previous_owner_id !== rosterIdNum
          );

          if (tradedAway && !tradedIn) {
            // Team traded this pick away, skip it
            continue;
          }

          if (tradedIn) {
            // Got a pick from another team
            const originalOwner = rosters.find((r) => r.roster_id === tradedIn.previous_owner_id);
            const originalUser = originalOwner ? userMap.get(originalOwner.owner_id) : null;
            const tradedPickValue = dynastyEngine.getDraftPickValue(String(season), round);
            picks.push({
              id: `${season}-${round}-${tradedIn.previous_owner_id}`,
              name: `${season} Round ${round} (from ${originalUser?.display_name || "Unknown"})`,
              season: String(season),
              round,
              originalOwner: originalUser?.display_name || "Unknown",
              isOwn: false,
              value: tradedPickValue.value,
            });
          } else {
            // Own pick
            const ownPickValue = dynastyEngine.getDraftPickValue(String(season), round);
            picks.push({
              id,
              name: `${season} Round ${round}`,
              season: String(season),
              round,
              isOwn: true,
              value: ownPickValue.value,
            });
          }
        }
      }

      // Calculate total roster value
      const allPlayers2 = [...starters, ...bench, ...taxi, ...ir];
      const totalPlayerValue = allPlayers2.reduce((sum, p) => sum + p.value, 0);
      const totalPickValue = picks.reduce((sum, p) => sum + p.value, 0);

      res.json({
        rosterId: roster.roster_id,
        ownerId: roster.owner_id,
        ownerName: user?.display_name || "Unknown",
        avatar: user?.avatar ? `https://sleepercdn.com/avatars/thumbs/${user.avatar}` : null,
        record: {
          wins: roster.settings.wins || 0,
          losses: roster.settings.losses || 0,
          ties: roster.settings.ties || 0,
          pointsFor: (roster.settings.fpts || 0) + (roster.settings.fpts_decimal || 0) / 100,
          pointsAgainst: (roster.settings.fpts_against || 0) + (roster.settings.fpts_against_decimal || 0) / 100,
          maxPoints: (roster.settings.ppts || 0) + (roster.settings.ppts_decimal || 0) / 100,
        },
        starters,
        bench,
        taxi,
        ir,
        picks,
        totalPlayerValue,
        totalPickValue,
        totalValue: totalPlayerValue + totalPickValue,
      });
    } catch (error) {
      console.error("Error fetching team:", error);
      res.status(500).json({ message: "Failed to fetch team" });
    }
  });

  // Analyze trade
  app.post("/api/trade/analyze", isAuthenticated, async (req: any, res: Response) => {
    try {
      const parsed = analyzeTradeSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid trade data" });
      }

      const { leagueId, teamAId, teamBId, teamAName, teamBName, teamAAssets, teamBAssets } = parsed.data;

      const teamADisplayName = teamAName || "Team A";
      const teamBDisplayName = teamBName || "Team B";

      const teamAValue = teamAAssets.reduce((sum: number, a) => sum + a.value, 0);
      const teamBValue = teamBAssets.reduce((sum: number, a) => sum + a.value, 0);

      // Calculate KTC-style adjusted values (stud premium)
      const adjustmentResult = dynastyEngine.calculateTradeAdjustment(teamAAssets, teamBAssets);

      const gradeResult = dynastyEngine.calculateTradeGrade(teamAValue, teamBValue);

      // Generate AI analysis
      let aiAnalysis = "";
      try {
        const teamAPlayerNames = teamAAssets.map((a: any) => a.name).join(", ");
        const teamBPlayerNames = teamBAssets.map((a: any) => a.name).join(", ");

        const prompt = `Analyze this fantasy football dynasty trade:

TRADE DETAILS:
- ${teamADisplayName} SENDS: ${teamAPlayerNames || "Nothing"} (raw value: ${teamAValue.toFixed(1)}, adjusted: ${adjustmentResult.teamA.adjustedTotal.toFixed(1)})
- ${teamADisplayName} RECEIVES: ${teamBPlayerNames || "Nothing"} (raw value: ${teamBValue.toFixed(1)}, adjusted: ${adjustmentResult.teamB.adjustedTotal.toFixed(1)})

- ${teamBDisplayName} SENDS: ${teamBPlayerNames || "Nothing"} (raw value: ${teamBValue.toFixed(1)}, adjusted: ${adjustmentResult.teamB.adjustedTotal.toFixed(1)})
- ${teamBDisplayName} RECEIVES: ${teamAPlayerNames || "Nothing"} (raw value: ${teamAValue.toFixed(1)}, adjusted: ${adjustmentResult.teamA.adjustedTotal.toFixed(1)})

Trade grade: ${gradeResult.grade}
Fairness: ${adjustmentResult.isFair ? "Fair trade (within 5%)" : `${adjustmentResult.winner === "A" ? teamADisplayName : teamBDisplayName} wins by ${Math.abs(adjustmentResult.fairnessPercent).toFixed(1)}%`}
${adjustmentResult.winner === "A" ? `${teamADisplayName} receives more value.` : adjustmentResult.winner === "B" ? `${teamBDisplayName} receives more value.` : "Trade is even."}

Provide a brief 2-3 sentence analysis. Be specific about who wins and what they're getting. Use the owner names ${teamADisplayName} and ${teamBDisplayName}, never "Team A" or "Team B".`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are a fantasy football trade analyst. Provide brief, insightful trade analysis.",
            },
            { role: "user", content: prompt },
          ],
          max_completion_tokens: 200,
        });

        aiAnalysis = response.choices[0]?.message?.content || "";
      } catch (aiError) {
        console.error("AI analysis error:", aiError);
        aiAnalysis = "AI analysis unavailable at this time.";
      }

      res.json({
        teamA: {
          teamId: teamAId,
          teamName: teamADisplayName,
          assets: teamAAssets,
          totalValue: teamAValue,
          adjustedTotal: adjustmentResult.teamA.adjustedTotal,
        },
        teamB: {
          teamId: teamBId,
          teamName: teamBDisplayName,
          assets: teamBAssets,
          totalValue: teamBValue,
          adjustedTotal: adjustmentResult.teamB.adjustedTotal,
        },
        difference: gradeResult.difference,
        percentageDiff: gradeResult.percentageDiff,
        grade: gradeResult.grade,
        winner: adjustmentResult.winner, // Use adjustment-based winner
        fairnessPercent: adjustmentResult.fairnessPercent,
        isFair: adjustmentResult.isFair,
        aiAnalysis,
      });
    } catch (error) {
      console.error("Error analyzing trade:", error);
      res.status(500).json({ message: "Failed to analyze trade" });
    }
  });

  // Get trade history (all seasons)
  app.get("/api/sleeper/trades/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;

      const [historicalTransactions, rosters, users, allPlayers, league] = await Promise.all([
        sleeperApi.getAllHistoricalTransactions(leagueId),
        sleeperApi.getLeagueRosters(leagueId),
        sleeperApi.getLeagueUsers(leagueId),
        sleeperApi.getAllPlayers(),
        sleeperApi.getLeague(leagueId),
      ]);

      // Fetch consensus values for blended dynasty values
      try {
        await dynastyConsensusService.fetchAndCacheValues();
      } catch (e) {
        console.log(`[Trade History] Failed to fetch consensus values: ${e}`);
      }

      // Check if league is Superflex/2QB
      const isSuperflex = dynastyEngine.isLeagueSuperflex(league);

      if (!historicalTransactions || !rosters) {
        return res.json({ 
          seasonTrades: [], 
          teamStats: [], 
          leagueHistory: [], 
          bestTrades: [], 
          totalTrades: 0,
          currentSeason: "2025"
        });
      }

      const userMap = new Map((users || []).map((u: sleeperApi.SleeperUser) => [u.user_id, u]));
      const rosterToOwner = new Map(rosters.map((r: sleeperApi.SleeperRoster) => [r.roster_id, r.owner_id]));
      const playerData = allPlayers || {};

      // Helper to format player names as "First Initial. Last Name"
      const formatPlayerName = (fullName: string): string => {
        if (!fullName) return "Unknown";
        const parts = fullName.split(" ");
        if (parts.length === 1) return fullName;
        const firstName = parts[0];
        const lastName = parts.slice(1).join(" ");
        return `${firstName.charAt(0)}. ${lastName}`;
      };

      // Helper to get blended asset value (league + KTC consensus)
      const getAssetValue = (asset: { type: string; id: string; name: string; position?: string }): number => {
        if (asset.type === "player") {
          const player = playerData[asset.id];
          const position = asset.position || player?.fantasy_positions?.[0] || "WR";
          const age = player?.age || 25;
          const yearsExp = player?.years_exp || 0;
          const playerName = player?.full_name || asset.name;
          const consensusValue = dynastyConsensusService.getNormalizedValue(playerName, position, isSuperflex);
          const valueResult = dynastyEngine.getBlendedPlayerValue(
            asset.id,
            playerName,
            position,
            age,
            yearsExp,
            player?.injury_status,
            {},
            null,
            null,
            consensusValue
          );
          return valueResult.value;
        } else if (asset.type === "pick") {
          const match = asset.name.match(/(\d{4}) Round (\d+)/);
          if (match) {
            const year = match[1];
            const round = parseInt(match[2]);
            return dynastyEngine.getDraftPickValue(year, round).value;
          }
        }
        return 0;
      };

      // Process trades by season
      const seasonTrades: any[] = [];
      const allTrades: any[] = [];

      for (const seasonData of historicalTransactions) {
        const tradesForSeason = seasonData.transactions
          .filter((t) => t.type === "trade" && t.status === "complete")
          .sort((a, b) => b.created - a.created)
          .map((trade) => {
            const [rosterId1, rosterId2] = trade.roster_ids;
            const ownerId1 = rosterToOwner.get(rosterId1);
            const ownerId2 = rosterToOwner.get(rosterId2);
            const user1 = ownerId1 ? userMap.get(ownerId1) : null;
            const user2 = ownerId2 ? userMap.get(ownerId2) : null;

            const team1Received: any[] = [];
            const team2Received: any[] = [];

            // Players
            if (trade.adds) {
              Object.entries(trade.adds).forEach(([playerId, rosterId]) => {
                const player = playerData[playerId];
                const asset = {
                  id: playerId,
                  name: player?.full_name || playerId,
                  displayName: formatPlayerName(player?.full_name || playerId),
                  type: "player" as const,
                  position: player?.fantasy_positions?.[0],
                };
                if (rosterId === rosterId1) team1Received.push(asset);
                else if (rosterId === rosterId2) team2Received.push(asset);
              });
            }

            // Draft picks
            if (trade.draft_picks) {
              trade.draft_picks.forEach((pick) => {
                const asset = {
                  id: `${pick.season}-${pick.round}`,
                  name: `${pick.season} Round ${pick.round}`,
                  displayName: `'${pick.season.slice(-2)} Rd ${pick.round}`,
                  type: "pick" as const,
                };
                if (pick.owner_id === rosterId1) team1Received.push(asset);
                else if (pick.owner_id === rosterId2) team2Received.push(asset);
              });
            }

            // Calculate trade values
            const team1Value = team1Received.reduce((sum, a) => sum + getAssetValue(a), 0);
            const team2Value = team2Received.reduce((sum, a) => sum + getAssetValue(a), 0);
            const valueDiff = team1Value - team2Value;

            return {
              transactionId: trade.transaction_id,
              timestamp: trade.created,
              week: trade.leg,
              season: seasonData.season,
              team1: {
                rosterId: rosterId1,
                ownerName: user1?.display_name || user1?.username || "Unknown",
                avatar: sleeperApi.getAvatarUrl(user1?.avatar || null),
                received: team1Received,
                value: team1Value,
              },
              team2: {
                rosterId: rosterId2,
                ownerName: user2?.display_name || user2?.username || "Unknown",
                avatar: sleeperApi.getAvatarUrl(user2?.avatar || null),
                received: team2Received,
                value: team2Value,
              },
              valueDiff,
              absValueDiff: Math.abs(valueDiff),
            };
          });

        if (tradesForSeason.length > 0) {
          seasonTrades.push({
            season: seasonData.season,
            trades: tradesForSeason,
          });
          allTrades.push(...tradesForSeason);
        }
      }

      // Calculate team stats across all seasons
      const teamStats = new Map<string, any>();
      
      rosters.forEach((roster) => {
        const user = userMap.get(roster.owner_id);
        teamStats.set(roster.owner_id, {
          ownerId: roster.owner_id,
          ownerName: user?.display_name || user?.username || "Unknown",
          avatar: sleeperApi.getAvatarUrl(user?.avatar || null),
          totalTrades: 0,
          tradingPartners: {},
        });
      });

      allTrades.forEach((trade) => {
        const stats1 = teamStats.get(rosterToOwner.get(trade.team1.rosterId) || "");
        const stats2 = teamStats.get(rosterToOwner.get(trade.team2.rosterId) || "");

        if (stats1) {
          stats1.totalTrades++;
          stats1.tradingPartners[trade.team2.ownerName] = 
            (stats1.tradingPartners[trade.team2.ownerName] || 0) + 1;
        }
        if (stats2) {
          stats2.totalTrades++;
          stats2.tradingPartners[trade.team1.ownerName] = 
            (stats2.tradingPartners[trade.team1.ownerName] || 0) + 1;
        }
      });

      // Find best and worst trades (by value difference)
      const tradesWithValue = allTrades.filter(t => t.absValueDiff > 0);
      const sortedByDiff = [...tradesWithValue].sort((a, b) => b.absValueDiff - a.absValueDiff);
      const topTrades = sortedByDiff.slice(0, 5);

      // Generate AI analysis for top trades
      const generateTradeAnalysis = async (trade: any): Promise<string> => {
        const winner = trade.valueDiff > 0 ? trade.team1 : trade.team2;
        const loser = trade.valueDiff > 0 ? trade.team2 : trade.team1;
        const winnerAssets = winner.received.map((a: any) => a.displayName || a.name).join(", ");
        const loserAssets = loser.received.map((a: any) => a.displayName || a.name).join(", ");

        try {
          const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "You are a dynasty fantasy football expert analyzing trade history. Give a brief, insightful analysis of this trade in 1-2 sentences. Focus on why the trade was good or bad for the winner.",
              },
              {
                role: "user",
                content: `In ${trade.season}, ${winner.ownerName} traded ${loserAssets} and received ${winnerAssets}. They gained ${trade.absValueDiff} in dynasty value. Why was this a good trade for them?`,
              },
            ],
            max_tokens: 100,
          });
          return response.choices[0]?.message?.content || "Trade analysis unavailable";
        } catch (error) {
          return "Trade analysis unavailable";
        }
      };

      // Generate AI analysis for top 3 trades only (to keep API costs down)
      const bestTradesWithAnalysis = await Promise.all(
        topTrades.slice(0, 3).map(async (trade) => {
          const analysis = await generateTradeAnalysis(trade);
          const winner = trade.valueDiff > 0 ? trade.team1.ownerName : trade.team2.ownerName;
          const loser = trade.valueDiff > 0 ? trade.team2.ownerName : trade.team1.ownerName;
          return {
            ...trade,
            winner,
            loser,
            aiAnalysis: analysis,
          };
        })
      );

      const leagueHistory = await sleeperApi.getLeagueHistory(leagueId);

      res.json({
        seasonTrades,
        teamStats: Array.from(teamStats.values()),
        leagueHistory: leagueHistory.map(h => h.season),
        currentSeason: league?.season || "2025",
        bestTrades: bestTradesWithAnalysis,
        totalTrades: allTrades.length,
      });
    } catch (error) {
      console.error("Error fetching trades:", error);
      res.status(500).json({ message: "Failed to fetch trade history" });
    }
  });

  // Get trophy room data
  app.get("/api/sleeper/trophies/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;

      const [league, leagueHistory, historicalRosters] = await Promise.all([
        sleeperApi.getLeague(leagueId),
        sleeperApi.getLeagueHistory(leagueId),
        sleeperApi.getAllHistoricalRosters(leagueId),
      ]);

      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      // Get playoff brackets for all seasons to find champions
      const bracketPromises = leagueHistory.map(async (h) => {
        const bracket = await sleeperApi.getPlayoffBracket(h.leagueId);
        return { season: h.season, leagueId: h.leagueId, bracket };
      });
      const allBrackets = await Promise.all(bracketPromises);

      // Build user map from all seasons (most recent data takes priority)
      const globalUserMap = new Map<string, sleeperApi.SleeperUser>();
      for (const seasonData of historicalRosters) {
        for (const user of seasonData.users) {
          if (!globalUserMap.has(user.user_id)) {
            globalUserMap.set(user.user_id, user);
          }
        }
      }

      // Find champions for each completed season
      const champions: { season: string; rosterId: number; ownerName: string; avatar: string | null }[] = [];
      for (const bracketData of allBrackets) {
        const championRosterId = sleeperApi.findChampionFromBracket(bracketData.bracket);
        if (championRosterId) {
          const seasonRosters = historicalRosters.find(sr => sr.season === bracketData.season);
          if (seasonRosters) {
            const championRoster = seasonRosters.rosters.find(r => r.roster_id === championRosterId);
            if (championRoster) {
              const user = globalUserMap.get(championRoster.owner_id);
              champions.push({
                season: bracketData.season,
                rosterId: championRosterId,
                ownerName: user?.display_name || user?.username || "Unknown",
                avatar: sleeperApi.getAvatarUrl(user?.avatar || null),
              });
            }
          }
        }
      }
      champions.sort((a, b) => b.season.localeCompare(a.season));

      // Aggregate all-time stats by owner
      const ownerStats = new Map<string, {
        ownerId: string;
        ownerName: string;
        avatar: string | null;
        totalWins: number;
        totalLosses: number;
        totalTies: number;
        totalPointsFor: number;
        totalMaxPoints: number;
        championships: number;
        seasonRecords: { season: string; wins: number; losses: number; ties: number; pointsFor: number; maxPoints: number }[];
      }>();

      for (const seasonData of historicalRosters) {
        for (const roster of seasonData.rosters) {
          const user = globalUserMap.get(roster.owner_id);
          const fpts = (roster.settings.fpts || 0) + (roster.settings.fpts_decimal || 0) / 100;
          const ppts = (roster.settings.ppts || 0) + (roster.settings.ppts_decimal || 0) / 100;
          
          const existing = ownerStats.get(roster.owner_id);
          if (existing) {
            existing.totalWins += roster.settings.wins || 0;
            existing.totalLosses += roster.settings.losses || 0;
            existing.totalTies += roster.settings.ties || 0;
            existing.totalPointsFor += fpts;
            existing.totalMaxPoints += ppts;
            existing.seasonRecords.push({
              season: seasonData.season,
              wins: roster.settings.wins || 0,
              losses: roster.settings.losses || 0,
              ties: roster.settings.ties || 0,
              pointsFor: fpts,
              maxPoints: ppts,
            });
          } else {
            ownerStats.set(roster.owner_id, {
              ownerId: roster.owner_id,
              ownerName: user?.display_name || user?.username || "Unknown",
              avatar: sleeperApi.getAvatarUrl(user?.avatar || null),
              totalWins: roster.settings.wins || 0,
              totalLosses: roster.settings.losses || 0,
              totalTies: roster.settings.ties || 0,
              totalPointsFor: fpts,
              totalMaxPoints: ppts,
              championships: 0,
              seasonRecords: [{
                season: seasonData.season,
                wins: roster.settings.wins || 0,
                losses: roster.settings.losses || 0,
                ties: roster.settings.ties || 0,
                pointsFor: fpts,
                maxPoints: ppts,
              }],
            });
          }
        }
      }

      // Count championships per owner
      for (const champion of champions) {
        const seasonRosters = historicalRosters.find(sr => sr.season === champion.season);
        if (seasonRosters) {
          const championRoster = seasonRosters.rosters.find(r => r.roster_id === champion.rosterId);
          if (championRoster) {
            const stats = ownerStats.get(championRoster.owner_id);
            if (stats) {
              stats.championships += 1;
            }
          }
        }
      }

      // Build all-time records sorted by wins
      const allTimeRecords = Array.from(ownerStats.values()).map(stats => {
        const totalGames = stats.totalWins + stats.totalLosses + stats.totalTies;
        return {
          ownerId: stats.ownerId,
          ownerName: stats.ownerName,
          avatar: stats.avatar,
          totalWins: stats.totalWins,
          totalLosses: stats.totalLosses,
          totalTies: stats.totalTies,
          totalPointsFor: Math.round(stats.totalPointsFor * 100) / 100,
          totalMaxPoints: Math.round(stats.totalMaxPoints * 100) / 100,
          championships: stats.championships,
          winPercentage: totalGames > 0 ? stats.totalWins / totalGames : 0,
        };
      }).sort((a, b) => {
        if (a.totalWins !== b.totalWins) return b.totalWins - a.totalWins;
        return b.totalPointsFor - a.totalPointsFor;
      });

      // Calculate season records (best single-season performances)
      interface SeasonRecord {
        ownerName: string;
        avatar: string | null;
        season: string;
        value: number;
        record?: string;
      }
      
      let bestSeasonRecord: SeasonRecord | null = null;
      let bestSeasonPoints: SeasonRecord | null = null;
      let bestSeasonMaxPoints: SeasonRecord | null = null;

      for (const [ownerId, stats] of Array.from(ownerStats.entries())) {
        for (const sr of stats.seasonRecords) {
          const totalGames = sr.wins + sr.losses + sr.ties;
          if (totalGames === 0) continue;

          const winPct = sr.wins / totalGames;
          
          // Best win/loss record
          if (!bestSeasonRecord || winPct > bestSeasonRecord.value || 
              (winPct === bestSeasonRecord.value && sr.wins > (bestSeasonRecord.record?.split('-')[0] ? parseInt(bestSeasonRecord.record.split('-')[0]) : 0))) {
            bestSeasonRecord = {
              ownerName: stats.ownerName,
              avatar: stats.avatar,
              season: sr.season,
              value: winPct,
              record: `${sr.wins}-${sr.losses}${sr.ties > 0 ? `-${sr.ties}` : ''}`,
            };
          }

          // Best points for in a season
          if (!bestSeasonPoints || sr.pointsFor > bestSeasonPoints.value) {
            bestSeasonPoints = {
              ownerName: stats.ownerName,
              avatar: stats.avatar,
              season: sr.season,
              value: Math.round(sr.pointsFor * 100) / 100,
            };
          }

          // Best max points in a season
          if (!bestSeasonMaxPoints || sr.maxPoints > bestSeasonMaxPoints.value) {
            bestSeasonMaxPoints = {
              ownerName: stats.ownerName,
              avatar: stats.avatar,
              season: sr.season,
              value: Math.round(sr.maxPoints * 100) / 100,
            };
          }
        }
      }

      // Top all-time performers
      const topPointsFor = [...allTimeRecords].sort((a, b) => b.totalPointsFor - a.totalPointsFor)[0] || null;
      const topWinPercentage = [...allTimeRecords].filter(r => (r.totalWins + r.totalLosses + r.totalTies) >= 10)
        .sort((a, b) => b.winPercentage - a.winPercentage)[0] || allTimeRecords[0] || null;

      res.json({
        champions,
        allTimeRecords,
        topPointsFor,
        topWinPercentage,
        bestSeasonRecord,
        bestSeasonPoints,
        bestSeasonMaxPoints,
        leagueName: league.name,
        leagueAge: leagueHistory.length,
        seasons: leagueHistory.map(h => h.season).sort((a, b) => b.localeCompare(a)),
      });
    } catch (error) {
      console.error("Error fetching trophies:", error);
      res.status(500).json({ message: "Failed to fetch trophy room" });
    }
  });

  // Rivalry Head-to-Head Records
  app.get("/api/sleeper/rivalries/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      
      const league = await sleeperApi.getLeague(leagueId);
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      const leagueHistory = await sleeperApi.getLeagueHistory(leagueId);
      
      interface MatchupResult {
        season: string;
        week: number;
        roster1Points: number;
        roster2Points: number;
        winner: number;
      }

      interface RivalryRecord {
        rosterId1: number;
        rosterId2: number;
        owner1Name: string;
        owner2Name: string;
        owner1Avatar: string | null;
        owner2Avatar: string | null;
        owner1Wins: number;
        owner2Wins: number;
        ties: number;
        totalGames: number;
        owner1TotalPoints: number;
        owner2TotalPoints: number;
        matchups: MatchupResult[];
      }

      const rivalryMap = new Map<string, RivalryRecord>();
      
      for (const historyEntry of leagueHistory) {
        const rosters = await sleeperApi.getLeagueRosters(historyEntry.leagueId);
        const users = await sleeperApi.getLeagueUsers(historyEntry.leagueId);
        const seasonLeague = await sleeperApi.getLeague(historyEntry.leagueId);
        
        if (!rosters || !users || !seasonLeague) continue;

        const userMap = new Map(users.map(u => [u.user_id, u]));
        const rosterOwnerMap = new Map<number, { name: string; avatar: string | null }>();
        
        for (const roster of rosters) {
          const user = userMap.get(roster.owner_id);
          rosterOwnerMap.set(roster.roster_id, {
            name: user?.display_name || user?.username || `Team ${roster.roster_id}`,
            avatar: user?.avatar ? `https://sleepercdn.com/avatars/thumbs/${user.avatar}` : null,
          });
        }

        const regularSeasonWeeks = seasonLeague.settings?.playoff_week_start 
          ? seasonLeague.settings.playoff_week_start - 1 
          : 14;

        for (let week = 1; week <= regularSeasonWeeks; week++) {
          const matchups = await sleeperApi.getMatchups(historyEntry.leagueId, week);
          if (!matchups || matchups.length === 0) continue;

          const matchupGroups = new Map<number, sleeperApi.SleeperMatchup[]>();
          for (const m of matchups) {
            if (m.matchup_id === null) continue;
            if (!matchupGroups.has(m.matchup_id)) {
              matchupGroups.set(m.matchup_id, []);
            }
            matchupGroups.get(m.matchup_id)!.push(m);
          }

          for (const [, group] of Array.from(matchupGroups)) {
            if (group.length !== 2) continue;
            
            const sortedGroup = [...group].sort((a: sleeperApi.SleeperMatchup, b: sleeperApi.SleeperMatchup) => a.roster_id - b.roster_id);
            const [m1, m2] = sortedGroup;
            const key = `${m1.roster_id}-${m2.roster_id}`;
            
            const owner1 = rosterOwnerMap.get(m1.roster_id);
            const owner2 = rosterOwnerMap.get(m2.roster_id);
            
            if (!owner1 || !owner2) continue;

            if (!rivalryMap.has(key)) {
              rivalryMap.set(key, {
                rosterId1: m1.roster_id,
                rosterId2: m2.roster_id,
                owner1Name: owner1.name,
                owner2Name: owner2.name,
                owner1Avatar: owner1.avatar,
                owner2Avatar: owner2.avatar,
                owner1Wins: 0,
                owner2Wins: 0,
                ties: 0,
                totalGames: 0,
                owner1TotalPoints: 0,
                owner2TotalPoints: 0,
                matchups: [],
              });
            }

            const rivalry = rivalryMap.get(key)!;
            rivalry.totalGames++;
            rivalry.owner1TotalPoints += m1.points || 0;
            rivalry.owner2TotalPoints += m2.points || 0;

            let winner: number;
            if ((m1.points || 0) > (m2.points || 0)) {
              rivalry.owner1Wins++;
              winner = m1.roster_id;
            } else if ((m2.points || 0) > (m1.points || 0)) {
              rivalry.owner2Wins++;
              winner = m2.roster_id;
            } else {
              rivalry.ties++;
              winner = 0;
            }

            rivalry.matchups.push({
              season: historyEntry.season,
              week,
              roster1Points: m1.points || 0,
              roster2Points: m2.points || 0,
              winner,
            });
          }
        }
      }

      const rivalries = Array.from(rivalryMap.values())
        .filter(r => r.totalGames > 0)
        .sort((a, b) => {
          // Sort by highest winning percentage (the dominant owner's win rate)
          const aMaxWinPct = Math.max(a.owner1Wins, a.owner2Wins) / a.totalGames;
          const bMaxWinPct = Math.max(b.owner1Wins, b.owner2Wins) / b.totalGames;
          if (bMaxWinPct !== aMaxWinPct) {
            return bMaxWinPct - aMaxWinPct;
          }
          // Tiebreaker: more total games first
          return b.totalGames - a.totalGames;
        });

      // Organize by team for accordion view
      interface TeamRecord {
        rosterId: number;
        ownerName: string;
        avatar: string | null;
        totalWins: number;
        totalLosses: number;
        totalTies: number;
        totalGames: number;
        opponents: {
          opponentRosterId: number;
          opponentName: string;
          opponentAvatar: string | null;
          wins: number;
          losses: number;
          ties: number;
          totalGames: number;
          winPct: number;
          matchups: MatchupResult[];
        }[];
      }

      const teamMap = new Map<number, TeamRecord>();

      for (const rivalry of rivalries) {
        // Add for owner1
        if (!teamMap.has(rivalry.rosterId1)) {
          teamMap.set(rivalry.rosterId1, {
            rosterId: rivalry.rosterId1,
            ownerName: rivalry.owner1Name,
            avatar: rivalry.owner1Avatar,
            totalWins: 0,
            totalLosses: 0,
            totalTies: 0,
            totalGames: 0,
            opponents: [],
          });
        }
        const team1 = teamMap.get(rivalry.rosterId1)!;
        team1.totalWins += rivalry.owner1Wins;
        team1.totalLosses += rivalry.owner2Wins;
        team1.totalTies += rivalry.ties;
        team1.totalGames += rivalry.totalGames;
        team1.opponents.push({
          opponentRosterId: rivalry.rosterId2,
          opponentName: rivalry.owner2Name,
          opponentAvatar: rivalry.owner2Avatar,
          wins: rivalry.owner1Wins,
          losses: rivalry.owner2Wins,
          ties: rivalry.ties,
          totalGames: rivalry.totalGames,
          winPct: rivalry.totalGames > 0 ? rivalry.owner1Wins / rivalry.totalGames : 0,
          matchups: rivalry.matchups.map(m => ({
            ...m,
            teamPoints: m.roster1Points,
            opponentPoints: m.roster2Points,
            won: m.winner === rivalry.rosterId1,
          })),
        });

        // Add for owner2
        if (!teamMap.has(rivalry.rosterId2)) {
          teamMap.set(rivalry.rosterId2, {
            rosterId: rivalry.rosterId2,
            ownerName: rivalry.owner2Name,
            avatar: rivalry.owner2Avatar,
            totalWins: 0,
            totalLosses: 0,
            totalTies: 0,
            totalGames: 0,
            opponents: [],
          });
        }
        const team2 = teamMap.get(rivalry.rosterId2)!;
        team2.totalWins += rivalry.owner2Wins;
        team2.totalLosses += rivalry.owner1Wins;
        team2.totalTies += rivalry.ties;
        team2.totalGames += rivalry.totalGames;
        team2.opponents.push({
          opponentRosterId: rivalry.rosterId1,
          opponentName: rivalry.owner1Name,
          opponentAvatar: rivalry.owner1Avatar,
          wins: rivalry.owner2Wins,
          losses: rivalry.owner1Wins,
          ties: rivalry.ties,
          totalGames: rivalry.totalGames,
          winPct: rivalry.totalGames > 0 ? rivalry.owner2Wins / rivalry.totalGames : 0,
          matchups: rivalry.matchups.map(m => ({
            ...m,
            teamPoints: m.roster2Points,
            opponentPoints: m.roster1Points,
            won: m.winner === rivalry.rosterId2,
          })),
        });
      }

      // Sort each team's opponents by win percentage (best to worst)
      Array.from(teamMap.values()).forEach((team: TeamRecord) => {
        team.opponents.sort((a, b) => b.winPct - a.winPct);
      });

      // Convert to array and sort teams by overall win percentage
      const teamRecords = Array.from(teamMap.values())
        .sort((a, b) => {
          const aWinPct = a.totalGames > 0 ? a.totalWins / a.totalGames : 0;
          const bWinPct = b.totalGames > 0 ? b.totalWins / b.totalGames : 0;
          return bWinPct - aWinPct;
        });

      res.json({
        rivalries,
        teamRecords,
        leagueName: league.name,
        totalSeasons: leagueHistory.length,
        seasons: leagueHistory.map(h => h.season).sort((a, b) => b.localeCompare(a)),
      });
    } catch (error) {
      console.error("Error fetching rivalries:", error);
      res.status(500).json({ message: "Failed to fetch rivalry data" });
    }
  });

  // ============================================
  // NOTIFICATIONS & REAL-TIME UPDATES
  // ============================================

  // Helper to verify user belongs to a league
  async function verifyUserInLeague(userId: string, leagueId: string): Promise<boolean> {
    try {
      const profile = await storage.getUserProfile(userId);
      if (!profile?.sleeperUserId) return false;
      
      // Use league_season for dynasty leagues that have rolled over
      const state = await sleeperApi.getState();
      const leagueSeason = state?.league_season || state?.season || "2026";
      const leagues = await sleeperApi.getUserLeagues(profile.sleeperUserId, leagueSeason);
      return leagues?.some(l => l.league_id === leagueId) || false;
    } catch {
      return false;
    }
  }

  // Get notifications for a league
  app.get("/api/notifications/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { leagueId } = req.params;
      
      // Verify user has access to this league
      const hasAccess = await verifyUserInLeague(userId, leagueId);
      if (!hasAccess) {
        return res.status(403).json({ message: "You don't have access to this league" });
      }
      
      const notifications = await storage.getNotificationsByLeague(leagueId, 50);
      res.json({ notifications });
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  // Get unread notifications for a user
  app.get("/api/notifications/:leagueId/unread", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { leagueId } = req.params;
      
      // Verify user has access to this league
      const hasAccess = await verifyUserInLeague(userId, leagueId);
      if (!hasAccess) {
        return res.status(403).json({ message: "You don't have access to this league" });
      }
      
      const notifications = await storage.getUnreadNotifications(userId, leagueId);
      res.json({ notifications, unreadCount: notifications.length });
    } catch (error) {
      console.error("Error fetching unread notifications:", error);
      res.status(500).json({ message: "Failed to fetch unread notifications" });
    }
  });

  // Mark notifications as read
  app.post("/api/notifications/mark-read", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { notificationIds, leagueId } = req.body;
      
      if (!Array.isArray(notificationIds)) {
        return res.status(400).json({ message: "notificationIds must be an array" });
      }
      
      if (!leagueId) {
        return res.status(400).json({ message: "leagueId is required" });
      }
      
      // Verify user has access to this league
      const hasAccess = await verifyUserInLeague(userId, leagueId);
      if (!hasAccess) {
        return res.status(403).json({ message: "You don't have access to this league" });
      }
      
      // Verify the notifications belong to this league before marking as read
      const leagueNotifications = await storage.getNotificationsByLeague(leagueId, 100);
      const validIds = new Set(leagueNotifications.map(n => n.id));
      const filteredIds = notificationIds.filter(id => validIds.has(id));
      
      if (filteredIds.length > 0) {
        await storage.markNotificationsRead(userId, filteredIds);
      }
      
      res.json({ success: true, markedCount: filteredIds.length });
    } catch (error) {
      console.error("Error marking notifications read:", error);
      res.status(500).json({ message: "Failed to mark notifications as read" });
    }
  });

  // Check for new transactions and create notifications
  app.post("/api/notifications/:leagueId/sync", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      
      // Get current league state
      const [league, rosters, users, allPlayers] = await Promise.all([
        sleeperApi.getLeague(leagueId),
        sleeperApi.getLeagueRosters(leagueId),
        sleeperApi.getLeagueUsers(leagueId),
        sleeperApi.getAllPlayers(),
      ]);
      
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }
      
      const userMap = new Map((users || []).map((u: sleeperApi.SleeperUser) => [u.user_id, u]));
      const rosterUserMap = new Map((rosters || []).map((r: sleeperApi.SleeperRoster) => [r.roster_id, r.owner_id]));
      
      const getTeamName = (rosterId: number) => {
        const ownerId = rosterUserMap.get(rosterId);
        const user = ownerId ? userMap.get(ownerId) : null;
        return user?.metadata?.team_name || user?.display_name || `Team ${rosterId}`;
      };
      
      const getPlayerName = (playerId: string) => {
        const player = allPlayers?.[playerId];
        return player ? `${player.first_name} ${player.last_name}` : playerId;
      };
      
      // Get sync status
      const syncStatus = await storage.getSyncStatus(leagueId);
      const currentWeek = league.settings?.leg || 1;
      
      // Fetch recent transactions (last 3 weeks to catch any missed)
      const weeksToCheck = [currentWeek, Math.max(1, currentWeek - 1), Math.max(1, currentWeek - 2)];
      const transactionPromises = weeksToCheck.map(week => sleeperApi.getLeagueTransactions(leagueId, week));
      const transactionResults = await Promise.all(transactionPromises);
      const allTransactions = transactionResults.flat();
      
      // Filter to only completed transactions
      const completedTransactions = allTransactions.filter(t => t.status === "complete");
      
      // Sort by created timestamp (newest first)
      completedTransactions.sort((a, b) => (b.created || 0) - (a.created || 0));
      
      // Take only the most recent transactions (limit to 20)
      const recentTransactions = completedTransactions.slice(0, 20);
      
      let newNotifications = 0;
      
      for (const transaction of recentTransactions) {
        const transactionId = transaction.transaction_id;
        
        // Check if we already have a notification for this transaction
        const exists = await storage.notificationExists(transactionId);
        if (exists) continue;
        
        let title = "";
        let message = "";
        let type = transaction.type;
        
        if (transaction.type === "trade") {
          // Trade notification
          const rosterIds = transaction.roster_ids || [];
          const teamNames = rosterIds.map((id: number) => getTeamName(id));
          
          title = "Trade Completed";
          
          // Build trade details
          const adds = transaction.adds || {};
          const drops = transaction.drops || {};
          const draftPicks = transaction.draft_picks || [];
          
          const tradeDetails: string[] = [];
          
          rosterIds.forEach((rosterId: number, index: number) => {
            const teamName = teamNames[index];
            const received: string[] = [];
            
            // Players received
            Object.entries(adds).forEach(([playerId, rId]) => {
              if (rId === rosterId) {
                received.push(getPlayerName(playerId));
              }
            });
            
            // Picks received
            draftPicks.forEach((pick: any) => {
              if (pick.owner_id === rosterId) {
                received.push(`${pick.season} Round ${pick.round} pick`);
              }
            });
            
            if (received.length > 0) {
              tradeDetails.push(`${teamName} receives: ${received.join(", ")}`);
            }
          });
          
          message = tradeDetails.join(" | ");
        } else if (transaction.type === "waiver") {
          // Waiver claim
          const rosterId = transaction.roster_ids?.[0];
          const teamName = rosterId ? getTeamName(rosterId) : "Unknown";
          const adds = Object.keys(transaction.adds || {});
          const drops = Object.keys(transaction.drops || {});
          
          title = "Waiver Claim";
          
          const addedPlayers = adds.map(id => getPlayerName(id)).join(", ");
          const droppedPlayers = drops.map(id => getPlayerName(id)).join(", ");
          
          if (addedPlayers && droppedPlayers) {
            message = `${teamName} added ${addedPlayers} and dropped ${droppedPlayers}`;
          } else if (addedPlayers) {
            message = `${teamName} added ${addedPlayers}`;
          } else if (droppedPlayers) {
            message = `${teamName} dropped ${droppedPlayers}`;
          }
        } else if (transaction.type === "free_agent") {
          // Free agent pickup
          const rosterId = transaction.roster_ids?.[0];
          const teamName = rosterId ? getTeamName(rosterId) : "Unknown";
          const adds = Object.keys(transaction.adds || {});
          const drops = Object.keys(transaction.drops || {});
          
          title = "Free Agent Move";
          
          const addedPlayers = adds.map(id => getPlayerName(id)).join(", ");
          const droppedPlayers = drops.map(id => getPlayerName(id)).join(", ");
          
          if (addedPlayers && droppedPlayers) {
            message = `${teamName} added ${addedPlayers} and dropped ${droppedPlayers}`;
          } else if (addedPlayers) {
            message = `${teamName} added ${addedPlayers}`;
          } else if (droppedPlayers) {
            message = `${teamName} dropped ${droppedPlayers}`;
          }
        }
        
        if (title && message) {
          await storage.createNotification({
            leagueId,
            type,
            transactionId,
            title,
            message,
            metadata: {
              rosterIds: transaction.roster_ids,
              adds: transaction.adds,
              drops: transaction.drops,
              draftPicks: transaction.draft_picks,
              week: currentWeek,
            },
          });
          newNotifications++;
        }
      }
      
      // Update sync status
      await storage.updateSyncStatus(leagueId, {
        lastTransactionCheck: new Date(),
        lastKnownWeek: currentWeek,
      });
      
      // Return current notifications
      const notifications = await storage.getNotificationsByLeague(leagueId, 20);
      
      res.json({
        success: true,
        newNotifications,
        notifications,
      });
    } catch (error) {
      console.error("Error syncing notifications:", error);
      res.status(500).json({ message: "Failed to sync notifications" });
    }
  });

  // Fantasy News Feed - Real news from sports sources, personalized to user's roster
  app.get("/api/fantasy/news", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { leagueId } = req.query;
      const profile = await storage.getUserProfile(userId);
      
      const targetLeagueId = leagueId || profile?.selectedLeagueId;
      
      // Fetch all required data in parallel
      const [allPlayers, state, allRealNews, trendingPlayers] = await Promise.all([
        sleeperApi.getAllPlayers(),
        sleeperApi.getState(),
        newsService.fetchAllSportsNews(),
        newsService.fetchSleeperTrending(),
      ]);
      
      const currentWeek = state?.week || 1;
      const currentSeason = state?.season || new Date().getFullYear().toString();
      
      let rosterPlayerNames: string[] = [];
      
      // If user has a selected league, get their roster player names for filtering news
      if (targetLeagueId && profile?.sleeperUserId) {
        const rosters = await sleeperApi.getLeagueRosters(targetLeagueId);
        const userRoster = rosters.find((r: any) => r.owner_id === profile.sleeperUserId);
        
        if (userRoster) {
          const rosterIds = [...(userRoster.starters || []), ...(userRoster.players || [])];
          const uniqueRosterIds = Array.from(new Set(rosterIds));
          
          rosterPlayerNames = uniqueRosterIds
            .map(id => allPlayers[id])
            .filter(p => p && ["QB", "RB", "WR", "TE", "K", "DEF"].includes(p.position))
            .map(p => p.full_name || `${p.first_name} ${p.last_name}`);
        }
      }
      
      // Filter real news for players on the roster (if available)
      let relevantNews = rosterPlayerNames.length > 0
        ? newsService.filterNewsForPlayers(allRealNews, rosterPlayerNames)
        : [];
      
      // Also include general NFL news if we don't have enough roster-specific news
      if (relevantNews.length < 5) {
        const generalNews = allRealNews.slice(0, 15 - relevantNews.length);
        relevantNews = [...relevantNews, ...generalNews];
      }
      
      // Add trending players from Sleeper as news items
      const trendingNews = trendingPlayers.slice(0, 5).map((trending: any, idx: number) => {
        const player = allPlayers[trending.player_id];
        if (!player) return null;
        return {
          id: `trending-${trending.player_id}`,
          title: `${player.full_name} Trending Up on Waiver Wire`,
          summary: `${player.full_name} (${player.position}, ${player.team || "FA"}) has been added in ${trending.count || "many"} leagues over the past 24 hours. Consider adding if available.`,
          source: "Sleeper Trending",
          url: "#",
          publishedAt: new Date(Date.now() - idx * 10 * 60000).toISOString(),
          category: "waiver",
          players: [player.full_name],
        };
      }).filter(Boolean);
      
      // Format real news items
      const formattedRealNews = relevantNews.map((item, idx) => ({
        id: `real-${Date.now()}-${idx}`,
        title: item.title,
        summary: item.summary,
        source: item.source,
        url: item.url,
        publishedAt: item.publishedAt,
        category: item.category,
        players: item.players,
      }));
      
      // Combine all news: real news first, then trending waiver adds
      const allNews = [
        ...formattedRealNews,
        ...trendingNews,
      ].slice(0, 20);
      
      // Sort by published date (most recent first)
      allNews.sort((a: any, b: any) => 
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );

      res.json({
        news: allNews,
        lastUpdated: new Date().toISOString(),
        week: currentWeek,
        season: currentSeason,
      });
    } catch (error) {
      console.error("Error fetching fantasy news:", error);
      res.status(500).json({ message: "Failed to fetch news" });
    }
  });

  // NFL Game Odds - Vegas lines and spreads
  app.get("/api/fantasy/odds", isAuthenticated, async (req: any, res: Response) => {
    try {
      const odds = await oddsService.fetchNFLOdds();
      
      res.json({
        games: odds,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching NFL odds:", error);
      res.status(500).json({ message: "Failed to fetch odds" });
    }
  });

  // Player Trends - Multi-season analysis (no auth required - public player data)
  app.get("/api/fantasy/trends", async (req: any, res: Response) => {
    try {
      const allPlayers = await sleeperApi.getAllPlayers();
      
      // Get established players sorted by search rank (best first)
      const establishedPlayers = Object.entries(allPlayers)
        .filter(([_, p]: [string, any]) => 
          p && ["QB", "RB", "WR", "TE"].includes(p.position) && 
          p.team && p.years_exp && p.years_exp >= 2 &&
          p.search_rank && p.search_rank < 200
        )
        .map(([id, p]: [string, any]) => ({ id, ...p }))
        .sort((a, b) => (a.search_rank || 999) - (b.search_rank || 999))
        .slice(0, 50);
      
      // Calculate trends based on age and position curves
      const getPositionPeakAge = (pos: string) => {
        switch (pos) {
          case "QB": return { peak: 28, decline: 35 };
          case "RB": return { peak: 25, decline: 28 };
          case "WR": return { peak: 26, decline: 30 };
          case "TE": return { peak: 27, decline: 31 };
          default: return { peak: 27, decline: 30 };
        }
      };
      
      const getBasePpg = (pos: string) => {
        switch (pos) {
          case "QB": return { avg: 18, high: 25, low: 12 };
          case "RB": return { avg: 12, high: 20, low: 6 };
          case "WR": return { avg: 14, high: 22, low: 8 };
          case "TE": return { avg: 10, high: 16, low: 5 };
          default: return { avg: 10, high: 15, low: 5 };
        }
      };
      
      const players = establishedPlayers.map((p, idx) => {
        const age = p.age || 25;
        const { peak, decline } = getPositionPeakAge(p.position);
        const basePpg = getBasePpg(p.position);
        
        // Determine trend based on age relative to position peak
        let trend: "up" | "down" | "stable" = "stable";
        let trajectory = "";
        
        if (age < peak - 1) {
          trend = "up";
          trajectory = `${p.full_name} is entering prime years at age ${age}. Expect continued development.`;
        } else if (age > decline) {
          trend = "down";
          trajectory = `At ${age}, ${p.full_name} is past typical ${p.position} peak. May see gradual decline.`;
        } else if (age >= peak - 1 && age <= peak + 2) {
          trend = "stable";
          trajectory = `${p.full_name} is in prime years at age ${age}. Peak production expected.`;
        } else {
          trend = "stable";
          trajectory = `${p.full_name} remains a consistent performer entering year ${p.years_exp + 1}.`;
        }
        
        // Adjust PPG based on search rank (better rank = higher production)
        const rankMultiplier = Math.max(0.5, 1 - (p.search_rank || 100) / 400);
        const avgPpg = Math.round((basePpg.avg * rankMultiplier + basePpg.avg) / 2 * 10) / 10;
        const careerHigh = Math.round((basePpg.high * rankMultiplier + basePpg.high) / 2 * 10) / 10;
        const careerLow = Math.round(basePpg.low * 10) / 10;
        
        return {
          playerId: p.id,
          name: p.full_name || "Unknown",
          position: p.position || "?",
          team: p.team || "FA",
          age,
          trend,
          avgPpg,
          careerHigh,
          careerLow,
          trajectory,
          seasons: [], // Would need historical data for actual seasons
        };
      });

      res.json({ players });
    } catch (error) {
      console.error("Error fetching player trends:", error);
      res.status(500).json({ message: "Failed to fetch trends" });
    }
  });

  // Trending players - most added/dropped across Sleeper
  app.get("/api/sleeper/trending", isAuthenticated, async (req: any, res: Response) => {
    try {
      const type = (req.query.type as string) || "add";
      const limit = parseInt(req.query.limit as string) || 25;
      
      if (type !== "add" && type !== "drop") {
        return res.status(400).json({ message: "Invalid type. Must be 'add' or 'drop'" });
      }
      
      const [trendingPlayers, allPlayers] = await Promise.all([
        sleeperApi.getTrendingPlayers(type, limit),
        sleeperApi.getAllPlayers(),
      ]);
      
      // Enrich trending data with player info
      const enrichedPlayers = trendingPlayers.map((trending, index) => {
        const player = allPlayers[trending.player_id];
        if (!player) return null;
        
        return {
          id: trending.player_id,
          name: player.full_name || player.first_name + " " + player.last_name,
          position: player.position || "?",
          team: player.team || "FA",
          age: player.age || null,
          yearsExp: player.years_exp || 0,
          count: trending.count,
          rank: index + 1,
          number: player.number || null,
          headshot: player.espn_id ? `https://a.espncdn.com/i/headshots/nfl/players/full/${player.espn_id}.png` : null,
        };
      }).filter(Boolean);
      
      res.json({ 
        players: enrichedPlayers,
        type,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching trending players:", error);
      res.status(500).json({ message: "Failed to fetch trending players" });
    }
  });

  // Player Comparison - Get players for comparison
  app.get("/api/fantasy/compare/players", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.query;
      const allPlayers = await sleeperApi.getAllPlayers();

      let stats: Record<string, any> = {};
      try {
        stats = await sleeperApi.getSeasonStats("2025", "regular");
      } catch (e) {
        stats = {};
      }
      
      // Fetch consensus values from DynastyProcess (cached for 24h)
      try {
        await dynastyConsensusService.fetchAndCacheValues();
      } catch (e) {
        console.log(`[Compare Players] Failed to fetch consensus values: ${e}`);
      }
      const consensusStats = dynastyConsensusService.getCacheStats();
      console.log(`[Compare Players] Consensus values: ${consensusStats.size} players cached`);
      
      // Get league-specific scoring settings if a league is selected
      let leagueScoring: dynastyEngine.LeagueScoringSettings | null = null;
      let isSuperflex = false;
      if (leagueId) {
        try {
          const league = await sleeperApi.getLeague(leagueId as string);
          if (league) {
            leagueScoring = dynastyEngine.parseLeagueScoringSettings(league);
            isSuperflex = dynastyEngine.isLeagueSuperflex(league);
            console.log(`[Compare Players] League ${leagueId}: PPR=${leagueScoring.rec}, PassTD=${leagueScoring.passTd}, TEPrem=${leagueScoring.bonusRecTe}, SF=${isSuperflex}`);
          } else {
            console.log(`[Compare Players] League ${leagueId}: Failed to fetch league data`);
          }
        } catch (e) {
          console.log(`[Compare Players] League ${leagueId}: Error fetching league - ${e}`);
        }
      } else {
        console.log(`[Compare Players] No leagueId provided - using default scoring`);
      }

      let matchedCount = 0;
      let totalCount = 0;
      
      const players = Object.entries(allPlayers)
        .filter(([_, p]: [string, any]) => 
          p && ["QB", "RB", "WR", "TE"].includes(p.position) && 
          p.team && p.search_rank && p.search_rank < 300
        )
        .map(([id, p]: [string, any]) => {
          const playerStats = stats[id] || {};
          const games = playerStats.gp || 0;
          const points = playerStats.pts_ppr || 0;
          const ppg = games > 0 ? points / games : 0;
          const depthOrder = p.depth_chart_order || null;
          const playerName = p.full_name || "Unknown";
          
          // Get consensus value from DynastyProcess (1QB or 2QB based on league type)
          const consensusValue = dynastyConsensusService.getNormalizedValue(playerName, p.position, isSuperflex);
          
          totalCount++;
          if (consensusValue !== null) matchedCount++;
          
          // Get blended value (50/50 average of league + KTC consensus)
          // Use null for leagueScoring to match NFL Players endpoint for consistency
          const valueResult = dynastyEngine.getBlendedPlayerValue(
            id,
            playerName,
            p.position, 
            p.age, 
            p.years_exp || 0, 
            p.injury_status,
            { points, games, ppg },
            null,
            null,
            consensusValue
          );
          
          return {
            playerId: id,
            name: playerName,
            position: p.position || "?",
            team: p.team || "FA",
            age: p.age || 25,
            dynastyValue: valueResult.value,
            leagueValue: valueResult.leagueValue,
            consensusValue: valueResult.consensusValue,
            blended: valueResult.blended,
            stats: {
              games,
              points,
              ppg: games > 0 ? points / games : 0,
              passYds: playerStats.pass_yd,
              passTds: playerStats.pass_td,
              rushYds: playerStats.rush_yd,
              rushTds: playerStats.rush_td,
              recYds: playerStats.rec_yd,
              recTds: playerStats.rec_td,
              receptions: playerStats.rec,
              targets: playerStats.rec_tgt,
            },
            projectedPoints: points * 1.05,
            upside: points * 1.2,
            floor: points * 0.8,
          };
        })
        .sort((a, b) => b.dynastyValue - a.dynastyValue)
        .slice(0, 200);
      
      const matchRate = totalCount > 0 ? Math.round((matchedCount / totalCount) * 100) : 0;
      console.log(`[Compare Players] Consensus match rate: ${matchedCount}/${totalCount} (${matchRate}%)`);

      // Calculate sample delta to prove scoring affects values
      const sampleRbValue = dynastyEngine.getQuickPlayerValue("sample", "RB", 25, 3, null, { points: 200, games: 16, ppg: 12.5 }, 1, leagueScoring);
      const baseRbValue = dynastyEngine.getQuickPlayerValue("sample", "RB", 25, 3, null, { points: 200, games: 16, ppg: 12.5 }, 1, null);
      const valueDelta = Math.round((sampleRbValue - baseRbValue) * 10) / 10;
      
      // Include scoring settings in response for debugging/verification
      const scoringInfo = leagueScoring ? {
        applied: true,
        ppr: leagueScoring.rec,
        passTd: leagueScoring.passTd,
        tePremium: leagueScoring.bonusRecTe,
        bonus100Rush: leagueScoring.bonus100RushYds || 0,
        bonus100Rec: leagueScoring.bonus100RecYds || 0,
        bonus300Pass: leagueScoring.bonus300PassYds || 0,
        rushFd: leagueScoring.rushFd,
        recFd: leagueScoring.recFd,
        leagueId: leagueId,
        scoringType: leagueScoring.rec >= 1.0 ? "Full PPR" : leagueScoring.rec >= 0.5 ? "Half PPR" : "Standard",
        sampleRbDelta: valueDelta,
        consensusPlayers: consensusStats.size,
        consensusAvailable: consensusStats.available,
        consensusMatchRate: matchRate
      } : {
        applied: false,
        scoringType: "Default (no league selected)",
        sampleRbDelta: 0,
        consensusPlayers: consensusStats.size,
        consensusAvailable: consensusStats.available,
        consensusMatchRate: matchRate
      };
      
      res.json({ players, scoringSettings: scoringInfo });
    } catch (error) {
      console.error("Error fetching compare players:", error);
      res.status(500).json({ message: "Failed to fetch players" });
    }
  });

  // Lineup Advice - AI-powered start/sit recommendations
  app.get("/api/fantasy/lineup-advice", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { leagueId } = req.query;
      const profile = await storage.getUserProfile(userId);

      if (!leagueId && !profile?.selectedLeagueId) {
        return res.status(400).json({ message: "League ID required" });
      }

      const targetLeagueId = leagueId || profile?.selectedLeagueId;
      const [rosters, users, league, state, allPlayers] = await Promise.all([
        sleeperApi.getLeagueRosters(targetLeagueId),
        sleeperApi.getLeagueUsers(targetLeagueId),
        sleeperApi.getLeague(targetLeagueId),
        sleeperApi.getState(),
        sleeperApi.getAllPlayers(),
      ]);

      const userMap = new Map(users.map(u => [u.user_id, u]));
      const userRoster = rosters.find(r => r.owner_id === profile?.sleeperUserId);
      
      if (!userRoster) {
        return res.json({ 
          week: state?.week || 1,
          rosterId: 0,
          teamName: "Your Team",
          starters: [],
          bench: [],
          suggestions: [],
          overallAnalysis: "Could not find your roster in this league."
        });
      }

      const teamName = userMap.get(userRoster.owner_id)?.display_name || "Your Team";
      const starterIds = userRoster.starters || [];
      const benchIds = (userRoster.players || []).filter((p: string) => !starterIds.includes(p));

      // Get player info
      const getPlayerInfo = (playerId: string) => {
        const p = allPlayers[playerId];
        return p ? { id: playerId, name: p.full_name, position: p.position, team: p.team } : null;
      };

      const starters = starterIds.map(getPlayerInfo).filter(Boolean);
      const bench = benchIds.map(getPlayerInfo).filter(Boolean);

      // Get current date for context
      const currentDate = new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      const currentWeek = state?.week || 1;
      const currentSeason = state?.season || new Date().getFullYear().toString();

      const lineupPrompt = `Today is ${currentDate}. This is Week ${currentWeek} of the ${currentSeason} NFL season.

Provide start/sit recommendations for this fantasy football lineup based on THIS WEEK'S matchups and latest injury reports.

STARTERS: ${starters.map((p: any) => `${p.name} (${p.position}, ${p.team})`).join(", ")}
BENCH: ${bench.map((p: any) => `${p.name} (${p.position}, ${p.team})`).join(", ")}

For each player (starters and bench), provide:
- recommendation: "start", "sit", or "flex"
- confidence: 60-95 (percentage)
- matchup: {opponent: "vs DEN", opponentRank: 1-32, projected: points, ceiling: points, floor: points}
- reasoning: why start/sit based on Week ${currentWeek} matchup (1 sentence)
- gameScript: predicted game flow impact for this week's game (1 sentence)

Also provide:
- suggestions: array of {type: "swap"|"warning"|"opportunity", message: "suggestion text", players: ["names"]}
- overallAnalysis: 2-3 sentence Week ${currentWeek} lineup assessment

Return JSON with: {starters: [...], bench: [...], suggestions: [...], overallAnalysis: "..."}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: lineupPrompt }],
        response_format: { type: "json_object" },
        max_tokens: 2500,
      });

      let advice: any = {};
      try {
        advice = JSON.parse(response.choices[0]?.message?.content || "{}");
      } catch (e) {
        advice = {};
      }

      // Merge AI advice with player data
      const mergeAdvice = (players: any[], adviceList: any[]) => {
        return players.map((p: any, idx: number) => {
          const a = adviceList?.[idx] || {};
          return {
            playerId: p.id,
            name: p.name,
            position: p.position,
            team: p.team,
            matchup: a.matchup || { opponent: "TBD", opponentRank: 16, projected: 10, ceiling: 15, floor: 5 },
            recommendation: a.recommendation || "flex",
            confidence: a.confidence || 70,
            reasoning: a.reasoning || "Standard play based on recent performance",
            gameScript: a.gameScript || "Neutral game script expected",
            injuryStatus: a.injuryStatus,
          };
        });
      };

      res.json({
        week: state?.week || 1,
        rosterId: userRoster.roster_id,
        teamName,
        starters: mergeAdvice(starters, advice.starters || []),
        bench: mergeAdvice(bench, advice.bench || []),
        suggestions: advice.suggestions || [],
        overallAnalysis: advice.overallAnalysis || "Review your lineup before kickoff.",
      });
    } catch (error) {
      console.error("Error generating lineup advice:", error);
      res.status(500).json({ message: "Failed to generate lineup advice" });
    }
  });

  // Advanced Projections - ROS outlook
  app.get("/api/fantasy/projections", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.query;
      const [allPlayers, state] = await Promise.all([
        sleeperApi.getAllPlayers(),
        sleeperApi.getState(),
      ]);

      // Get current date and season context
      const currentDate = new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      const currentWeek = state?.week || 1;
      const currentSeason = state?.season || new Date().getFullYear().toString();
      const remainingWeeks = Math.max(0, 18 - currentWeek); // NFL regular season is 18 weeks, clamp to 0 minimum

      let stats: Record<string, any> = {};
      try {
        stats = await sleeperApi.getSeasonStats(currentSeason, "regular");
      } catch (e) {
        stats = {};
      }

      // Get top players
      const topPlayers = Object.entries(allPlayers)
        .filter(([_, p]: [string, any]) => 
          p && ["QB", "RB", "WR", "TE"].includes(p.position) && 
          p.team && p.search_rank && p.search_rank < 150
        )
        .map(([id, p]: [string, any]) => {
          const playerStats = stats[id] || {};
          return {
            id,
            name: p.full_name,
            position: p.position,
            team: p.team,
            age: p.age || 25,
            points: playerStats.pts_ppr || 0,
            games: playerStats.gp || 0,
          };
        })
        .slice(0, 60);

      const projectionsPrompt = `Today is ${currentDate}. We are in Week ${currentWeek} of the ${currentSeason} NFL season with approximately ${remainingWeeks} weeks remaining.

Generate rest-of-season (ROS) fantasy projections for these NFL players from Week ${currentWeek + 1} through Week 17.

Players: ${topPlayers.map(p => `${p.name} (${p.position}, ${p.team}, age ${p.age})`).join("; ")}

For each player provide:
- projectedPoints: total ROS fantasy points for the remaining ${remainingWeeks} weeks
- projectedPpg: expected points per game ROS
- confidence: 50-95 (how confident in projection)
- upside: ceiling PPG ROS
- downside: floor PPG ROS
- trend: "up", "down", or "stable" based on recent performance
- outlook: 1-2 sentence ROS analysis including current form
- keyFactors: array of 2-3 key factors affecting remaining schedule outlook
- scheduleStrength: 1-10 (1=easiest, 10=hardest) for remaining games
- injuryRisk: "low", "medium", or "high"
- byeWeek: 5-14 (NFL bye week - mark as "past" if already happened)

Return JSON: {"players": [{...}]}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: projectionsPrompt }],
        response_format: { type: "json_object" },
        max_tokens: 4000,
      });

      let projData: any = { players: [] };
      try {
        projData = JSON.parse(response.choices[0]?.message?.content || "{}");
      } catch (e) {
        projData = { players: [] };
      }

      // Merge with player data
      const players = (projData.players || []).map((proj: any, idx: number) => {
        const player = topPlayers[idx];
        return {
          playerId: player?.id || `player-${idx}`,
          name: proj.name || player?.name || "Unknown",
          position: proj.position || player?.position || "?",
          team: proj.team || player?.team || "FA",
          age: player?.age || 25,
          projectedPoints: proj.projectedPoints || 150,
          projectedPpg: proj.projectedPpg || 12,
          confidence: proj.confidence || 70,
          upside: proj.upside || 18,
          downside: proj.downside || 8,
          trend: proj.trend || "stable",
          outlook: proj.outlook || "Solid fantasy contributor",
          keyFactors: proj.keyFactors || ["Volume", "Talent"],
          scheduleStrength: proj.scheduleStrength || 5,
          injuryRisk: proj.injuryRisk || "low",
          byeWeek: proj.byeWeek || 9,
        };
      });

      res.json({ 
        players,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error generating projections:", error);
      res.status(500).json({ message: "Failed to generate projections" });
    }
  });

  // Matchup-based projections for a specific league
  app.get("/api/fantasy/matchup-projections", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.query;
      if (!leagueId) {
        return res.status(400).json({ message: "League ID required" });
      }

      const userId = req.user.claims.sub;
      const userProfile = await storage.getUserProfile(userId);
      if (!userProfile?.sleeperUserId) {
        return res.status(400).json({ message: "No Sleeper account linked" });
      }

      const [league, state, allPlayers] = await Promise.all([
        sleeperApi.getLeague(leagueId as string),
        sleeperApi.getState(),
        sleeperApi.getAllPlayers(),
      ]);

      const currentWeek = state?.week || 1;
      const currentSeason = state?.season || new Date().getFullYear().toString();

      // Get league rosters and user's roster
      const rosters = await sleeperApi.getLeagueRosters(leagueId as string);
      const userRoster = rosters.find((r: any) => r.owner_id === userProfile.sleeperUserId);
      
      if (!userRoster) {
        return res.status(404).json({ message: "User roster not found" });
      }

      // Get matchups for current week
      const matchups = await sleeperApi.getMatchups(leagueId as string, currentWeek);
      const userMatchup = matchups.find((m: any) => m.roster_id === userRoster.roster_id);
      const opponentMatchup = userMatchup ? matchups.find((m: any) => 
        m.matchup_id === userMatchup.matchup_id && m.roster_id !== userRoster.roster_id
      ) : null;

      // Get opponent team name
      const leagueUsers = await sleeperApi.getLeagueUsers(leagueId as string);
      let opponentName = "Unknown Opponent";
      if (opponentMatchup) {
        const opponentRoster = rosters.find((r: any) => r.roster_id === opponentMatchup.roster_id);
        const opponentUser = leagueUsers.find((u: any) => u.user_id === opponentRoster?.owner_id);
        opponentName = opponentUser?.metadata?.team_name || opponentUser?.display_name || "Opponent";
      }

      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      // Get league scoring settings
      const scoringSettings = league.scoring_settings || {};
      const scoringType = scoringSettings.rec === 1 ? "PPR" : scoringSettings.rec === 0.5 ? "Half PPR" : "Standard";

      // Build player list from user's roster
      const rosterPlayers = (userRoster.players || [])
        .map((playerId: string) => {
          const p = allPlayers[playerId];
          if (!p || !["QB", "RB", "WR", "TE", "K", "DEF"].includes(p.position)) return null;
          return {
            id: playerId,
            name: p.full_name || `${p.first_name} ${p.last_name}`,
            position: p.position,
            team: p.team || "FA",
            age: p.age,
          };
        })
        .filter(Boolean)
        .slice(0, 20);

      // Get NFL schedule data for home/away info
      const currentDate = new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });

      const projPrompt = `Today is ${currentDate}. Generate Week ${currentWeek} fantasy projections for a ${scoringType} league.

Players on the roster: ${rosterPlayers.map((p: any) => `${p.name} (${p.position}, ${p.team})`).join("; ")}

For each player, analyze their Week ${currentWeek} matchup and provide:
- opponent: The NFL team they play against (e.g., "@ DAL" for away at Dallas, "vs NYG" for home vs Giants)
- isHome: true/false
- gameScript: Brief 1-sentence prediction of game flow that affects their fantasy output
- projectedPoints: Expected fantasy points in ${scoringType} scoring
- floor: Worst-case scenario points (10th percentile outcome)
- ceiling: Best-case scenario points (90th percentile outcome)
- confidence: 50-95 based on matchup certainty
- keyMatchup: Brief note about key defensive matchup (e.g., "faces elite pass rush" or "targets slot corner weakness")
- startSitAdvice: "Start", "Sit", or "Flex" recommendation with 5-word reason

Base projections on ${scoringType} scoring: ${scoringSettings.rec || 1} PPR, ${scoringSettings.pass_yd || 0.04} pts/pass yard, ${scoringSettings.rush_yd || 0.1} pts/rush yard.

Return JSON: {"projections": [{playerId, name, position, team, opponent, isHome, gameScript, projectedPoints, floor, ceiling, confidence, keyMatchup, startSitAdvice}]}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: projPrompt }],
        response_format: { type: "json_object" },
        max_tokens: 3000,
      });

      let projData: any = { projections: [] };
      try {
        projData = JSON.parse(response.choices[0]?.message?.content || "{}");
      } catch (e) {
        projData = { projections: [] };
      }

      // Merge with player data
      const projections = (projData.projections || []).map((proj: any, idx: number) => {
        const player = rosterPlayers[idx];
        return {
          playerId: player?.id || `player-${idx}`,
          name: proj.name || player?.name || "Unknown",
          position: proj.position || player?.position || "?",
          team: proj.team || player?.team || "FA",
          opponent: proj.opponent || "TBD",
          isHome: proj.isHome ?? true,
          gameScript: proj.gameScript || "Standard game script expected",
          projectedPoints: proj.projectedPoints || 10,
          floor: proj.floor || 5,
          ceiling: proj.ceiling || 20,
          confidence: proj.confidence || 70,
          keyMatchup: proj.keyMatchup || "Average matchup",
          startSitAdvice: proj.startSitAdvice || "Flex",
        };
      });

      res.json({
        projections,
        week: currentWeek,
        season: currentSeason,
        scoringType,
        opponent: opponentName,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error generating matchup projections:", error);
      res.status(500).json({ message: "Failed to generate projections" });
    }
  });

  // League Summary - Overall stats across leagues including ALL historical seasons
  // Cache for career summary data (keyed by sleeper user ID)
  const careerSummaryCache = new Map<string, { data: any; timestamp: number }>();
  const CAREER_CACHE_TTL = 1000 * 60 * 15; // 15 minutes

  app.get("/api/fantasy/summary", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      
      const userProfile = await storage.getUserProfile(userId);
      if (!userProfile?.sleeperUserId) {
        return res.json({
          totalLeagues: 0,
          totalWins: 0,
          totalLosses: 0,
          totalTies: 0,
          championships: 0,
          runnerUps: 0,
          playoffAppearances: 0,
          bestFinish: "N/A",
          currentSeason: new Date().getFullYear().toString(),
          leagueStats: [],
        });
      }

      // Get all takeovers for this user
      const allTakeovers = await storage.getAllLeagueTakeovers(userId);
      const takeoverMap = new Map(allTakeovers.map(t => [t.leagueId, t.takeoverSeason]));

      // Check cache first - include takeover hash in cache key
      const takeoverHash = allTakeovers.map(t => `${t.leagueId}:${t.takeoverSeason}`).sort().join(',');
      const cacheKey = `${userProfile.sleeperUserId}:${takeoverHash}`;
      const cached = careerSummaryCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CAREER_CACHE_TTL) {
        return res.json(cached.data);
      }

      const currentLeagues = await sleeperApi.getUserLeagues(userProfile.sleeperUserId);
      
      const processedLeagueIds = new Set<string>();
      // Cache league data to avoid duplicate API calls
      const leagueDataCache = new Map<string, any>();

      // Collect all league IDs and cache league data in a single pass
      // Include takeoverSeason for filtering
      const leagueIdsToProcess: { leagueId: string; leagueName: string }[] = [];
      
      // First pass: collect all league IDs by tracing back histories (and cache league data)
      // Filter out seasons before takeover date
      const collectLeagueIds = async (startLeagueId: string, leagueName: string, takeoverSeason: number | null): Promise<string[]> => {
        const ids: string[] = [];
        let currentId: string | null = startLeagueId;
        
        while (currentId && currentId !== "0") {
          if (processedLeagueIds.has(currentId)) break;
          processedLeagueIds.add(currentId);
          
          try {
            const league = await sleeperApi.getLeague(currentId);
            if (!league) break;
            
            // Skip seasons before takeover if set
            const seasonYear = parseInt(league.season);
            if (takeoverSeason && seasonYear < takeoverSeason) {
              currentId = league.previous_league_id;
              continue;
            }
            
            // Cache for reuse in processing phase
            leagueDataCache.set(currentId, league);
            ids.push(currentId);
            currentId = league.previous_league_id;
          } catch {
            break;
          }
        }
        return ids;
      };

      // Collect all league IDs from all current leagues in parallel
      const leagueIdResults = await Promise.all(
        currentLeagues.map(league => {
          const takeoverSeason = takeoverMap.get(league.league_id) || null;
          return collectLeagueIds(league.league_id, league.name, takeoverSeason).then(ids => 
            ids.map(id => ({ leagueId: id, leagueName: league.name }))
          );
        })
      );
      
      leagueIdResults.forEach(ids => leagueIdsToProcess.push(...ids));

      // Process all league seasons in parallel (use cached league data, fetch rosters + bracket)
      const processLeagueSeason = async (leagueId: string, leagueName: string) => {
        try {
          // Get league from cache (already fetched), only need rosters and bracket
          const league = leagueDataCache.get(leagueId);
          if (!league) return null;
          
          // Fetch rosters and bracket in parallel
          const [rosters, bracket] = await Promise.all([
            sleeperApi.getLeagueRosters(leagueId),
            sleeperApi.getPlayoffBracket(leagueId).catch(() => [])
          ]);
          
          if (!rosters) return null;
          
          const userRoster = rosters.find(r => r.owner_id === userProfile!.sleeperUserId);
          if (!userRoster) return null;
          
          const wins = userRoster.settings?.wins || 0;
          const losses = userRoster.settings?.losses || 0;
          const ties = userRoster.settings?.ties || 0;
          
          // Calculate rank
          const sortedRosters = [...rosters].sort((a, b) => {
            const winsA = a.settings?.wins || 0;
            const winsB = b.settings?.wins || 0;
            if (winsB !== winsA) return winsB - winsA;
            const fptsA = (a.settings?.fpts || 0) + (a.settings?.fpts_decimal || 0) / 100;
            const fptsB = (b.settings?.fpts || 0) + (b.settings?.fpts_decimal || 0) / 100;
            return fptsB - fptsA;
          });
          const rank = sortedRosters.findIndex(r => r.roster_id === userRoster.roster_id) + 1;
          
          const playoffTeams = league.settings?.playoff_teams || 6;
          // Only count playoff appearance if they actually played games (not just ranked in preseason)
          const hasPlayedGames = wins > 0 || losses > 0;
          const isPlayoffs = hasPlayedGames && rank <= playoffTeams;
          
          // Determine championship status
          let isChampion = false;
          let isRunnerUp = false;
          
          if (bracket && bracket.length > 0) {
            const champMatch = bracket.reduce((max, match) => 
              (match.r > (max?.r || 0)) ? match : max, bracket[0]);
            
            if (champMatch && champMatch.w === userRoster.roster_id) {
              isChampion = true;
            } else if (champMatch && champMatch.l === userRoster.roster_id) {
              isRunnerUp = true;
            }
          } else if (league.status === "complete") {
            if (rank === 1) isChampion = true;
            else if (rank === 2) isRunnerUp = true;
          }
          
          // Only include seasons where games were actually played
          if (!hasPlayedGames) {
            return null;
          }
          
          return {
            leagueId,
            leagueName,
            season: league.season,
            wins,
            losses,
            ties,
            rank,
            totalTeams: rosters.length,
            isChampion,
            isPlayoffs,
            isRunnerUp,
          };
        } catch (e) {
          console.error(`Error processing league ${leagueId}:`, e);
          return null;
        }
      };

      // Process all leagues in parallel with concurrency limit
      const BATCH_SIZE = 10;
      const allResults: any[] = [];
      
      for (let i = 0; i < leagueIdsToProcess.length; i += BATCH_SIZE) {
        const batch = leagueIdsToProcess.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(({ leagueId, leagueName }) => processLeagueSeason(leagueId, leagueName))
        );
        allResults.push(...batchResults.filter(Boolean));
      }

      // Aggregate stats
      let totalWins = 0;
      let totalLosses = 0;
      let totalTies = 0;
      let championships = 0;
      let runnerUps = 0;
      let playoffAppearances = 0;
      
      for (const stat of allResults) {
        totalWins += stat.wins;
        totalLosses += stat.losses;
        totalTies += stat.ties;
        if (stat.isChampion) championships++;
        if (stat.isRunnerUp) runnerUps++;
        if (stat.isPlayoffs) playoffAppearances++;
      }

      // Sort league stats by season descending
      allResults.sort((a, b) => b.season.localeCompare(a.season));

      const result = {
        totalLeagues: currentLeagues.length,
        totalSeasons: allResults.length,
        totalWins,
        totalLosses,
        totalTies,
        championships,
        runnerUps,
        playoffAppearances,
        bestFinish: championships > 0 ? "Champion" : runnerUps > 0 ? "Runner-up" : playoffAppearances > 0 ? "Playoffs" : "N/A",
        currentSeason: new Date().getFullYear().toString(),
        leagueStats: allResults,
      };

      // Cache the result
      careerSummaryCache.set(cacheKey, { data: result, timestamp: Date.now() });

      res.json(result);
    } catch (error) {
      console.error("Error fetching summary:", error);
      res.status(500).json({ message: "Failed to fetch summary" });
    }
  });

  // League-Specific Summary - Stats for a single league across all its seasons
  app.get("/api/fantasy/league-summary/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { leagueId } = req.params;
      
      const userProfile = await storage.getUserProfile(userId);
      if (!userProfile?.sleeperUserId) {
        return res.status(400).json({ message: "No Sleeper account connected" });
      }

      // Check if user has a takeover season set for this league
      const takeover = await storage.getLeagueTakeover(userId, leagueId);
      const takeoverSeason = takeover?.takeoverSeason;

      let totalWins = 0;
      let totalLosses = 0;
      let totalTies = 0;
      let championships = 0;
      let runnerUps = 0;
      let playoffAppearances = 0;
      const seasonStats: any[] = [];
      const processedLeagueIds = new Set<string>();

      // Trace back through league history for this specific league
      let currentLeagueId: string | null = leagueId;
      
      while (currentLeagueId && currentLeagueId !== "0" && !processedLeagueIds.has(currentLeagueId)) {
        processedLeagueIds.add(currentLeagueId);
        
        try {
          const league = await sleeperApi.getLeague(currentLeagueId);
          if (!league) break;
          
          // Skip seasons before takeover if set
          const seasonYear = parseInt(league.season);
          if (takeoverSeason && seasonYear < takeoverSeason) {
            currentLeagueId = league.previous_league_id;
            continue;
          }
          
          const rosters = await sleeperApi.getLeagueRosters(currentLeagueId);
          
          // Find user's roster in this season
          const userRoster = rosters.find(r => r.owner_id === userProfile.sleeperUserId);
          if (userRoster) {
            const wins = userRoster.settings?.wins || 0;
            const losses = userRoster.settings?.losses || 0;
            const ties = userRoster.settings?.ties || 0;
            
            totalWins += wins;
            totalLosses += losses;
            totalTies += ties;
            
            // Calculate rank based on wins, then points for tie-breaking
            const sortedRosters = [...rosters].sort((a, b) => {
              const winsA = a.settings?.wins || 0;
              const winsB = b.settings?.wins || 0;
              if (winsB !== winsA) return winsB - winsA;
              const fptsA = (a.settings?.fpts || 0) + (a.settings?.fpts_decimal || 0) / 100;
              const fptsB = (b.settings?.fpts || 0) + (b.settings?.fpts_decimal || 0) / 100;
              return fptsB - fptsA;
            });
            const rank = sortedRosters.findIndex(r => r.roster_id === userRoster.roster_id) + 1;
            
            const playoffTeams = league.settings?.playoff_teams || 6;
            // Only count playoff appearance if they actually played games (not just ranked in preseason)
            const hasPlayedGames = wins > 0 || losses > 0;
            const isPlayoffs = hasPlayedGames && rank <= playoffTeams;
            if (isPlayoffs) playoffAppearances++;
            
            let isChampion = false;
            let isRunnerUp = false;
            
            try {
              const bracket = await sleeperApi.getPlayoffBracket(currentLeagueId);
              if (bracket && bracket.length > 0) {
                const champMatch = bracket.reduce((max, match) => 
                  (match.r > (max?.r || 0)) ? match : max, bracket[0]);
                
                if (champMatch && champMatch.w === userRoster.roster_id) {
                  isChampion = true;
                  championships++;
                } else if (champMatch && champMatch.l === userRoster.roster_id) {
                  isRunnerUp = true;
                  runnerUps++;
                }
              }
            } catch (bracketError) {
              if (league.status === "complete" && rank === 1) {
                isChampion = true;
                championships++;
              } else if (league.status === "complete" && rank === 2) {
                isRunnerUp = true;
                runnerUps++;
              }
            }
            
            // Only include seasons where games were actually played
            if (hasPlayedGames) {
              seasonStats.push({
                leagueId: currentLeagueId,
                season: league.season,
                wins,
                losses,
                ties,
                rank,
                totalTeams: rosters.length,
                isChampion,
                isPlayoffs,
                isRunnerUp,
              });
            }
          }
          
          currentLeagueId = league.previous_league_id;
        } catch (e) {
          console.error(`Error processing league ${currentLeagueId}:`, e);
          break;
        }
      }

      // Sort by season descending
      seasonStats.sort((a, b) => b.season.localeCompare(a.season));

      // Get current league info for name
      const currentLeague = await sleeperApi.getLeague(leagueId);

      res.json({
        leagueName: currentLeague?.name || "Unknown League",
        totalSeasons: seasonStats.length,
        totalWins,
        totalLosses,
        totalTies,
        championships,
        runnerUps,
        playoffAppearances,
        bestFinish: championships > 0 ? "Champion" : runnerUps > 0 ? "Runner-up" : playoffAppearances > 0 ? "Playoffs" : "N/A",
        seasonStats,
        takeoverSeason: takeoverSeason || null, // Include takeover info for UI
      });
    } catch (error) {
      console.error("Error fetching league summary:", error);
      res.status(500).json({ message: "Failed to fetch league summary" });
    }
  });

  // League Takeover API - For orphan team management
  app.get("/api/league-takeover/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { leagueId } = req.params;
      
      const takeover = await storage.getLeagueTakeover(userId, leagueId);
      res.json(takeover || null);
    } catch (error) {
      console.error("Error fetching league takeover:", error);
      res.status(500).json({ message: "Failed to fetch league takeover" });
    }
  });

  app.get("/api/league-takeover", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const takeovers = await storage.getAllLeagueTakeovers(userId);
      res.json(takeovers);
    } catch (error) {
      console.error("Error fetching all league takeovers:", error);
      res.status(500).json({ message: "Failed to fetch league takeovers" });
    }
  });

  app.post("/api/league-takeover/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { leagueId } = req.params;
      const { takeoverSeason } = req.body;
      
      if (!takeoverSeason || typeof takeoverSeason !== "number") {
        return res.status(400).json({ message: "takeoverSeason is required and must be a number" });
      }
      
      const takeover = await storage.upsertLeagueTakeover(userId, leagueId, takeoverSeason);
      res.json(takeover);
    } catch (error) {
      console.error("Error saving league takeover:", error);
      res.status(500).json({ message: "Failed to save league takeover" });
    }
  });

  app.delete("/api/league-takeover/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { leagueId } = req.params;
      
      await storage.deleteLeagueTakeover(userId, leagueId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting league takeover:", error);
      res.status(500).json({ message: "Failed to delete league takeover" });
    }
  });

  // Player Stats - Get comprehensive player profile with stats, game logs, splits
  app.get("/api/player/:playerId/profile", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { playerId } = req.params;
      const { playerName } = req.query;
      
      if (!playerName) {
        return res.status(400).json({ message: "Player name required" });
      }
      
      const profile = await playerStatsService.getPlayerProfile(playerId, playerName as string);
      
      if (!profile) {
        return res.status(404).json({ message: "Player not found" });
      }
      
      res.json(profile);
    } catch (error) {
      console.error("Error fetching player profile:", error);
      res.status(500).json({ message: "Failed to fetch player profile" });
    }
  });

  // Player Game Logs
  app.get("/api/player/:playerId/gamelogs", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { playerId } = req.params;
      const { playerName, season } = req.query;
      
      if (!playerName) {
        return res.status(400).json({ message: "Player name required" });
      }
      
      const gameLogs = await playerStatsService.getPlayerGameLogs(
        playerId, 
        playerName as string, 
        season as string | undefined
      );
      
      res.json({ gameLogs });
    } catch (error) {
      console.error("Error fetching game logs:", error);
      res.status(500).json({ message: "Failed to fetch game logs" });
    }
  });

  // Player Career Stats
  app.get("/api/player/:playerId/career", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { playerId } = req.params;
      const { playerName } = req.query;
      
      if (!playerName) {
        return res.status(400).json({ message: "Player name required" });
      }
      
      const stats = await playerStatsService.getPlayerCareerStats(playerId, playerName as string);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching career stats:", error);
      res.status(500).json({ message: "Failed to fetch career stats" });
    }
  });

  // Player Splits
  app.get("/api/player/:playerId/splits", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { playerId } = req.params;
      const { playerName } = req.query;
      
      if (!playerName) {
        return res.status(400).json({ message: "Player name required" });
      }
      
      const splits = await playerStatsService.getPlayerSplits(playerId, playerName as string);
      res.json({ splits });
    } catch (error) {
      console.error("Error fetching splits:", error);
      res.status(500).json({ message: "Failed to fetch splits" });
    }
  });

  // Roster - Get user's roster for selected league
  app.get("/api/fantasy/roster", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { leagueId } = req.query;
      
      console.log("[Roster] Request received - userId:", userId, "leagueId:", leagueId);
      
      const userProfile = await storage.getUserProfile(userId);
      console.log("[Roster] User profile - sleeperUserId:", userProfile?.sleeperUserId);
      
      if (!userProfile?.sleeperUserId || !leagueId) {
        console.log("[Roster] Missing data - sleeperUserId:", userProfile?.sleeperUserId, "leagueId:", leagueId);
        return res.status(400).json({ message: "League ID required" });
      }

      const [rosters, allPlayers, league, stats] = await Promise.all([
        sleeperApi.getLeagueRosters(leagueId as string),
        sleeperApi.getAllPlayers(),
        sleeperApi.getLeague(leagueId as string),
        sleeperApi.getSeasonStats("2025", "regular"),
      ]);
      
      // Fetch consensus values for blended dynasty values
      try {
        await dynastyConsensusService.fetchAndCacheValues();
      } catch (e) {
        console.log(`[Roster] Failed to fetch consensus values: ${e}`);
      }
      
      // Check if league is Superflex/2QB
      const isSuperflex = dynastyEngine.isLeagueSuperflex(league);
      
      const userRoster = rosters.find(r => r.owner_id === userProfile.sleeperUserId);
      const leagueSize = rosters.length;
      
      // Get roster positions from league settings (excluding BN = bench)
      const rosterPositions = (league?.roster_positions || []).filter((pos: string) => pos !== "BN");
      
      if (!userRoster) {
        return res.json({ 
          players: [], 
          teamName: "My Team", 
          ownerId: "", 
          totalValue: 0, 
          starters: [],
          positionRankings: { QB: { rank: 0, total: leagueSize }, RB: { rank: 0, total: leagueSize }, WR: { rank: 0, total: leagueSize }, TE: { rank: 0, total: leagueSize } }
        });
      }
      
      // Helper function to get blended dynasty value consistently
      const getBlendedValue = (playerId: string, player: any) => {
        const pos = player?.position || "?";
        const playerName = player?.full_name || `${player?.first_name} ${player?.last_name}`;
        const playerStats = stats?.[playerId] || {};
        const gamesPlayed = playerStats.gp || 0;
        const fantasyPoints = playerStats.pts_ppr || 0;
        const pointsPerGame = gamesPlayed > 0 ? fantasyPoints / gamesPlayed : 0;
        
        const consensusValue = dynastyConsensusService.getNormalizedValue(playerName, pos, isSuperflex);
        
        const valueResult = dynastyEngine.getBlendedPlayerValue(
          playerId,
          playerName,
          pos,
          player?.age || 25,
          player?.years_exp || 0,
          player?.injury_status,
          { points: fantasyPoints, games: gamesPlayed, ppg: pointsPerGame },
          null,
          null,
          consensusValue
        );
        return valueResult.value;
      };

      // Calculate position group values for ALL teams
      const teamPositionValues: Record<string, { QB: number; RB: number; WR: number; TE: number }> = {};
      
      for (const roster of rosters) {
        const ownerId = roster.owner_id;
        const rosterPlayers = roster.players || [];
        
        const posValues = { QB: 0, RB: 0, WR: 0, TE: 0 };
        
        for (const pid of rosterPlayers) {
          const player = allPlayers[pid];
          if (!player) continue;
          
          const pos = player.position as "QB" | "RB" | "WR" | "TE";
          if (pos in posValues) {
            const value = getBlendedValue(pid, player);
            posValues[pos] += value;
          }
        }
        
        teamPositionValues[ownerId] = posValues;
      }

      // Rank each position group
      const positions = ["QB", "RB", "WR", "TE"] as const;
      const positionRankings: Record<string, { rank: number; total: number; value: number }> = {};
      
      for (const pos of positions) {
        const sorted = Object.entries(teamPositionValues)
          .map(([oid, vals]) => ({ ownerId: oid, value: vals[pos] }))
          .sort((a, b) => b.value - a.value);
        
        const userIndex = sorted.findIndex(t => t.ownerId === userProfile.sleeperUserId);
        const userValue = userIndex >= 0 ? sorted[userIndex].value : 0;
        
        positionRankings[pos] = {
          rank: userIndex + 1,
          total: leagueSize,
          value: userValue,
        };
      }

      const starters = userRoster.starters || [];
      const playerIds = userRoster.players || [];

      const players = playerIds.map(playerId => {
        const player = allPlayers[playerId];
        const dynastyValue = getBlendedValue(playerId, player);
        const isStarter = starters.includes(playerId);
        const starterIndex = starters.indexOf(playerId);
        
        // Use league's roster_positions to determine slot position
        let slotPosition = "BN";
        if (isStarter && starterIndex >= 0 && starterIndex < rosterPositions.length) {
          slotPosition = rosterPositions[starterIndex];
        }
        
        // ESPN headshot URL from Sleeper's ESPN ID mapping
        let headshot: string | null = null;
        if (player?.espn_id) {
          headshot = `https://a.espncdn.com/i/headshots/nfl/players/full/${player.espn_id}.png`;
        }

        return {
          playerId,
          name: player?.full_name || player?.first_name + " " + player?.last_name || "Unknown",
          position: player?.position || "?",
          team: player?.team || "FA",
          age: player?.age || 0,
          number: player?.number || "",
          status: player?.status || null,
          injuryStatus: player?.injury_status || null,
          dynastyValue,
          projectedPoints: Math.round((dynastyValue / 800) * 10 + Math.random() * 5),
          isStarter,
          slotPosition,
          starterIndex: isStarter ? starterIndex : -1,
          headshot,
        };
      }).sort((a, b) => {
        // Starters first, then bench
        if (a.isStarter !== b.isStarter) return a.isStarter ? -1 : 1;
        // Starters: maintain Sleeper's lineup order (starterIndex)
        if (a.isStarter && b.isStarter) return a.starterIndex - b.starterIndex;
        // Bench: sort by position, then dynasty value
        const posOrder: Record<string, number> = { QB: 1, RB: 2, WR: 3, TE: 4, K: 5, DEF: 6, DL: 7, LB: 8, DB: 9 };
        const posA = posOrder[a.position] || 10;
        const posB = posOrder[b.position] || 10;
        if (posA !== posB) return posA - posB;
        return b.dynastyValue - a.dynastyValue;
      });

      const totalValue = players.reduce((sum, p) => sum + p.dynastyValue, 0);

      res.json({
        players,
        teamName: "My Team",
        ownerId: userProfile.sleeperUserId,
        totalValue,
        starters,
        positionRankings,
        leagueSize,
      });
    } catch (error) {
      console.error("Error fetching roster:", error);
      res.status(500).json({ message: "Failed to fetch roster" });
    }
  });

  // Dashboard API - returns action-first data for home page
  app.get("/api/fantasy/dashboard/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { leagueId } = req.params;
      
      if (!leagueId) {
        return res.status(400).json({ message: "League ID required" });
      }

      const userProfile = await storage.getUserProfile(userId);
      if (!userProfile?.sleeperUserId) {
        return res.status(400).json({ message: "Sleeper account not connected" });
      }

      const [rosters, allPlayers, league, stats, matchups] = await Promise.all([
        sleeperApi.getLeagueRosters(leagueId as string),
        sleeperApi.getAllPlayers(),
        sleeperApi.getLeague(leagueId as string),
        sleeperApi.getSeasonStats("2025", "regular"),
        sleeperApi.getMatchups(leagueId as string, 1),
      ]);

      // Fetch consensus values
      try {
        await dynastyConsensusService.fetchAndCacheValues();
      } catch (e) {
        console.log(`[Dashboard] Failed to fetch consensus values: ${e}`);
      }

      const isSuperflex = dynastyEngine.isLeagueSuperflex(league);
      const userRoster = rosters.find(r => r.owner_id === userProfile.sleeperUserId);
      const leagueSize = rosters.length;

      if (!userRoster) {
        return res.json({
          rosterStrength: { QB: 0, RB: 0, WR: 0, TE: 0 },
          positionRanks: { QB: { rank: 0, total: leagueSize }, RB: { rank: 0, total: leagueSize }, WR: { rank: 0, total: leagueSize }, TE: { rank: 0, total: leagueSize } },
          teamProfile: "balanced",
          biggestNeed: null,
          recommendations: [],
          weeklyBlurb: "Connect your roster to get personalized insights.",
          playerCount: 0,
        });
      }

      // Calculate dynasty values
      const getBlendedValue = (playerId: string, player: any) => {
        const pos = player?.position || "?";
        const playerName = player?.full_name || `${player?.first_name} ${player?.last_name}`;
        const playerStats = stats?.[playerId] || {};
        const gamesPlayed = playerStats.gp || 0;
        const fantasyPoints = playerStats.pts_ppr || 0;
        const pointsPerGame = gamesPlayed > 0 ? fantasyPoints / gamesPlayed : 0;
        
        const consensusValue = dynastyConsensusService.getNormalizedValue(playerName, pos, isSuperflex);
        
        const valueResult = dynastyEngine.getBlendedPlayerValue(
          playerId,
          playerName,
          pos,
          player?.age || 25,
          player?.years_exp || 0,
          player?.injury_status,
          { points: fantasyPoints, games: gamesPlayed, ppg: pointsPerGame },
          null,
          null,
          consensusValue
        );
        return valueResult.value;
      };

      // Calculate position group values for ALL teams
      const teamPositionValues: Record<string, { QB: number; RB: number; WR: number; TE: number }> = {};
      const teamAges: Record<string, number[]> = {};
      
      for (const roster of rosters) {
        const ownerId = roster.owner_id;
        const rosterPlayers = roster.players || [];
        
        const posValues = { QB: 0, RB: 0, WR: 0, TE: 0 };
        const ages: number[] = [];
        
        for (const pid of rosterPlayers) {
          const player = allPlayers[pid];
          if (!player) continue;
          
          const pos = player.position as "QB" | "RB" | "WR" | "TE";
          if (pos in posValues) {
            const value = getBlendedValue(pid, player);
            posValues[pos] += value;
            if (player.age) ages.push(player.age);
          }
        }
        
        teamPositionValues[ownerId] = posValues;
        teamAges[ownerId] = ages;
      }

      // Rank each position group
      const positions = ["QB", "RB", "WR", "TE"] as const;
      const positionRanks: Record<string, { rank: number; total: number; value: number; maxValue: number }> = {};
      
      for (const pos of positions) {
        const sorted = Object.entries(teamPositionValues)
          .map(([oid, vals]) => ({ ownerId: oid, value: vals[pos] }))
          .sort((a, b) => b.value - a.value);
        
        const userIndex = sorted.findIndex(t => t.ownerId === userProfile.sleeperUserId);
        const userValue = userIndex >= 0 ? sorted[userIndex].value : 0;
        const maxValue = sorted[0]?.value || 1;
        
        positionRanks[pos] = {
          rank: userIndex + 1,
          total: leagueSize,
          value: userValue,
          maxValue,
        };
      }

      // Calculate roster strength as percentage (0-100) based on RANK
      // Higher rank (worse) = lower bar, lower rank (better) = higher bar
      // e.g., #1 of 12 = 100%, #6 of 12 = 58%, #12 of 12 = 8%
      const rosterStrength: Record<string, number> = {};
      for (const pos of positions) {
        const { rank, total } = positionRanks[pos];
        // Formula: ((total - rank + 1) / total) * 100
        // Rank 1 of 12 = (12 - 1 + 1)/12 * 100 = 100%
        // Rank 6 of 12 = (12 - 6 + 1)/12 * 100 = 58%
        // Rank 12 of 12 = (12 - 12 + 1)/12 * 100 = 8%
        rosterStrength[pos] = total > 0 ? Math.round(((total - rank + 1) / total) * 100) : 0;
      }

      // Calculate team age profile
      const userAges = teamAges[userProfile.sleeperUserId] || [];
      const avgAge = userAges.length > 0 ? userAges.reduce((a, b) => a + b, 0) / userAges.length : 25;
      const youngPlayers = userAges.filter(a => a <= 24).length;
      const oldPlayers = userAges.filter(a => a >= 28).length;
      
      let teamProfile: "contender" | "balanced" | "rebuild" = "balanced";
      if (avgAge >= 27 || oldPlayers > youngPlayers * 1.5) {
        teamProfile = "contender"; // Older roster, win-now
      } else if (avgAge <= 24 || youngPlayers > oldPlayers * 1.5) {
        teamProfile = "rebuild"; // Young roster, building
      }

      // Find biggest need
      const weakestPos = positions.reduce((weakest, pos) => {
        if (!weakest || positionRanks[pos].rank > positionRanks[weakest].rank) {
          return pos;
        }
        return weakest;
      }, null as string | null);
      
      const biggestNeed = weakestPos ? {
        position: weakestPos,
        rank: positionRanks[weakestPos].rank,
        total: leagueSize,
        message: `Your ${weakestPos} room ranks #${positionRanks[weakestPos].rank} of ${leagueSize}`
      } : null;

      // Generate recommendations
      const recommendations: Array<{ type: string; priority: "high" | "medium" | "low"; title: string; description: string; action?: string }> = [];

      // Waiver recommendation based on need
      if (biggestNeed && biggestNeed.rank > leagueSize / 2) {
        recommendations.push({
          type: "waiver",
          priority: "high",
          title: `Add ${biggestNeed.position} depth`,
          description: `Your ${biggestNeed.position} room needs help. Check the waiver wire for options.`,
          action: `/league/waivers?id=${leagueId}&position=${biggestNeed.position}`,
        });
      }

      // Trade recommendation based on surplus
      const strongestPos = positions.reduce((strongest, pos) => {
        if (!strongest || positionRanks[pos].rank < positionRanks[strongest].rank) {
          return pos;
        }
        return strongest;
      }, null as string | null);

      if (strongestPos && biggestNeed && strongestPos !== biggestNeed.position) {
        if (positionRanks[strongestPos].rank <= 3 && positionRanks[biggestNeed.position].rank > leagueSize / 2) {
          recommendations.push({
            type: "trade",
            priority: "medium",
            title: `Trade ${strongestPos} for ${biggestNeed.position}`,
            description: `You're stacked at ${strongestPos} (ranked #${positionRanks[strongestPos].rank}). Consider trading depth for a ${biggestNeed.position} upgrade.`,
            action: `/league/trade?id=${leagueId}`,
          });
        }
      }

      // Lineup check
      recommendations.push({
        type: "lineup",
        priority: "low",
        title: "Review your lineup",
        description: "Make sure your best players are in the starting spots.",
        action: `/league/lineup?id=${leagueId}`,
      });

      // Generate weekly blurb
      const blurbOptions = [
        teamProfile === "contender" 
          ? "Your roster is built to win now. Focus on maximizing points and making win-now moves."
          : teamProfile === "rebuild"
          ? "Your young roster has upside. Prioritize acquiring future picks and developing players."
          : "Your roster is well-balanced. Look for opportunities to tip the scales in your favor.",
      ];
      const weeklyBlurb = blurbOptions[0];

      res.json({
        rosterStrength,
        positionRanks,
        teamProfile,
        biggestNeed,
        recommendations,
        weeklyBlurb,
        avgAge: Math.round(avgAge * 10) / 10,
        playerCount: userRoster.players?.length || 0,
      });
    } catch (error) {
      console.error("Error fetching dashboard:", error);
      res.status(500).json({ message: "Failed to fetch dashboard data" });
    }
  });

  // Smart Trade Ideas API - generates AI-powered trade suggestions
  app.get("/api/fantasy/trade-ideas", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { leagueId } = req.query;
      
      if (!leagueId) {
        return res.status(400).json({ message: "League ID required" });
      }

      const userProfile = await storage.getUserProfile(userId);
      if (!userProfile?.sleeperUserId) {
        return res.status(400).json({ message: "Sleeper account not connected" });
      }

      const [rosters, allPlayers, league, stats, users] = await Promise.all([
        sleeperApi.getLeagueRosters(leagueId as string),
        sleeperApi.getAllPlayers(),
        sleeperApi.getLeague(leagueId as string),
        sleeperApi.getSeasonStats("2025", "regular"),
        sleeperApi.getLeagueUsers(leagueId as string),
      ]);

      // Fetch consensus values
      try {
        await dynastyConsensusService.fetchAndCacheValues();
      } catch (e) {
        console.log(`[TradeIdeas] Failed to fetch consensus values: ${e}`);
      }

      const isSuperflex = dynastyEngine.isLeagueSuperflex(league);
      const userRoster = rosters.find(r => r.owner_id === userProfile.sleeperUserId);

      if (!userRoster) {
        return res.json({ tradeIdeas: [] });
      }

      // Helper function to get player value
      const getPlayerValue = (playerId: string, player: any) => {
        const pos = player?.position || "?";
        const playerName = player?.full_name || `${player?.first_name} ${player?.last_name}`;
        const playerStats = stats?.[playerId] || {};
        const gamesPlayed = playerStats.gp || 0;
        const fantasyPoints = playerStats.pts_ppr || 0;
        const pointsPerGame = gamesPlayed > 0 ? fantasyPoints / gamesPlayed : 0;
        
        const consensusValue = dynastyConsensusService.getNormalizedValue(playerName, pos, isSuperflex);
        
        const valueResult = dynastyEngine.getBlendedPlayerValue(
          playerId,
          playerName,
          pos,
          player?.age || 25,
          player?.years_exp || 0,
          player?.injury_status,
          { points: fantasyPoints, games: gamesPlayed, ppg: pointsPerGame },
          null,
          null,
          consensusValue
        );
        return { value: valueResult.value, name: playerName, pos, age: player?.age || 25 };
      };

      // Build user's player values by position
      const userPlayers: Record<string, Array<{ id: string; name: string; value: number; pos: string; age: number }>> = {
        QB: [], RB: [], WR: [], TE: []
      };
      
      for (const pid of (userRoster.players || [])) {
        const player = allPlayers[pid];
        if (!player) continue;
        const { value, name, pos, age } = getPlayerValue(pid, player);
        if (pos in userPlayers) {
          userPlayers[pos].push({ id: pid, name, value, pos, age });
        }
      }

      // Sort user players by value (highest first)
      for (const pos of Object.keys(userPlayers)) {
        userPlayers[pos].sort((a, b) => b.value - a.value);
      }

      // Calculate position VALUE totals for ALL teams (used for league ranking)
      const positions = ["QB", "RB", "WR", "TE"] as const;
      const teamPositionValues: Record<string, Record<string, number>> = {};
      
      for (const roster of rosters) {
        const ownerId = roster.owner_id;
        const posValues: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
        
        for (const pid of (roster.players || [])) {
          const player = allPlayers[pid];
          if (!player) continue;
          const { value, pos } = getPlayerValue(pid, player);
          if (pos in posValues) {
            posValues[pos] += value;
          }
        }
        teamPositionValues[ownerId] = posValues;
      }
      
      // Calculate USER'S league RANK for each position (like dashboard does)
      const userRanks: Record<string, { rank: number; total: number }> = {};
      for (const pos of positions) {
        const sorted = Object.entries(teamPositionValues)
          .map(([oid, vals]) => ({ ownerId: oid, value: vals[pos] }))
          .sort((a, b) => b.value - a.value);
        
        const userIndex = sorted.findIndex(t => t.ownerId === userProfile.sleeperUserId);
        userRanks[pos] = { rank: userIndex + 1, total: rosters.length };
      }
      
      // Find user's weakest and strongest positions by RANK (not raw value)
      // Lower rank = stronger (rank 1 is best), higher rank = weaker
      const sortedByRank = positions
        .map(pos => ({ pos, rank: userRanks[pos].rank }))
        .sort((a, b) => a.rank - b.rank); // Sort by rank ascending (best first)
      
      // Strong positions = low ranks (top 2), Weak positions = high ranks (bottom 2)
      const strongPositions = sortedByRank.slice(0, 2).map(p => p.pos);
      const weakPositions = sortedByRank.slice(-2).map(p => p.pos);

      // Build trade ideas by finding complementary needs
      const tradeIdeas: Array<{
        tradePartner: { name: string; avatar: string | null; ownerId: string };
        give: Array<{ name: string; pos: string; value: number }>;
        get: Array<{ name: string; pos: string; value: number }>;
        reason: string;
        fairnessScore: number; // 0-100, 50 = perfectly fair
      }> = [];

      // Create owner name lookup
      const ownerMap = new Map<string, { name: string; avatar: string | null }>();
      for (const user of users) {
        ownerMap.set(user.user_id, { 
          name: user.display_name || user.username || "Unknown",
          avatar: user.avatar ? `https://sleepercdn.com/avatars/${user.avatar}` : null
        });
      }

      // Analyze other teams
      for (const roster of rosters) {
        if (roster.owner_id === userProfile.sleeperUserId) continue;

        const theirPlayers: Record<string, Array<{ id: string; name: string; value: number; pos: string; age: number }>> = {
          QB: [], RB: [], WR: [], TE: []
        };

        for (const pid of (roster.players || [])) {
          const player = allPlayers[pid];
          if (!player) continue;
          const { value, name, pos, age } = getPlayerValue(pid, player);
          if (pos in theirPlayers) {
            theirPlayers[pos].push({ id: pid, name, value, pos, age });
          }
        }

        // Sort their players
        for (const pos of Object.keys(theirPlayers)) {
          theirPlayers[pos].sort((a, b) => b.value - a.value);
        }

        // Get their position values (already calculated in teamPositionValues)
        const theirPosValues = teamPositionValues[roster.owner_id] || { QB: 0, RB: 0, WR: 0, TE: 0 };
        const ourPosValues = teamPositionValues[userProfile.sleeperUserId] || { QB: 0, RB: 0, WR: 0, TE: 0 };

        // Find positions where we're strong and they're weak
        for (const ourStrong of strongPositions) {
          for (const ourWeak of weakPositions) {
            // They need what we have surplus (their value < 70% of ours), we need what they have (their value > 130% of ours)
            if (theirPosValues[ourStrong] < ourPosValues[ourStrong] * 0.7 &&
                theirPosValues[ourWeak] > ourPosValues[ourWeak] * 1.3) {
              
              // Find tradeable pieces
              // Give: One of our depth at strong position
              const ourTradeable = userPlayers[ourStrong].slice(1, 3); // Our 2nd/3rd best
              // Get: One of their players at our weak position
              const theirTradeable = theirPlayers[ourWeak].slice(0, 2);

              if (ourTradeable.length > 0 && theirTradeable.length > 0) {
                // Try to find a fair trade
                for (const give of ourTradeable) {
                  for (const get of theirTradeable) {
                    const valueDiff = Math.abs(give.value - get.value);
                    const avgValue = (give.value + get.value) / 2;
                    const fairnessScore = avgValue > 0 ? Math.round(100 - (valueDiff / avgValue) * 50) : 50;
                    
                    // Only suggest trades within reasonable value difference (fairness >= 50)
                    if (fairnessScore >= 50 && give.value >= 15 && get.value >= 15) {
                      const ownerInfo = ownerMap.get(roster.owner_id) || { name: "Unknown", avatar: null };
                      
                      tradeIdeas.push({
                        tradePartner: { 
                          name: ownerInfo.name, 
                          avatar: ownerInfo.avatar,
                          ownerId: roster.owner_id
                        },
                        give: [{ name: give.name, pos: give.pos, value: Math.round(give.value) }],
                        get: [{ name: get.name, pos: get.pos, value: Math.round(get.value) }],
                        reason: `They need ${ourStrong} help, you need ${ourWeak} depth`,
                        fairnessScore: Math.min(100, Math.max(0, fairnessScore)),
                      });
                    }
                  }
                }
              }
            }
          }
        }
      }

      // Sort by fairness and limit to top 5
      tradeIdeas.sort((a, b) => b.fairnessScore - a.fairnessScore);
      const topIdeas = tradeIdeas.slice(0, 5);

      res.json({ tradeIdeas: topIdeas });
    } catch (error) {
      console.error("Error generating trade ideas:", error);
      res.status(500).json({ message: "Failed to generate trade ideas" });
    }
  });

  // Draft War Room API - Get league drafts and picks
  app.get("/api/fantasy/drafts/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      
      const drafts = await sleeperApi.getLeagueDrafts(leagueId);
      res.json({ drafts });
    } catch (error) {
      console.error("Error fetching drafts:", error);
      res.status(500).json({ message: "Failed to fetch drafts" });
    }
  });

  app.get("/api/fantasy/draft/:draftId/picks", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { draftId } = req.params;
      
      const [draft, picks] = await Promise.all([
        sleeperApi.getDraft(draftId),
        sleeperApi.getDraftPicks(draftId),
      ]);
      
      res.json({ draft, picks });
    } catch (error) {
      console.error("Error fetching draft picks:", error);
      res.status(500).json({ message: "Failed to fetch draft picks" });
    }
  });

  // Draft War Room - Get smart pick recommendations
  app.get("/api/fantasy/draft-recommendations/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { leagueId } = req.params;
      const { draftId, mode = "rookie" } = req.query;
      
      const userProfile = await storage.getUserProfile(userId);
      if (!userProfile?.sleeperUserId) {
        return res.status(400).json({ message: "Sleeper account not connected" });
      }

      const [rosters, allPlayers, league, stats, users, drafts] = await Promise.all([
        sleeperApi.getLeagueRosters(leagueId),
        sleeperApi.getAllPlayers(),
        sleeperApi.getLeague(leagueId),
        sleeperApi.getSeasonStats("2025", "regular"),
        sleeperApi.getLeagueUsers(leagueId),
        sleeperApi.getLeagueDrafts(leagueId),
      ]);

      // Fetch consensus values
      try {
        await dynastyConsensusService.fetchAndCacheValues();
      } catch (e) {
        console.log(`[DraftRoom] Failed to fetch consensus values: ${e}`);
      }

      const isSuperflex = dynastyEngine.isLeagueSuperflex(league);
      const userRoster = rosters.find(r => r.owner_id === userProfile.sleeperUserId);

      // Get draft picks if draft is active
      let draftPicks: sleeperApi.SleeperDraftPickResult[] = [];
      let activeDraft: sleeperApi.SleeperDraft | null = null;
      
      if (draftId) {
        const [draft, picks] = await Promise.all([
          sleeperApi.getDraft(draftId as string),
          sleeperApi.getDraftPicks(draftId as string),
        ]);
        activeDraft = draft;
        draftPicks = picks;
      } else if (drafts.length > 0) {
        // Use most recent draft
        activeDraft = drafts[0];
        draftPicks = await sleeperApi.getDraftPicks(drafts[0].draft_id);
      }

      // Get user's draft picks from this draft
      const userDraftPicks: any[] = [];
      const userRosterId = userRoster?.roster_id;
      
      for (const pick of draftPicks) {
        // Match by picked_by (user ID) or roster_id
        if (pick.picked_by === userProfile.sleeperUserId || pick.roster_id === userRosterId) {
          const player = allPlayers[pick.player_id];
          if (player) {
            userDraftPicks.push({
              playerId: pick.player_id,
              name: player.full_name || "Unknown",
              position: player.position || "?",
              team: player.team || "FA",
              round: pick.round,
              slot: pick.draft_slot,
              pickNo: (pick.round - 1) * (activeDraft?.settings?.teams || 12) + pick.draft_slot,
            });
          }
        }
      }

      // Analyze roster needs - include BOTH existing roster AND user's draft picks from this draft
      const positionCounts: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
      const rosterPlayers: any[] = [];
      const countedPlayerIds = new Set<string>(); // Prevent double-counting
      
      // Count existing roster players
      if (userRoster?.players) {
        for (const playerId of userRoster.players) {
          countedPlayerIds.add(playerId);
          const player = allPlayers[playerId];
          if (player?.position) {
            positionCounts[player.position] = (positionCounts[player.position] || 0) + 1;
            const playerStats = stats?.[playerId] || {};
            const gp = (playerStats as any).gp || 0;
            rosterPlayers.push({
              id: playerId,
              name: player.full_name,
              position: player.position,
              age: player.age,
              ppg: gp > 0 ? ((playerStats as any).pts_ppr || 0) / gp : 0,
            });
          }
        }
      }

      // Also count user's draft picks from this draft (skip if already on roster)
      for (const pick of userDraftPicks) {
        if (countedPlayerIds.has(pick.playerId)) continue; // Skip duplicates
        
        if (pick.position && positionCounts[pick.position] !== undefined) {
          countedPlayerIds.add(pick.playerId);
          positionCounts[pick.position]++;
          rosterPlayers.push({
            id: pick.playerId,
            name: pick.name,
            position: pick.position,
            age: allPlayers[pick.playerId]?.age,
            ppg: 0,
          });
        }
      }

      // Calculate roster age average
      const ages = rosterPlayers.filter(p => p.age).map(p => p.age);
      const avgAge = ages.length > 0 ? ages.reduce((a, b) => a + b, 0) / ages.length : 0;

      // Determine biggest needs based on position counts
      const needs: string[] = [];
      if (positionCounts.QB < 2 && isSuperflex) needs.push("QB");
      if (positionCounts.RB < 4) needs.push("RB");
      if (positionCounts.WR < 5) needs.push("WR");
      if (positionCounts.TE < 2) needs.push("TE");

      // Get available players (not drafted yet)
      const draftedPlayerIds = new Set(draftPicks.map(p => p.player_id));
      
      // Build player recommendations
      const availablePlayers: any[] = [];
      const isRookieDraft = mode === "rookie";
      
      for (const [playerId, player] of Object.entries(allPlayers)) {
        if (draftedPlayerIds.has(playerId)) continue;
        if (!player || !player.position) continue;
        if (!["QB", "RB", "WR", "TE"].includes(player.position)) continue;
        
        // For rookie draft, only include rookies (age <= 23 or experience < 1)
        if (isRookieDraft && player.years_exp !== 0) continue;
        // For startup, include all
        
        const playerStats = stats?.[playerId] || {};
        const gamesPlayed = playerStats.gp || 0;
        const ppg = gamesPlayed > 0 ? (playerStats.pts_ppr || 0) / gamesPlayed : 0;
        
        // Get dynasty value
        const blendedValue = dynastyEngine.getBlendedPlayerValue(
          playerId,
          player.full_name || "",
          player.position,
          player.age || null,
          player.years_exp || 0,
          player.injury_status || null,
          { points: playerStats.pts_ppr || 0, games: gamesPlayed, ppg },
          1, // Assume starter for ranking
          null,
          null
        );

        if (blendedValue.value > 5) {
          const needFit = needs.includes(player.position) ? "High" : "Medium";
          
          availablePlayers.push({
            playerId,
            name: player.full_name,
            position: player.position,
            team: player.team || "FA",
            age: player.age,
            value: blendedValue.value,
            needFit,
            ppg: Math.round(ppg * 10) / 10,
          });
        }
      }

      // Sort by value
      availablePlayers.sort((a, b) => b.value - a.value);

      // Detect positional runs in last 6 picks
      const recentPicks = draftPicks.slice(-6);
      const positionRuns: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
      for (const pick of recentPicks) {
        if (pick.metadata?.position) {
          positionRuns[pick.metadata.position] = (positionRuns[pick.metadata.position] || 0) + 1;
        }
      }

      // Identify runs (3+ of same position in last 6)
      const activeRuns: { position: string; count: number }[] = [];
      for (const [pos, count] of Object.entries(positionRuns)) {
        if (count >= 3) {
          activeRuns.push({ position: pos, count });
        }
      }

      // Get top recommendations by category
      const bestValue = availablePlayers.slice(0, 5);
      const bestForNeeds = availablePlayers
        .filter(p => needs.includes(p.position))
        .slice(0, 5);
      const bestUpside = availablePlayers
        .filter(p => p.age && p.age <= 24)
        .slice(0, 5);

      // Detect value drops (players who should have been picked earlier based on GLOBAL value rank)
      // First, build a full player list with values (including drafted) for global ranking
      const allPlayersWithValue: { playerId: string; value: number; drafted: boolean }[] = [];
      
      for (const [playerId, player] of Object.entries(allPlayers)) {
        if (!player || !player.position) continue;
        if (!["QB", "RB", "WR", "TE"].includes(player.position)) continue;
        if (isRookieDraft && player.years_exp !== 0) continue;
        
        const playerStats = stats?.[playerId] || {};
        const gamesPlayed = playerStats.gp || 0;
        
        const blendedValue = dynastyEngine.getBlendedPlayerValue(
          playerId,
          player.full_name || "",
          player.position,
          player.age || null,
          player.years_exp || 0,
          player.injury_status || null,
          { points: playerStats.pts_ppr || 0, games: gamesPlayed, ppg: gamesPlayed > 0 ? (playerStats.pts_ppr || 0) / gamesPlayed : 0 },
          1, null, null
        );
        
        allPlayersWithValue.push({
          playerId,
          value: blendedValue.value,
          drafted: draftedPlayerIds.has(playerId),
        });
      }
      
      // Sort ALL players by value to get global rank
      allPlayersWithValue.sort((a, b) => b.value - a.value);
      
      // Create global rank map
      const globalRankMap = new Map<string, number>();
      allPlayersWithValue.forEach((p, idx) => {
        globalRankMap.set(p.playerId, idx + 1);
      });
      
      const valueDrops: any[] = [];
      const pickNumber = draftPicks.length + 1;
      
      // Find available players whose global rank suggests they should have been picked earlier
      for (const player of availablePlayers.slice(0, 30)) {
        const globalRank = globalRankMap.get(player.playerId) || 999;
        const spotsFallen = pickNumber - globalRank;
        
        // If player has fallen 10+ spots past their expected position
        if (spotsFallen >= 10 && globalRank <= 100) {
          valueDrops.push({
            ...player,
            expectedPick: globalRank,
            spotsFallen,
          });
        }
      }

      res.json({
        recommendations: {
          bestValue,
          bestForNeeds,
          bestUpside,
        },
        valueDrops: valueDrops.slice(0, 3),
        rosterAnalysis: {
          positionCounts,
          needs,
          avgAge: Math.round(avgAge * 10) / 10,
          profile: avgAge > 27 ? "Contender" : avgAge < 25 ? "Rebuild" : "Balanced",
        },
        positionalRuns: activeRuns,
        draft: activeDraft ? {
          id: activeDraft.draft_id,
          status: activeDraft.status,
          type: activeDraft.type,
          rounds: activeDraft.settings?.rounds || 0,
          picksMade: draftPicks.length,
          totalPicks: (activeDraft.settings?.rounds || 0) * (activeDraft.settings?.teams || 0),
        } : null,
        draftBoard: draftPicks.map(p => ({
          pickNo: p.pick_no,
          round: p.round,
          slot: p.draft_slot,
          rosterId: p.roster_id,
          player: {
            id: p.player_id,
            name: `${p.metadata.first_name} ${p.metadata.last_name}`,
            position: p.metadata.position,
            team: p.metadata.team,
          },
        })),
        myPicks: userDraftPicks.sort((a, b) => a.pickNo - b.pickNo),
        mode,
      });
    } catch (error) {
      console.error("Error generating draft recommendations:", error);
      res.status(500).json({ message: "Failed to generate draft recommendations" });
    }
  });

  return httpServer;
}
