import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { users } from "@shared/models/auth";
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
import { eq, and, desc, sql, isNull, or, ilike, ne, asc } from "drizzle-orm";
import { getUncachableStripeClient, getStripePublishableKey, getLiveStripeClient } from "./stripeClient";
import * as engineOptimizer from "./engine/optimizer";
import * as engineExplainer from "./engine/explainer";
import { getLeagueContext, getPositionalScarcity, getAllRosterContexts, getStandings, getPlayerProjections } from "./engine/data-ingestion";
import { buildCorrelationMatrix, computePlayerDistribution } from "./engine/projection-model";
import { analyzePortfolio } from "./engine/portfolio-analyzer";
import { computeChampionshipPath } from "./engine/championship-path";
import { analyzeRiskProfile } from "./engine/risk-profiler";
import { scanForExploits } from "./engine/exploit-scanner";
import { detectRegressionAlerts } from "./engine/regression-detector";
import { buildEliteProfile } from "./engine/player-profile-engine";
import type { PlayerProjection } from "./engine/types";
import * as draftIntelService from "./engine/draft-intelligence-service";
import { getExternalRankingsSummary } from "./engine/external-rankings-service";
import * as playerValuationService from "./engine/player-valuation-service";
import * as devyProjectionService from "./engine/devy-projection-service";
import * as franchiseModelingService from "./engine/franchise-modeling-service";
import * as ufasService from "./engine/ufas-service";
import * as draftSimulationService from "./engine/draft-simulation-service";
import * as tradeSimulationService from "./engine/trade-simulation-service";
import * as marketDynamicsService from "./engine/market-dynamics-service";
import * as powerRankingsService from "./engine/power-rankings-service";
import * as inSeasonRankingsService from "./engine/in-season-rankings-service";
import * as aiExplanationService from "./engine/ai-explanation-service";
import * as marketPsychologyService from "./engine/market-psychology-service";

function r2(v: number): number { return Math.round(v * 100) / 100; }

// Server-side response cache for expensive API routes
class RouteCache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private ttl: number;
  private maxSize: number;

  constructor(ttlMs: number, maxSize: number = 200) {
    this.ttl = ttlMs;
    this.maxSize = maxSize;
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key: string, data: any): void {
    if (this.cache.size >= this.maxSize) {
      let oldest: string | null = null;
      let oldestTime = Infinity;
      this.cache.forEach((v, k) => {
        if (v.timestamp < oldestTime) {
          oldestTime = v.timestamp;
          oldest = k;
        }
      });
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  invalidate(keyPrefix: string): void {
    const keys = Array.from(this.cache.keys());
    for (const key of keys) {
      if (key.startsWith(keyPrefix)) this.cache.delete(key);
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

const leaguesCache = new RouteCache(3 * 60 * 1000);
const overviewCache = new RouteCache(2 * 60 * 1000);
const rosterCache = new RouteCache(2 * 60 * 1000);
const standingsCache = new RouteCache(3 * 60 * 1000);
const matchupsCache = new RouteCache(2 * 60 * 1000);
const leagueInfoCache = new RouteCache(10 * 60 * 1000);
const externalApiCache = new RouteCache(5 * 60 * 1000);
const playersCache = new RouteCache(15 * 60 * 1000);
const engineV3Cache = new RouteCache(5 * 60 * 1000);

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

// Simplified standalone player value helper for endpoints that don't need full blended calculation
function getSimplePlayerValue(playerId: string, player: any): number {
  if (!player) return 0;
  const pos = player.position || "?";
  const name = player.full_name || `${player.first_name || ""} ${player.last_name || ""}`.trim();
  const consensusVal = dynastyConsensusService.getNormalizedValue(name, pos, false) || 0;
  if (consensusVal > 0) return consensusVal;
  const age = player.age || 25;
  const yearsExp = player.years_exp || 0;
  const baseByPos: Record<string, number> = { QB: 3000, RB: 2500, WR: 2800, TE: 1500 };
  let base = baseByPos[pos] || 1000;
  const agePenalty = pos === "RB" ? Math.max(0, (age - 25) * 300) : Math.max(0, (age - 27) * 200);
  const expBonus = yearsExp <= 2 ? 500 : yearsExp <= 4 ? 200 : 0;
  return Math.max(100, base - agePenalty + expBonus);
}

// Parse commissioner notes on placeholder players to detect devy picks
// Common formats: "Husan Longstreet QB LSU", "J. Smith WR Alabama", "Player Name - QB - Georgia"
const VALID_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "EDGE", "DL", "DL1T", "DL3T", "DL5T", "ILB", "LB", "CB", "S", "DE", "DT", "OLB", "DB", "FB", "WRS", "IDP"]);

function parseDevyNote(note: string): { devyName: string; devyPosition: string; devySchool: string } | null {
  if (!note || note.length < 2) return null;
  
  // Strip emojis, special characters, dashes, and extra whitespace
  // eslint-disable-next-line no-control-regex
  const cleaned = note
    .replace(/[^\x20-\x7E\xC0-\xFF]/g, '')
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  const parts = cleaned.split(' ').filter(p => p.length > 0);
  
  if (parts.length < 1) return null;
  
  let positionIndex = -1;
  for (let i = 0; i < parts.length; i++) {
    if (VALID_POSITIONS.has(parts[i].toUpperCase())) {
      positionIndex = i;
      break;
    }
  }
  
  if (positionIndex !== -1) {
    const nameParts = parts.slice(0, positionIndex);
    const position = parts[positionIndex].toUpperCase();
    const schoolParts = parts.slice(positionIndex + 1);
    
    if (nameParts.length > 0) {
      return {
        devyName: nameParts.join(' '),
        devyPosition: position,
        devySchool: schoolParts.length > 0 ? schoolParts.join(' ') : "Unknown",
      };
    }
    
    if (schoolParts.length > 0) {
      return {
        devyName: schoolParts.join(' '),
        devyPosition: position,
        devySchool: "Unknown",
      };
    }
  }
  
  if (parts.length >= 2) {
    return {
      devyName: parts.join(' '),
      devyPosition: "?",
      devySchool: "Unknown",
    };
  }
  
  return null;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // SEO Routes - serve before auth to ensure crawlers can access
  app.get("/robots.txt", (req: Request, res: Response) => {
    const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host || "dt-sleeper-agent.replit.app";
    const baseUrl = `${protocol}://${host}`;
    const robotsTxt = `# DT Sleeper Agent - robots.txt
# ${baseUrl}

User-agent: *
Allow: /
Disallow: /league/
Disallow: /auth
Disallow: /upgrade
Disallow: /admin
Disallow: /dashboard
Disallow: /api/

Sitemap: ${baseUrl}/sitemap.xml
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
   - Custom dynasty player values (0-10,000 scale)
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

  app.get("/sitemap.xml", (req: Request, res: Response) => {
    const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host || "dt-sleeper-agent.replit.app";
    const baseUrl = `${protocol}://${host}`;
    const today = new Date().toISOString().split("T")[0];
    const pages = [
      { path: "/", changefreq: "weekly", priority: "1.0" },
    ];
    const urls = pages.map(p => `  <url>
    <loc>${baseUrl}${p.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join("\n");
    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
    res.type("application/xml").send(sitemapXml);
  });

  // Setup authentication
  await setupAuth(app);
  registerAuthRoutes(app);

  // Helper to check if user has active subscription or is grandfathered
  async function hasActiveSubscription(userId: string): Promise<boolean> {
    const profile = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).limit(1);
    if (!profile[0]) return false;
    
    // Grandfathered users have lifetime premium access
    if (profile[0].isGrandfathered) return true;
    
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
      console.log(`[subscription/status] Checking for userId: ${userId}`);
      const profile = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).limit(1);
      
      if (!profile[0]) {
        console.log(`[subscription/status] No profile found for userId: ${userId}`);
        return res.json({ 
          hasSubscription: false,
          status: null,
          periodEnd: null,
          isGrandfathered: false
        });
      }

      const { subscriptionStatus, subscriptionPeriodEnd, stripeSubscriptionId, subscriptionSource, isGrandfathered } = profile[0];
      console.log(`[subscription/status] userId: ${userId}, grandfathered: ${isGrandfathered}, subStatus: ${subscriptionStatus}`);
      
      if (isGrandfathered) {
        return res.json({
          hasSubscription: true,
          status: 'grandfathered',
          periodEnd: null,
          subscriptionId: null,
          subscriptionSource: null,
          isGrandfathered: true
        });
      }
      
      const isActive = subscriptionStatus === 'active' || subscriptionStatus === 'trialing';
      const periodEnd = subscriptionPeriodEnd ? new Date(subscriptionPeriodEnd) : null;
      const isValid = isActive && (!periodEnd || periodEnd > new Date());

      res.json({
        hasSubscription: isValid,
        status: subscriptionStatus,
        periodEnd: subscriptionPeriodEnd,
        subscriptionId: stripeSubscriptionId,
        subscriptionSource: subscriptionSource || (stripeSubscriptionId ? 'stripe' : null),
        isGrandfathered: false
      });
    } catch (error) {
      console.error("[subscription/status] Error:", error);
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

      const existingProfile = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).limit(1);
      if (existingProfile[0]?.isGrandfathered) {
        return res.json({ alreadyPremium: true });
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

      // Create checkout session - use request host for correct domain (custom domain support)
      const host = req.get('host') || process.env.REPLIT_DOMAINS?.split(',')[0];
      const protocol = req.protocol || 'https';
      const baseUrl = `${protocol}://${host}`;
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
      const host = req.get('host') || process.env.REPLIT_DOMAINS?.split(',')[0];
      const protocol = req.protocol || 'https';
      const baseUrl = `${protocol}://${host}`;
      
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
      
      // Parse the recurring JSON field if it's a string
      const prices = result.rows.map((row: any) => ({
        ...row,
        recurring: typeof row.recurring === 'string' ? JSON.parse(row.recurring) : row.recurring
      }));
      
      res.json({ prices });
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

  app.post("/api/subscription/sync-my-subscription", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      console.log(`[sync-sub] Manual sync requested for userId: ${userId}`);
      
      const profile = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).limit(1);
      const user = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
      const userEmail = user[0]?.email;
      
      let customerId = profile[0]?.stripeCustomerId;

      const stripeClients: { stripe: any; label: string }[] = [];
      try {
        const connectorStripe = await getUncachableStripeClient();
        stripeClients.push({ stripe: connectorStripe, label: 'connector' });
      } catch (e) {
        console.log('[sync-sub] Connector Stripe not available');
      }
      const liveStripe = await getLiveStripeClient();
      if (liveStripe) {
        const alreadyHasLive = stripeClients.some(c => c.label === 'connector' && process.env.STRIPE_SECRET_KEY);
        if (!alreadyHasLive || stripeClients.length === 0) {
          stripeClients.push({ stripe: liveStripe, label: 'live' });
        } else {
          stripeClients.push({ stripe: liveStripe, label: 'live' });
        }
      }

      if (stripeClients.length === 0) {
        return res.json({ synced: false, message: "Stripe not configured" });
      }

      if (!customerId && userEmail) {
        console.log(`[sync-sub] No stripeCustomerId, searching Stripe by email: ${userEmail}`);
        for (const { stripe, label } of stripeClients) {
          try {
            const customers = await stripe.customers.list({ email: userEmail.toLowerCase(), limit: 10 });
            if (customers.data.length > 0) {
              customerId = customers.data[0].id;
              console.log(`[sync-sub] Found customer ${customerId} via ${label} Stripe by email`);
              break;
            }
          } catch (e: any) {
            console.log(`[sync-sub] Error searching ${label} Stripe: ${e.message}`);
          }
        }

        if (customerId && profile[0]) {
          await db.update(schema.userProfiles)
            .set({ stripeCustomerId: customerId })
            .where(eq(schema.userProfiles.userId, userId));
        }
      }
      
      if (!customerId) {
        console.log(`[sync-sub] No Stripe customer found for userId: ${userId}`);
        return res.json({ synced: false, message: "No Stripe customer found for your email. Make sure you used the same email to pay as you used to register." });
      }

      for (const { stripe, label } of stripeClients) {
        try {
          const stripeSubs = await stripe.subscriptions.list({ customer: customerId, limit: 5 });
          const activeSub = stripeSubs.data.find((s: any) => s.status === 'active' || s.status === 'trialing') || stripeSubs.data[0];
          
          if (activeSub) {
            await db.update(schema.userProfiles)
              .set({
                stripeCustomerId: customerId,
                stripeSubscriptionId: activeSub.id,
                subscriptionStatus: activeSub.status,
                subscriptionPeriodEnd: (activeSub as any).current_period_end ? new Date((activeSub as any).current_period_end * 1000) : null,
                subscriptionSource: 'stripe'
              })
              .where(eq(schema.userProfiles.userId, userId));

            console.log(`[sync-sub] Successfully synced subscription ${activeSub.id} (${activeSub.status}) via ${label} for userId: ${userId}`);
            return res.json({ synced: true, source: label, status: activeSub.status });
          }
        } catch (e: any) {
          console.log(`[sync-sub] Error checking subscriptions via ${label}: ${e.message}`);
        }
      }

      return res.json({ synced: false, message: "No active subscription found for your account" });
    } catch (error) {
      console.error("Error syncing subscription:", error);
      res.status(500).json({ error: "Failed to sync subscription" });
    }
  });

  // Get league settings
  app.get("/api/league-settings/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { leagueId } = req.params;
      const settings = await storage.getLeagueSettings(userId, leagueId);
      res.json(settings || { devyEnabled: true, idpEnabled: true });
    } catch (error) {
      console.error("Error fetching league settings:", error);
      res.status(500).json({ message: "Failed to fetch league settings" });
    }
  });

  // Update league settings
  app.put("/api/league-settings/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { leagueId } = req.params;
      const { devyEnabled, idpEnabled } = req.body;
      const updates: Record<string, boolean> = {};
      if (devyEnabled !== undefined) updates.devyEnabled = devyEnabled !== false;
      if (idpEnabled !== undefined) updates.idpEnabled = idpEnabled !== false;
      const settings = await storage.upsertLeagueSettings(userId, leagueId, updates);
      res.json(settings);
    } catch (error) {
      console.error("Error updating league settings:", error);
      res.status(500).json({ message: "Failed to update league settings" });
    }
  });

  // Admin middleware - check if user is admin (by Sleeper username)
  const ADMIN_SLEEPER_USERNAMES = ['doubletap7798'];
  
  const requireAdmin = async (req: any, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const profile = await storage.getUserProfile(userId);
      if (!profile?.sleeperUsername || !ADMIN_SLEEPER_USERNAMES.includes(profile.sleeperUsername.toLowerCase())) {
        return res.status(403).json({ error: "Admin access required" });
      }
      next();
    } catch (error) {
      console.error("Admin check error:", error);
      return res.status(500).json({ error: "Failed to verify admin access" });
    }
  };

  // Admin routes
  app.get("/api/admin/subscriptions", isAuthenticated, requireAdmin, async (req: any, res: Response) => {
    try {
      const stripe = await getUncachableStripeClient();
      
      // Fetch all subscriptions from Stripe
      const subscriptions = await stripe.subscriptions.list({
        limit: 100,
        expand: ['data.customer'],
      });

      // Format subscription data
      const formattedSubs = subscriptions.data.map((sub: any) => {
        const customer = sub.customer as any;
        return {
          id: sub.id,
          status: sub.status,
          customerEmail: customer?.email || 'Unknown',
          customerName: customer?.name || customer?.email || 'Unknown',
          customerId: customer?.id || sub.customer,
          amount: sub.items?.data?.[0]?.price?.unit_amount ? (sub.items.data[0].price.unit_amount / 100).toFixed(2) : '0.00',
          currency: sub.items?.data?.[0]?.price?.currency?.toUpperCase() || 'USD',
          interval: sub.items?.data?.[0]?.price?.recurring?.interval || 'month',
          currentPeriodStart: sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null,
          currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          created: sub.created ? new Date(sub.created * 1000).toISOString() : null,
        };
      });

      // Get grandfathered users with their emails by joining with users table
      const grandfatheredUsersData = await db.select({
        userId: schema.userProfiles.userId,
        sleeperUsername: schema.userProfiles.sleeperUsername,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        createdAt: users.createdAt,
      })
        .from(schema.userProfiles)
        .leftJoin(users, eq(schema.userProfiles.userId, users.id))
        .where(eq(schema.userProfiles.isGrandfathered, true));

      res.json({
        subscriptions: formattedSubs,
        totalSubscriptions: formattedSubs.length,
        activeSubscriptions: formattedSubs.filter((s: any) => s.status === 'active').length,
        grandfatheredUsers: grandfatheredUsersData.length,
        grandfatheredUsersList: grandfatheredUsersData.map(u => ({
          userId: u.userId,
          email: u.email || 'Unknown',
          name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.sleeperUsername || 'Unknown',
          sleeperUsername: u.sleeperUsername || null,
          joinedAt: u.createdAt ? u.createdAt.toISOString() : null,
        })),
      });
    } catch (error) {
      console.error("Error fetching admin subscriptions:", error);
      res.status(500).json({ error: "Failed to fetch subscriptions" });
    }
  });

  app.get("/api/admin/users", isAuthenticated, requireAdmin, async (req: any, res: Response) => {
    try {
      const allUsers = await db.select({
        userId: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        createdAt: users.createdAt,
      }).from(users).orderBy(users.createdAt);

      const allProfiles = await db.select().from(schema.userProfiles);
      const profileMap = new Map(allProfiles.map(p => [p.userId, p]));

      const result = allUsers.map(u => {
        const profile = profileMap.get(u.userId);
        return {
          userId: u.userId,
          email: u.email || 'Unknown',
          name: [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Unknown',
          sleeperUsername: profile?.sleeperUsername || null,
          isPremium: profile?.subscriptionStatus === 'active' || profile?.isGrandfathered === true,
          isGrandfathered: profile?.isGrandfathered === true,
          subscriptionStatus: profile?.subscriptionStatus || null,
          subscriptionSource: profile?.subscriptionSource || null,
          joinedAt: u.createdAt ? u.createdAt.toISOString() : null,
        };
      });

      res.json({
        users: result,
        totalUsers: result.length,
        premiumUsers: result.filter(u => u.isPremium).length,
      });
    } catch (error) {
      console.error("Error fetching admin users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.post("/api/admin/toggle-premium", isAuthenticated, requireAdmin, async (req: any, res: Response) => {
    try {
      const { userId, makePremium } = req.body;
      if (!userId || typeof makePremium !== 'boolean') {
        return res.status(400).json({ error: "userId and makePremium (boolean) required" });
      }

      const existingProfile = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).limit(1);

      if (existingProfile[0]) {
        if (makePremium) {
          await db.update(schema.userProfiles)
            .set({ subscriptionStatus: 'active', subscriptionSource: 'manual', isGrandfathered: false })
            .where(eq(schema.userProfiles.userId, userId));
        } else {
          await db.update(schema.userProfiles)
            .set({ subscriptionStatus: null, subscriptionSource: null, isGrandfathered: false })
            .where(eq(schema.userProfiles.userId, userId));
        }
      } else {
        const { nanoid } = await import('nanoid');
        if (makePremium) {
          await db.insert(schema.userProfiles).values({
            id: nanoid(),
            userId,
            subscriptionStatus: 'active',
            subscriptionSource: 'manual',
            isGrandfathered: false,
          });
        }
      }

      console.log(`[admin] User ${userId} premium set to ${makePremium}`);
      res.json({ success: true, userId, isPremium: makePremium });
    } catch (error) {
      console.error("Error toggling premium:", error);
      res.status(500).json({ error: "Failed to toggle premium" });
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

  async function getAllUserLeagues(sleeperUserId: string): Promise<any[]> {
    const state = await sleeperApi.getState();
    const leagueSeason = state?.league_season || state?.season || "2026";
    const previousSeason = String(parseInt(leagueSeason) - 1);

    const [currentLeagues, prevLeagues] = await Promise.all([
      sleeperApi.getUserLeagues(sleeperUserId, leagueSeason),
      parseInt(leagueSeason) > 2020
        ? sleeperApi.getUserLeagues(sleeperUserId, previousSeason)
        : Promise.resolve([]),
    ]);

    const supersededIds = new Set<string>();
    for (const league of (currentLeagues || [])) {
      if (league.previous_league_id) {
        supersededIds.add(league.previous_league_id);
      }
    }

    const seen = new Set<string>();
    const merged: any[] = [];
    for (const league of (currentLeagues || [])) {
      if (!seen.has(league.league_id)) {
        seen.add(league.league_id);
        merged.push(league);
      }
    }
    for (const league of (prevLeagues || [])) {
      if (!seen.has(league.league_id) && !supersededIds.has(league.league_id)) {
        seen.add(league.league_id);
        merged.push(league);
      }
    }

    console.log(`[Leagues] Found ${currentLeagues?.length || 0} for ${leagueSeason}, ${prevLeagues?.length || 0} for ${previousSeason}, ${supersededIds.size} superseded, ${merged.length} after dedup`);
    return merged;
  }

  // Get user's leagues (enriched with commissioner names and league type)
  app.get("/api/sleeper/leagues", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getUserProfile(userId);

      if (!profile?.sleeperUserId) {
        return res.json([]);
      }

      const cacheKey = `leagues:${profile.sleeperUserId}`;
      const cached = leaguesCache.get(cacheKey);
      if (cached) return res.json(cached);

      const state = await sleeperApi.getState();
      const currentSeason = state?.league_season || state?.season || "2026";
      let leagues = await getAllUserLeagues(profile.sleeperUserId);

      leagues = leagues.filter(league => {
        const isDynasty = league.settings?.type === 2;
        const isKeeper = league.settings?.type === 1;
        if (isDynasty || isKeeper) return true;
        return league.season === currentSeason || league.status !== "complete";
      });

      const commishMap = new Map<string, string>();
      await Promise.all(
        leagues.map(async (league) => {
          try {
            const users = await sleeperApi.getLeagueUsers(league.league_id);
            const commish = (users as any[]).find((u: any) => u.is_owner);
            if (commish) {
              commishMap.set(league.league_id, commish.display_name || commish.username || "Unknown");
            }
          } catch {}
        })
      );

      const enrichedLeagues = leagues.map(league => {
        let leagueType = "Redraft";
        if (league.settings?.best_ball === 1) {
          leagueType = "Best Ball";
        } else if (league.settings?.type === 2) {
          leagueType = "Dynasty";
        } else if (league.settings?.type === 1) {
          leagueType = "Keeper";
        }

        return {
          ...league,
          commissioner_name: commishMap.get(league.league_id) || "Unknown",
          league_type: leagueType,
        };
      });

      leaguesCache.set(cacheKey, enrichedLeagues);
      res.json(enrichedLeagues);
    } catch (error) {
      console.error("Error fetching leagues:", error);
      res.status(500).json({ message: "Failed to fetch leagues" });
    }
  });

  // Multi-league overview: upcoming matchups + standings for all user's leagues
  app.get("/api/sleeper/leagues-overview", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getUserProfile(userId);

      if (!profile?.sleeperUserId) {
        return res.json([]);
      }

      const ovCacheKey = `overview:${profile.sleeperUserId}`;
      const ovCached = overviewCache.get(ovCacheKey);
      if (ovCached) return res.json(ovCached);

      const state = await sleeperApi.getState();
      let leagues = await getAllUserLeagues(profile.sleeperUserId);

      const currentWeek = state?.display_week || state?.week || 1;

      const overviewResults = await Promise.all(
        leagues.map(async (league) => {
          try {
            const [rosters, users, matchups] = await Promise.all([
              sleeperApi.getLeagueRosters(league.league_id),
              sleeperApi.getLeagueUsers(league.league_id),
              sleeperApi.getMatchups(league.league_id, currentWeek).catch(() => []),
            ]);

            const userMap = new Map((users || []).map((u) => [u.user_id, u]));
            const rosterMap = new Map((rosters || []).map((r) => [r.roster_id, r]));
            const userRoster = rosters.find(r => r.owner_id === profile.sleeperUserId);
            if (!userRoster) return null;

            const wins = userRoster.settings?.wins || 0;
            const losses = userRoster.settings?.losses || 0;
            const ties = userRoster.settings?.ties || 0;
            const fpts = (userRoster.settings?.fpts || 0) + (userRoster.settings?.fpts_decimal || 0) / 100;

            const sortedRosters = [...rosters].sort((a, b) => {
              const wA = a.settings?.wins || 0;
              const wB = b.settings?.wins || 0;
              if (wB !== wA) return wB - wA;
              const fA = (a.settings?.fpts || 0) + (a.settings?.fpts_decimal || 0) / 100;
              const fB = (b.settings?.fpts || 0) + (b.settings?.fpts_decimal || 0) / 100;
              return fB - fA;
            });
            const rank = sortedRosters.findIndex(r => r.roster_id === userRoster.roster_id) + 1;
            const totalTeams = rosters.length;

            let leagueType = "Redraft";
            if (league.settings?.best_ball === 1) leagueType = "Best Ball";
            else if (league.settings?.type === 2) leagueType = "Dynasty";
            else if (league.settings?.type === 1) leagueType = "Keeper";

            let upcomingMatchup: any = null;
            if (matchups && matchups.length > 0) {
              const userMatchup = matchups.find((m: any) => m.roster_id === userRoster.roster_id);
              if (userMatchup && userMatchup.matchup_id != null) {
                const opponentMatchup = matchups.find(
                  (m: any) => m.matchup_id === userMatchup.matchup_id && m.roster_id !== userRoster.roster_id
                );
                if (opponentMatchup) {
                  const oppRoster = rosterMap.get(opponentMatchup.roster_id);
                  const oppUser = oppRoster ? userMap.get(oppRoster.owner_id) : null;
                  const oppWins = oppRoster?.settings?.wins || 0;
                  const oppLosses = oppRoster?.settings?.losses || 0;
                  upcomingMatchup = {
                    week: currentWeek,
                    opponentName: oppUser?.display_name || oppUser?.username || `Team ${opponentMatchup.roster_id}`,
                    opponentAvatar: oppUser?.avatar ? sleeperApi.getAvatarUrl(oppUser.avatar) : null,
                    opponentRecord: `${oppWins}-${oppLosses}`,
                    userPoints: userMatchup.points || 0,
                    opponentPoints: opponentMatchup.points || 0,
                  };
                }
              }
            }

            return {
              leagueId: league.league_id,
              leagueName: league.name,
              leagueAvatar: league.avatar ? `https://sleepercdn.com/avatars/${league.avatar}` : null,
              leagueType,
              season: league.season,
              record: { wins, losses, ties },
              rank,
              totalTeams,
              pointsFor: Math.round(fpts * 10) / 10,
              upcomingMatchup,
            };
          } catch {
            return null;
          }
        })
      );

      const overviewData = overviewResults.filter(Boolean);
      overviewCache.set(ovCacheKey, overviewData);
      res.json(overviewData);
    } catch (error) {
      console.error("Error fetching leagues overview:", error);
      res.status(500).json({ message: "Failed to fetch leagues overview" });
    }
  });

  // Strength of Schedule endpoint
  app.get("/api/sleeper/strength-of-schedule/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      const userId = req.user.claims.sub;
      const profile = await storage.getUserProfile(userId);
      if (!profile?.sleeperUserId) {
        return res.status(400).json({ message: "Sleeper account not connected" });
      }

      const [league, state, rosters, users] = await Promise.all([
        sleeperApi.getLeague(leagueId),
        sleeperApi.getState(),
        sleeperApi.getLeagueRosters(leagueId),
        sleeperApi.getLeagueUsers(leagueId),
      ]);

      if (!league || !state) {
        return res.status(404).json({ message: "League not found" });
      }

      const userRoster = rosters.find(r => r.owner_id === profile.sleeperUserId);
      if (!userRoster) {
        return res.status(404).json({ message: "User roster not found" });
      }

      const currentWeek = state.display_week || state.week || 1;
      const playoffWeekStart = league.settings?.playoff_week_start || 15;
      const userMap = new Map((users || []).map((u) => [u.user_id, u]));
      const rosterMap = new Map((rosters || []).map((r) => [r.roster_id, r]));

      // Calculate power scores for all teams based on record and points
      const teamPowerScores = new Map<number, number>();
      rosters.forEach(r => {
        const wins = r.settings?.wins || 0;
        const losses = r.settings?.losses || 0;
        const fpts = (r.settings?.fpts || 0) + (r.settings?.fpts_decimal || 0) / 100;
        const totalGames = wins + losses;
        const winPct = totalGames > 0 ? wins / totalGames : 0.5;
        const maxFpts = Math.max(...rosters.map(ro => (ro.settings?.fpts || 0) + (ro.settings?.fpts_decimal || 0) / 100));
        const fptsNorm = maxFpts > 0 ? fpts / maxFpts : 0.5;
        const powerScore = (winPct * 0.5 + fptsNorm * 0.5) * 100;
        teamPowerScores.set(r.roster_id, Math.round(powerScore * 10) / 10);
      });

      // Sort teams by power score for ranking
      const sortedTeams = Array.from(teamPowerScores.entries()).sort((a, b) => b[1] - a[1]);
      const powerRankMap = new Map(sortedTeams.map(([rid, score], idx) => [rid, { rank: idx + 1, score }]));

      // Get all remaining regular season matchups
      const remainingWeeks = [];
      for (let w = currentWeek; w < playoffWeekStart; w++) {
        remainingWeeks.push(w);
      }

      const weekMatchups = await Promise.all(
        remainingWeeks.map(w => sleeperApi.getMatchups(leagueId, w).then(m => ({ week: w, matchups: m })).catch(() => ({ week: w, matchups: [] })))
      );

      // Build schedule with SOS data for ALL teams
      const teamSchedules = new Map<number, { week: number; opponentId: number; opponentName: string; opponentAvatar: string | null; opponentRecord: string; opponentPowerRank: number; opponentPowerScore: number; difficulty: string }[]>();

      rosters.forEach(r => teamSchedules.set(r.roster_id, []));

      weekMatchups.forEach(({ week, matchups }) => {
        if (!matchups || matchups.length === 0) return;

        const matchupGroups = new Map<number, any[]>();
        matchups.forEach((m: any) => {
          if (m.matchup_id == null) return;
          if (!matchupGroups.has(m.matchup_id)) matchupGroups.set(m.matchup_id, []);
          matchupGroups.get(m.matchup_id)!.push(m);
        });

        matchupGroups.forEach(group => {
          if (group.length !== 2) return;
          const [a, b] = group;

          const addScheduleEntry = (teamId: number, oppId: number) => {
            const oppRoster = rosterMap.get(oppId);
            const oppUser = oppRoster ? userMap.get(oppRoster.owner_id) : null;
            const oppPower = powerRankMap.get(oppId) || { rank: rosters.length, score: 0 };
            const oppWins = oppRoster?.settings?.wins || 0;
            const oppLosses = oppRoster?.settings?.losses || 0;

            let difficulty = "Medium";
            const totalTeams = rosters.length;
            const topThird = Math.ceil(totalTeams / 3);
            const bottomThird = totalTeams - topThird;
            if (oppPower.rank <= topThird) difficulty = "Hard";
            else if (oppPower.rank > bottomThird) difficulty = "Easy";

            const schedules = teamSchedules.get(teamId) || [];
            schedules.push({
              week,
              opponentId: oppId,
              opponentName: oppUser?.display_name || oppUser?.username || `Team ${oppId}`,
              opponentAvatar: oppUser?.avatar ? sleeperApi.getAvatarUrl(oppUser.avatar) : null,
              opponentRecord: `${oppWins}-${oppLosses}`,
              opponentPowerRank: oppPower.rank,
              opponentPowerScore: oppPower.score,
              difficulty,
            });
            teamSchedules.set(teamId, schedules);
          };

          addScheduleEntry(a.roster_id, b.roster_id);
          addScheduleEntry(b.roster_id, a.roster_id);
        });
      });

      // Calculate overall SOS for each team
      const teamSosScores: { rosterId: number; ownerName: string; avatar: string | null; record: string; sosScore: number; sosRank: number; remainingGames: any[]; avgOpponentPowerRank: number }[] = [];

      rosters.forEach(r => {
        const schedule = teamSchedules.get(r.roster_id) || [];
        const user = userMap.get(r.owner_id);
        const avgPowerScore = schedule.length > 0
          ? schedule.reduce((sum, g) => sum + g.opponentPowerScore, 0) / schedule.length
          : 50;
        const avgPowerRank = schedule.length > 0
          ? schedule.reduce((sum, g) => sum + g.opponentPowerRank, 0) / schedule.length
          : rosters.length / 2;

        teamSosScores.push({
          rosterId: r.roster_id,
          ownerName: user?.display_name || user?.username || `Team ${r.roster_id}`,
          avatar: user?.avatar ? sleeperApi.getAvatarUrl(user.avatar) : null,
          record: `${r.settings?.wins || 0}-${r.settings?.losses || 0}`,
          sosScore: Math.round(avgPowerScore * 10) / 10,
          sosRank: 0,
          remainingGames: schedule,
          avgOpponentPowerRank: Math.round(avgPowerRank * 10) / 10,
        });
      });

      // Rank by SOS (higher = harder schedule)
      teamSosScores.sort((a, b) => b.sosScore - a.sosScore);
      teamSosScores.forEach((t, idx) => { t.sosRank = idx + 1; });

      const userSos = teamSosScores.find(t => t.rosterId === userRoster.roster_id);

      res.json({
        leagueName: league.name,
        season: league.season,
        currentWeek,
        playoffWeekStart,
        totalTeams: rosters.length,
        userRosterId: userRoster.roster_id,
        userSos: userSos || null,
        allTeamsSos: teamSosScores,
        powerRankings: sortedTeams.map(([rid, score], idx) => {
          const r = rosterMap.get(rid);
          const u = r ? userMap.get(r.owner_id) : null;
          return {
            rosterId: rid,
            ownerName: u?.display_name || u?.username || `Team ${rid}`,
            rank: idx + 1,
            score,
          };
        }),
      });
    } catch (error) {
      console.error("Error fetching SOS:", error);
      res.status(500).json({ message: "Failed to fetch strength of schedule" });
    }
  });

  // Season-long projections with Monte Carlo simulation
  app.get("/api/fantasy/season-projections/:leagueId", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      const userId = req.user.claims.sub;
      const profile = await storage.getUserProfile(userId);
      if (!profile?.sleeperUserId) {
        return res.status(400).json({ message: "Sleeper account not connected" });
      }

      const [league, state, rosters, users] = await Promise.all([
        sleeperApi.getLeague(leagueId),
        sleeperApi.getState(),
        sleeperApi.getLeagueRosters(leagueId),
        sleeperApi.getLeagueUsers(leagueId),
      ]);

      if (!league || !state) {
        return res.status(404).json({ message: "League not found" });
      }

      const currentWeek = state.display_week || state.week || 1;
      const playoffWeekStart = league.settings?.playoff_week_start || 15;
      const playoffTeams = league.settings?.playoff_teams || 6;
      const totalWeeks = playoffWeekStart - 1;
      const userMap = new Map((users || []).map((u) => [u.user_id, u]));

      const allZeroRecords = rosters.every(r => (r.settings?.wins || 0) === 0 && (r.settings?.losses || 0) === 0);
      if (currentWeek <= 1 && allZeroRecords) {
        return res.json({ message: "Season hasn't started yet - projections will be available once games begin", projections: [] });
      }

      const teamPowerScores = new Map<number, number>();
      const maxFpts = Math.max(...rosters.map(ro => (ro.settings?.fpts || 0) + (ro.settings?.fpts_decimal || 0) / 100), 1);
      rosters.forEach(r => {
        const wins = r.settings?.wins || 0;
        const losses = r.settings?.losses || 0;
        const fpts = (r.settings?.fpts || 0) + (r.settings?.fpts_decimal || 0) / 100;
        const totalGames = wins + losses;
        const winPct = totalGames > 0 ? wins / totalGames : 0.5;
        const fptsNorm = maxFpts > 0 ? fpts / maxFpts : 0.5;
        const powerScore = Math.max((winPct * 0.5 + fptsNorm * 0.5) * 100, 5);
        teamPowerScores.set(r.roster_id, Math.round(powerScore * 10) / 10);
      });

      const sortedByPower = Array.from(teamPowerScores.entries()).sort((a, b) => b[1] - a[1]);
      const currentRankMap = new Map(sortedByPower.map(([rid], idx) => [rid, idx + 1]));

      const remainingWeeks: number[] = [];
      for (let w = currentWeek; w < playoffWeekStart; w++) {
        remainingWeeks.push(w);
      }

      const weekMatchups = await Promise.all(
        remainingWeeks.map(w => sleeperApi.getMatchups(leagueId, w).then(m => ({ week: w, matchups: m })).catch(() => ({ week: w, matchups: [] })))
      );

      interface ScheduleGame { week: number; rosterId: number; opponentId: number; }
      const schedule: ScheduleGame[] = [];

      weekMatchups.forEach(({ week, matchups }) => {
        if (!matchups || matchups.length === 0) return;
        const matchupGroups = new Map<number, any[]>();
        matchups.forEach((m: any) => {
          if (m.matchup_id == null) return;
          if (!matchupGroups.has(m.matchup_id)) matchupGroups.set(m.matchup_id, []);
          matchupGroups.get(m.matchup_id)!.push(m);
        });
        matchupGroups.forEach(group => {
          if (group.length !== 2) return;
          const [a, b] = group;
          schedule.push({ week, rosterId: a.roster_id, opponentId: b.roster_id });
          schedule.push({ week, rosterId: b.roster_id, opponentId: a.roster_id });
        });
      });

      const SIMULATION_COUNT = 500;
      const rosterIds = rosters.map(r => r.roster_id);
      const totalWinsAccum = new Map<number, number>();
      const totalLossesAccum = new Map<number, number>();
      const playoffCountAccum = new Map<number, number>();
      const bestWins = new Map<number, number>();
      const worstWins = new Map<number, number>();

      rosterIds.forEach(rid => {
        const currentWins = rosters.find(r => r.roster_id === rid)?.settings?.wins || 0;
        totalWinsAccum.set(rid, 0);
        totalLossesAccum.set(rid, 0);
        playoffCountAccum.set(rid, 0);
        bestWins.set(rid, currentWins);
        worstWins.set(rid, currentWins + remainingWeeks.length);
      });

      for (let sim = 0; sim < SIMULATION_COUNT; sim++) {
        const simWins = new Map<number, number>();
        rosterIds.forEach(rid => {
          simWins.set(rid, rosters.find(r => r.roster_id === rid)?.settings?.wins || 0);
        });

        const processed = new Set<string>();
        schedule.forEach(game => {
          const key = `${game.week}-${Math.min(game.rosterId, game.opponentId)}-${Math.max(game.rosterId, game.opponentId)}`;
          if (processed.has(key)) return;
          processed.add(key);

          const teamPower = teamPowerScores.get(game.rosterId) || 5;
          const oppPower = teamPowerScores.get(game.opponentId) || 5;
          let winProb = teamPower / (teamPower + oppPower);
          winProb = Math.max(0.2, Math.min(0.8, winProb));

          if (Math.random() < winProb) {
            simWins.set(game.rosterId, (simWins.get(game.rosterId) || 0) + 1);
          } else {
            simWins.set(game.opponentId, (simWins.get(game.opponentId) || 0) + 1);
          }
        });

        rosterIds.forEach(rid => {
          const wins = simWins.get(rid) || 0;
          totalWinsAccum.set(rid, (totalWinsAccum.get(rid) || 0) + wins);
          const losses = totalWeeks - wins;
          totalLossesAccum.set(rid, (totalLossesAccum.get(rid) || 0) + losses);
          if (wins > (bestWins.get(rid) || 0)) bestWins.set(rid, wins);
          if (wins < (worstWins.get(rid) || totalWeeks)) worstWins.set(rid, wins);
        });

        const ranked = rosterIds.map(rid => ({ rid, wins: simWins.get(rid) || 0 })).sort((a, b) => b.wins - a.wins);
        ranked.slice(0, playoffTeams).forEach(({ rid }) => {
          playoffCountAccum.set(rid, (playoffCountAccum.get(rid) || 0) + 1);
        });
      }

      const projections = rosters.map(r => {
        const rid = r.roster_id;
        const user = userMap.get(r.owner_id);
        const currentWins = r.settings?.wins || 0;
        const currentLosses = r.settings?.losses || 0;
        const projectedWins = Math.round(((totalWinsAccum.get(rid) || 0) / SIMULATION_COUNT) * 10) / 10;
        const projectedLosses = Math.round((totalWeeks - projectedWins) * 10) / 10;
        const playoffOdds = Math.round(((playoffCountAccum.get(rid) || 0) / SIMULATION_COUNT) * 1000) / 10;
        const best = bestWins.get(rid) || currentWins;
        const worst = worstWins.get(rid) || currentWins;
        const powerScore = teamPowerScores.get(rid) || 0;
        const currentRank = currentRankMap.get(rid) || rosterIds.length;

        return {
          rosterId: rid,
          ownerName: user?.display_name || user?.username || `Team ${rid}`,
          avatar: user?.avatar ? sleeperApi.getAvatarUrl(user.avatar) : null,
          currentRecord: `${currentWins}-${currentLosses}`,
          projectedWins,
          projectedLosses,
          playoffOdds,
          bestCase: `${best}-${totalWeeks - best}`,
          worstCase: `${worst}-${totalWeeks - worst}`,
          currentRank,
          projectedRank: 0,
          powerScore,
          trend: "steady" as "rising" | "falling" | "steady",
        };
      });

      projections.sort((a, b) => b.playoffOdds - a.playoffOdds);
      projections.forEach((p, idx) => {
        p.projectedRank = idx + 1;
        if (p.currentRank > p.projectedRank + 1) p.trend = "rising";
        else if (p.currentRank < p.projectedRank - 1) p.trend = "falling";
        else p.trend = "steady";
      });

      res.json({
        projections,
        simulationCount: SIMULATION_COUNT,
        playoffSpots: playoffTeams,
        remainingWeeks: remainingWeeks.length,
        totalWeeks,
      });
    } catch (error) {
      console.error("Error fetching season projections:", error);
      res.status(500).json({ message: "Failed to fetch season projections" });
    }
  });

  // Player usage trends from nflverse data
  app.get("/api/fantasy/usage-trends/:leagueId", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      const userId = req.user.claims.sub;
      const profile = await storage.getUserProfile(userId);
      if (!profile?.sleeperUserId) {
        return res.status(400).json({ message: "Sleeper account not connected" });
      }

      const [rosters, allPlayers, league] = await Promise.all([
        sleeperApi.getLeagueRosters(leagueId),
        sleeperApi.getAllPlayers(),
        sleeperApi.getLeague(leagueId),
      ]);

      const userRoster = rosters.find(r => r.owner_id === profile.sleeperUserId);
      if (!userRoster || !userRoster.players || userRoster.players.length === 0) {
        return res.json({ players: [] });
      }

      const { getPlayerWeeklyStats } = await import('./nflverse-stats');

      const skillPositions = new Set(["QB", "RB", "WR", "TE"]);
      const rosterPlayers = userRoster.players
        .map(pid => {
          const p = allPlayers[pid];
          if (!p) return null;
          if (!skillPositions.has(p.position)) return null;
          return { id: pid, name: `${p.first_name} ${p.last_name}`, position: p.position, team: p.team || "FA" };
        })
        .filter(Boolean) as { id: string; name: string; position: string; team: string }[];

      type TrendDirection = "rising" | "falling" | "steady";
      const calcTrend = (last3Val: number, seasonVal: number): TrendDirection => {
        if (seasonVal === 0) return "steady";
        if (last3Val > seasonVal * 1.15) return "rising";
        if (last3Val < seasonVal * 0.85) return "falling";
        return "steady";
      };

      const batchSize = 5;
      const results: any[] = [];

      for (let i = 0; i < rosterPlayers.length; i += batchSize) {
        const batch = rosterPlayers.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (player) => {
            try {
              const weeklyStats = await getPlayerWeeklyStats(player.name);
              if (weeklyStats.length < 3) return null;

              const weeklyData = weeklyStats.map(w => ({
                week: w.week,
                targets: w.targets,
                receptions: w.receptions,
                carries: w.carries,
                rushingYards: w.rushing_yards,
                receivingYards: w.receiving_yards,
                fantasyPoints: w.fantasy_points_ppr,
                targetShare: w.target_share,
                airYardsShare: w.air_yards_share,
              }));

              const totalWeeks = weeklyData.length;
              const seasonTotalFP = weeklyData.reduce((s, w) => s + w.fantasyPoints, 0);

              const seasonAvg = {
                targets: weeklyData.reduce((s, w) => s + w.targets, 0) / totalWeeks,
                carries: weeklyData.reduce((s, w) => s + w.carries, 0) / totalWeeks,
                fantasyPoints: seasonTotalFP / totalWeeks,
                targetShare: weeklyData.reduce((s, w) => s + w.targetShare, 0) / totalWeeks,
              };

              const last3 = weeklyData.slice(-3);
              const last3Avg = {
                targets: last3.reduce((s, w) => s + w.targets, 0) / 3,
                carries: last3.reduce((s, w) => s + w.carries, 0) / 3,
                fantasyPoints: last3.reduce((s, w) => s + w.fantasyPoints, 0) / 3,
                targetShare: last3.reduce((s, w) => s + w.targetShare, 0) / 3,
              };

              const trends = {
                targetShareTrend: calcTrend(last3Avg.targetShare, seasonAvg.targetShare),
                usageTrend: calcTrend(last3Avg.targets + last3Avg.carries, seasonAvg.targets + seasonAvg.carries),
                pointsTrend: calcTrend(last3Avg.fantasyPoints, seasonAvg.fantasyPoints),
              };

              return {
                playerId: player.id,
                name: player.name,
                position: player.position,
                team: player.team,
                weeklyData,
                trends,
                seasonAvg,
                last3Avg,
                _totalFP: seasonTotalFP,
              };
            } catch {
              return null;
            }
          })
        );
        results.push(...batchResults.filter(Boolean));
      }

      results.sort((a, b) => b._totalFP - a._totalFP);
      const limited = results.slice(0, 25).map(({ _totalFP, ...rest }) => rest);

      res.json({ players: limited });
    } catch (error) {
      console.error("Error fetching usage trends:", error);
      res.status(500).json({ message: "Failed to fetch usage trends" });
    }
  });

  app.get("/api/fantasy/injury-report/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      const userId = req.user.claims.sub;
      const profile = await storage.getUserProfile(userId);
      if (!profile?.sleeperUserId) {
        return res.status(400).json({ message: "Sleeper account not connected" });
      }

      const [rosters, allPlayers, league] = await Promise.all([
        sleeperApi.getLeagueRosters(leagueId),
        sleeperApi.getAllPlayers(),
        sleeperApi.getLeague(leagueId),
      ]);

      const userRoster = rosters.find(r => r.owner_id === profile.sleeperUserId);
      if (!userRoster || !userRoster.players || userRoster.players.length === 0) {
        return res.json({ injuries: [], healthyCount: 0, injuredCount: 0, irCount: 0, leagueName: league?.name || "Unknown" });
      }

      const severityMap: Record<string, "minor" | "moderate" | "severe"> = {
        Questionable: "minor",
        Doubtful: "moderate",
        Out: "severe",
        IR: "severe",
        PUP: "severe",
        Suspended: "severe",
      };

      const injured: any[] = [];
      const healthy: any[] = [];
      let irCount = 0;

      for (const pid of userRoster.players) {
        const p = allPlayers[pid];
        if (!p) continue;
        const injuryStatus = p.injury_status || null;
        if (injuryStatus) {
          if (injuryStatus === "IR" || injuryStatus === "PUP") irCount++;
          injured.push({
            playerId: pid,
            name: `${p.first_name || ""} ${p.last_name || ""}`.trim(),
            position: p.position || "Unknown",
            team: p.team || null,
            injuryStatus,
            injuryBodyPart: p.injury_body_part || null,
            injuryNotes: p.injury_notes || null,
            injuryStartDate: p.injury_start_date || null,
            severity: severityMap[injuryStatus] || "moderate",
            years_exp: p.years_exp || 0,
            age: p.age || 0,
          });
        } else {
          healthy.push({
            playerId: pid,
            name: `${p.first_name || ""} ${p.last_name || ""}`.trim(),
            position: p.position || "Unknown",
            team: p.team || null,
            years_exp: p.years_exp || 0,
            age: p.age || 0,
          });
        }
      }

      const rosteredPlayerIds = new Set<string>();
      for (const roster of rosters) {
        if (roster.players) {
          for (const pid of roster.players) {
            rosteredPlayerIds.add(pid);
          }
        }
      }

      const injuriesWithReplacements = injured.map(inj => {
        const samePositionHealthy = healthy
          .filter(h => h.position === inj.position)
          .sort((a, b) => (b.years_exp - a.years_exp) || (b.age - a.age));
        const rosterReplacement = samePositionHealthy.length > 0
          ? { name: samePositionHealthy[0].name, position: samePositionHealthy[0].position, playerId: samePositionHealthy[0].playerId }
          : null;

        const waiverOptions: { name: string; position: string; team: string; playerId: string }[] = [];
        const allPlayerEntries = Object.entries(allPlayers);
        const freeAgents = allPlayerEntries
          .filter(([pid, p]) => {
            if (rosteredPlayerIds.has(pid)) return false;
            if (!p || p.position !== inj.position) return false;
            if (!p.active) return false;
            return true;
          })
          .sort(([, a], [, b]) => ((b.years_exp || 0) - (a.years_exp || 0)))
          .slice(0, 3);

        for (const [pid, p] of freeAgents) {
          waiverOptions.push({
            name: `${p.first_name || ""} ${p.last_name || ""}`.trim(),
            position: p.position,
            team: p.team || "FA",
            playerId: pid,
          });
        }

        return {
          playerId: inj.playerId,
          name: inj.name,
          position: inj.position,
          team: inj.team,
          injuryStatus: inj.injuryStatus,
          injuryBodyPart: inj.injuryBodyPart,
          injuryNotes: inj.injuryNotes,
          injuryStartDate: inj.injuryStartDate,
          severity: inj.severity,
          rosterReplacement,
          waiverOptions,
        };
      });

      res.json({
        injuries: injuriesWithReplacements,
        healthyCount: healthy.length,
        injuredCount: injured.length,
        irCount,
        leagueName: league?.name || "Unknown",
      });
    } catch (error) {
      console.error("Error fetching injury report:", error);
      res.status(500).json({ message: "Failed to fetch injury report" });
    }
  });

  // Team Report - shareable team summary card
  app.get("/api/fantasy/team-report/:leagueId", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      const userId = req.user.claims.sub;
      const profile = await storage.getUserProfile(userId);

      if (!profile?.sleeperUserId) {
        return res.status(400).json({ message: "Sleeper account not connected" });
      }

      const [rosters, allPlayers, league, users, stats] = await Promise.all([
        sleeperApi.getLeagueRosters(leagueId),
        sleeperApi.getAllPlayers(),
        sleeperApi.getLeague(leagueId),
        sleeperApi.getLeagueUsers(leagueId),
        sleeperApi.getSeasonStats("2025", "regular"),
      ]);

      try { await dynastyConsensusService.fetchAndCacheValues(); } catch(e) {}
      const isSuperflex = dynastyEngine.isLeagueSuperflex(league);
      const leagueScoring = league ? dynastyEngine.parseLeagueScoringSettings(league) : null;

      const userRoster = rosters.find(r => r.owner_id === profile.sleeperUserId);
      if (!userRoster) {
        return res.status(404).json({ message: "Roster not found in this league" });
      }

      const userEntry = users.find(u => u.user_id === profile.sleeperUserId);
      const teamName = userEntry?.display_name || userEntry?.username || "My Team";
      const avatar = userEntry?.avatar ? `https://sleepercdn.com/avatars/${userEntry.avatar}` : null;
      const leagueName = league?.name || "Unknown League";

      const getBlendedValue = (playerId: string, player: any) => {
        const pos = player?.position || "?";
        const playerName = player?.full_name || `${player?.first_name} ${player?.last_name}`;
        const playerStats = stats?.[playerId] || {};
        const gamesPlayed = (playerStats as any).gp || 0;
        const fantasyPoints = (playerStats as any).pts_ppr || 0;
        const pointsPerGame = gamesPlayed > 0 ? fantasyPoints / gamesPlayed : 0;
        const consensusValue = dynastyConsensusService.getNormalizedValue(playerName, pos, isSuperflex);
        const valueResult = dynastyEngine.getBlendedPlayerValue(
          playerId, playerName, pos, player?.age || 25, player?.years_exp || 0,
          player?.injury_status,
          { points: fantasyPoints, games: gamesPlayed, ppg: pointsPerGame },
          null, leagueScoring, consensusValue, 0.5,
          dynastyEngine.parseLeagueRosterSettings(league)
        );
        return valueResult.value;
      };

      const wins = (userRoster.settings as any)?.wins || 0;
      const losses = (userRoster.settings as any)?.losses || 0;
      const ties = (userRoster.settings as any)?.ties || 0;
      const totalPoints = parseFloat(String((userRoster.settings as any)?.fpts || 0)) + parseFloat(String((userRoster.settings as any)?.fpts_decimal || 0)) / 100;
      const gamesPlayed = wins + losses + ties;
      const pointsPerGame = gamesPlayed > 0 ? Math.round((totalPoints / gamesPlayed) * 10) / 10 : 0;
      const record = `${wins}-${losses}${ties > 0 ? `-${ties}` : ""}`;

      const sortedByRecord = [...rosters].sort((a, b) => {
        const aWins = (a.settings as any)?.wins || 0;
        const bWins = (b.settings as any)?.wins || 0;
        if (bWins !== aWins) return bWins - aWins;
        const aPts = parseFloat(String((a.settings as any)?.fpts || 0));
        const bPts = parseFloat(String((b.settings as any)?.fpts || 0));
        return bPts - aPts;
      });
      const rank = sortedByRecord.findIndex(r => r.roster_id === userRoster.roster_id) + 1;
      const totalTeams = rosters.length;

      const allPointTotals = rosters.map(r => parseFloat(String((r.settings as any)?.fpts || 0)));
      allPointTotals.sort((a, b) => b - a);
      const top25Threshold = allPointTotals[Math.floor(allPointTotals.length * 0.25)] || 0;

      const playerIds = userRoster.players || [];
      const positions = ["QB", "RB", "WR", "TE"];

      const positionBreakdown: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
      const positionValues: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };

      interface PlayerInfo { name: string; position: string; points: number; value: number; age: number; }
      const rosterPlayers: PlayerInfo[] = [];

      let totalDynastyValue = 0;
      let totalAge = 0;
      let ageCount = 0;

      for (const pid of playerIds) {
        const player = allPlayers[pid];
        if (!player) continue;
        const pos = player.position || "?";
        const playerName = player.full_name || `${player.first_name} ${player.last_name}`;
        const playerStats = stats?.[pid] || {};
        const fantasyPoints = (playerStats as any).pts_ppr || 0;
        const value = getBlendedValue(pid, player);
        totalDynastyValue += value;

        if (positions.includes(pos)) {
          positionBreakdown[pos] = (positionBreakdown[pos] || 0) + 1;
          positionValues[pos] = (positionValues[pos] || 0) + value;
        }

        const age = player.age || 0;
        if (age > 0) {
          totalAge += age;
          ageCount++;
        }

        rosterPlayers.push({ name: playerName, position: pos, points: fantasyPoints, value, age });
      }

      const avgAge = ageCount > 0 ? Math.round((totalAge / ageCount) * 10) / 10 : 0;

      const topPlayers = [...rosterPlayers]
        .sort((a, b) => b.points - a.points)
        .slice(0, 5)
        .map(p => ({ name: p.name, position: p.position, points: Math.round(p.points * 10) / 10, value: p.value }));

      const leaguePositionValues: Record<string, number[]> = { QB: [], RB: [], WR: [], TE: [] };
      const teamDynastyValues: { rosterId: number; value: number }[] = [];

      for (const roster of rosters) {
        let teamValue = 0;
        const teamPosValues: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
        for (const pid of (roster.players || [])) {
          const player = allPlayers[pid];
          if (!player) continue;
          const pos = player.position || "?";
          const value = getBlendedValue(pid, player);
          teamValue += value;
          if (positions.includes(pos)) {
            teamPosValues[pos] += value;
          }
        }
        teamDynastyValues.push({ rosterId: roster.roster_id, value: teamValue });
        for (const pos of positions) {
          leaguePositionValues[pos].push(teamPosValues[pos]);
        }
      }

      teamDynastyValues.sort((a, b) => b.value - a.value);
      const dynastyRank = teamDynastyValues.findIndex(t => t.rosterId === userRoster.roster_id) + 1;

      const positionRanks: Record<string, { rank: number; total: number }> = {};
      for (const pos of positions) {
        const vals = leaguePositionValues[pos];
        const sorted = [...vals].sort((a, b) => b - a);
        const userVal = positionValues[pos] || 0;
        const rank = sorted.findIndex(v => v <= userVal) + 1;
        positionRanks[pos] = { rank: rank || sorted.length, total: sorted.length };
      }

      const strengths: string[] = [];
      const weaknesses: string[] = [];

      for (const pos of positions) {
        const vals = leaguePositionValues[pos];
        const avg = vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
        const userVal = positionValues[pos] || 0;
        if (avg > 0 && userVal > avg * 1.2) {
          strengths.push(`Strong ${pos} room`);
        } else if (avg > 0 && userVal < avg * 0.8) {
          weaknesses.push(`Weak at ${pos}`);
        }
      }

      if (avgAge > 28) weaknesses.push("Aging roster");
      if (avgAge > 0 && avgAge < 24) strengths.push("Youth advantage");
      if (rank <= 3) strengths.push("Top 3 contender");
      if (totalPoints >= top25Threshold && top25Threshold > 0) strengths.push("High-scoring team");

      let profileLabel: "Contender" | "Rebuild" | "Balanced" = "Balanced";
      if (avgAge > 0 && avgAge >= 27) profileLabel = "Contender";
      if (avgAge > 0 && avgAge < 25) profileLabel = "Rebuild";

      const top3Names = topPlayers.slice(0, 3).map(p => p.name).join(", ");
      const shareText = [
        `${teamName} - ${leagueName}`,
        `Record: ${record} (Rank #${rank}/${totalTeams})`,
        `Dynasty Value: ${totalDynastyValue.toLocaleString()} (#${dynastyRank})`,
        `Profile: ${profileLabel} | Avg Age: ${avgAge}`,
        `Top Players: ${top3Names}`,
        `Powered by DT Sleeper Agent`,
      ].join("\n");

      res.json({
        teamName,
        leagueName,
        avatar,
        record,
        rank,
        totalTeams,
        totalPoints: Math.round(totalPoints * 10) / 10,
        pointsPerGame,
        dynastyValue: totalDynastyValue,
        dynastyRank,
        profile: profileLabel,
        avgAge,
        topPlayers,
        positionBreakdown,
        positionRanks,
        strengths,
        weaknesses,
        shareText,
      });
    } catch (error) {
      console.error("Error generating team report:", error);
      res.status(500).json({ message: "Failed to generate team report" });
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

  // Cross-league activity feed (supports ?leagueId= filter)
  app.get("/api/fantasy/activity-feed", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getUserProfile(userId);
      const filterLeagueId = req.query.leagueId as string | undefined;

      if (!profile?.sleeperUserId) {
        return res.json({ activities: [], lastUpdated: Date.now() });
      }

      let leagues = await getAllUserLeagues(profile.sleeperUserId);
      if (!leagues || leagues.length === 0) {
        return res.json({ activities: [], lastUpdated: Date.now() });
      }

      if (filterLeagueId) {
        leagues = leagues.filter((l: any) => l.league_id === filterLeagueId);
        if (leagues.length === 0) {
          return res.json({ activities: [], lastUpdated: Date.now() });
        }
      }

      const state = await sleeperApi.getState();
      const currentWeek = state?.week || 1;
      const weeksToFetch: number[] = [];
      for (let w = currentWeek; w >= Math.max(1, currentWeek - 2); w--) {
        weeksToFetch.push(w);
      }

      const allPlayers = await sleeperApi.getAllPlayers();

      const batchSize = 10;
      const allActivities: any[] = [];

      for (let i = 0; i < leagues.length; i += batchSize) {
        const batch = leagues.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (league: any) => {
            try {
              const [leagueUsers, rosters, ...weekTransactions] = await Promise.all([
                sleeperApi.getLeagueUsers(league.league_id),
                sleeperApi.getLeagueRosters(league.league_id),
                ...weeksToFetch.map(w => sleeperApi.getLeagueTransactions(league.league_id, w)),
              ]);

              const rosterOwnerMap = new Map<number, string>();
              const userNameMap = new Map<string, string>();
              for (const u of (leagueUsers || [])) {
                userNameMap.set(u.user_id, u.display_name || u.username || "Unknown");
              }
              for (const r of (rosters || [])) {
                const ownerName = userNameMap.get(r.owner_id) || "Unknown Team";
                rosterOwnerMap.set(r.roster_id, ownerName);
              }

              const transactions = weekTransactions.flat().filter((t: any) => t.status === "complete");

              return transactions.map((tx: any) => {
                const players: any[] = [];
                if (tx.adds) {
                  for (const [playerId, rosterId] of Object.entries(tx.adds)) {
                    const p = allPlayers[playerId];
                    players.push({
                      name: p?.full_name || "Unknown Player",
                      position: p?.position || "?",
                      action: "added",
                    });
                  }
                }
                if (tx.drops) {
                  for (const [playerId, rosterId] of Object.entries(tx.drops)) {
                    const p = allPlayers[playerId];
                    players.push({
                      name: p?.full_name || "Unknown Player",
                      position: p?.position || "?",
                      action: "dropped",
                    });
                  }
                }

                const draftPicks = (tx.draft_picks || []).map((pick: any) => {
                  const fromTeam = rosterOwnerMap.get(pick.previous_owner_id) || "Unknown";
                  const toTeam = rosterOwnerMap.get(pick.owner_id) || "Unknown";
                  return `${pick.season} Round ${pick.round} (${fromTeam} → ${toTeam})`;
                });

                const teams = (tx.roster_ids || []).map((rid: number) => rosterOwnerMap.get(rid) || "Unknown Team");

                let description = "";
                if (tx.type === "trade") {
                  description = `Trade between ${teams.join(" and ")}`;
                } else if (tx.type === "waiver") {
                  const added = players.filter((p: any) => p.action === "added").map((p: any) => p.name);
                  const dropped = players.filter((p: any) => p.action === "dropped").map((p: any) => p.name);
                  const team = teams[0] || "Unknown Team";
                  if (added.length > 0 && dropped.length > 0) {
                    description = `${team} claimed ${added.join(", ")} and dropped ${dropped.join(", ")}`;
                  } else if (added.length > 0) {
                    description = `${team} claimed ${added.join(", ")} off waivers`;
                  } else {
                    description = `${team} waiver move`;
                  }
                } else if (tx.type === "free_agent") {
                  const added = players.filter((p: any) => p.action === "added").map((p: any) => p.name);
                  const dropped = players.filter((p: any) => p.action === "dropped").map((p: any) => p.name);
                  const team = teams[0] || "Unknown Team";
                  if (added.length > 0 && dropped.length > 0) {
                    description = `${team} added ${added.join(", ")} and dropped ${dropped.join(", ")}`;
                  } else if (added.length > 0) {
                    description = `${team} added ${added.join(", ")} as free agent`;
                  } else if (dropped.length > 0) {
                    description = `${team} dropped ${dropped.join(", ")}`;
                  } else {
                    description = `${team} roster move`;
                  }
                }

                return {
                  id: `${tx.transaction_id}_${league.league_id}`,
                  type: tx.type,
                  leagueId: league.league_id,
                  leagueName: league.name,
                  timestamp: tx.status_updated || tx.created || 0,
                  description,
                  players,
                  draftPicks,
                  teams,
                };
              });
            } catch (err) {
              console.error(`Error fetching activity for league ${league.league_id}:`, err);
              return [];
            }
          })
        );
        allActivities.push(...batchResults.flat());
      }

      allActivities.sort((a, b) => b.timestamp - a.timestamp);
      res.json({ activities: allActivities.slice(0, 50), lastUpdated: Date.now() });
    } catch (error) {
      console.error("Error fetching activity feed:", error);
      res.status(500).json({ message: "Failed to fetch activity feed" });
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
          isMedianLeague: (league.settings as any)?.league_average_match === 1,
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

      const cacheKey = `standings:${leagueId}`;
      const cached = standingsCache.get(cacheKey);
      if (cached) return res.json(cached);

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

      const responseData = {
        standings,
        playoffTeams,
        currentWeek,
      };
      standingsCache.set(cacheKey, responseData);
      res.json(responseData);
    } catch (error) {
      console.error("Error fetching standings:", error);
      res.status(500).json({ message: "Failed to fetch standings" });
    }
  });

  // Lineup Optimizer - find optimal starting lineup (Premium)
  app.get("/api/sleeper/lineup-optimizer/:leagueId", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      const userId = req.user.claims.sub;

      const userProfile = await storage.getUserProfile(userId);
      if (!userProfile?.sleeperUserId) {
        return res.status(400).json({ message: "No Sleeper account connected" });
      }

      const [league, rosters, users, state, allPlayers] = await Promise.all([
        sleeperApi.getLeague(leagueId),
        sleeperApi.getLeagueRosters(leagueId),
        sleeperApi.getLeagueUsers(leagueId),
        sleeperApi.getState(),
        sleeperApi.getAllPlayers(),
      ]);

      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      const currentWeek = state?.week || 1;
      const season = league.season || state?.season || "2025";

      const projections = await sleeperApi.fetchSleeperProjections(season, currentWeek);

      const userMap = new Map((users || []).map((u) => [u.user_id, u]));
      const userRoster = rosters.find((r) => r.owner_id === userProfile.sleeperUserId);

      if (!userRoster) {
        return res.status(404).json({ message: "Could not find your roster in this league" });
      }

      const owner = userMap.get(userRoster.owner_id);
      const teamName = owner?.metadata?.team_name || owner?.display_name || owner?.username || "Your Team";
      const ownerName = owner?.display_name || owner?.username || "Unknown";

      const scoringType = sleeperApi.getScoringType(league.scoring_settings || {});
      const pointsKey = scoringType === "ppr" ? "pts_ppr" : scoringType === "half_ppr" ? "pts_half_ppr" : "pts_std";

      const getProjectedPoints = (playerId: string): number => {
        const proj = projections[playerId];
        if (!proj) return 0;
        const stats = proj.stats || proj;
        return stats[pointsKey] || stats.pts_ppr || stats.pts_half_ppr || stats.pts_std || 0;
      };

      const getPlayerInfo = (playerId: string) => {
        const player = allPlayers[playerId];
        if (!player) return { name: `Player ${playerId}`, position: "?", team: "?" };
        return {
          name: player.full_name || `${player.first_name || ""} ${player.last_name || ""}`.trim() || playerId,
          position: player.position || "?",
          team: player.team || "FA",
        };
      };

      const rosterPositions = league.roster_positions || [];
      const starterSlots = rosterPositions.filter((p: string) => p !== "BN");
      const currentStarters = userRoster.starters || [];
      const allPlayerIds = userRoster.players || [];
      const benchPlayerIds = allPlayerIds.filter((id: string) => !currentStarters.includes(id));

      const hasKickerSlot = rosterPositions.includes("K");
      const hasDefSlot = rosterPositions.includes("DEF");
      const idpPositions = ["DL", "LB", "DB", "IDP_FLEX"];
      const isIDPLeague = rosterPositions.some((p: string) => idpPositions.includes(p));
      const devyNoteMap = new Map<string, { devyName: string; devyPosition: string; devySchool: string }>();

      for (const roster of rosters) {
        const meta = roster.metadata || {};
        for (const [key, noteValue] of Object.entries(meta)) {
          if (!noteValue || typeof noteValue !== 'string') continue;
          let targetPlayerId: string | null = null;
          if (key.startsWith('p_nick_')) {
            targetPlayerId = key.replace('p_nick_', '');
          } else if (key.startsWith('p_note_')) {
            targetPlayerId = key.replace('p_note_', '');
          }
          if (targetPlayerId && noteValue.trim().length >= 2 && allPlayerIds.includes(targetPlayerId)) {
            const parsed = parseDevyNote(noteValue.trim());
            if (parsed && !devyNoteMap.has(targetPlayerId)) {
              devyNoteMap.set(targetPlayerId, parsed);
            }
          }
        }
      }

      const isDevyPlaceholder = (playerId: string): boolean => {
        const player = allPlayers[playerId];
        if (!player) return false;
        // Real NFL players with active NFL teams are never devy placeholders
        const isActiveNFLPlayer = !!player.team && player.team !== "" && player.team !== "FA";
        if (isActiveNFLPlayer) return false;
        if (devyNoteMap.has(playerId)) return true;
        const playerPos = player.position || "?";
        const isKicker = playerPos === "K";
        const isDef = playerPos === "DEF";
        const isRetired = !player.team && (player.status === "Inactive" || player.active === false);
        const isIDPPlayer = ["CB", "S", "DB", "LB", "ILB", "OLB", "MLB", "DL", "DE", "DT", "NT", "EDGE", "ED", "FS", "SS"].includes(playerPos);
        const isPlaceholderByPosition = (isKicker && !hasKickerSlot) || (isDef && !hasDefSlot) || (isIDPPlayer && !isIDPLeague);
        const isLikelyDevyPlaceholder = devyNoteMap.size > 0 && isKicker && !player.team;
        return isPlaceholderByPosition || isRetired || isLikelyDevyPlaceholder;
      };

      const devyPlaceholderIds = new Set(allPlayerIds.filter((id: string) => isDevyPlaceholder(id)));
      const eligiblePlayerIds = allPlayerIds.filter((id: string) => !devyPlaceholderIds.has(id));

      const SLOT_ELIGIBILITY: Record<string, string[]> = {
        "QB": ["QB"],
        "RB": ["RB"],
        "WR": ["WR"],
        "TE": ["TE"],
        "FLEX": ["RB", "WR", "TE"],
        "SUPER_FLEX": ["QB", "RB", "WR", "TE"],
        "REC_FLEX": ["WR", "TE"],
        "K": ["K"],
        "DEF": ["DEF"],
        "DL": ["DL", "DE", "DT"],
        "LB": ["LB", "ILB", "OLB"],
        "DB": ["DB", "CB", "S", "FS", "SS"],
        "IDP_FLEX": ["DL", "DE", "DT", "LB", "ILB", "OLB", "DB", "CB", "S", "FS", "SS"],
      };

      const isFlexSlot = (slot: string) => ["FLEX", "SUPER_FLEX", "REC_FLEX", "IDP_FLEX"].includes(slot);

      const sortedSlots = [...starterSlots].sort((a: string, b: string) => {
        const aFlex = isFlexSlot(a) ? 1 : 0;
        const bFlex = isFlexSlot(b) ? 1 : 0;
        return aFlex - bFlex;
      });

      const playerProjections = eligiblePlayerIds.map((id: string) => ({
        id,
        ...getPlayerInfo(id),
        projectedPoints: Math.round(getProjectedPoints(id) * 100) / 100,
      }));
      playerProjections.sort((a: any, b: any) => b.projectedPoints - a.projectedPoints);

      const assigned = new Set<string>();
      const optimalLineup: any[] = [];

      for (const slot of sortedSlots) {
        const eligible = SLOT_ELIGIBILITY[slot] || [slot];
        const best = playerProjections.find(
          (p: any) => !assigned.has(p.id) && eligible.includes(p.position)
        );
        if (best) {
          assigned.add(best.id);
          optimalLineup.push({
            playerId: best.id,
            name: best.name,
            position: best.position,
            team: best.team,
            slot,
            projectedPoints: best.projectedPoints,
          });
        } else {
          optimalLineup.push({
            playerId: "",
            name: "Empty",
            position: "",
            team: "",
            slot,
            projectedPoints: 0,
          });
        }
      }

      const optimalPlayerIds = new Set(optimalLineup.map((p: any) => p.playerId));

      const slotCounts: Record<string, number> = {};
      const currentLineup = starterSlots.map((slot: string, index: number) => {
        slotCounts[slot] = (slotCounts[slot] || 0) + 1;
        const playerId = currentStarters[index] || "";
        const isDevy = playerId ? devyPlaceholderIds.has(playerId) : false;
        const devyNote = playerId ? devyNoteMap.get(playerId) : undefined;
        const info = playerId ? getPlayerInfo(playerId) : { name: "Empty", position: "", team: "" };
        const projectedPoints = (playerId && !isDevy) ? Math.round(getProjectedPoints(playerId) * 100) / 100 : 0;
        const isInOptimal = optimalPlayerIds.has(playerId);
        return {
          playerId,
          name: isDevy && devyNote ? devyNote.devyName : info.name,
          position: isDevy && devyNote ? devyNote.devyPosition : info.position,
          team: isDevy && devyNote ? devyNote.devySchool : info.team,
          slot,
          projectedPoints,
          isOptimal: isDevy ? true : isInOptimal,
          isDevyPlaceholder: isDevy,
        };
      });

      const optimalBenchIds = eligiblePlayerIds.filter((id: string) => !optimalPlayerIds.has(id));
      const benchPlayersData = optimalBenchIds.map((id: string) => {
        const info = getPlayerInfo(id);
        return {
          playerId: id,
          name: info.name,
          position: info.position,
          team: info.team,
          projectedPoints: Math.round(getProjectedPoints(id) * 100) / 100,
        };
      }).sort((a: any, b: any) => b.projectedPoints - a.projectedPoints);

      const currentProjectedTotal = Math.round(currentLineup.reduce((sum: number, p: any) => sum + p.projectedPoints, 0) * 100) / 100;
      const optimalProjectedTotal = Math.round(optimalLineup.reduce((sum: number, p: any) => sum + p.projectedPoints, 0) * 100) / 100;

      res.json({
        currentLineup,
        optimalLineup,
        benchPlayers: benchPlayersData,
        currentProjectedTotal,
        optimalProjectedTotal,
        pointsGained: Math.round((optimalProjectedTotal - currentProjectedTotal) * 100) / 100,
        week: currentWeek,
        teamName,
        ownerName,
      });
    } catch (error) {
      console.error("Error in lineup optimizer:", error);
      res.status(500).json({ message: "Failed to optimize lineup" });
    }
  });

  // Get power rankings for a league — Dynasty Dominance Score V3 Engine + In-Season + Hybrid
  app.get("/api/sleeper/power-rankings/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      const mode = (req.query.mode as string) || "dynasty";
      const projectionWindow = (req.query.window as string) || "3";

      if (mode === "in-season" || mode === "hybrid") {
        const inSeasonResult = await inSeasonRankingsService.computeInSeasonRankings(leagueId);

        if (mode === "in-season") {
          if (inSeasonResult.offseason) {
            return res.json({ offseason: true, rankings: [], mode: "in-season" });
          }

          let inSeasonSnapshots: any[] = [];
          try {
            inSeasonSnapshots = await db.select().from(schema.powerRankingSnapshots)
              .where(sql`${schema.powerRankingSnapshots.leagueId} = ${leagueId} AND ${schema.powerRankingSnapshots.mode} = 'in-season'`)
              .orderBy(sql`${schema.powerRankingSnapshots.createdAt} DESC`)
              .limit(inSeasonResult.rankings.length * 2);
          } catch (e) {}

          const lastSnapMap = new Map<number, { compositeScore: number; championshipOdds: number }>();
          for (const snap of inSeasonSnapshots) {
            if (!lastSnapMap.has(snap.rosterId)) {
              lastSnapMap.set(snap.rosterId, { compositeScore: snap.compositeScore, championshipOdds: snap.championshipOdds });
            }
          }

          for (const entry of inSeasonResult.rankings) {
            const prev = lastSnapMap.get(entry.rosterId);
            entry.weeklyDelta = prev ? r2(entry.inSeasonScore - prev.compositeScore) : null;
            entry.oddsDelta = prev ? r2(entry.championshipOdds - prev.championshipOdds) : null;
          }

          try {
            const shouldSnapshot = inSeasonSnapshots.length === 0 ||
              (inSeasonSnapshots[0] && (Date.now() - new Date(inSeasonSnapshots[0].createdAt).getTime() > 6 * 24 * 60 * 60 * 1000));
            if (shouldSnapshot) {
              const stateData = await sleeperApi.getState();
              const currentWeek = stateData?.week || 0;
              const currentSeason = parseInt(stateData?.season || "2025");
              for (const entry of inSeasonResult.rankings) {
                await db.insert(schema.powerRankingSnapshots).values({
                  leagueId,
                  rosterId: entry.rosterId,
                  compositeScore: entry.inSeasonScore,
                  championshipOdds: entry.championshipOdds,
                  rosterEV: entry.nStarterPPG,
                  pickEV: entry.nWinPct,
                  depthScore: entry.nAllPlayPct,
                  liquidityScore: entry.nMomentum,
                  riskScore: entry.nInjuryDepth,
                  snapshotWeek: currentWeek,
                  snapshotSeason: currentSeason,
                  mode: "in-season",
                });
              }
            }
          } catch (e) {}

          return res.json(inSeasonResult.rankings);
        }

        if (mode === "hybrid") {
          if (inSeasonResult.offseason) {
            return res.json({ offseason: true, rankings: [], mode: "hybrid" });
          }
        }
      }

      const [league, rosters, leagueUsers, state, allPlayers, tradedPicks] = await Promise.all([
        sleeperApi.getLeague(leagueId),
        sleeperApi.getLeagueRosters(leagueId),
        sleeperApi.getLeagueUsers(leagueId),
        sleeperApi.getState(),
        sleeperApi.getAllPlayers(),
        sleeperApi.getLeagueDraftPicks(leagueId),
      ]);

      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      await dynastyConsensusService.fetchAndCacheValues();
      const isSuperflex = dynastyEngine.isLeagueSuperflex(league);
      const currentSeason = parseInt(state?.season || "2025");
      const currentWeek = state?.week || 0;
      const numTeams = rosters.length || 12;

      const userMap = new Map(leagueUsers.map((u: any) => [u.user_id, u]));

      const WINDOW_WEIGHTS: Record<string, { rosterEV: number; pickEV: number; depth: number; liquidity: number; risk: number }> = {
        "1": { rosterEV: 0.60, pickEV: 0.10, depth: 0.15, liquidity: 0.05, risk: 0.10 },
        "3": { rosterEV: 0.45, pickEV: 0.25, depth: 0.15, liquidity: 0.05, risk: 0.10 },
        "5": { rosterEV: 0.35, pickEV: 0.35, depth: 0.10, liquidity: 0.10, risk: 0.10 },
      };
      const weights = WINDOW_WEIGHTS[projectionWindow] || WINDOW_WEIGHTS["3"];

      const HISTORICAL_HIT_RATE: Record<number, number> = {
        1: 0.72, 2: 0.68, 3: 0.63, 4: 0.58, 5: 0.52, 6: 0.47,
        7: 0.42, 8: 0.38, 9: 0.34, 10: 0.30, 11: 0.27, 12: 0.24,
      };

      const POS_SCARCITY: Record<string, number> = { QB: isSuperflex ? 1.3 : 0.9, RB: 1.15, WR: 1.0, TE: 1.1 };
      const YEAR_DISCOUNT: Record<number, number> = { 0: 1.0, 1: 0.85, 2: 0.7 };

      const AGE_CURVES: Record<string, { peak: [number, number]; decline: number }> = {
        QB: { peak: [24, 32], decline: 0.06 },
        RB: { peak: [22, 27], decline: 0.12 },
        WR: { peak: [23, 30], decline: 0.08 },
        TE: { peak: [24, 30], decline: 0.07 },
      };

      const pickOwnership: Map<number, Array<{ round: number; season: number; originalRosterId: number }>> = new Map();
      for (const roster of rosters) {
        const ownedPicks: Array<{ round: number; season: number; originalRosterId: number }> = [];
        for (let yr = currentSeason; yr <= currentSeason + 2; yr++) {
          for (let rd = 1; rd <= (league.settings?.draft_rounds || 4); rd++) {
            ownedPicks.push({ round: rd, season: yr, originalRosterId: roster.roster_id });
          }
        }
        pickOwnership.set(roster.roster_id, ownedPicks);
      }

      if (tradedPicks && tradedPicks.length > 0) {
        for (const tp of tradedPicks) {
          const season = parseInt(String(tp.season));
          if (season < currentSeason || season > currentSeason + 2) continue;
          const origRosterId = tp.roster_id;
          const newOwnerRosterId = tp.owner_id;
          if (origRosterId === newOwnerRosterId) continue;
          const origOwnerPicks = pickOwnership.get(origRosterId);
          if (origOwnerPicks) {
            const idx = origOwnerPicks.findIndex(
              p => p.round === tp.round && p.season === season && p.originalRosterId === origRosterId
            );
            if (idx !== -1) {
              const [removed] = origOwnerPicks.splice(idx, 1);
              const newOwnerPicks = pickOwnership.get(newOwnerRosterId);
              if (newOwnerPicks) newOwnerPicks.push(removed);
            }
          }
        }
      }

      function calcDynastyVal(player: any, normVal: number): number {
        const pos = player.position || "QB";
        const age = player.age || 25;
        const curve = AGE_CURVES[pos] || AGE_CURVES.WR;
        let ageMod = 1.0;
        if (age < curve.peak[0]) ageMod = 0.85 + (age / curve.peak[0]) * 0.15;
        else if (age <= curve.peak[1]) ageMod = 1.0;
        else ageMod = Math.max(0.3, 1.0 - (age - curve.peak[1]) * curve.decline);
        const prodTrend = normVal > 50 ? 0.8 : normVal > 25 ? 0.5 : 0.3;
        const scarcity = POS_SCARCITY[pos] || 1.0;
        return (normVal * 0.5) + (ageMod * 20 * 0.2) + (prodTrend * 20 * 0.2) + (scarcity * 10 * 0.1);
      }

      const teamsRaw = rosters.map((roster: any) => {
        const user = userMap.get(roster.owner_id);
        const starters = roster.starters || [];
        const starterSet = new Set(starters.filter((s: string) => s && s !== "0"));
        const playerIds: string[] = roster.players || [];

        let rosterEVRaw = 0;
        let starterCount = 0;
        let topTierAssets = 0;
        let midTierAssets = 0;
        let flexLevelAssets = 0;
        let injuryRiskCount = 0;
        let decliningCount = 0;
        let oldClusterCount = 0;
        const playerAges: number[] = [];
        const starterAges: number[] = [];
        const playerValues: Array<{ name: string; pos: string; age: number; value: number; normVal: number; isStarter: boolean }> = [];
        let future1st2ndCount = 0;

        for (const pid of playerIds) {
          const player = allPlayers[pid];
          if (!player) continue;
          const playerName = player.full_name || `${player.first_name} ${player.last_name}`;
          const position = player.position || "QB";
          const age = player.age || 25;
          const normVal = dynastyConsensusService.getNormalizedValue(playerName, position, isSuperflex);
          if (normVal === null) continue;

          const dynastyVal = calcDynastyVal(player, normVal);
          rosterEVRaw += dynastyVal;

          const isStarter = starterSet.has(pid);
          if (isStarter) {
            starterCount++;
            starterAges.push(age);
          }
          playerAges.push(age);
          playerValues.push({ name: playerName, pos: position, age, value: dynastyVal, normVal, isStarter });

          if (normVal >= 70) topTierAssets++;
          else if (normVal >= 40) midTierAssets++;
          if (normVal >= 20 && (isStarter || normVal >= 30)) flexLevelAssets++;

          if (player.injury_status && ["Out", "IR", "PUP", "Questionable"].includes(player.injury_status)) {
            injuryRiskCount++;
          }

          const curve = AGE_CURVES[position] || AGE_CURVES.WR;
          if (age > curve.peak[1] + 2 && normVal < 40) decliningCount++;
          if (age >= 30) oldClusterCount++;
        }

        const sortedByValue = [...playerValues].sort((a, b) => b.value - a.value);
        const top6 = sortedByValue.slice(0, 6);
        const top3 = sortedByValue.slice(0, 3);

        const coreAgeWeighted = top6.length > 0
          ? top6.reduce((sum, p) => sum + p.age * p.value, 0) / top6.reduce((sum, p) => sum + p.value, 0)
          : 27;
        const starterAgeWeighted = starterAges.length > 0
          ? playerValues.filter(p => p.isStarter).reduce((sum, p) => sum + p.age * p.value, 0) /
            (playerValues.filter(p => p.isStarter).reduce((sum, p) => sum + p.value, 0) || 1)
          : 27;
        const ageStdDev = playerAges.length > 1
          ? Math.sqrt(playerAges.reduce((sum, a) => sum + (a - (playerAges.reduce((s, v) => s + v, 0) / playerAges.length)) ** 2, 0) / playerAges.length)
          : 0;
        const ageVolatility = ageStdDev > 5 ? "High" : ageStdDev > 3 ? "Medium" : "Low";

        let ageGrade: string;
        const sustainabilityAge = (coreAgeWeighted * 0.6 + starterAgeWeighted * 0.4);
        if (sustainabilityAge < 24.5) ageGrade = "A+";
        else if (sustainabilityAge < 25.5) ageGrade = "A";
        else if (sustainabilityAge < 26.5) ageGrade = "A-";
        else if (sustainabilityAge < 27.5) ageGrade = "B+";
        else if (sustainabilityAge < 28.5) ageGrade = "B";
        else if (sustainabilityAge < 29.5) ageGrade = "B-";
        else ageGrade = "C";

        const top3EV = top3.reduce((sum, p) => sum + p.value, 0);
        const concentrationRatio = rosterEVRaw > 0 ? top3EV / rosterEVRaw : 0;
        const isTopHeavy = concentrationRatio > 0.40;

        const depthRaw = starterCount * 2 + flexLevelAssets;

        const ownedPicks = pickOwnership.get(roster.roster_id) || [];
        for (const pick of ownedPicks) {
          if (pick.round <= 2 && pick.season <= currentSeason + 1) future1st2ndCount++;
        }
        const tradeablePlayers = playerValues.filter(p => p.normVal >= 30).length;
        const liquidityRaw = (topTierAssets * 4) + (future1st2ndCount * 3) + (tradeablePlayers * 1);

        let pickEVRaw = 0;
        for (const pick of ownedPicks) {
          const yearDelta = pick.season - currentSeason;
          const discount = YEAR_DISCOUNT[yearDelta] ?? 0.7;
          const midSlot = Math.ceil(numTeams / 2);
          const hitRate = HISTORICAL_HIT_RATE[midSlot] || 0.30;
          const classStrength = 1.0;
          const scarcityMult = 1.0;
          const windowDiscount = pick.round <= 2 ? 1.0 : 0.8;
          const baseVal = pick.round === 1 ? (100 - (midSlot - 1) * 3.5) :
                          pick.round === 2 ? (55 - (midSlot - 1) * 2) :
                          pick.round === 3 ? (30 - (midSlot - 1) * 1) :
                          pick.round === 4 ? (15 - (midSlot - 1) * 0.5) : 8;
          pickEVRaw += Math.max(baseVal, 1) * hitRate * classStrength * scarcityMult * windowDiscount * discount;
        }

        const injuryRisk0to100 = Math.min(injuryRiskCount * 15, 100);
        const ageClusterRisk0to100 = Math.min(oldClusterCount * 10, 100);
        const volatilityRisk0to100 = concentrationRatio > 0.5 ? 80 : concentrationRatio > 0.4 ? 50 : concentrationRatio > 0.3 ? 25 : 10;
        const concentrationRisk0to100 = isTopHeavy ? 70 : 20;
        const riskRaw = injuryRisk0to100 * 0.30 + ageClusterRisk0to100 * 0.20 + volatilityRisk0to100 * 0.25 + concentrationRisk0to100 * 0.25;

        let riskLevel: string;
        if (riskRaw <= 30) riskLevel = "Low";
        else if (riskRaw <= 60) riskLevel = "Moderate";
        else riskLevel = "High";

        const topPlayers = sortedByValue
          .slice(0, 5)
          .map(p => ({ name: p.name, position: p.pos, value: Math.round(p.value * 10) / 10 }));

        return {
          rosterId: roster.roster_id,
          ownerId: roster.owner_id,
          ownerName: user?.display_name || user?.username || "Unknown",
          avatar: sleeperApi.getAvatarUrl(user?.avatar || null),
          teamName: user?.metadata?.team_name || user?.display_name || user?.username || "Unknown",
          rosterEVRaw,
          pickEVRaw,
          depthRaw,
          liquidityRaw,
          riskRaw,
          coreAge: Math.round(coreAgeWeighted * 10) / 10,
          starterAge: Math.round(starterAgeWeighted * 10) / 10,
          ageVolatility,
          ageGrade,
          riskLevel,
          concentrationRatio: Math.round(concentrationRatio * 100),
          isTopHeavy,
          topPlayers,
          starterCount,
          totalPlayers: playerIds.length,
          draftPickCount: ownedPicks.length,
          future1st2ndCount,
          record: {
            wins: roster.settings.wins || 0,
            losses: roster.settings.losses || 0,
            ties: roster.settings.ties || 0,
          },
          pointsFor: (roster.settings.fpts || 0) + (roster.settings.fpts_decimal || 0) / 100,
        };
      });

      function normalizeMetric(values: number[]): number[] {
        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = max - min || 1;
        return values.map(v => Math.round(((v - min) / range) * 100 * 10) / 10);
      }

      const rosterEVs = normalizeMetric(teamsRaw.map((t: any) => t.rosterEVRaw));
      const pickEVs = normalizeMetric(teamsRaw.map((t: any) => t.pickEVRaw));
      const depths = normalizeMetric(teamsRaw.map((t: any) => t.depthRaw));
      const liquidities = normalizeMetric(teamsRaw.map((t: any) => t.liquidityRaw));
      const risks = teamsRaw.map((t: any) => Math.round(t.riskRaw * 10) / 10);

      let previousSnapshots: any[] = [];
      try {
        const snaps = await db.select().from(schema.powerRankingSnapshots)
          .where(sql`${schema.powerRankingSnapshots.leagueId} = ${leagueId} AND ${schema.powerRankingSnapshots.mode} = 'dynasty'`)
          .orderBy(sql`${schema.powerRankingSnapshots.createdAt} DESC`)
          .limit(numTeams * 2);
        previousSnapshots = snaps;
      } catch (e) {}

      const lastSnapshotMap = new Map<number, { compositeScore: number; championshipOdds: number }>();
      for (const snap of previousSnapshots) {
        if (!lastSnapshotMap.has(snap.rosterId)) {
          lastSnapshotMap.set(snap.rosterId, {
            compositeScore: snap.compositeScore,
            championshipOdds: snap.championshipOdds,
          });
        }
      }

      const teamsWithMetrics = teamsRaw.map((team: any, idx: number) => {
        const nRosterEV = rosterEVs[idx];
        const nPickEV = pickEVs[idx];
        const nDepth = depths[idx];
        const nLiquidity = liquidities[idx];
        const riskInverse = Math.max(0, 100 - risks[idx]);

        const dds = Math.round(
          (nRosterEV * weights.rosterEV +
           nPickEV * weights.pickEV +
           nDepth * weights.depth +
           nLiquidity * weights.liquidity +
           riskInverse * weights.risk) * 10
        ) / 10;

        return { ...team, nRosterEV, nPickEV, nDepth, nLiquidity, riskScore: risks[idx], dds };
      });

      const SOFTMAX_TEMP = 25;
      const expScores = teamsWithMetrics.map((t: any) => Math.exp(t.dds / SOFTMAX_TEMP));
      const expSum = expScores.reduce((a: number, b: number) => a + b, 0);

      const teams = teamsWithMetrics.map((team: any, idx: number) => {
        const champOdds = Math.round((expScores[idx] / expSum) * 1000) / 10;
        const playoffOdds = Math.min(Math.round(champOdds * (numTeams / 2) * 10) / 10, 99);

        let tier: string;
        if (team.dds >= 80) tier = "Elite Contender";
        else if (team.dds >= 70) tier = "Contender";
        else if (team.dds >= 60) tier = "Competitive";
        else if (team.dds >= 45) tier = "Retool";
        else tier = "Rebuild";

        let strategy = "";
        if (team.nRosterEV >= 70 && team.nPickEV <= 40 && team.coreAge <= 27) strategy = "Elite Contender";
        else if (team.nPickEV >= 60 && team.coreAge <= 25) strategy = "Ascending Builder";
        else if (team.isTopHeavy && team.nRosterEV >= 60) strategy = "Fragile Contender";
        else if (team.nPickEV >= 60 && team.nLiquidity >= 60) strategy = "Liquid Rebuilder";
        else if (team.nRosterEV >= 50 && team.nPickEV >= 40) strategy = "Balanced";
        else if (team.nRosterEV <= 40 && team.nPickEV <= 40) strategy = "Full Rebuild";
        else strategy = tier;

        const prevSnap = lastSnapshotMap.get(team.rosterId);
        const weeklyDelta = prevSnap ? Math.round((team.dds - prevSnap.compositeScore) * 10) / 10 : null;
        const oddsDelta = prevSnap ? Math.round((champOdds - prevSnap.championshipOdds) * 10) / 10 : null;

        return {
          rosterId: team.rosterId,
          ownerId: team.ownerId,
          ownerName: team.ownerName,
          avatar: team.avatar,
          teamName: team.teamName,
          dds: team.dds,
          championshipOdds: champOdds,
          playoffOdds,
          rosterEV: team.nRosterEV,
          pickEV: team.nPickEV,
          depth: team.nDepth,
          liquidity: team.nLiquidity,
          riskScore: team.riskScore,
          riskLevel: team.riskLevel,
          ageGrade: team.ageGrade,
          coreAge: team.coreAge,
          starterAge: team.starterAge,
          ageVolatility: team.ageVolatility,
          concentrationRatio: team.concentrationRatio,
          isTopHeavy: team.isTopHeavy,
          tier,
          strategy,
          weeklyDelta,
          oddsDelta,
          topPlayers: team.topPlayers,
          starterCount: team.starterCount,
          totalPlayers: team.totalPlayers,
          draftPickCount: team.draftPickCount,
          future1st2ndCount: team.future1st2ndCount,
          record: team.record,
          pointsFor: team.pointsFor,
          projectionWindow: projectionWindow,
        };
      });

      teams.sort((a: any, b: any) => b.dds - a.dds);

      const isOffseason = teamsRaw.every((t: any) => t.record.wins === 0 && t.record.losses === 0 && t.record.ties === 0);

      const dynastyResult = teams.map((team: any, index: number) => ({
        ...team,
        rank: index + 1,
        mode: "dynasty" as const,
      }));

      try {
        const shouldSnapshot = previousSnapshots.length === 0 ||
          (previousSnapshots[0] && (Date.now() - new Date(previousSnapshots[0].createdAt).getTime() > 6 * 24 * 60 * 60 * 1000));
        if (shouldSnapshot) {
          for (const team of dynastyResult) {
            await db.insert(schema.powerRankingSnapshots).values({
              leagueId,
              rosterId: team.rosterId,
              compositeScore: team.dds,
              championshipOdds: team.championshipOdds,
              rosterEV: team.rosterEV,
              pickEV: team.pickEV,
              depthScore: team.depth,
              liquidityScore: team.liquidity,
              riskScore: team.riskScore,
              snapshotWeek: currentWeek,
              snapshotSeason: currentSeason,
              mode: "dynasty",
            });
          }
        }
      } catch (e) {}

      if (mode === "hybrid") {
        const inSeasonResult = await inSeasonRankingsService.computeInSeasonRankings(leagueId);
        if (!inSeasonResult.offseason && inSeasonResult.rankings.length > 0) {
          const inSeasonMap = new Map(inSeasonResult.rankings.map(r => [r.rosterId, r]));

          const hybridTeams = dynastyResult.map((team: any) => {
            const inSeason = inSeasonMap.get(team.rosterId);
            const inSeasonScore = inSeason?.inSeasonScore ?? team.dds;
            const hybridScore = r2(inSeasonScore * 0.6 + team.dds * 0.4);

            return {
              ...team,
              mode: "hybrid" as const,
              hybridScore,
              inSeasonScore: inSeason?.inSeasonScore ?? null,
              dynastyScore: team.dds,
              starterPPG: inSeason?.starterPPG ?? null,
              nStarterPPG: inSeason?.nStarterPPG ?? null,
              winPct: inSeason?.winPct ?? null,
              nWinPct: inSeason?.nWinPct ?? null,
              pointsAboveMedian: inSeason?.pointsAboveMedian ?? null,
              nPointsAboveMedian: inSeason?.nPointsAboveMedian ?? null,
              allPlayPct: inSeason?.allPlayPct ?? null,
              nAllPlayPct: inSeason?.nAllPlayPct ?? null,
              momentum: inSeason?.momentum ?? null,
              nMomentum: inSeason?.nMomentum ?? null,
              injuryDepth: inSeason?.injuryDepth ?? null,
              nInjuryDepth: inSeason?.nInjuryDepth ?? null,
            };
          });

          hybridTeams.sort((a: any, b: any) => b.hybridScore - a.hybridScore);

          const SOFTMAX_TEMP = 25;
          const expH = hybridTeams.map((t: any) => Math.exp(t.hybridScore / SOFTMAX_TEMP));
          const expHSum = expH.reduce((a: number, b: number) => a + b, 0);

          const hybridResult = hybridTeams.map((team: any, idx: number) => {
            const champOdds = r2((expH[idx] / expHSum) * 100);
            let tier: string;
            if (team.hybridScore >= 85) tier = "Elite";
            else if (team.hybridScore >= 70) tier = "Strong";
            else if (team.hybridScore >= 50) tier = "Competitive";
            else if (team.hybridScore >= 35) tier = "Retool";
            else tier = "Rebuild";

            return {
              ...team,
              rank: idx + 1,
              dds: team.hybridScore,
              championshipOdds: champOdds,
              playoffOdds: Math.min(r2(champOdds * (numTeams / 2)), 99),
              tier,
            };
          });

          return res.json(hybridResult);
        }
      }

      res.json(dynastyResult);
    } catch (error) {
      console.error("Error fetching power rankings:", error);
      res.status(500).json({ message: "Failed to fetch power rankings" });
    }
  });

  // Get waiver wire players (Premium)
  app.get("/api/sleeper/waivers/:leagueId", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;

      const [rosters, allPlayers, state, league] = await Promise.all([
        sleeperApi.getLeagueRosters(leagueId),
        sleeperApi.getAllPlayers(),
        sleeperApi.getState(),
        sleeperApi.getLeague(leagueId),
      ]);

      if (!rosters || !allPlayers) {
        return res.json({ players: [], week: state?.week || 1 });
      }
      
      const wCurrentDate = new Date();
      const wCurrentMonth = wCurrentDate.getMonth();
      const wCurrentYear = wCurrentDate.getFullYear();
      const wStatsSeason = wCurrentMonth < 8 ? String(wCurrentYear - 1) : String(wCurrentYear);
      let wSeasonStats: any = {};
      try {
        wSeasonStats = await sleeperApi.getSeasonStats(wStatsSeason, "regular") || {};
      } catch (e) {
        console.log(`[Waiver Wire] Failed to fetch season stats: ${e}`);
      }

      // Get all rostered player IDs
      const rosteredPlayers = new Set<string>();
      rosters.forEach((roster) => {
        (roster.players || []).forEach((p) => rosteredPlayers.add(p));
        (roster.reserve || []).forEach((p) => rosteredPlayers.add(p));
        (roster.taxi || []).forEach((p) => rosteredPlayers.add(p));
      });

      // Filter to available players - exclude retired/inactive
      const availablePlayers = Object.entries(allPlayers)
        .filter(([playerId, player]: [string, any]) => {
          if (rosteredPlayers.has(playerId)) return false;
          if (!player.fantasy_positions?.length) return false;
          const pos = player.fantasy_positions[0];
          if (!["QB", "RB", "WR", "TE", "K", "DEF"].includes(pos)) return false;
          const status = (player.status || "").toLowerCase();
          if (status === "inactive" || status === "retired") return false;
          if (!player.team) return false;
          return true;
        })
        .map(([playerId, player]: [string, any]) => {
          const pStats = wSeasonStats?.[playerId] || {};
          const gamesPlayed = pStats.gp || 0;
          const fantasyPoints = pStats.pts_ppr || 0;
          const ppg = gamesPlayed > 0 ? fantasyPoints / gamesPlayed : 0;
          
          return {
            playerId,
            name: player.full_name || `${player.first_name} ${player.last_name}`,
            position: player.fantasy_positions?.[0] || "?",
            team: player.team,
            age: player.age,
            status: player.status || "Active",
            injuryStatus: player.injury_status,
            seasonPoints: Math.round(fantasyPoints * 10) / 10,
            avgPoints: Math.round(ppg * 10) / 10,
            lastWeekPoints: 0,
            projectedPoints: Math.round(ppg * 10) / 10,
            percentRostered: 0,
          };
        })
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

  // Get personalized waiver recommendations based on roster needs (Premium)
  app.get("/api/fantasy/waiver-recommendations/:leagueId", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
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
      
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();
      const statsSeason = currentMonth < 8 ? String(currentYear - 1) : String(currentYear);
      let seasonStats: any = {};
      try {
        seasonStats = await sleeperApi.getSeasonStats(statsSeason, "regular") || {};
      } catch (e) {
        console.log(`[Waiver Recommendations] Failed to fetch season stats: ${e}`);
      }

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
      const isSuperflex = dynastyEngine.isLeagueSuperflex(league);
      const rosterSettings = dynastyEngine.parseLeagueRosterSettings(league);
      
      try {
        await dynastyConsensusService.fetchAndCacheValues();
      } catch (e) {
        console.log(`[Waiver Wire] Failed to fetch consensus values: ${e}`);
      }
      
      const recommendations = Object.entries(allPlayers)
        .filter(([playerId, player]: [string, any]) => {
          if (rosteredPlayers.has(playerId)) return false;
          if (!player.fantasy_positions?.length) return false;
          const pos = player.fantasy_positions[0];
          if (!["QB", "RB", "WR", "TE"].includes(pos)) return false;
          if (!player.team) return false;
          const status = (player.status || "").toLowerCase();
          if (status === "inactive" || status === "retired") return false;
          return true;
        })
        .map(([playerId, player]: [string, any]) => {
          const pos = player.fantasy_positions[0];
          const playerName = player.full_name || `${player.first_name} ${player.last_name}`;
          const pStats = seasonStats?.[playerId] || {};
          const gamesPlayed = pStats.gp || 0;
          const fantasyPoints = pStats.pts_ppr || 0;
          const ppg = gamesPlayed > 0 ? fantasyPoints / gamesPlayed : 0;
          
          const consensusValue = dynastyConsensusService.getNormalizedValue(playerName, pos, isSuperflex);
          const valueResult = dynastyEngine.getBlendedPlayerValue(
            playerId,
            playerName,
            pos,
            player.age || 25,
            player.years_exp || 0,
            player.injury_status || null,
            { points: fantasyPoints, games: gamesPlayed, ppg },
            null,
            null,
            consensusValue,
            0.5,
            rosterSettings
          );
          const playerValue = valueResult.value;
          const positionNeed = positionNeeds.find(p => p.position === pos);
          
          const needBonus = positionNeed ? (positionNeed.need / 100) * 20 : 0;
          const fitScore = Math.round(Math.min(100, (playerValue / 100) + needBonus));
          
          let reason = "";
          if (positionNeed && positionNeed.need >= 50) {
            reason = `Fills ${pos} need (only ${positionNeed.count} on roster)`;
          } else if (playerValue >= 7000) {
            reason = `Elite talent available (${ppg > 0 ? ppg.toFixed(1) + " PPG" : "high upside"})`;
          } else if (playerValue >= 4000) {
            reason = `Solid starter${ppg >= 10 ? " (" + ppg.toFixed(1) + " PPG)" : ""}`;
          } else if (playerValue >= 2000) {
            reason = `Emerging player with upside`;
          } else if (player.years_exp <= 2) {
            reason = `Young developmental prospect`;
          } else {
            reason = `Depth/streaming option`;
          }
          
          return {
            playerId,
            name: playerName,
            position: pos,
            team: player.team,
            age: player.age,
            injuryStatus: player.injury_status,
            dynastyValue: Math.round(playerValue),
            fitScore,
            needLevel: positionNeed?.need ? (positionNeed.need >= 70 ? "high" : positionNeed.need >= 40 ? "medium" : "low") : "low",
            reason,
          };
        })
        .filter(p => p.fitScore >= 10 && p.dynastyValue >= 500)
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

  // Get user's watchlist (Premium)
  app.get("/api/watchlist", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
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

  // Add player to watchlist (Premium)
  app.post("/api/watchlist", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
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

  // Remove player from watchlist (Premium)
  app.delete("/api/watchlist/:playerId", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
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

  // Update watchlist entry notes (Premium)
  app.patch("/api/watchlist/:playerId", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
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

      const cacheKey = `matchups:${leagueId}:${requestedWeek || 'current'}`;
      const cached = matchupsCache.get(cacheKey);
      if (cached) return res.json(cached);

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

      const responseData = {
        matchups,
        currentWeek,
        selectedWeek,
        seasonType: selectedWeek >= (league.settings?.playoff_week_start || 15) ? "playoff" : "regular",
        gamesInProgress,
      };
      matchupsCache.set(cacheKey, responseData);
      res.json(responseData);
    } catch (error) {
      console.error("Error fetching matchups:", error);
      res.status(500).json({ message: "Failed to fetch matchups" });
    }
  });

  // Get median tracker data for a team - shows current week median status and season record
  app.get("/api/sleeper/median-tracker/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      const userId = req.user.claims.sub;

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

      // Check if this is a median league
      const isMedianLeague = (league.settings as any)?.league_average_match === 1;

      // Find user's roster
      const userRoster = rosters.find(r => r.owner_id === profile.sleeperUserId);
      if (!userRoster) {
        return res.status(404).json({ message: "User roster not found in this league" });
      }

      const userRosterId = userRoster.roster_id;
      const currentWeek = state.display_week || state.week || 1;
      const playoffWeekStart = league.settings?.playoff_week_start || 15;
      const regularSeasonWeeks = Math.min(currentWeek, playoffWeekStart - 1);

      // Fetch matchups for completed weeks and current week
      const weeksToFetch = Array.from({ length: regularSeasonWeeks }, (_, i) => i + 1);
      const matchupPromises = weeksToFetch.map(week => 
        sleeperApi.getMatchups(leagueId, week).then(matchups => ({ week, matchups }))
      );
      const weekResults = await Promise.all(matchupPromises);

      // Calculate median record for user
      let medianWins = 0;
      let medianLosses = 0;
      let medianTies = 0;
      const weeklyMedianResults: {
        week: number;
        userScore: number;
        median: number;
        result: 'W' | 'L' | 'T' | null;
        beatingMedian: boolean | null;
      }[] = [];

      let currentWeekData: {
        userScore: number;
        median: number;
        beatingMedian: boolean | null;
        leagueScores: { rosterId: number; ownerName: string; score: number; }[];
      } | null = null;

      const userMap = new Map((users || []).map((u) => [u.user_id, u]));

      for (const { week, matchups } of weekResults) {
        if (!matchups || matchups.length === 0) continue;

        const userMatchup = matchups.find(m => m.roster_id === userRosterId);
        const userScore = userMatchup?.points || 0;

        // Calculate median from all scores
        const allScores = matchups
          .map(m => m.points || 0)
          .filter(s => s > 0)
          .sort((a, b) => b - a);

        if (allScores.length === 0) continue;

        const midIndex = Math.floor(allScores.length / 2);
        const median = allScores.length % 2 === 0
          ? (allScores[midIndex - 1] + allScores[midIndex]) / 2
          : allScores[midIndex];

        // Check if this week is complete (user has points)
        const isWeekComplete = userScore > 0 && week < currentWeek;
        const isCurrentWeek = week === currentWeek;

        if (isWeekComplete) {
          if (userScore > median) {
            medianWins++;
            weeklyMedianResults.push({ week, userScore, median, result: 'W', beatingMedian: true });
          } else if (userScore < median) {
            medianLosses++;
            weeklyMedianResults.push({ week, userScore, median, result: 'L', beatingMedian: false });
          } else {
            medianTies++;
            weeklyMedianResults.push({ week, userScore, median, result: 'T', beatingMedian: null });
          }
        }

        // Current week live data
        if (isCurrentWeek) {
          const leagueScores = matchups.map(m => {
            const roster = rosters.find(r => r.roster_id === m.roster_id);
            const user = roster ? userMap.get(roster.owner_id) : null;
            return {
              rosterId: m.roster_id,
              ownerName: user?.display_name || "Unknown",
              score: m.points || 0,
            };
          }).sort((a, b) => b.score - a.score);

          currentWeekData = {
            userScore,
            median: allScores.length > 0 ? median : 0,
            beatingMedian: userScore > 0 && median > 0 ? userScore > median : null,
            leagueScores,
          };
        }
      }

      // Calculate percentage of weeks beating the median
      const totalWeeksPlayed = medianWins + medianLosses + medianTies;
      const beatMedianPercentage = totalWeeksPlayed > 0 
        ? Math.round((medianWins / totalWeeksPlayed) * 100) 
        : null;

      // Determine if games are in progress (current week has some scores but not all finalized)
      const hasCurrentWeekScores = currentWeekData && currentWeekData.leagueScores.some(s => s.score > 0);
      const gamesInProgress = hasCurrentWeekScores && (state.season_type === "regular" || state.season_type === "post");

      res.json({
        isMedianLeague,
        currentWeek,
        gamesInProgress: gamesInProgress || false,
        seasonRecord: {
          wins: medianWins,
          losses: medianLosses,
          ties: medianTies,
          percentage: beatMedianPercentage,
        },
        currentWeekData,
        weeklyResults: weeklyMedianResults,
      });
    } catch (error) {
      console.error("Error fetching median tracker:", error);
      res.status(500).json({ message: "Failed to fetch median tracker data" });
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

  app.get("/api/sleeper/devy/my-players", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const [profile] = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId));

      const devyPlayers = ktcValues.getDevyPlayers();
      const devyByName = new Map(devyPlayers.map(p => [p.name.toLowerCase().trim(), p]));
      const devyByLastName = new Map<string, typeof devyPlayers[0][]>();
      for (const p of devyPlayers) {
        const parts = p.name.toLowerCase().trim().split(' ');
        const lastName = parts[parts.length - 1];
        if (!devyByLastName.has(lastName)) devyByLastName.set(lastName, []);
        devyByLastName.get(lastName)!.push(p);
      }

      const fuzzyMatchDevy = (parsedName: string, parsedPos: string): typeof devyPlayers[0] | undefined => {
        const nameKey = parsedName.toLowerCase().trim();
        const exact = devyByName.get(nameKey);
        if (exact) return exact;
        const nameParts = nameKey.split(' ');
        const lastName = nameParts[nameParts.length - 1];
        const candidates = devyByLastName.get(lastName) || [];
        if (candidates.length === 1) return candidates[0];
        if (parsedPos && parsedPos !== '?') {
          const posMatch = candidates.filter(c => c.position === parsedPos.toUpperCase());
          if (posMatch.length === 1) return posMatch[0];
        }
        for (const c of candidates) {
          const cFirst = c.name.toLowerCase().split(' ')[0];
          const pFirst = nameParts[0];
          if (pFirst.length === 1 && cFirst.startsWith(pFirst)) return c;
          if (cFirst.length === 1 && pFirst.startsWith(cFirst)) return c;
          if (pFirst.endsWith('.') && cFirst.startsWith(pFirst.replace('.', ''))) return c;
        }
        return undefined;
      };

      let leagueNames: Array<{ id: string; name: string }> = [];
      if (profile?.sleeperUsername) {
        const sleeperUser = await sleeperApi.getSleeperUser(profile.sleeperUsername);
        if (sleeperUser) {
          const leagues = await getAllUserLeagues(sleeperUser.user_id);
          leagueNames = (leagues || []).map((l: any) => ({ id: l.league_id, name: l.name }));
        }
      }

      const manualEntries = await db.select().from(schema.devyPortfolio).where(eq(schema.devyPortfolio.userId, userId));

      const ownedDevy: Array<{
        devyPlayerId: string;
        devyName: string;
        devyPosition: string;
        devySchool: string;
        leagueId: string | null;
        leagueName: string | null;
        matched: boolean;
        manualEntryId: string;
      }> = [];

      const playerLeagueMap = new Map<string, Set<string>>();
      for (const entry of manualEntries) {
        const key = entry.playerName.toLowerCase().trim();
        if (entry.leagueId) {
          if (!playerLeagueMap.has(key)) playerLeagueMap.set(key, new Set());
          playerLeagueMap.get(key)!.add(entry.leagueId);
        }
      }

      const dedupedEntries = manualEntries.filter(entry => {
        if (entry.leagueId) return true;
        const key = entry.playerName.toLowerCase().trim();
        return !playerLeagueMap.has(key);
      });

      for (const entry of dedupedEntries) {
        const matchedDevy = fuzzyMatchDevy(entry.playerName, entry.position);
        ownedDevy.push({
          devyPlayerId: matchedDevy?.id || `manual-${entry.id}`,
          devyName: entry.playerName,
          devyPosition: entry.position,
          devySchool: entry.school || "",
          leagueId: entry.leagueId || null,
          leagueName: entry.leagueName || null,
          matched: !!matchedDevy,
          manualEntryId: String(entry.id),
        });
      }

      res.json({ ownedDevy, leagues: leagueNames, manualEntries: dedupedEntries });
    } catch (error) {
      console.error("Error fetching my devy players:", error);
      res.status(500).json({ message: "Failed to fetch owned devy players" });
    }
  });

  app.post("/api/sleeper/devy/my-players", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const { playerName, position, school, leagueId, leagueName, notes } = req.body;
      if (!playerName || !position) {
        return res.status(400).json({ message: "Player name and position are required" });
      }

      const existingSameLeague = await db.select().from(schema.devyPortfolio).where(
        and(
          eq(schema.devyPortfolio.userId, userId),
          eq(schema.devyPortfolio.playerName, playerName),
          leagueId ? eq(schema.devyPortfolio.leagueId, leagueId) : isNull(schema.devyPortfolio.leagueId)
        )
      );
      if (existingSameLeague.length > 0) {
        return res.status(409).json({ message: `${playerName} is already in your portfolio${leagueName ? ` for ${leagueName}` : ''}` });
      }

      if (leagueId) {
        const orphaned = await db.select().from(schema.devyPortfolio).where(
          and(
            eq(schema.devyPortfolio.userId, userId),
            eq(schema.devyPortfolio.playerName, playerName),
            isNull(schema.devyPortfolio.leagueId)
          )
        );
        if (orphaned.length > 0) {
          await db.delete(schema.devyPortfolio).where(
            and(
              eq(schema.devyPortfolio.userId, userId),
              eq(schema.devyPortfolio.playerName, playerName),
              isNull(schema.devyPortfolio.leagueId)
            )
          );
        }
      }

      const [entry] = await db.insert(schema.devyPortfolio).values({
        userId,
        playerName,
        position,
        school: school || null,
        leagueId: leagueId || null,
        leagueName: leagueName || null,
        notes: notes || null,
      }).returning();

      res.json(entry);
    } catch (error) {
      console.error("Error adding manual devy player:", error);
      res.status(500).json({ message: "Failed to add devy player" });
    }
  });

  app.delete("/api/sleeper/devy/my-players/:id", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      await db.delete(schema.devyPortfolio).where(
        and(
          eq(schema.devyPortfolio.id, req.params.id),
          eq(schema.devyPortfolio.userId, userId)
        )
      );

      res.json({ success: true });
    } catch (error) {
      console.error("Error removing manual devy player:", error);
      res.status(500).json({ message: "Failed to remove devy player" });
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

      const currentDraftYear = currentYear;
      
      const trueDevyPlayers = devyPlayers.filter(player => {
        if (player.draftEligibleYear < currentDraftYear) {
          return false;
        }
        
        const nameKey = player.name.toLowerCase().trim();
        const nflPlayer = nflPlayersByName.get(nameKey);
        
        if (nflPlayer) {
          if (nflPlayer.team || nflPlayer.years_exp > 0) {
            return false;
          }
        }
        return true;
      });

      const { getFantasyProsRankByName } = await import('./devy-data-sources');

      const totalDevyCount = trueDevyPlayers.length;

      function calculateDVIServer(p: any): number {
        let score = 0;
        score += Math.max(0, 40 - ((p.rank || p.dtRank || 1) - 1) * 0.5);
        score += (p.round1Pct / 100) * 15;
        score += (p.top10Pct / 100) * 5;
        score += (p.elitePct / 100) * 15;
        score -= (p.bustPct / 100) * 5;
        const trendBonus = Math.min(10, Math.max(-5, (p.trend30Day || 0) * 0.5));
        score += 5 + trendBonus;
        if (p.ageClass === "young-breakout") score += 10;
        else if (p.ageClass === "normal") score += 6;
        else score += 3;
        return Math.round(Math.min(100, Math.max(0, score)));
      }

      const playersWithConsensus = trueDevyPlayers.map((player, index) => {
        const dynastyValue = player.value > 0
          ? player.value
          : dynastyEngine.calculateDevyValue(player.tier, player.draftEligibleYear, 1, currentYear);

        const dtRank = index + 1;
        const fpRank = getFantasyProsRankByName(player.name, player.position);

        let consensusRank: number;
        if (fpRank !== null) {
          const scaledFpRank = Math.round(fpRank * (totalDevyCount / 100));
          consensusRank = Math.round(dtRank * 0.6 + scaledFpRank * 0.4);
        } else {
          consensusRank = dtRank;
        }

        const enriched = ktcValues.computeEnrichedFields(player, trueDevyPlayers);

        return {
          ...enriched,
          value: dynastyValue,
          dtRank,
          fantasyProsRank: fpRank,
          consensusRank,
          rank: 0,
          marketRank: dtRank,
          modelRank: 0,
          rankDelta: 0,
          dviScore: 0,
          playerClass: player.draftEligibleYear === currentDraftYear ? "draft" as const : "devy" as const,
        };
      });

      playersWithConsensus.sort((a, b) => a.consensusRank - b.consensusRank);
      const positionCounters: Record<string, number> = {};
      const withRanks = playersWithConsensus.map((player, index) => {
        positionCounters[player.position] = (positionCounters[player.position] || 0) + 1;
        const rank = index + 1;
        const marketRank = rank;
        return { ...player, rank, positionRank: positionCounters[player.position], marketRank };
      });

      const withDvi = withRanks.map(p => ({ ...p, dviScore: calculateDVIServer(p) }));
      const dviSorted = [...withDvi].sort((a, b) => b.dviScore - a.dviScore);
      const dviRankMap = new Map(dviSorted.map((p, i) => [p.playerId, i + 1]));

      const rankedPlayers = withDvi.map(p => {
        const modelRank = dviRankMap.get(p.playerId) || p.rank;
        return { ...p, modelRank, rankDelta: p.marketRank - modelRank };
      });

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
      
      let player = ktcValues.getDevyPlayerById(playerId);
      if (!player) {
        const playerName = req.query.playerName as string;
        if (playerName) {
          player = ktcValues.getDevyPlayerByName(playerName);
        }
      }
      if (!player) {
        return res.status(404).json({ message: "Player not found" });
      }

      // Import college stats service
      const { getCollegePlayerProfile, getCollegePlayerHeadshotUrl } = await import("./college-stats-service");
      const cfbd = await import('./cfbd-service');
      
      // Fetch real ESPN college stats and CFBD advanced data in parallel
      const [espnProfile, cfbdProfile] = await Promise.all([
        getCollegePlayerProfile(player.name, player.college),
        cfbd.getFullPlayerProfile(player.name, player.college, player.position).catch(err => {
          console.error(`[CFBD] Profile fetch failed for ${player.name}:`, err);
          return null;
        }),
      ]);
      
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

      const cfbdAdvanced = cfbdProfile ? {
        seasonStats: cfbdProfile.seasonStats,
        usage: cfbdProfile.usage ? {
          overall: cfbdProfile.usage.usage.overall,
          pass: cfbdProfile.usage.usage.pass,
          rush: cfbdProfile.usage.usage.rush,
          firstDown: cfbdProfile.usage.usage.firstDown,
          secondDown: cfbdProfile.usage.usage.secondDown,
          thirdDown: cfbdProfile.usage.usage.thirdDown,
          standardDowns: cfbdProfile.usage.usage.standardDowns,
          passingDowns: cfbdProfile.usage.usage.passingDowns,
        } : null,
        ppa: cfbdProfile.ppa ? {
          countablePlays: cfbdProfile.ppa.countablePlays,
          averagePPA: cfbdProfile.ppa.averagePPA,
          totalPPA: cfbdProfile.ppa.totalPPA,
        } : null,
      } : null;

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
        cfbdAdvanced,
        analysisNotes: scoutingData.analysisNotes || [],
        scoutingReport: scoutingData.scoutingReport || { strengths: [], weaknesses: [], nflComparison: "N/A", draftProjection: "N/A", fantasyOutlook: "N/A" },
        news: [],
        espnId: espnProfile?.espnId || null,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching devy player profile:", error);
      res.status(500).json({ message: "Failed to fetch player profile" });
    }
  });

  // Get multi-source devy players with consensus rankings
  app.get("/api/sleeper/devy/multi-source", isAuthenticated, async (req: any, res: Response) => {
    try {
      const devyDataSources = await import('./devy-data-sources');
      const players = await devyDataSources.getMultiSourceDevyPlayers();
      
      res.json({
        players,
        sources: await devyDataSources.getDataSourceStatus(),
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching multi-source devy players:", error);
      res.status(500).json({ message: "Failed to fetch multi-source devy data" });
    }
  });

  // Get data source status for devy rankings
  app.get("/api/sleeper/devy/sources", isAuthenticated, async (req: any, res: Response) => {
    try {
      const devyDataSources = await import('./devy-data-sources');
      const sources = await devyDataSources.getDataSourceStatus();
      
      res.json({ sources });
    } catch (error) {
      console.error("Error fetching data source status:", error);
      res.status(500).json({ message: "Failed to fetch data source status" });
    }
  });

  // Refresh all devy data sources
  app.post("/api/sleeper/devy/refresh-sources", isAuthenticated, async (req: any, res: Response) => {
    try {
      const devyDataSources = await import('./devy-data-sources');
      const result = await devyDataSources.refreshAllSources();
      
      res.json(result);
    } catch (error) {
      console.error("Error refreshing data sources:", error);
      res.status(500).json({ message: "Failed to refresh data sources" });
    }
  });

  // College stat leaders
  app.get("/api/college/stat-leaders", isAuthenticated, async (req: any, res: Response) => {
    try {
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      const conference = req.query.conference as string | undefined;
      const cfbd = await import('./cfbd-service');
      const leaders = await cfbd.getCollegeStatLeaders(year, conference);
      res.json(leaders);
    } catch (error: any) {
      console.error("Error fetching college stat leaders:", error);
      res.status(500).json({ message: "Failed to fetch college stat leaders", error: error.message });
    }
  });

  // Transfer portal
  app.get("/api/college/transfer-portal", isAuthenticated, async (req: any, res: Response) => {
    try {
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      const cfbd = await import('./cfbd-service');
      const transfers = await cfbd.getTransferPortal(year);
      res.json({ transfers, year: year || new Date().getFullYear() });
    } catch (error: any) {
      console.error("Error fetching transfer portal:", error);
      res.status(500).json({ message: "Failed to fetch transfer portal data", error: error.message });
    }
  });

  // Team roster
  app.get("/api/college/roster/:team", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { team } = req.params;
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      const cfbd = await import('./cfbd-service');
      const roster = await cfbd.getTeamRoster(team, year);
      res.json({ roster, team, year: year || new Date().getFullYear() });
    } catch (error: any) {
      console.error("Error fetching team roster:", error);
      res.status(500).json({ message: "Failed to fetch team roster", error: error.message });
    }
  });

  app.get("/api/draft/2026", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { getDraft2026Players, getDraft2026Stats, getDraft2026PositionGroups, getDraft2026StockMovers } = await import('./draft-2026-data');
      const { KTC_DEVY_PLAYERS } = await import('./ktc-values');
      
      const side = req.query.side as string | undefined;
      const positionGroup = req.query.positionGroup as string | undefined;
      const search = req.query.search as string | undefined;
      
      const players = getDraft2026Players({ side, positionGroup, search });
      const stats = getDraft2026Stats();
      const positionGroups = getDraft2026PositionGroups();
      const stockMovers = getDraft2026StockMovers();

      const HISTORICAL_PICK_DATA: Record<string, { value: number; hitRate: number; eliteRate: number; starterRate: number; bustRate: number; avgPPG: number }> = {
        "1.01": { value: 100, hitRate: 82, eliteRate: 45, starterRate: 72, bustRate: 18, avgPPG: 16.2 },
        "1.02": { value: 93, hitRate: 78, eliteRate: 38, starterRate: 68, bustRate: 22, avgPPG: 14.8 },
        "1.03": { value: 87, hitRate: 75, eliteRate: 32, starterRate: 65, bustRate: 25, avgPPG: 14.1 },
        "1.04": { value: 82, hitRate: 72, eliteRate: 28, starterRate: 62, bustRate: 28, avgPPG: 13.5 },
        "1.05": { value: 77, hitRate: 68, eliteRate: 24, starterRate: 58, bustRate: 32, avgPPG: 12.8 },
        "1.06": { value: 73, hitRate: 64, eliteRate: 20, starterRate: 54, bustRate: 36, avgPPG: 12.2 },
        "1.07": { value: 68, hitRate: 58, eliteRate: 16, starterRate: 48, bustRate: 42, avgPPG: 11.5 },
        "1.08": { value: 64, hitRate: 54, eliteRate: 14, starterRate: 44, bustRate: 46, avgPPG: 10.9 },
        "1.09": { value: 60, hitRate: 50, eliteRate: 12, starterRate: 40, bustRate: 50, avgPPG: 10.3 },
        "1.10": { value: 56, hitRate: 46, eliteRate: 10, starterRate: 36, bustRate: 54, avgPPG: 9.7 },
        "1.11": { value: 53, hitRate: 42, eliteRate: 8, starterRate: 32, bustRate: 58, avgPPG: 9.1 },
        "1.12": { value: 50, hitRate: 38, eliteRate: 6, starterRate: 28, bustRate: 62, avgPPG: 8.5 },
        "2.01": { value: 47, hitRate: 35, eliteRate: 5, starterRate: 25, bustRate: 65, avgPPG: 7.8 },
        "2.02": { value: 44, hitRate: 32, eliteRate: 4, starterRate: 22, bustRate: 68, avgPPG: 7.4 },
        "2.03": { value: 41, hitRate: 30, eliteRate: 4, starterRate: 20, bustRate: 70, avgPPG: 7.0 },
        "2.04": { value: 38, hitRate: 28, eliteRate: 3, starterRate: 18, bustRate: 72, avgPPG: 6.6 },
        "2.05": { value: 35, hitRate: 25, eliteRate: 3, starterRate: 16, bustRate: 75, avgPPG: 6.2 },
        "2.06": { value: 33, hitRate: 23, eliteRate: 2, starterRate: 14, bustRate: 77, avgPPG: 5.9 },
        "2.07": { value: 30, hitRate: 20, eliteRate: 2, starterRate: 12, bustRate: 80, avgPPG: 5.5 },
        "2.08": { value: 28, hitRate: 18, eliteRate: 2, starterRate: 10, bustRate: 82, avgPPG: 5.2 },
        "2.09": { value: 26, hitRate: 16, eliteRate: 1, starterRate: 9, bustRate: 84, avgPPG: 4.8 },
        "2.10": { value: 24, hitRate: 15, eliteRate: 1, starterRate: 8, bustRate: 85, avgPPG: 4.5 },
        "2.11": { value: 22, hitRate: 14, eliteRate: 1, starterRate: 7, bustRate: 86, avgPPG: 4.2 },
        "2.12": { value: 20, hitRate: 12, eliteRate: 1, starterRate: 6, bustRate: 88, avgPPG: 3.9 },
        "3.01": { value: 18, hitRate: 10, eliteRate: 1, starterRate: 5, bustRate: 90, avgPPG: 3.5 },
        "3.02": { value: 16, hitRate: 9, eliteRate: 0, starterRate: 5, bustRate: 91, avgPPG: 3.2 },
        "3.03": { value: 15, hitRate: 8, eliteRate: 0, starterRate: 4, bustRate: 92, avgPPG: 3.0 },
        "3.04": { value: 13, hitRate: 7, eliteRate: 0, starterRate: 3, bustRate: 93, avgPPG: 2.7 },
        "3.05": { value: 12, hitRate: 6, eliteRate: 0, starterRate: 3, bustRate: 94, avgPPG: 2.5 },
        "3.06": { value: 10, hitRate: 5, eliteRate: 0, starterRate: 2, bustRate: 95, avgPPG: 2.2 },
      };

      const POS_HIT_RATES: Record<string, Record<string, { eliteRate: number; starterRate: number; bustRate: number }>> = {
        QB: {
          "1.01-1.04": { eliteRate: 42, starterRate: 68, bustRate: 20 },
          "1.05-1.08": { eliteRate: 28, starterRate: 52, bustRate: 35 },
          "1.09-1.12": { eliteRate: 15, starterRate: 38, bustRate: 50 },
          "2.01-2.06": { eliteRate: 5, starterRate: 18, bustRate: 75 },
          "2.07-2.12": { eliteRate: 2, starterRate: 8, bustRate: 88 },
          "3.01+": { eliteRate: 0, starterRate: 3, bustRate: 95 },
        },
        RB: {
          "1.01-1.04": { eliteRate: 48, starterRate: 75, bustRate: 15 },
          "1.05-1.08": { eliteRate: 22, starterRate: 50, bustRate: 38 },
          "1.09-1.12": { eliteRate: 10, starterRate: 32, bustRate: 58 },
          "2.01-2.06": { eliteRate: 4, starterRate: 18, bustRate: 72 },
          "2.07-2.12": { eliteRate: 2, starterRate: 8, bustRate: 85 },
          "3.01+": { eliteRate: 1, starterRate: 3, bustRate: 94 },
        },
        WR: {
          "1.01-1.04": { eliteRate: 38, starterRate: 70, bustRate: 18 },
          "1.05-1.08": { eliteRate: 20, starterRate: 48, bustRate: 40 },
          "1.09-1.12": { eliteRate: 8, starterRate: 30, bustRate: 60 },
          "2.01-2.06": { eliteRate: 4, starterRate: 16, bustRate: 74 },
          "2.07-2.12": { eliteRate: 2, starterRate: 8, bustRate: 85 },
          "3.01+": { eliteRate: 0, starterRate: 3, bustRate: 94 },
        },
        TE: {
          "1.01-1.04": { eliteRate: 30, starterRate: 58, bustRate: 28 },
          "1.05-1.08": { eliteRate: 15, starterRate: 38, bustRate: 48 },
          "1.09-1.12": { eliteRate: 5, starterRate: 22, bustRate: 68 },
          "2.01-2.06": { eliteRate: 2, starterRate: 10, bustRate: 82 },
          "2.07-2.12": { eliteRate: 1, starterRate: 5, bustRate: 90 },
          "3.01+": { eliteRate: 0, starterRate: 2, bustRate: 96 },
        },
      };

      function getPickSlot(rank: number): string {
        const round = Math.ceil(rank / 12);
        const pick = ((rank - 1) % 12) + 1;
        return `${round}.${pick.toString().padStart(2, '0')}`;
      }

      function getPickRange(rank: number): string {
        const slot = getPickSlot(rank);
        const round = Math.ceil(rank / 12);
        const pick = ((rank - 1) % 12) + 1;
        const lo = Math.max(1, pick - 2);
        const hi = Math.min(12, pick + 2);
        return `${round}.${lo.toString().padStart(2, '0')}-${round}.${hi.toString().padStart(2, '0')}`;
      }

      function getPosRangeBucket(rank: number): string {
        if (rank <= 4) return "1.01-1.04";
        if (rank <= 8) return "1.05-1.08";
        if (rank <= 12) return "1.09-1.12";
        if (rank <= 18) return "2.01-2.06";
        if (rank <= 24) return "2.07-2.12";
        return "3.01+";
      }

      function computeEV(elitePct: number, starterPct: number, bustPct: number): number {
        const ev = (elitePct / 100 * 95) + (starterPct / 100 * 60) - (bustPct / 100 * 30);
        return Math.max(0, Math.min(100, Math.round(ev)));
      }

      function getRiskTier(bustPct: number): string {
        if (bustPct <= 20) return "Low";
        if (bustPct <= 40) return "Medium";
        if (bustPct <= 65) return "High";
        return "Extreme";
      }

      function getLiquidityScore(rank: number, ktcValue: number): number {
        const rankScore = Math.max(0, 100 - rank * 2);
        const valueScore = Math.min(100, ktcValue / 100);
        return Math.round((rankScore * 0.4 + valueScore * 0.6));
      }

      const ktcByName: Record<string, typeof KTC_DEVY_PLAYERS[0]> = {};
      for (const dp of KTC_DEVY_PLAYERS) {
        ktcByName[dp.name.toLowerCase().trim()] = dp;
      }

      const enrichedPlayers = players.map(player => {
        const ktc = ktcByName[player.name.toLowerCase().trim()];
        const pickSlot = getPickSlot(player.rank);
        const pickRange = getPickRange(player.rank);
        const historicalPick = HISTORICAL_PICK_DATA[pickSlot];
        const posGroup = player.positionGroup;
        const posBucket = getPosRangeBucket(player.rank);
        const posRates = POS_HIT_RATES[posGroup]?.[posBucket] || null;

        let elitePct: number;
        let starterPct: number;
        let bustPct: number;

        if (ktc && ktc.draftEligibleYear === 2026) {
          elitePct = ktc.elitePct;
          starterPct = ktc.starterPct;
          bustPct = ktc.bustPct;
        } else if (posRates) {
          elitePct = posRates.eliteRate;
          starterPct = posRates.starterRate;
          bustPct = posRates.bustRate;
        } else if (historicalPick) {
          elitePct = historicalPick.eliteRate;
          starterPct = historicalPick.starterRate;
          bustPct = historicalPick.bustRate;
        } else {
          elitePct = 0;
          starterPct = 2;
          bustPct = 95;
        }

        const evScore = computeEV(elitePct, starterPct, bustPct);
        const riskTier = getRiskTier(bustPct);
        const liquidityScore = getLiquidityScore(player.rank, ktc?.value || 0);
        const historicalAvgPPG = historicalPick?.avgPPG || 0;

        return {
          ...player,
          projectedPickRange: pickRange,
          projectedPickSlot: pickSlot,
          elitePct,
          starterPct,
          bustPct,
          evScore,
          riskTier,
          liquidityScore,
          historicalAvgPPG,
          positionEliteRate: posRates?.eliteRate ?? null,
          positionStarterRate: posRates?.starterRate ?? null,
          positionBustRate: posRates?.bustRate ?? null,
          ktcValue: ktc?.value ?? null,
          tier: ktc?.tier ?? null,
        };
      });

      const tierCliffs: { afterRank: number; eliteDropFrom: number; eliteDropTo: number; severity: string }[] = [];
      const sorted = [...enrichedPlayers].sort((a, b) => a.rank - b.rank);
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        const drop = prev.elitePct - curr.elitePct;
        if (drop >= 8 && prev.elitePct >= 15) {
          tierCliffs.push({
            afterRank: prev.rank,
            eliteDropFrom: prev.elitePct,
            eliteDropTo: curr.elitePct,
            severity: drop >= 15 ? "major" : "minor",
          });
        }
      }
      
      res.json({
        players: enrichedPlayers,
        stats,
        positionGroups,
        stockMovers,
        tierCliffs,
        draftYear: 2026,
      });
    } catch (error) {
      console.error("Error fetching 2026 draft data:", error);
      res.status(500).json({ message: "Failed to fetch 2026 draft data" });
    }
  });

  app.get("/api/draft/2026/:playerName/profile", isAuthenticated, async (req: any, res: Response) => {
    try {
      const playerName = decodeURIComponent(req.params.playerName);
      const { DRAFT_2026_PLAYERS } = await import('./draft-2026-data');
      
      const player = DRAFT_2026_PLAYERS.find(p => p.name.toLowerCase() === playerName.toLowerCase());
      if (!player) {
        return res.status(404).json({ message: "Player not found" });
      }

      const cfbd = await import('./cfbd-service');
      const { getCollegePlayerProfile, getCollegePlayerHeadshotUrl } = await import('./college-stats-service');

      const defensivePositions = ['EDGE', 'DL', 'DL1T', 'DL3T', 'DL5T', 'LB', 'ILB', 'CB', 'S', 'DE', 'DT', 'NT', 'OLB', 'MLB', 'FS', 'SS', 'DB', 'IDL'];
      const isDefensive = defensivePositions.includes(player.position.toUpperCase());

      const [espnProfile, cfbdProfile, cfbdDefStats] = await Promise.all([
        getCollegePlayerProfile(player.name, player.college).catch(() => null),
        cfbd.getFullPlayerProfile(player.name, player.college, player.position).catch(() => null),
        isDefensive ? cfbd.getDefensivePlayerStats(player.name, player.college, player.position).catch(() => null) : null,
      ]);

      let collegeStats = { seasons: [] as any[], careerTotals: {} as Record<string, any> };
      if (espnProfile) {
        collegeStats = { seasons: espnProfile.seasons, careerTotals: espnProfile.careerTotals };
      }

      if (isDefensive && cfbdDefStats && cfbdDefStats.seasons.length > 0) {
        const defStatKeys = ['tackles', 'soloTackles', 'astTackles', 'sacks', 'tfl', 'passDeflect', 'passInt', 'ff', 'fr', 'qbHurries', 'defTd'];
        const espnDefStatCount = collegeStats.seasons.reduce((count: number, s: any) => {
          return count + defStatKeys.filter(k => s.stats[k] !== undefined).length;
        }, 0);
        const cfbdDefStatCount = cfbdDefStats.seasons.reduce((count: number, s: any) => {
          return count + defStatKeys.filter(k => s.stats[k] !== undefined).length;
        }, 0);

        if (collegeStats.seasons.length === 0 || cfbdDefStatCount > espnDefStatCount) {
          if (collegeStats.seasons.length === 0) {
            collegeStats.seasons = cfbdDefStats.seasons;
            collegeStats.careerTotals = cfbdDefStats.careerTotals;
          } else {
            for (const cfbdSeason of cfbdDefStats.seasons) {
              const existing = collegeStats.seasons.find((s: any) => s.year === cfbdSeason.year);
              if (existing) {
                for (const [key, value] of Object.entries(cfbdSeason.stats)) {
                  if (existing.stats[key] === undefined || existing.stats[key] === 0) {
                    existing.stats[key] = value;
                  }
                }
              } else {
                collegeStats.seasons.push(cfbdSeason);
              }
            }
            for (const [key, value] of Object.entries(cfbdDefStats.careerTotals)) {
              if (collegeStats.careerTotals[key] === undefined || collegeStats.careerTotals[key] === 0) {
                collegeStats.careerTotals[key] = value;
              }
            }
            collegeStats.seasons.sort((a: any, b: any) => Number(b.year) - Number(a.year));
          }
        } else {
          for (const cfbdSeason of cfbdDefStats.seasons) {
            const existing = collegeStats.seasons.find((s: any) => s.year === cfbdSeason.year);
            if (existing) {
              for (const [key, value] of Object.entries(cfbdSeason.stats)) {
                if (existing.stats[key] === undefined) {
                  existing.stats[key] = value;
                }
              }
            }
          }
          for (const [key, value] of Object.entries(cfbdDefStats.careerTotals)) {
            if (collegeStats.careerTotals[key] === undefined) {
              collegeStats.careerTotals[key] = value;
            }
          }
        }
      }

      let headshot: string | null = null;
      if (espnProfile?.espnId) {
        headshot = getCollegePlayerHeadshotUrl(espnProfile.espnId);
      }

      const cfbdAdvanced = cfbdProfile ? {
        seasonStats: cfbdProfile.seasonStats,
        usage: cfbdProfile.usage ? {
          overall: cfbdProfile.usage.usage.overall,
          pass: cfbdProfile.usage.usage.pass,
          rush: cfbdProfile.usage.usage.rush,
          firstDown: cfbdProfile.usage.usage.firstDown,
          secondDown: cfbdProfile.usage.usage.secondDown,
          thirdDown: cfbdProfile.usage.usage.thirdDown,
          standardDowns: cfbdProfile.usage.usage.standardDowns,
          passingDowns: cfbdProfile.usage.usage.passingDowns,
        } : null,
        ppa: cfbdProfile.ppa ? {
          countablePlays: cfbdProfile.ppa.countablePlays,
          averagePPA: cfbdProfile.ppa.averagePPA,
          totalPPA: cfbdProfile.ppa.totalPPA,
        } : null,
      } : null;

      res.json({
        player: {
          ...player,
          headshot,
        },
        bio: espnProfile?.bio || null,
        collegeStats,
        cfbdAdvanced,
        espnId: espnProfile?.espnId || null,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching draft player profile:", error);
      res.status(500).json({ message: "Failed to fetch player profile" });
    }
  });

  // Get Dynasty Process NFL player values (for trade calculator enhancement)
  app.get("/api/sleeper/dynasty-process/values", isAuthenticated, async (req: any, res: Response) => {
    try {
      const devyDataSources = await import('./devy-data-sources');
      const values = await devyDataSources.getDynastyProcessNFLValues();
      
      res.json({
        players: values,
        count: values.length,
        fetchedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching Dynasty Process values:", error);
      res.status(500).json({ message: "Failed to fetch Dynasty Process values" });
    }
  });

  app.get("/api/sleeper/dynasty-process/ecr", isAuthenticated, async (req: any, res: Response) => {
    try {
      const devyDataSources = await import('./devy-data-sources');
      const format = (req.query.format === '2qb' ? '2qb' : '1qb') as '1qb' | '2qb';
      const rankings = await devyDataSources.getDynastyProcessECRRankings(format);
      
      res.json({
        rankings,
        format,
        count: rankings.length,
        source: 'Dynasty Process (FantasyPros ECR aggregation)',
        fetchedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching Dynasty Process ECR:", error);
      res.status(500).json({ message: "Failed to fetch ECR rankings" });
    }
  });

  app.get("/api/nfl/key-dates", async (_req: Request, res: Response) => {
    try {
      const keyDates = [
        { date: "2026-02-08", event: "Super Bowl LX", description: "Super Bowl LX at Levi's Stadium, Santa Clara", category: "postseason" },
        { date: "2026-02-16", event: "Franchise Tag Window Opens", description: "Teams can begin designating franchise/transition tags", category: "offseason" },
        { date: "2026-02-23", event: "NFL Combine Begins", description: "NFL Scouting Combine at Lucas Oil Stadium, Indianapolis", category: "draft" },
        { date: "2026-03-18", event: "Free Agency Begins", description: "New league year and free agency officially open", category: "offseason" },
        { date: "2026-04-23", event: "NFL Draft Round 1", description: "2026 NFL Draft begins in Pittsburgh, Pennsylvania", category: "draft" },
        { date: "2026-04-24", event: "NFL Draft Rounds 2-3", description: "Day 2 of the 2026 NFL Draft", category: "draft" },
        { date: "2026-04-25", event: "NFL Draft Rounds 4-7", description: "Final day of the 2026 NFL Draft", category: "draft" },
        { date: "2026-05-04", event: "Rookie Minicamp Window", description: "Teams can hold rookie minicamps", category: "offseason" },
        { date: "2026-06-15", event: "Mandatory Minicamp", description: "Teams hold mandatory minicamps", category: "offseason" },
        { date: "2026-07-21", event: "Training Camp Opens", description: "Veteran players report for training camp", category: "offseason" },
        { date: "2026-08-01", event: "Hall of Fame Game", description: "NFL preseason kicks off with Hall of Fame Game", category: "preseason" },
        { date: "2026-09-10", event: "Regular Season Kickoff", description: "2026 NFL regular season begins", category: "regular" },
        { date: "2026-09-11", event: "Sleeper Leagues Begin", description: "Fantasy football regular season starts", category: "fantasy" },
        { date: "2026-11-03", event: "NFL Trade Deadline", description: "Last day for in-season trades", category: "regular" },
        { date: "2026-11-26", event: "Thanksgiving Games", description: "Thanksgiving Day NFL games", category: "regular" },
        { date: "2026-12-21", event: "Fantasy Playoffs Begin", description: "Most fantasy leagues begin playoff rounds", category: "fantasy" },
        { date: "2027-01-03", event: "Regular Season Ends", description: "Final week of the 2026 regular season", category: "regular" },
        { date: "2027-01-09", event: "Wild Card Round", description: "NFL Playoff Wild Card Weekend", category: "postseason" },
        { date: "2027-01-16", event: "Divisional Round", description: "NFL Playoff Divisional Round", category: "postseason" },
        { date: "2027-01-24", event: "Conference Championships", description: "AFC and NFC Championship Games", category: "postseason" },
        { date: "2027-02-07", event: "Super Bowl LXI", description: "Super Bowl LXI at SoFi Stadium, Inglewood", category: "postseason" },
      ];
      res.json({ season: "2026-2027", dates: keyDates });
    } catch (error) {
      console.error("Error fetching key dates:", error);
      res.status(500).json({ message: "Failed to fetch key dates" });
    }
  });

  app.get("/api/nfl/schedule", async (req: Request, res: Response) => {
    try {
      const week = parseInt(req.query.week as string) || 1;
      const cacheKey = `nfl-schedule:${week}`;
      const cached = externalApiCache.get(cacheKey);
      if (cached) return res.json(cached);
      const season = 2026;
      const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${week}&dates=${season}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("ESPN API error");
      const data = await response.json() as any;
      
      const games = (data.events || []).map((event: any) => {
        const competition = event.competitions?.[0];
        const homeTeam = competition?.competitors?.find((c: any) => c.homeAway === "home");
        const awayTeam = competition?.competitors?.find((c: any) => c.homeAway === "away");
        const status = competition?.status;
        
        return {
          id: event.id,
          date: event.date,
          name: event.name || event.shortName,
          shortName: event.shortName,
          homeTeam: {
            name: homeTeam?.team?.displayName || "TBD",
            abbreviation: homeTeam?.team?.abbreviation || "TBD",
            logo: homeTeam?.team?.logo || "",
            score: homeTeam?.score || "0",
            record: homeTeam?.records?.[0]?.summary || "",
          },
          awayTeam: {
            name: awayTeam?.team?.displayName || "TBD",
            abbreviation: awayTeam?.team?.abbreviation || "TBD",
            logo: awayTeam?.team?.logo || "",
            score: awayTeam?.score || "0",
            record: awayTeam?.records?.[0]?.summary || "",
          },
          status: {
            completed: status?.type?.completed || false,
            inProgress: status?.type?.state === "in",
            detail: status?.type?.shortDetail || status?.type?.detail || "",
            period: status?.period || 0,
            clock: status?.displayClock || "",
          },
          broadcast: competition?.broadcasts?.[0]?.names?.[0] || "",
          venue: competition?.venue?.fullName || "",
        };
      });
      
      const responseData = { season, week, games };
      externalApiCache.set(cacheKey, responseData);
      res.json(responseData);
    } catch (error) {
      console.error("Error fetching NFL schedule:", error);
      res.status(500).json({ message: "Failed to fetch NFL schedule" });
    }
  });

  app.get("/api/nfl/standings", async (_req: Request, res: Response) => {
    try {
      const cacheKey = `nfl-standings`;
      const cached = externalApiCache.get(cacheKey);
      if (cached) return res.json(cached);
      const url = "https://site.api.espn.com/apis/v2/sports/football/nfl/standings?season=2026";
      const response = await fetch(url);
      if (!response.ok) throw new Error("ESPN API error");
      const data = await response.json() as any;
      
      const divisions: Array<{
        conference: string;
        division: string;
        teams: Array<{
          name: string;
          abbreviation: string;
          logo: string;
          wins: number;
          losses: number;
          ties: number;
          pct: string;
          pointsFor: number;
          pointsAgainst: number;
          streak: string;
          divisionRecord: string;
          conferenceRecord: string;
        }>;
      }> = [];
      
      for (const child of (data.children || [])) {
        const conference = child.abbreviation || child.name || "";
        for (const divChild of (child.children || [])) {
          const division = divChild.name || "";
          const teams = (divChild.standings?.entries || []).map((entry: any) => {
            const stats = entry.stats || [];
            const getStat = (name: string) => {
              const s = stats.find((st: any) => st.name === name || st.abbreviation === name);
              return s?.value || 0;
            };
            const getStatDisplay = (name: string) => {
              const s = stats.find((st: any) => st.name === name || st.abbreviation === name);
              return s?.displayValue || s?.value?.toString() || "0";
            };
            
            return {
              name: entry.team?.displayName || "",
              abbreviation: entry.team?.abbreviation || "",
              logo: entry.team?.logos?.[0]?.href || "",
              wins: getStat("wins"),
              losses: getStat("losses"),
              ties: getStat("ties"),
              pct: getStatDisplay("winPercent"),
              pointsFor: getStat("pointsFor"),
              pointsAgainst: getStat("pointsAgainst"),
              streak: getStatDisplay("streak"),
              divisionRecord: getStatDisplay("divisionRecord"),
              conferenceRecord: getStatDisplay("conferenceRecord"),
            };
          });
          
          divisions.push({ conference, division, teams });
        }
      }
      
      const responseData = { season: 2026, divisions };
      externalApiCache.set(cacheKey, responseData);
      res.json(responseData);
    } catch (error) {
      console.error("Error fetching NFL standings:", error);
      res.status(500).json({ message: "Failed to fetch NFL standings" });
    }
  });

  app.get("/api/nfl/stat-leaders", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { getStatLeaders } = await import('./nflverse-stats');
      const { getRedZoneQBLeaders, getRedZoneWRLeaders, getRedZoneRBLeaders, getRedZoneTELeaders, getAdvancedQBLeaders, getAdvancedWRLeaders, getAdvancedRBLeaders, getAdvancedTELeaders } = await import('./fantasypros-stats');
      const season = req.query.season ? parseInt(req.query.season as string) : undefined;
      const leaders = await getStatLeaders(season);
      leaders.categories.redzone = {
        ...getRedZoneQBLeaders(),
        ...getRedZoneWRLeaders(),
        ...getRedZoneRBLeaders(),
        ...getRedZoneTELeaders(),
      };
      leaders.categories.advanced = {
        ...getAdvancedQBLeaders(),
        ...getAdvancedWRLeaders(),
        ...getAdvancedRBLeaders(),
        ...getAdvancedTELeaders(),
      };
      res.json(leaders);
    } catch (error) {
      console.error("Error fetching stat leaders:", error);
      res.status(500).json({ message: "Failed to fetch NFL stat leaders" });
    }
  });

  app.get("/api/nflverse/stats", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { getNFLVerseStats } = await import('./nflverse-stats');
      const season = req.query.season ? parseInt(req.query.season as string) : undefined;
      const stats = await getNFLVerseStats(season);
      
      res.json({
        players: stats.season,
        count: stats.season.length,
        season: stats.seasonYear,
        fetchedAt: stats.fetchedAt.toISOString(),
        source: 'nflverse (open-source NFL data)'
      });
    } catch (error) {
      console.error("Error fetching nflverse stats:", error);
      res.status(500).json({ message: "Failed to fetch player stats" });
    }
  });

  app.get("/api/nflverse/stats/:playerName", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { getPlayerSeasonStats, getPlayerWeeklyStats } = await import('./nflverse-stats');
      const playerName = decodeURIComponent(req.params.playerName);
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const autoSeason = currentMonth < 8 ? currentYear - 1 : currentYear;
      const season = req.query.season ? parseInt(req.query.season as string) : autoSeason;
      const includeWeekly = req.query.weekly === 'true';

      const seasonStats = await getPlayerSeasonStats(playerName, season);
      const weeklyStats = includeWeekly ? await getPlayerWeeklyStats(playerName, season) : [];

      if (!seasonStats) {
        return res.status(404).json({ message: `No stats found for ${playerName}` });
      }

      res.json({
        season: seasonStats,
        weekly: weeklyStats,
        source: 'nflverse (open-source NFL data)'
      });
    } catch (error) {
      console.error("Error fetching player stats:", error);
      res.status(500).json({ message: "Failed to fetch player stats" });
    }
  });

  app.get("/api/nflverse/stats/:playerName/profile", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { getPlayerSeasonStats, getPlayerWeeklyStats } = await import('./nflverse-stats');
      const devyDataSources = await import('./devy-data-sources');
      const playerName = decodeURIComponent(req.params.playerName);

      const [seasonStats, weeklyStats, dpData] = await Promise.all([
        getPlayerSeasonStats(playerName),
        getPlayerWeeklyStats(playerName),
        devyDataSources.getDynastyProcessPlayerByName(playerName),
      ]);

      const dpValue1qb = dpData ? parseInt(dpData.value_1qb) || 0 : null;
      const dpValue2qb = dpData ? parseInt(dpData.value_2qb) || 0 : null;
      const dpEcr1qb = dpData ? parseFloat(dpData.ecr_1qb) || null : null;
      const dpEcr2qb = dpData ? parseFloat(dpData.ecr_2qb) || null : null;

      res.json({
        playerName,
        seasonStats,
        weeklyStats,
        dynastyProcess: dpData ? {
          value_1qb: dpValue1qb,
          value_2qb: dpValue2qb,
          ecr_1qb: dpEcr1qb,
          ecr_2qb: dpEcr2qb,
          ecr_pos: dpData.ecr_pos ? parseFloat(dpData.ecr_pos) : null,
          age: parseFloat(dpData.age) || null,
          team: dpData.team,
        } : null,
        sources: ['nflverse', 'Dynasty Process'],
      });
    } catch (error) {
      console.error("Error fetching player profile stats:", error);
      res.status(500).json({ message: "Failed to fetch player profile" });
    }
  });

  // === CFBD (College Football Data) API Routes ===
  
  app.get("/api/cfbd/player/:playerName", isAuthenticated, async (req: any, res: Response) => {
    try {
      const cfbd = await import('./cfbd-service');
      const playerName = decodeURIComponent(req.params.playerName);
      const team = req.query.team as string | undefined;
      const position = (req.query.position as string) || 'WR';

      const profile = await cfbd.getFullPlayerProfile(playerName, team || '', position);

      res.json({
        playerName,
        team,
        ...profile,
        source: 'College Football Data API',
      });
    } catch (error) {
      console.error("Error fetching CFBD player:", error);
      res.status(500).json({ message: "Failed to fetch college football data" });
    }
  });

  app.get("/api/cfbd/team/:team/stats", isAuthenticated, async (req: any, res: Response) => {
    try {
      const cfbd = await import('./cfbd-service');
      const team = decodeURIComponent(req.params.team);
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;

      const stats = await cfbd.getTeamPlayerStats(team, year);

      res.json({
        team,
        year,
        ...stats,
        source: 'College Football Data API',
      });
    } catch (error) {
      console.error("Error fetching CFBD team stats:", error);
      res.status(500).json({ message: "Failed to fetch team stats" });
    }
  });

  app.get("/api/cfbd/status", isAuthenticated, async (req: any, res: Response) => {
    try {
      const cfbd = await import('./cfbd-service');
      const status = cfbd.getCFBDCacheStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ message: "Failed to get CFBD status" });
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
      
      const cacheKey = `players:${leagueId || 'all'}:${yearParam || 'auto'}`;
      const cached = playersCache.get(cacheKey);
      if (cached) return res.json(cached);
      
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
      let league: any = null;
      
      if (leagueId) {
        league = await sleeperApi.getLeague(leagueId);
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
          consensusValue,
          0.5,
          dynastyEngine.parseLeagueRosterSettings(league)
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
      
      const responseData = {
        players: playersToReturn,
        totalCount: playersToReturn.length,
        season: statsSeason,
        scoringType: isCustomScoring ? `${scoringLabel} (custom)` : scoringLabel,
        isCustomScoring,
        isIDPLeague,
        lastUpdated: new Date().toISOString(),
      };
      playersCache.set(cacheKey, responseData);
      res.json(responseData);
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
      let league: any = null;
      if (leagueId) {
        league = await sleeperApi.getLeague(leagueId);
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
          consensusValue,
          0.5,
          dynastyEngine.parseLeagueRosterSettings(league)
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

      const [rosters, users, allPlayers, draftPicks, stats, league, drafts] = await Promise.all([
        sleeperApi.getLeagueRosters(leagueId),
        sleeperApi.getLeagueUsers(leagueId),
        sleeperApi.getAllPlayers(),
        sleeperApi.getLeagueDraftPicks(leagueId),
        sleeperApi.getSeasonStats("2025", "regular"),
        sleeperApi.getLeague(leagueId),
        sleeperApi.getLeagueDrafts(leagueId),
      ]);

      // Fetch consensus values for blended dynasty values
      try {
        await dynastyConsensusService.fetchAndCacheValues();
      } catch (e) {
        console.log(`[Trade Calculator] Failed to fetch consensus values: ${e}`);
      }

      // Check if league is Superflex/2QB
      const isSuperflex = dynastyEngine.isLeagueSuperflex(league);
      
      // Check if league is a startup (hasn't completed startup draft yet)
      const isStartup = dynastyEngine.isLeagueStartup(league, drafts);
      const startupRounds = isStartup ? dynastyEngine.getStartupRoundCount(league) : 0;

      if (!rosters || rosters.length === 0) {
        return res.json({ rosters: [] });
      }

      const userMap = new Map((users || []).map((u) => [u.user_id, u]));
      const playerData = allPlayers || {};
      const totalRosters = rosters.length;
      
      // Build draft slot maps for each season from actual draft data
      // Map: season -> (roster_id -> actual slot number 1-N)
      const draftSlotsBySeason = new Map<string, Map<number, number>>();
      for (const draft of drafts || []) {
        if (draft.slot_to_roster_id) {
          const seasonMap = new Map<number, number>();
          // slot_to_roster_id maps slot (1,2,3...) to roster_id
          for (const [slot, rosterId] of Object.entries(draft.slot_to_roster_id)) {
            // Coerce both to numbers for consistent Map lookups
            seasonMap.set(Number(rosterId), Number(slot));
          }
          draftSlotsBySeason.set(draft.season, seasonMap);
        } else if (draft.draft_order) {
          const seasonMap = new Map<number, number>();
          // draft_order maps user_id to slot - need to convert via roster
          const userToRoster = new Map((rosters || []).map(r => [r.owner_id, r.roster_id]));
          for (const [userId, slot] of Object.entries(draft.draft_order)) {
            const rosterId = userToRoster.get(userId);
            if (rosterId) {
              // Coerce slot to number for consistent math
              seasonMap.set(rosterId, Number(slot));
            }
          }
          draftSlotsBySeason.set(draft.season, seasonMap);
        }
      }
      
      // Helper: get pick position based on actual slot or default to "mid"
      const getPickPosition = (rosterId: number, season: string): "early" | "mid" | "late" => {
        const seasonSlots = draftSlotsBySeason.get(season);
        if (seasonSlots) {
          const slot = seasonSlots.get(rosterId);
          if (slot !== undefined) {
            // Use actual slot to determine position
            // Early = first 1/3, Mid = middle 1/3, Late = last 1/3
            const position = (slot - 1) / totalRosters;
            if (position < 0.33) return "early";
            if (position < 0.67) return "mid";
            return "late";
          }
        }
        // No actual slot found - default to "mid"
        return "mid";
      };
      
      // Get draft settings for snake/reversal logic
      const draftSettingsBySeason = new Map<string, { type: string; reversalRound: number; totalTeams: number }>();
      for (const draft of drafts || []) {
        draftSettingsBySeason.set(draft.season, {
          type: draft.type || "snake",
          reversalRound: draft.settings?.reversal_round || 1,
          totalTeams: draft.settings?.teams || totalRosters,
        });
      }

      // Helper: get actual slot display (e.g., "1.06") with snake/reversal awareness
      const getActualSlotDisplay = (rosterId: number, season: string, round: number): string | null => {
        const seasonSlots = draftSlotsBySeason.get(season);
        if (seasonSlots) {
          const slot = seasonSlots.get(rosterId);
          if (slot !== undefined) {
            const draftSettings = draftSettingsBySeason.get(season);
            const draftType = draftSettings?.type || "snake";
            const reversalRound = draftSettings?.reversalRound || 1;
            const teams = draftSettings?.totalTeams || totalRosters;

            if (draftType === "linear") {
              return `${round}.${slot.toString().padStart(2, '0')}`;
            }

            // Snake draft: compute actual pick position per round
            // Track direction through rounds (forward = ascending order)
            let forward = true;
            for (let r = 2; r <= round; r++) {
              if (r === reversalRound) {
                // Reversal round: direction stays the same (skip the flip)
              } else {
                // Normal snake: flip direction each round
                forward = !forward;
              }
            }

            const actualPick = forward ? slot : (teams - slot + 1);
            return `${round}.${actualPick.toString().padStart(2, '0')}`;
          }
        }
        return null;
      };

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
            consensusValue,
            0.5,
            dynastyEngine.parseLeagueRosterSettings(league)
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

        // Build pick ownership map from Sleeper's traded_picks endpoint
        // Note: Sleeper's /traded_picks returns CURRENT ownership state, not history
        // Each (season, round, roster_id) key maps to who CURRENTLY owns that pick
        // If a pick is not in this list, the original team (roster_id) still owns it
        const pickOwnershipMap = new Map<string, { owner_id: number; roster_id: number }>();
        for (const pick of draftPicks || []) {
          const key = `${pick.season}-${pick.round}-${pick.roster_id}`;
          pickOwnershipMap.set(key, { owner_id: pick.owner_id, roster_id: pick.roster_id });
        }

        // Get draft pick assets for this roster (picks acquired from trades)
        const picks: { id: string; name: string; type: "pick"; value: number; pickPosition?: string }[] = [];
        
        // Find all picks this roster currently owns (from trades)
        for (const [key, ownership] of Array.from(pickOwnershipMap.entries())) {
          if (ownership.owner_id === roster.roster_id && ownership.roster_id !== roster.roster_id) {
            // This is a pick from another team that this roster now owns
            const [season, roundStr, originalRosterId] = key.split("-");
            const round = parseInt(roundStr);
            const originalOwner = rosters.find((r) => r.roster_id === parseInt(originalRosterId));
            const originalOwnerUser = originalOwner ? userMap.get(originalOwner.owner_id) : null;
            // Use the ORIGINAL owner's actual slot to determine pick position (default to mid)
            const pickPosition = getPickPosition(parseInt(originalRosterId), season);
            const pickValue = dynastyEngine.getDraftPickValue(season, round, pickPosition);
            const ownerSuffix = originalOwnerUser?.display_name || originalOwnerUser?.username;
            // Use actual slot display if available (e.g., "1.06"), otherwise show position label
            const slotDisplay = getActualSlotDisplay(parseInt(originalRosterId), season, round);
            const pickLabel = slotDisplay || `${pickPosition.charAt(0).toUpperCase() + pickPosition.slice(1)} ${pickValue.displayName}`;
            picks.push({
              id: key,
              name: ownerSuffix ? `${pickLabel} (${ownerSuffix})` : pickLabel,
              type: "pick" as const,
              value: pickValue.value,
              pickPosition,
            });
          }
        }

        // Add draft picks based on league type
        const currentYear = new Date().getFullYear();
        const currentPicks = new Set(picks.map((p) => p.id));
        
        if (isStartup) {
          // Startup league: generate all startup draft rounds
          const totalStartupRounds = startupRounds || 25;
          const seasonSlots = draftSlotsBySeason.get(String(currentYear));
          const baseSlot = seasonSlots?.get(roster.roster_id);
          const draftSettings = draftSettingsBySeason.get(String(currentYear));
          
          for (let round = 1; round <= totalStartupRounds; round++) {
            const id = `startup-${round}-${roster.roster_id}`;
            if (!currentPicks.has(id)) {
              // For snake drafts, pick position changes each round
              let thisPickPosition = getPickPosition(roster.roster_id, String(currentYear));
              if (baseSlot !== undefined && draftSettings && draftSettings.type === "snake") {
                // Determine if this round is forward or reversed
                let forward = true;
                for (let r = 2; r <= round; r++) {
                  if (r === draftSettings.reversalRound) {
                    // Reversal round: skip the flip
                  } else {
                    forward = !forward;
                  }
                }
                const actualPick = forward ? baseSlot : (draftSettings.totalTeams - baseSlot + 1);
                const position = (actualPick - 1) / draftSettings.totalTeams;
                thisPickPosition = position < 0.33 ? "early" : position < 0.67 ? "mid" : "late";
              }
              
              const pickValue = dynastyEngine.getStartupDraftPickValue(round, thisPickPosition);
              const slotDisplay = getActualSlotDisplay(roster.roster_id, String(currentYear), round);
              const pickLabel = slotDisplay || `${thisPickPosition.charAt(0).toUpperCase() + thisPickPosition.slice(1)} ${pickValue.displayName}`;
              picks.push({
                id,
                name: pickLabel,
                type: "pick" as const,
                value: pickValue.value,
                pickPosition: thisPickPosition,
              });
            }
          }
          // Also add future rookie picks (next 2 years, rounds 1-4)
          [String(currentYear + 1), String(currentYear + 2)].forEach((season) => {
            [1, 2, 3, 4].forEach((round) => {
              const id = `${season}-${round}-${roster.roster_id}`;
              const ownership = pickOwnershipMap.get(id);
              const tradedAway = ownership && ownership.owner_id !== roster.roster_id;
              if (!currentPicks.has(id) && !tradedAway) {
                const thisPickPosition = getPickPosition(roster.roster_id, season);
                const pickValue = dynastyEngine.getDraftPickValue(season, round, thisPickPosition);
                const slotDisplay = getActualSlotDisplay(roster.roster_id, season, round);
                const pickLabel = slotDisplay || `${thisPickPosition.charAt(0).toUpperCase() + thisPickPosition.slice(1)} ${pickValue.displayName}`;
                picks.push({
                  id,
                  name: pickLabel,
                  type: "pick" as const,
                  value: pickValue.value,
                  pickPosition: thisPickPosition,
                });
              }
            });
          });
        } else {
          // Established league: standard rookie picks (current year + 2 years, rounds 1-4)
          // A roster owns their own pick UNLESS it's been traded away (owner_id !== roster.roster_id)
          [String(currentYear), String(currentYear + 1), String(currentYear + 2)].forEach((season) => {
            [1, 2, 3, 4].forEach((round) => {
              const id = `${season}-${round}-${roster.roster_id}`;
              // Check if this roster's own pick has been traded away
              const ownership = pickOwnershipMap.get(id);
              const tradedAway = ownership && ownership.owner_id !== roster.roster_id;
              if (!currentPicks.has(id) && !tradedAway) {
                // Get pick position from actual slot or default to mid
                const thisPickPosition = getPickPosition(roster.roster_id, season);
                const pickValue = dynastyEngine.getDraftPickValue(season, round, thisPickPosition);
                // Use actual slot display if available (e.g., "1.06"), otherwise show position label
                const slotDisplay = getActualSlotDisplay(roster.roster_id, season, round);
                const pickLabel = slotDisplay || `${thisPickPosition.charAt(0).toUpperCase() + thisPickPosition.slice(1)} ${pickValue.displayName}`;
                picks.push({
                  id,
                  name: pickLabel,
                  type: "pick" as const,
                  value: pickValue.value,
                  pickPosition: thisPickPosition,
                });
              }
            });
          });
        }

        return {
          rosterId: roster.roster_id,
          ownerId: roster.owner_id,
          ownerName: user?.display_name || user?.username || "Unknown",
          players: players.sort((a: any, b: any) => b.value - a.value),
          picks: picks.sort((a, b) => b.value - a.value),
        };
      });

      const startupDraft = isStartup ? (drafts || []).find(d => d.settings?.player_type === 0 || d.settings?.rounds >= 15) : null;
      res.json({ 
        rosters: rostersWithAssets, 
        isStartup, 
        startupRounds: isStartup ? startupRounds : undefined,
        draftType: startupDraft?.type || "snake",
        reversalRound: startupDraft?.settings?.reversal_round || 1,
      });
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

      const [rosters, users, allPlayers, draftPicks, league, stats, drafts] = await Promise.all([
        sleeperApi.getLeagueRosters(leagueId),
        sleeperApi.getLeagueUsers(leagueId),
        sleeperApi.getAllPlayers(),
        sleeperApi.getLeagueDraftPicks(leagueId),
        sleeperApi.getLeague(leagueId),
        sleeperApi.getSeasonStats("2025", "regular"),
        sleeperApi.getLeagueDrafts(leagueId),
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
      const totalTeams = rosters.length;
      
      // Build draft slot maps for each season from actual draft data
      const draftSlotsBySeason = new Map<string, Map<number, number>>();
      for (const draft of drafts || []) {
        if (draft.slot_to_roster_id) {
          const seasonMap = new Map<number, number>();
          for (const [slot, rostId] of Object.entries(draft.slot_to_roster_id)) {
            // Coerce both to numbers for consistent Map lookups
            seasonMap.set(Number(rostId), Number(slot));
          }
          draftSlotsBySeason.set(draft.season, seasonMap);
        } else if (draft.draft_order) {
          const seasonMap = new Map<number, number>();
          const userToRoster = new Map((rosters || []).map(r => [r.owner_id, r.roster_id]));
          for (const [userId, slot] of Object.entries(draft.draft_order)) {
            const rostId = userToRoster.get(userId);
            if (rostId) {
              // Coerce slot to number for consistent math
              seasonMap.set(rostId, Number(slot));
            }
          }
          draftSlotsBySeason.set(draft.season, seasonMap);
        }
      }
      
      // Helper: get pick position based on actual slot or default to "mid"
      const getPickPos = (rostId: number, season: string): "early" | "mid" | "late" => {
        const seasonSlots = draftSlotsBySeason.get(season);
        if (seasonSlots) {
          const slot = seasonSlots.get(rostId);
          if (slot !== undefined) {
            const position = (slot - 1) / totalTeams;
            if (position < 0.33) return "early";
            if (position < 0.67) return "mid";
            return "late";
          }
        }
        return "mid";
      };
      
      // Get draft settings for snake/reversal logic
      const draftSettingsBySeason2 = new Map<string, { type: string; reversalRound: number; totalTeams: number }>();
      for (const draft of drafts || []) {
        draftSettingsBySeason2.set(draft.season, {
          type: draft.type || "snake",
          reversalRound: draft.settings?.reversal_round || 1,
          totalTeams: draft.settings?.teams || totalTeams,
        });
      }

      // Helper: get actual slot display (e.g., "1.06") with snake/reversal awareness
      const getSlotDisplay = (rostId: number, season: string, round: number): string | null => {
        const seasonSlots = draftSlotsBySeason.get(season);
        if (seasonSlots) {
          const slot = seasonSlots.get(rostId);
          if (slot !== undefined) {
            const ds = draftSettingsBySeason2.get(season);
            const draftType = ds?.type || "snake";
            const reversalRound = ds?.reversalRound || 1;
            const teams = ds?.totalTeams || totalTeams;

            if (draftType === "linear") {
              return `${round}.${slot.toString().padStart(2, '0')}`;
            }

            let forward = true;
            for (let r = 2; r <= round; r++) {
              if (r === reversalRound) {
                // skip flip
              } else {
                forward = !forward;
              }
            }
            const actualPick = forward ? slot : (teams - slot + 1);
            return `${round}.${actualPick.toString().padStart(2, '0')}`;
          }
        }
        return null;
      };

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
          consensusValue,
          0.5,
          dynastyEngine.parseLeagueRosterSettings(league)
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

      // Build pick ownership map from Sleeper's traded_picks endpoint
      // Note: Sleeper's /traded_picks returns CURRENT ownership state, not history
      // Each (season, round, roster_id) key maps to who CURRENTLY owns that pick
      // If a pick is not in this list, the original team (roster_id) still owns it
      const pickOwnershipMap = new Map<string, { owner_id: number; roster_id: number }>();
      for (const pick of draftPicks || []) {
        const key = `${pick.season}-${pick.round}-${pick.roster_id}`;
        pickOwnershipMap.set(key, { owner_id: pick.owner_id, roster_id: pick.roster_id });
      }
      
      const picks: any[] = [];
      const currentYear = new Date().getFullYear();
      
      // Generate picks for next 3 years
      for (let season = currentYear; season <= currentYear + 2; season++) {
        const seasonStr = String(season);
        for (let round = 1; round <= 5; round++) {
          const id = `${season}-${round}-${rosterIdNum}`;
          
          // Check if this roster's OWN pick has been traded away
          const ownership = pickOwnershipMap.get(id);
          const ownPickTradedAway = ownership && ownership.owner_id !== rosterIdNum;

          // Add own pick if not traded away
          if (!ownPickTradedAway) {
            const pickPosition = getPickPos(rosterIdNum, seasonStr);
            const ownPickValue = dynastyEngine.getDraftPickValue(seasonStr, round, pickPosition);
            // Use actual slot display if available (e.g., "1.06"), otherwise show position label
            const slotDisplay = getSlotDisplay(rosterIdNum, seasonStr, round);
            const pickLabel = slotDisplay || `${pickPosition.charAt(0).toUpperCase() + pickPosition.slice(1)} ${season} Round ${round}`;
            picks.push({
              id,
              name: pickLabel,
              season: seasonStr,
              round,
              isOwn: true,
              value: ownPickValue.value,
              pickPosition,
            });
          }
        }
      }
      
      // Add acquired picks from other teams (deduplicated via Map)
      for (const [key, ownership] of Array.from(pickOwnershipMap.entries())) {
        if (ownership.owner_id === rosterIdNum && ownership.roster_id !== rosterIdNum) {
          const [seasonStr, roundStr, originalRosterId] = key.split("-");
          const round = parseInt(roundStr);
          const originalOwner = rosters.find((r) => r.roster_id === parseInt(originalRosterId));
          const originalUser = originalOwner ? userMap.get(originalOwner.owner_id) : null;
          // Use the ORIGINAL owner's actual slot or default to mid
          const origPickPos = getPickPos(parseInt(originalRosterId), seasonStr);
          const tradedPickValue = dynastyEngine.getDraftPickValue(seasonStr, round, origPickPos);
          // Use actual slot display if available (e.g., "1.06"), otherwise show position label
          const slotDisplay = getSlotDisplay(parseInt(originalRosterId), seasonStr, round);
          const pickLabel = slotDisplay || `${origPickPos.charAt(0).toUpperCase() + origPickPos.slice(1)} ${seasonStr} Round ${round}`;
          picks.push({
            id: key,
            name: `${pickLabel} (from ${originalUser?.display_name || "Unknown"})`,
            season: seasonStr,
            round,
            originalOwner: originalUser?.display_name || "Unknown",
            isOwn: false,
            value: tradedPickValue.value,
            pickPosition: origPickPos,
          });
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

  // Analyze trade (Premium)
  app.post("/api/trade/analyze", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
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
        const teamAAssetNames = teamAAssets.map((a: any) => a.name).join(", ");
        const teamBAssetNames = teamBAssets.map((a: any) => a.name).join(", ");

        // Clearly explain the trade direction to avoid AI confusion
        const winnerName = adjustmentResult.winner === "A" ? teamADisplayName : 
                          adjustmentResult.winner === "B" ? teamBDisplayName : null;
        const loserName = adjustmentResult.winner === "A" ? teamBDisplayName : 
                         adjustmentResult.winner === "B" ? teamADisplayName : null;

        const prompt = `Analyze this fantasy football dynasty trade between ${teamADisplayName} and ${teamBDisplayName}:

THE TRADE:
• ${teamADisplayName} is GIVING UP: ${teamAAssetNames || "Nothing"} (total value: ${Math.round(adjustmentResult.teamA.adjustedTotal)})
• ${teamBDisplayName} is GIVING UP: ${teamBAssetNames || "Nothing"} (total value: ${Math.round(adjustmentResult.teamB.adjustedTotal)})

This means:
• ${teamADisplayName} RECEIVES: ${teamBAssetNames || "Nothing"}
• ${teamBDisplayName} RECEIVES: ${teamAAssetNames || "Nothing"}

WINNER: ${adjustmentResult.isFair ? "Trade is fair (within 5% difference)" : `${winnerName} wins this trade by ${Math.abs(adjustmentResult.fairnessPercent).toFixed(1)}% because they RECEIVE more value than they GIVE UP.`}

IMPORTANT: Do NOT confuse the assets. ${teamADisplayName} is RECEIVING ${teamBAssetNames || "nothing"}, NOT giving those up. ${teamBDisplayName} is RECEIVING ${teamAAssetNames || "nothing"}, NOT giving those up.

Provide a brief 2-3 sentence analysis explaining who wins and why, being specific about what each team is actually RECEIVING. Use owner names "${teamADisplayName}" and "${teamBDisplayName}".`;

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

      let tradeContext: any = null;
      try {
        const [allRosters, allPlayersData] = await Promise.all([
          sleeperApi.getLeagueRosters(leagueId),
          sleeperApi.getAllPlayers(),
        ]);
        const league = await sleeperApi.getLeague(leagueId);
        const isSuperflex = dynastyEngine.isLeagueSuperflex(league);

        try {
          await dynastyConsensusService.fetchAndCacheValues();
        } catch (e) {
          console.log(`[Trade Context] Failed to fetch consensus values: ${e}`);
        }

        const playerData = allPlayersData || {};

        const PEAK_ENDS: Record<string, number> = { QB: 32, RB: 27, WR: 29, TE: 30, DL: 30, LB: 29, DB: 28 };

        const getPlayerAge = (playerId: string): number | null => {
          const p = playerData[playerId];
          return p?.age || null;
        };

        const getPlayerPosition = (playerId: string): string => {
          const p = playerData[playerId];
          return p?.fantasy_positions?.[0] || p?.position || "WR";
        };

        const getPlayerName = (playerId: string): string => {
          const p = playerData[playerId];
          return p?.full_name || playerId;
        };

        const getPlayerValue = (playerId: string): number => {
          const p = playerData[playerId];
          if (!p) return 0;
          const position = p.fantasy_positions?.[0] || p.position || "WR";
          const age = p.age || 25;
          const yearsExp = p.years_exp || 0;
          const playerName = p.full_name || playerId;
          const consensusValue = dynastyConsensusService.getNormalizedValue(playerName, position, isSuperflex);
          const rosterSettings = dynastyEngine.parseLeagueRosterSettings(league);
          const valueResult = dynastyEngine.getBlendedPlayerValue(
            playerId, playerName, position, age, yearsExp,
            p.injury_status, {}, null, null, consensusValue, 0.5, rosterSettings
          );
          return valueResult.value;
        };

        const buildTeamProfile = (ownerId: string) => {
          const roster = allRosters?.find((r: any) => r.owner_id === ownerId);
          if (!roster || !roster.players) return null;

          const rosterPlayers = roster.players
            .map((pid: string) => ({
              id: pid,
              name: getPlayerName(pid),
              age: getPlayerAge(pid),
              position: getPlayerPosition(pid),
              value: getPlayerValue(pid),
            }))
            .sort((a: any, b: any) => b.value - a.value);

          const top10 = rosterPlayers.slice(0, 10);
          const studs = rosterPlayers.filter((p: any) => p.value >= 7000).length;
          const agesOfTop10 = top10.filter((p: any) => p.age !== null).map((p: any) => p.age as number);
          const avgAge = agesOfTop10.length > 0 ? agesOfTop10.reduce((s: number, a: number) => s + a, 0) / agesOfTop10.length : 26;

          let profile: "contender" | "rebuilder" | "balanced" = "balanced";
          if (avgAge >= 27 && studs >= 4) profile = "contender";
          else if (avgAge <= 25 || studs <= 2) profile = "rebuilder";

          let totalWeightedYears = 0;
          let totalWeight = 0;
          for (const p of top10) {
            if (p.age === null || p.value <= 0) continue;
            const peakEnd = PEAK_ENDS[p.position] || 29;
            const yearsLeft = Math.max(0, peakEnd - p.age);
            totalWeightedYears += yearsLeft * p.value;
            totalWeight += p.value;
          }
          const windowYears = totalWeight > 0 ? Math.round(totalWeightedYears / totalWeight) : 2;
          let windowStrength: "Strong" | "Moderate" | "Closing" = "Moderate";
          if (windowYears >= 3) windowStrength = "Strong";
          else if (windowYears <= 1) windowStrength = "Closing";

          return { profile, windowYears, windowStrength, avgStarterAge: Math.round(avgAge * 10) / 10, studs, top10 };
        };

        const teamAProfile = buildTeamProfile(teamAId);
        const teamBProfile = buildTeamProfile(teamBId);

        const computeGrades = (
          receivedAssets: any[],
          teamProfile: any
        ) => {
          const players = receivedAssets.filter((a: any) => a.type === "player");
          const picks = receivedAssets.filter((a: any) => a.type === "pick");
          const totalValueReceived = receivedAssets.reduce((s: number, a: any) => s + a.value, 0);

          const winNowPlayers = players.filter((p: any) => {
            const age = getPlayerAge(p.id);
            return age !== null && age >= 24 && age <= 29 && p.value >= 5000;
          });

          const youngPlayers = players.filter((p: any) => {
            const age = getPlayerAge(p.id);
            return age !== null && age < 25;
          });

          let contenderScore = 0;
          contenderScore += totalValueReceived / 1000;
          contenderScore += winNowPlayers.length * 3;
          contenderScore += players.filter((p: any) => p.value >= 7000).length * 2;

          let rebuilderScore = 0;
          rebuilderScore += youngPlayers.length * 4;
          rebuilderScore += picks.length * 3;
          rebuilderScore += players.filter((p: any) => {
            const age = getPlayerAge(p.id);
            return age !== null && age < 23;
          }).length * 2;
          rebuilderScore += totalValueReceived / 2000;

          const gradeFromScore = (score: number): string => {
            if (score >= 18) return "A+";
            if (score >= 15) return "A";
            if (score >= 12) return "A-";
            if (score >= 10) return "B+";
            if (score >= 8) return "B";
            if (score >= 6) return "B-";
            if (score >= 4) return "C+";
            if (score >= 3) return "C";
            if (score >= 2) return "D";
            return "F";
          };

          const contenderReasons: string[] = [];
          const rebuilderReasons: string[] = [];

          if (winNowPlayers.length >= 2) contenderReasons.push("Adds multiple win-now pieces");
          else if (winNowPlayers.length === 1) contenderReasons.push("Adds a win-now contributor");
          if (totalValueReceived >= 15000) contenderReasons.push("Massive value injection for competing");
          else if (totalValueReceived >= 8000) contenderReasons.push("Adds significant roster value");
          if (players.some((p: any) => p.value >= 8000)) contenderReasons.push("Acquires a cornerstone player");
          if (picks.length > 0) contenderReasons.push("Gives up future capital for present upside");
          if (players.filter((p: any) => { const a = getPlayerAge(p.id); return a && a > 29; }).length > 0) contenderReasons.push("Aging assets have limited shelf life");

          if (youngPlayers.length >= 2) rebuilderReasons.push("Acquires multiple young building blocks");
          else if (youngPlayers.length === 1) rebuilderReasons.push("Adds a young upside player");
          if (picks.length >= 2) rebuilderReasons.push("Stockpiles future draft capital");
          else if (picks.length === 1) rebuilderReasons.push("Adds a future draft pick");
          if (players.some((p: any) => { const a = getPlayerAge(p.id); return a && a < 23 && p.value >= 5000; })) rebuilderReasons.push("Acquires youth at a premium value");
          if (winNowPlayers.length === 0 && players.length > 0) rebuilderReasons.push("No immediate win-now pieces acquired");
          if (totalValueReceived >= 10000 && youngPlayers.length > 0) rebuilderReasons.push("Strong long-term value accumulation");

          return {
            contenderGrade: gradeFromScore(contenderScore),
            rebuilderGrade: gradeFromScore(rebuilderScore),
            contenderReasons: contenderReasons.slice(0, 4),
            rebuilderReasons: rebuilderReasons.slice(0, 4),
          };
        };

        const teamAReceives = teamBAssets;
        const teamBReceives = teamAAssets;

        const teamAGrades = computeGrades(teamAReceives, teamAProfile);
        const teamBGrades = computeGrades(teamBReceives, teamBProfile);

        const psychologyInsights: string[] = [];

        const getAvgAge = (assets: any[]): number | null => {
          const players = assets.filter((a: any) => a.type === "player");
          const ages = players.map((p: any) => getPlayerAge(p.id)).filter((a: any): a is number => a !== null);
          return ages.length > 0 ? ages.reduce((s, a) => s + a, 0) / ages.length : null;
        };

        const avgAgeA = getAvgAge(teamAAssets);
        const avgAgeB = getAvgAge(teamBAssets);
        if (avgAgeA !== null && avgAgeB !== null && Math.abs(avgAgeA - avgAgeB) >= 2) {
          const olderSide = avgAgeA > avgAgeB ? teamADisplayName : teamBDisplayName;
          const youngerSide = avgAgeA > avgAgeB ? teamBDisplayName : teamADisplayName;
          psychologyInsights.push(`${olderSide} is trading production for youth from ${youngerSide}`);
        }

        if (teamAAssets.length >= 3 && teamBAssets.length <= 1) {
          psychologyInsights.push(`${teamBDisplayName} is consolidating assets into fewer elite pieces`);
        } else if (teamBAssets.length >= 3 && teamAAssets.length <= 1) {
          psychologyInsights.push(`${teamADisplayName} is consolidating assets into fewer elite pieces`);
        } else if (teamAAssets.length >= teamBAssets.length + 2) {
          psychologyInsights.push(`${teamADisplayName} is diversifying risk across more pieces`);
        } else if (teamBAssets.length >= teamAAssets.length + 2) {
          psychologyInsights.push(`${teamBDisplayName} is diversifying risk across more pieces`);
        }

        const maxValueA = teamAAssets.length > 0 ? Math.max(...teamAAssets.map(a => a.value)) : 0;
        const maxValueB = teamBAssets.length > 0 ? Math.max(...teamBAssets.map(a => a.value)) : 0;
        if (maxValueA >= 7000 && teamAAssets.length <= 2) {
          psychologyInsights.push(`This trade increases roster fragility for ${teamADisplayName} by moving a cornerstone player`);
        }
        if (maxValueB >= 7000 && teamBAssets.length <= 2) {
          psychologyInsights.push(`This trade increases roster fragility for ${teamBDisplayName} by moving a cornerstone player`);
        }

        const getReceivedPositions = (assets: any[]): Record<string, number> => {
          const counts: Record<string, number> = {};
          for (const a of assets) {
            if (a.type === "player" && a.position) {
              counts[a.position] = (counts[a.position] || 0) + 1;
            }
          }
          return counts;
        };

        const teamAReceivedPos = getReceivedPositions(teamBAssets);
        const teamBReceivedPos = getReceivedPositions(teamAAssets);
        for (const [pos, count] of Object.entries(teamAReceivedPos)) {
          if (count >= 2) psychologyInsights.push(`${teamADisplayName} increases their ${pos} concentration`);
        }
        for (const [pos, count] of Object.entries(teamBReceivedPos)) {
          if (count >= 2) psychologyInsights.push(`${teamBDisplayName} increases their ${pos} concentration`);
        }

        const marketGaps: any[] = [];
        const allTradeAssets = [
          ...teamAAssets.map((a: any) => ({ ...a, side: "A" as const })),
          ...teamBAssets.map((a: any) => ({ ...a, side: "B" as const })),
        ];

        for (const asset of allTradeAssets) {
          if (asset.type !== "player") continue;
          const position = asset.position || getPlayerPosition(asset.id);
          const consensusValue = dynastyConsensusService.getNormalizedValue(asset.name, position, isSuperflex);
          if (consensusValue === null) continue;

          const dynastyValue = asset.value;
          const gapPercent = dynastyValue > 0 ? ((dynastyValue - consensusValue) / consensusValue) * 100 : 0;

          let label = "Fair value";
          if (gapPercent > 15) label = "Undervalued by league";
          else if (gapPercent < -15) label = "Overvalued by league";

          let momentumLabel: string | undefined;
          const valueDiffRatio = dynastyValue > 0 && consensusValue > 0 ? dynastyValue / consensusValue : 1;
          if (valueDiffRatio > 1.3) momentumLabel = "Hype exceeds production";
          else if (valueDiffRatio < 0.7) momentumLabel = "Production exceeds hype";

          marketGaps.push({
            playerName: asset.name,
            position,
            side: asset.side,
            dynastyValue,
            ecrValue: consensusValue,
            gapPercent: Math.round(gapPercent * 10) / 10,
            label,
            momentumLabel,
          });
        }

        tradeContext = {
          teamA: {
            profile: teamAProfile?.profile || "balanced",
            windowYears: teamAProfile?.windowYears || 2,
            windowStrength: teamAProfile?.windowStrength || "Moderate",
            avgStarterAge: teamAProfile?.avgStarterAge || 26,
            ...teamAGrades,
          },
          teamB: {
            profile: teamBProfile?.profile || "balanced",
            windowYears: teamBProfile?.windowYears || 2,
            windowStrength: teamBProfile?.windowStrength || "Moderate",
            avgStarterAge: teamBProfile?.avgStarterAge || 26,
            ...teamBGrades,
          },
          psychologyInsights,
          marketGaps,
        };
      } catch (contextError) {
        console.error("Trade context computation error:", contextError);
        tradeContext = null;
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
        winner: adjustmentResult.winner,
        fairnessPercent: adjustmentResult.fairnessPercent,
        isFair: adjustmentResult.isFair,
        aiAnalysis,
        tradeContext,
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
            consensusValue,
            0.5,
            dynastyEngine.parseLeagueRosterSettings(league)
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
      const completedSeasons = leagueHistory.filter(h => h.status === "complete" || h.status === "in_season");

      res.json({
        seasonTrades,
        teamStats: Array.from(teamStats.values()),
        leagueHistory: completedSeasons.map(h => h.season),
        currentSeason: league?.season || "2025",
        bestTrades: bestTradesWithAnalysis,
        totalTrades: allTrades.length,
      });
    } catch (error) {
      console.error("Error fetching trades:", error);
      res.status(500).json({ message: "Failed to fetch trade history" });
    }
  });

  // Get trophy room data (Premium)
  app.get("/api/sleeper/trophies/:leagueId", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
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

      const completedHistory = leagueHistory.filter(h => h.status === "complete" || h.status === "in_season");
      const bracketPromises = completedHistory.map(async (h) => {
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

  // Rivalry Head-to-Head Records (Premium) - with in-memory cache
  const rivalryCache = new Map<string, { data: any; timestamp: number }>();
  const RIVALRY_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  app.get("/api/sleeper/rivalries/:leagueId", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;

      const cached = rivalryCache.get(leagueId);
      if (cached && Date.now() - cached.timestamp < RIVALRY_CACHE_TTL) {
        return res.json(cached.data);
      }
      
      const league = await sleeperApi.getLeague(leagueId);
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      const allLeagueHistory = await sleeperApi.getLeagueHistory(leagueId);
      const leagueHistory = allLeagueHistory.filter(h => h.status === "complete" || h.status === "in_season");
      
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
      const seasonsWithMatchups = new Set<string>();
      
      const seasonDataResults = await Promise.all(
        leagueHistory.map(async (historyEntry) => {
          const [rosters, users, seasonLeague] = await Promise.all([
            sleeperApi.getLeagueRosters(historyEntry.leagueId),
            sleeperApi.getLeagueUsers(historyEntry.leagueId),
            sleeperApi.getLeague(historyEntry.leagueId),
          ]);
          return { historyEntry, rosters, users, seasonLeague };
        })
      );

      for (const { historyEntry, rosters, users, seasonLeague } of seasonDataResults) {
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

        const weekNumbers = Array.from({ length: regularSeasonWeeks }, (_, i) => i + 1);
        const allWeekMatchups = await Promise.all(
          weekNumbers.map(week => sleeperApi.getMatchups(historyEntry.leagueId, week).then(m => ({ week, matchups: m })))
        );

        for (const { week, matchups } of allWeekMatchups) {
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
            seasonsWithMatchups.add(historyEntry.season);
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

      const playedSeasons = leagueHistory
        .filter(h => seasonsWithMatchups.has(h.season))
        .map(h => h.season)
        .sort((a, b) => b.localeCompare(a));

      const responseData = {
        rivalries,
        teamRecords,
        leagueName: league.name,
        totalSeasons: playedSeasons.length,
        seasons: playedSeasons,
      };
      rivalryCache.set(leagueId, { data: responseData, timestamp: Date.now() });
      res.json(responseData);
    } catch (error) {
      console.error("Error fetching rivalries:", error);
      res.status(500).json({ message: "Failed to fetch rivalry data" });
    }
  });

  // ============================================
  // NOTIFICATIONS & REAL-TIME UPDATES
  // ============================================

  async function verifyUserInLeague(userId: string, leagueId: string): Promise<boolean> {
    try {
      const profile = await storage.getUserProfile(userId);
      if (!profile?.sleeperUserId) return false;
      
      const leagues = await getAllUserLeagues(profile.sleeperUserId);
      return leagues?.some(l => l.league_id === leagueId) || false;
    } catch {
      return false;
    }
  }

  // Get notifications for a league
  // Notification preferences - MUST be before :leagueId routes to avoid collision
  const notifPrefsSchema = z.object({
    trades: z.boolean().optional(),
    waivers: z.boolean().optional(),
    injuries: z.boolean().optional(),
    scoringUpdates: z.boolean().optional(),
    freeAgents: z.boolean().optional(),
    draftPicks: z.boolean().optional(),
    leagueAnnouncements: z.boolean().optional(),
  });

  app.get("/api/notifications/preferences", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const prefs = await db
        .select()
        .from(schema.notificationPreferences)
        .where(eq(schema.notificationPreferences.userId, userId))
        .limit(1);

      if (prefs.length === 0) {
        const defaults = {
          userId,
          trades: true,
          waivers: true,
          injuries: true,
          scoringUpdates: true,
          freeAgents: true,
          draftPicks: true,
          leagueAnnouncements: true,
        };
        const created = await db.insert(schema.notificationPreferences).values(defaults).returning();
        return res.json(created[0]);
      }

      res.json(prefs[0]);
    } catch (error) {
      console.error("Error fetching notification preferences:", error);
      res.status(500).json({ message: "Failed to fetch preferences" });
    }
  });

  app.put("/api/notifications/preferences", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = notifPrefsSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid preferences" });

      const existing = await db
        .select()
        .from(schema.notificationPreferences)
        .where(eq(schema.notificationPreferences.userId, userId))
        .limit(1);

      if (existing.length === 0) {
        const created = await db.insert(schema.notificationPreferences).values({
          userId,
          ...parsed.data,
        }).returning();
        return res.json(created[0]);
      }

      const updated = await db
        .update(schema.notificationPreferences)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(schema.notificationPreferences.userId, userId))
        .returning();

      res.json(updated[0]);
    } catch (error) {
      console.error("Error updating notification preferences:", error);
      res.status(500).json({ message: "Failed to update preferences" });
    }
  });

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

  // Fantasy News Feed - Real news from sports sources, personalized to user's roster (Premium)
  app.get("/api/fantasy/news", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
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

  // Multi-season trend analysis cache
  let multiSeasonCache: { data: any; time: number; seasons: number[] } | null = null;
  const MULTI_SEASON_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  async function getMultiSeasonData() {
    const now = Date.now();
    if (multiSeasonCache && now - multiSeasonCache.time < MULTI_SEASON_CACHE_TTL) {
      return multiSeasonCache;
    }

    const allPlayers = await sleeperApi.getAllPlayers();
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const latestSeason = currentMonth < 3 ? currentYear - 1 : currentYear;
    const seasons = [latestSeason - 4, latestSeason - 3, latestSeason - 2, latestSeason - 1, latestSeason];

    const seasonStatsMap: Record<number, any> = {};
    await Promise.all(seasons.map(async (season) => {
      try {
        const stats = await sleeperApi.getSeasonStats(String(season), "regular");
        seasonStatsMap[season] = stats || {};
      } catch {
        seasonStatsMap[season] = {};
      }
    }));

    const positionRanksBySeason: Record<number, Record<string, Array<{ id: string; ppg: number }>>> = {};
    for (const season of seasons) {
      const stats = seasonStatsMap[season];
      const byPos: Record<string, Array<{ id: string; ppg: number }>> = {};
      for (const [pid, pStats] of Object.entries(stats)) {
        const player = allPlayers[pid];
        if (!player || !["QB", "RB", "WR", "TE"].includes(player.position)) continue;
        const gp = (pStats as any).gp || 0;
        const pts = (pStats as any).pts_ppr || 0;
        if (gp < 4) continue;
        const pos = player.position;
        if (!byPos[pos]) byPos[pos] = [];
        byPos[pos].push({ id: pid, ppg: pts / gp });
      }
      for (const pos of Object.keys(byPos)) {
        byPos[pos].sort((a, b) => b.ppg - a.ppg);
      }
      positionRanksBySeason[season] = byPos;
    }

    multiSeasonCache = {
      data: { allPlayers, seasonStatsMap, positionRanksBySeason },
      time: now,
      seasons,
    };
    return multiSeasonCache;
  }

  // Player trends (Premium) - Multi-season analysis with real Sleeper stats
  app.get("/api/fantasy/trends", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
    try {
      const leagueId = req.query.leagueId as string | undefined;
      const mode = (req.query.mode as string) || "browse";
      const searchQuery = (req.query.search as string || "").toLowerCase().trim();
      const positionFilter = (req.query.position as string || "all").toUpperCase();

      const cached = await getMultiSeasonData();
      const { allPlayers, seasonStatsMap, positionRanksBySeason } = cached.data;
      const seasons = cached.seasons;

      let targetPlayerIds: string[] = [];

      if (mode === "roster" && leagueId) {
        const userId = req.user.claims.sub;
        const [profile] = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId));
        if (profile?.sleeperUsername) {
          const sleeperUser = await sleeperApi.getSleeperUser(profile.sleeperUsername);
          if (sleeperUser) {
            const rosters = await sleeperApi.getLeagueRosters(leagueId);
            const userRoster = rosters?.find(r => r.owner_id === sleeperUser.user_id);
            targetPlayerIds = userRoster?.players || [];
          }
        }
      } else {
        const validPositions = ["QB", "RB", "WR", "TE"];
        const candidates = Object.entries(allPlayers)
          .filter(([_, p]: [string, any]) =>
            p && validPositions.includes(p.position) &&
            p.team && p.years_exp && p.years_exp >= 2 &&
            p.search_rank && p.search_rank < 300
          )
          .map(([id, p]: [string, any]) => ({ id, ...p }));

        let filtered = candidates;
        if (positionFilter !== "ALL") {
          filtered = filtered.filter(p => p.position === positionFilter);
        }
        if (searchQuery) {
          filtered = filtered.filter(p =>
            (p.full_name || "").toLowerCase().includes(searchQuery) ||
            (p.team || "").toLowerCase().includes(searchQuery)
          );
        }
        filtered.sort((a, b) => (a.search_rank || 999) - (b.search_rank || 999));
        targetPlayerIds = filtered.slice(0, 60).map(p => p.id);
      }

      const getPositionPeakAge = (pos: string) => {
        switch (pos) {
          case "QB": return { peak: 28, decline: 35 };
          case "RB": return { peak: 25, decline: 28 };
          case "WR": return { peak: 26, decline: 30 };
          case "TE": return { peak: 27, decline: 31 };
          default: return { peak: 27, decline: 30 };
        }
      };

      const players = targetPlayerIds.map(pid => {
        const p = allPlayers[pid];
        if (!p || !["QB", "RB", "WR", "TE"].includes(p.position)) return null;

        const seasonData: Array<{
          season: number;
          games: number;
          points: number;
          ppg: number;
          positionRank: number;
          rank: number;
        }> = [];

        for (const season of seasons) {
          const stats = seasonStatsMap[season]?.[pid];
          if (!stats) continue;
          const gp = (stats as any).gp || 0;
          const pts = (stats as any).pts_ppr || 0;
          if (gp < 1) continue;
          const ppg = Math.round((pts / gp) * 10) / 10;

          const posRanks = positionRanksBySeason[season]?.[p.position] || [];
          const posRank = posRanks.findIndex((r: { id: string; ppg: number }) => r.id === pid) + 1;

          const allPosRanks = Object.values(positionRanksBySeason[season] || {}).flat() as Array<{ id: string; ppg: number }>;
          allPosRanks.sort((a, b) => b.ppg - a.ppg);
          const overallRank = allPosRanks.findIndex((r) => r.id === pid) + 1;

          seasonData.push({
            season,
            games: gp,
            points: Math.round(pts * 10) / 10,
            ppg,
            positionRank: posRank || 999,
            rank: overallRank || 999,
          });
        }

        if (seasonData.length === 0) return null;

        const ppgValues = seasonData.map(s => s.ppg);
        const careerHigh = Math.max(...ppgValues);
        const careerLow = Math.min(...ppgValues);
        const avgPpg = Math.round((ppgValues.reduce((a, b) => a + b, 0) / ppgValues.length) * 10) / 10;
        const peakSeason = seasonData.find(s => s.ppg === careerHigh)?.season || seasons[0];

        let trend: "up" | "down" | "stable" | "breakout" = "stable";
        let trajectory = "";
        const age = p.age || 25;
        const { peak, decline } = getPositionPeakAge(p.position);

        if (seasonData.length >= 2) {
          const recent = seasonData.slice(-2);
          const ppgDelta = recent[1].ppg - recent[0].ppg;
          const pctChange = recent[0].ppg > 0 ? ppgDelta / recent[0].ppg : 0;

          if (pctChange >= 0.3 && recent[1].games >= 8) {
            trend = "breakout";
            trajectory = `${p.full_name} broke out in ${recent[1].season} with ${recent[1].ppg} PPG (+${Math.round(pctChange * 100)}% increase).`;
          } else if (seasonData.length >= 3) {
            const last3 = seasonData.slice(-3);
            const ascending = last3[2].ppg > last3[1].ppg && last3[1].ppg > last3[0].ppg;
            const declining = last3[2].ppg < last3[1].ppg && last3[1].ppg < last3[0].ppg;
            if (ascending) {
              trend = "up";
              trajectory = `${p.full_name} has shown consistent improvement over ${last3.length} seasons, trending upward at age ${age}.`;
            } else if (declining) {
              trend = "down";
              trajectory = `${p.full_name} has declined over the last ${last3.length} seasons. ${age > decline ? `At ${age}, past typical ${p.position} peak.` : "May bounce back."}`;
            } else {
              trend = ppgDelta > 0 ? "up" : ppgDelta < -1 ? "down" : "stable";
              trajectory = age <= peak + 2 && age >= peak - 1
                ? `${p.full_name} is in prime years at age ${age}. Peak PPG: ${careerHigh} (${peakSeason}).`
                : `${p.full_name} has maintained steady production. Career avg: ${avgPpg} PPG across ${seasonData.length} seasons.`;
            }
          } else {
            trend = ppgDelta > 1 ? "up" : ppgDelta < -1 ? "down" : "stable";
            trajectory = `${p.full_name} went from ${recent[0].ppg} to ${recent[1].ppg} PPG year-over-year.`;
          }
        } else {
          trajectory = `${p.full_name} has ${seasonData[0].games} games at ${seasonData[0].ppg} PPG in ${seasonData[0].season}.`;
        }

        const miniSeries = seasons.map(s => {
          const sd = seasonData.find(d => d.season === s);
          return sd ? sd.ppg : 0;
        });

        return {
          playerId: pid,
          name: p.full_name || "Unknown",
          position: p.position || "?",
          team: p.team || "FA",
          age,
          seasons: seasonData,
          trend,
          careerHigh,
          careerLow,
          avgPpg,
          trajectory,
          peakSeason,
          miniSeries,
          yearsExp: p.years_exp || 0,
        };
      }).filter(Boolean);

      players.sort((a: any, b: any) => b.avgPpg - a.avgPpg);

      res.json({
        players,
        availableSeasons: seasons,
      });
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
      let leagueRosterSettings: dynastyEngine.LeagueRosterSettings | null = null;
      let isSuperflex = false;
      if (leagueId) {
        try {
          const league = await sleeperApi.getLeague(leagueId as string);
          if (league) {
            leagueScoring = dynastyEngine.parseLeagueScoringSettings(league);
            leagueRosterSettings = dynastyEngine.parseLeagueRosterSettings(league);
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
            consensusValue,
            0.5,
            leagueRosterSettings
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
      const valueDelta = Math.round(sampleRbValue - baseRbValue);
      
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
  // Lineup Advice (Premium)
  app.get("/api/fantasy/lineup-advice", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
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

  // Matchup History - Last 5 games a player played vs a specific opponent
  app.get("/api/fantasy/matchup-history/:playerId", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
    try {
      const { playerId } = req.params;
      const { opponent, leagueId } = req.query;

      if (!opponent || !leagueId) {
        return res.status(400).json({ message: "opponent and leagueId required" });
      }

      const allPlayers = await sleeperApi.getAllPlayers();
      const player = allPlayers[playerId];
      if (!player) {
        return res.status(404).json({ message: "Player not found" });
      }

      const playerName = player.full_name || `${player.first_name} ${player.last_name}`;
      const position = player.position || "?";

      const league = await sleeperApi.getLeague(leagueId as string);
      const scoring = league?.scoring_settings || {};

      const pprValue = scoring.rec || 0;
      const passTdPts = scoring.pass_td || 4;
      const rushTdPts = scoring.rush_td || 6;
      const recTdPts = scoring.rec_td || 6;
      const passYdPts = scoring.pass_yd || 0.04;
      const rushYdPts = scoring.rush_yd || 0.1;
      const recYdPts = scoring.rec_yd || 0.1;
      const passIntPts = scoring.pass_int || -1;
      const fumLostPts = scoring.fum_lost || -2;
      const gameLogs = await playerStatsService.getPlayerGameLogs(playerId, playerName);

      const normalizeTeam = (t: string) => t.replace(/^(vs\.?\s*|@\s*)/i, "").replace(/\s*\(.*\)/, "").trim().toUpperCase();
      const opponentAbbrev = normalizeTeam(opponent as string);

      const matchedGames = gameLogs
        .filter(g => normalizeTeam(g.opponent) === opponentAbbrev)
        .slice(0, 5);

      const bonusRecTe = scoring.bonus_rec_te || 0;
      const bonusRecRb = scoring.bonus_rec_rb || 0;
      const bonusRecWr = scoring.bonus_rec_wr || 0;
      const bonus100Rushing = scoring.bonus_rush_yd_100 || 0;
      const bonus100Receiving = scoring.bonus_rec_yd_100 || 0;
      const bonus300Passing = scoring.bonus_pass_yd_300 || 0;

      const calculateFantasyPoints = (stats: Record<string, number | string>): number => {
        let pts = 0;
        const n = (key: string) => {
          const v = stats[key];
          return typeof v === "number" ? v : parseFloat(String(v)) || 0;
        };

        const passYds = n("passingYards") || n("PYDS") || n("YDS");
        const passTds = n("passingTouchdowns") || n("PTD") || n("TD");
        const ints = n("interceptions") || n("INT");
        const rushYds = n("rushingYards") || n("RYDS");
        const rushTds = n("rushingTouchdowns") || n("RTD");
        const recYds = n("receivingYards") || n("RECYDS");
        const recTds = n("receivingTouchdowns") || n("RECTD");
        const receptions = n("receptions") || n("REC");
        const fumbles = n("fumbles") || n("FUM") || n("fumblesLost");

        if (position === "QB") {
          pts += passYds * passYdPts;
          pts += passTds * passTdPts;
          pts += ints * passIntPts;
          pts += rushYds * rushYdPts;
          pts += rushTds * rushTdPts;
          pts += receptions * pprValue;
          pts += recYds * recYdPts;
          pts += fumbles * fumLostPts;
          if (passYds >= 300) pts += bonus300Passing;
        } else if (position === "RB") {
          pts += rushYds * rushYdPts;
          pts += rushTds * rushTdPts;
          pts += receptions * (pprValue + bonusRecRb);
          pts += recYds * recYdPts;
          pts += recTds * recTdPts;
          pts += fumbles * fumLostPts;
          if (rushYds >= 100) pts += bonus100Rushing;
          if (recYds >= 100) pts += bonus100Receiving;
        } else if (position === "WR") {
          pts += receptions * (pprValue + bonusRecWr);
          pts += recYds * recYdPts;
          pts += recTds * recTdPts;
          pts += rushYds * rushYdPts;
          pts += rushTds * rushTdPts;
          pts += fumbles * fumLostPts;
          if (recYds >= 100) pts += bonus100Receiving;
          if (rushYds >= 100) pts += bonus100Rushing;
        } else if (position === "TE") {
          pts += receptions * (pprValue + bonusRecTe);
          pts += recYds * recYdPts;
          pts += recTds * recTdPts;
          pts += rushYds * rushYdPts;
          pts += rushTds * rushTdPts;
          pts += fumbles * fumLostPts;
          if (recYds >= 100) pts += bonus100Receiving;
        }

        return Math.round(pts * 10) / 10;
      };

      const games = matchedGames.map(g => {
        const stats = g.stats;
        const fantasyPts = calculateFantasyPoints(stats);

        const keyStats: Record<string, number> = {};
        const n = (key: string) => {
          const v = stats[key];
          return typeof v === "number" ? v : parseFloat(String(v)) || 0;
        };

        if (position === "QB") {
          keyStats.passYds = n("passingYards") || n("YDS");
          keyStats.passTds = n("passingTouchdowns") || n("TD");
          keyStats.ints = n("interceptions") || n("INT");
          keyStats.rushYds = n("rushingYards");
          keyStats.rushTds = n("rushingTouchdowns");
        } else if (position === "RB") {
          keyStats.rushYds = n("rushingYards") || n("YDS");
          keyStats.rushTds = n("rushingTouchdowns") || n("TD");
          keyStats.carries = n("rushingAttempts") || n("CAR");
          keyStats.receptions = n("receptions") || n("REC");
          keyStats.recYds = n("receivingYards");
          keyStats.recTds = n("receivingTouchdowns");
        } else if (position === "WR" || position === "TE") {
          keyStats.receptions = n("receptions") || n("REC");
          keyStats.recYds = n("receivingYards") || n("YDS");
          keyStats.recTds = n("receivingTouchdowns") || n("TD");
          keyStats.targets = n("receivingTargets") || n("TAR");
          keyStats.rushYds = n("rushingYards");
        }

        return {
          season: g.season,
          week: g.week,
          date: g.date,
          homeAway: g.homeAway,
          result: g.result,
          score: g.score,
          fantasyPoints: fantasyPts,
          keyStats,
        };
      });

      const avgFantasyPts = games.length > 0
        ? Math.round((games.reduce((s, g) => s + g.fantasyPoints, 0) / games.length) * 10) / 10
        : 0;

      let verdict: "strong_start" | "average" | "tough_matchup" | "no_data" = "no_data";
      if (games.length > 0) {
        if (avgFantasyPts >= 15 && position === "QB") verdict = "strong_start";
        else if (avgFantasyPts >= 12 && (position === "RB" || position === "WR")) verdict = "strong_start";
        else if (avgFantasyPts >= 10 && position === "TE") verdict = "strong_start";
        else if (avgFantasyPts >= 10 && position === "QB") verdict = "average";
        else if (avgFantasyPts >= 7 && (position === "RB" || position === "WR")) verdict = "average";
        else if (avgFantasyPts >= 5 && position === "TE") verdict = "average";
        else verdict = "tough_matchup";
      }

      res.json({
        playerName,
        position,
        team: player.team,
        opponent: opponentAbbrev,
        gamesFound: games.length,
        games,
        avgFantasyPts,
        verdict,
        scoringType: pprValue >= 1 ? "PPR" : pprValue >= 0.5 ? "Half PPR" : "Standard",
      });
    } catch (error) {
      console.error("Error fetching matchup history:", error);
      res.status(500).json({ message: "Failed to fetch matchup history" });
    }
  });

  // Advanced Projections - ROS outlook
  // ROS Projections (Premium)
  app.get("/api/fantasy/projections", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
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

  async function computeCareerSummary(userId: string, sleeperUserId: string, skipCache = false) {
    const allTakeovers = await storage.getAllLeagueTakeovers(userId);
    const takeoverMap = new Map(allTakeovers.map(t => [t.leagueId, t.takeoverSeason]));
    const takeoverHash = allTakeovers.map(t => `${t.leagueId}:${t.takeoverSeason}`).sort().join(',');
    const cacheKey = `${sleeperUserId}:${takeoverHash}`;

    if (!skipCache) {
      const cached = careerSummaryCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CAREER_CACHE_TTL) {
        return cached.data;
      }
    } else {
      careerSummaryCache.delete(cacheKey);
    }

    const currentLeagues = await getAllUserLeagues(sleeperUserId);
    const processedLeagueIds = new Set<string>();
    const leagueDataCache = new Map<string, any>();
    const leagueIdsToProcess: { leagueId: string; leagueName: string }[] = [];

    const collectLeagueIds = async (startLeagueId: string, leagueName: string, takeoverSeason: number | null): Promise<string[]> => {
      const ids: string[] = [];
      let currentId: string | null = startLeagueId;
      while (currentId && currentId !== "0") {
        if (processedLeagueIds.has(currentId)) break;
        processedLeagueIds.add(currentId);
        try {
          const league = await sleeperApi.getLeague(currentId);
          if (!league) break;
          const seasonYear = parseInt(league.season);
          if (takeoverSeason && seasonYear < takeoverSeason) {
            currentId = league.previous_league_id;
            continue;
          }
          leagueDataCache.set(currentId, league);
          ids.push(currentId);
          currentId = league.previous_league_id;
        } catch { break; }
      }
      return ids;
    };

    const leagueIdResults = await Promise.all(
      currentLeagues.map(league => {
        const takeoverSeason = takeoverMap.get(league.league_id) || null;
        return collectLeagueIds(league.league_id, league.name, takeoverSeason).then(ids =>
          ids.map(id => ({ leagueId: id, leagueName: league.name }))
        );
      })
    );
    leagueIdResults.forEach(ids => leagueIdsToProcess.push(...ids));

    const processLeagueSeason = async (leagueId: string, leagueName: string) => {
      try {
        const league = leagueDataCache.get(leagueId);
        if (!league) return null;

        const currentSeason = new Date().getFullYear().toString();
        const isCurrentSeason = league.season === currentSeason;

        const [rosters, bracket] = await Promise.all([
          sleeperApi.getLeagueRosters(leagueId),
          sleeperApi.getPlayoffBracket(leagueId).catch(() => [])
        ]);

        if (!rosters) return null;
        const userRoster = rosters.find(r => r.owner_id === sleeperUserId);
        if (!userRoster) return null;

        const wins = userRoster.settings?.wins || 0;
        const losses = userRoster.settings?.losses || 0;
        const ties = userRoster.settings?.ties || 0;
        const fpts = (userRoster.settings?.fpts || 0) + (userRoster.settings?.fpts_decimal || 0) / 100;

        if (wins === 0 && losses === 0 && ties === 0) return null;

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
        const isPlayoffs = rank <= playoffTeams;

        let isChampion = false;
        let isRunnerUp = false;
        if (bracket && bracket.length > 0) {
          const champMatch = bracket.reduce((max: any, match: any) =>
            (match.r > (max?.r || 0)) ? match : max, bracket[0]);
          if (champMatch && champMatch.w === userRoster.roster_id) isChampion = true;
          else if (champMatch && champMatch.l === userRoster.roster_id) isRunnerUp = true;
        } else if (league.status === "complete") {
          if (rank === 1) isChampion = true;
          else if (rank === 2) isRunnerUp = true;
        }

        return {
          leagueId, leagueName, season: league.season,
          wins, losses, ties, fpts: Math.round(fpts),
          rank, totalTeams: rosters.length,
          isChampion, isPlayoffs, isRunnerUp, isCurrentSeason,
        };
      } catch { return null; }
    };

    const BATCH_SIZE = 10;
    const allResults: any[] = [];
    for (let i = 0; i < leagueIdsToProcess.length; i += BATCH_SIZE) {
      const batch = leagueIdsToProcess.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(({ leagueId, leagueName }) => processLeagueSeason(leagueId, leagueName))
      );
      allResults.push(...batchResults.filter(Boolean));
    }

    let totalWins = 0, totalLosses = 0, totalTies = 0;
    let championships = 0, runnerUps = 0, playoffAppearances = 0;
    let totalPointsFor = 0;
    let bestFinishRank: number | null = null;

    for (const stat of allResults) {
      totalWins += stat.wins;
      totalLosses += stat.losses;
      totalTies += stat.ties;
      totalPointsFor += stat.fpts;
      if (stat.isChampion) championships++;
      if (stat.isRunnerUp) runnerUps++;
      if (stat.isPlayoffs) playoffAppearances++;
      if (bestFinishRank === null || stat.rank < bestFinishRank) bestFinishRank = stat.rank;
    }

    allResults.sort((a, b) => b.season.localeCompare(a.season));

    const result = {
      totalLeagues: currentLeagues.length,
      totalSeasons: allResults.length,
      totalWins, totalLosses, totalTies,
      championships, runnerUps, playoffAppearances,
      totalPointsFor,
      bestFinish: championships > 0 ? "Champion" : runnerUps > 0 ? "Runner-up" : playoffAppearances > 0 ? "Playoffs" : "N/A",
      bestFinishRank,
      currentSeason: new Date().getFullYear().toString(),
      leagueStats: allResults,
    };

    careerSummaryCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  }

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

      const result = await computeCareerSummary(userId, userProfile.sleeperUserId);
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
          
          const [rosters, bracket] = await Promise.all([
            sleeperApi.getLeagueRosters(currentLeagueId),
            sleeperApi.getPlayoffBracket(currentLeagueId).catch(() => [] as sleeperApi.PlayoffBracketMatch[]),
          ]);
          
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

  app.get("/api/player/:playerId/elite-profile", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { playerId } = req.params;
      const { leagueId } = req.query;
      const sleeperUserId = req.user?.claims?.metadata?.sleeper_user_id;

      const allPlayers = await sleeperApi.getAllPlayers();
      const player = allPlayers[playerId];
      if (!player) {
        return res.status(404).json({ message: "Player not found" });
      }

      const state = await sleeperApi.getState();
      const currentSeason = parseInt(state?.season || '2025');
      const currentWeek = state?.week || 1;

      let weeklyScores: number[] = [];
      try {
        for (let w = 1; w <= Math.min(currentWeek, 18); w++) {
          const weekStats = await fetch(`https://api.sleeper.app/v1/stats/nfl/regular/${currentSeason}/${w}`);
          if (weekStats.ok) {
            const data = await weekStats.json();
            const ps = data[playerId];
            if (ps) {
              const pts = (ps.pts_ppr ?? ps.pts_half_ppr ?? ps.pts_std ?? 0);
              weeklyScores.push(typeof pts === 'number' ? pts : 0);
            }
          }
        }
      } catch (e) {
        console.error("Error fetching weekly stats for elite profile:", e);
      }

      let projectedMedian = 0;
      let projectedStdDev = 0;
      try {
        const projResp = await fetch(`https://api.sleeper.app/v1/projections/nfl/regular/${currentSeason}/${currentWeek}`);
        if (projResp.ok) {
          const projData = await projResp.json();
          const pp = projData[playerId];
          if (pp) {
            projectedMedian = pp.pts_ppr ?? pp.pts_half_ppr ?? pp.pts_std ?? 0;
            projectedStdDev = projectedMedian * 0.35;
          }
        }
      } catch (e) {}

      let dynastyValue = 0;
      let ktcValue: number | null = null;
      const allDynastyValues: { playerId: string; value: number; position: string }[] = [];
      try {
        const pos = player.position || 'WR';
        dynastyValue = dynastyEngine.getQuickPlayerValue(
          playerId, pos, player.age || 25, player.years_exp || 0,
          weeklyScores, player.injury_status || null,
          player.snap_pct || null, player.depth_chart_order || null,
          player.draft_round ? parseInt(player.draft_round) : null,
          weeklyScores.filter(s => s > 0).length, 51, false
        );
      } catch (e) {}

      let rosterPlayers: string[] = [];
      if (leagueId && sleeperUserId) {
        try {
          const rosters = await sleeperApi.getLeagueRosters(leagueId as string);
          const userRoster = rosters?.find((r: any) =>
            r.owner_id === sleeperUserId || (r.co_owners && r.co_owners.includes(sleeperUserId))
          );
          if (userRoster?.players) {
            rosterPlayers = userRoster.players;
          }
        } catch (e) {}
      }

      const profile = buildEliteProfile(
        playerId, allPlayers, weeklyScores,
        projectedMedian, projectedStdDev,
        dynastyValue, ktcValue, allDynastyValues,
        rosterPlayers, currentSeason
      );

      res.json(profile);
    } catch (error) {
      console.error("Error building elite player profile:", error);
      res.status(500).json({ message: "Failed to build elite player profile" });
    }
  });

  app.post("/api/player/:playerId/elite-summary", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { playerId } = req.params;
      const { leagueId } = req.body;
      const sleeperUserId = req.user?.claims?.metadata?.sleeper_user_id;

      const allPlayers = await sleeperApi.getAllPlayers();
      const player = allPlayers[playerId];
      if (!player) {
        return res.status(404).json({ message: "Player not found" });
      }

      const state = await sleeperApi.getState();
      const currentSeason = parseInt(state?.season || '2025');
      const currentWeek = state?.week || 1;

      let weeklyScores: number[] = [];
      try {
        for (let w = 1; w <= Math.min(currentWeek, 18); w++) {
          const weekStats = await fetch(`https://api.sleeper.app/v1/stats/nfl/regular/${currentSeason}/${w}`);
          if (weekStats.ok) {
            const data = await weekStats.json();
            const ps = data[playerId];
            if (ps) {
              const pts = (ps.pts_ppr ?? ps.pts_half_ppr ?? ps.pts_std ?? 0);
              weeklyScores.push(typeof pts === 'number' ? pts : 0);
            }
          }
        }
      } catch (e) {}

      let projectedMedian = 0;
      try {
        const projResp = await fetch(`https://api.sleeper.app/v1/projections/nfl/regular/${currentSeason}/${currentWeek}`);
        if (projResp.ok) {
          const projData = await projResp.json();
          const pp = projData[playerId];
          if (pp) { projectedMedian = pp.pts_ppr ?? pp.pts_half_ppr ?? pp.pts_std ?? 0; }
        }
      } catch (e) {}

      let dynastyValue = 0;
      try {
        const pos = player.position || 'WR';
        dynastyValue = dynastyEngine.getQuickPlayerValue(
          playerId, pos, player.age || 25, player.years_exp || 0,
          weeklyScores, player.injury_status || null,
          player.snap_pct || null, player.depth_chart_order || null,
          player.draft_round ? parseInt(player.draft_round) : null,
          weeklyScores.filter(s => s > 0).length, 51, false
        );
      } catch (e) {}

      let rosterPlayers: string[] = [];
      if (leagueId && sleeperUserId) {
        try {
          const rosters = await sleeperApi.getLeagueRosters(leagueId as string);
          const userRoster = rosters?.find((r: any) =>
            r.owner_id === sleeperUserId || (r.co_owners && r.co_owners.includes(sleeperUserId))
          );
          if (userRoster?.players) { rosterPlayers = userRoster.players; }
        } catch (e) {}
      }

      const profile = buildEliteProfile(
        playerId, allPlayers, weeklyScores,
        projectedMedian, projectedMedian * 0.35,
        dynastyValue, null, [],
        rosterPlayers, currentSeason
      );

      const summary = await engineExplainer.explainPlayerProfile(profile);
      res.json({ summary });
    } catch (error) {
      console.error("Error generating elite player summary:", error);
      res.status(500).json({ message: "Failed to generate summary" });
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

      const cacheKey = `roster:${userProfile.sleeperUserId}:${leagueId}`;
      const cached = rosterCache.get(cacheKey);
      if (cached) return res.json(cached);

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
      
      // Parse league scoring settings for accurate position valuations (TEP, PPR, etc.)
      const leagueScoring = league ? dynastyEngine.parseLeagueScoringSettings(league) : null;

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
          leagueScoring,
          consensusValue,
          0.5,
          dynastyEngine.parseLeagueRosterSettings(league)
        );
        return valueResult.value;
      };

      // Detect IDP league from roster positions
      const idpSlotTypes = ["DL", "LB", "DB", "DE", "DT", "CB", "S", "IDP_FLEX", "ILB", "OLB", "MLB", "NT", "FS", "SS", "ED", "EDGE"];
      const isIDPLeague = rosterPositions.some((pos: string) => idpSlotTypes.includes(pos));

      // Determine which positions to rank - always include offense, add IDP groups if IDP league
      const offensePositions = ["QB", "RB", "WR", "TE"];
      const idpPositions = ["DL", "LB", "DB"];
      const idpPlayerPositionMap: Record<string, string> = {
        DE: "DL", DT: "DL", NT: "DL", EDGE: "DL", ED: "DL",
        ILB: "LB", OLB: "LB", MLB: "LB", LB: "LB",
        CB: "DB", S: "DB", FS: "DB", SS: "DB", DB: "DB",
      };
      const positionsToRank = isIDPLeague ? [...offensePositions, ...idpPositions] : offensePositions;

      // Production confidence: scales dynasty value by proven production for position strength
      const prElitePPG: Record<string, number> = { QB: 18, RB: 14, WR: 14, TE: 12 };
      const prStarterPPG: Record<string, number> = { QB: 14, RB: 10, WR: 10, TE: 8 };
      const getProdConfidence = (playerId: string, player: any, pos: string, dynastyValue: number): number => {
        const pStats = stats?.[playerId] || {} as any;
        const gp = pStats.gp || 0;
        const pts = pStats.pts_ppr || 0;
        const ppg = gp > 0 ? pts / gp : 0;
        const yearsExp = player?.years_exp || 0;
        const injuryStatus = player?.injury_status;
        const isCurrentlyInjured = injuryStatus && ["IR", "Out", "Doubtful", "PUP"].includes(injuryStatus);
        if (gp >= 8 && ppg >= (prElitePPG[pos] || 14)) return 1.0;
        if (gp >= 6 && ppg >= (prStarterPPG[pos] || 10)) return 0.9;
        if (gp >= 4 && ppg >= (prStarterPPG[pos] || 10) * 0.7) return 0.75;
        if (gp >= 2 && ppg >= (prStarterPPG[pos] || 10) * 0.5) return 0.6;
        if (isCurrentlyInjured && dynastyValue >= 6000 && gp < 6) return 0.75;
        if (dynastyValue >= 7000 && gp < 6 && yearsExp >= 1 && yearsExp <= 3) return 0.65;
        if (yearsExp === 0) return dynastyValue >= 7000 ? 0.65 : 0.45;
        if (yearsExp >= 2 && gp < 4) return 0.35;
        return 0.5;
      };

      // Calculate position group values for ALL teams using weighted top-N approach
      const topNByPosition: Record<string, number> = { QB: 3, RB: 5, WR: 5, TE: 3, DL: 4, LB: 4, DB: 4 };
      const teamPositionValues: Record<string, Record<string, number>> = {};
      
      for (const roster of rosters) {
        const ownerId = roster.owner_id;
        const rosterPlayers = roster.players || [];
        
        const posPlayerValues: Record<string, number[]> = {};
        for (const p of positionsToRank) posPlayerValues[p] = [];
        
        for (const pid of rosterPlayers) {
          const player = allPlayers[pid];
          if (!player) continue;
          
          const pos = player.position;
          const idpGroup = idpPlayerPositionMap[pos];
          if (pos in posPlayerValues) {
            const dynastyValue = getBlendedValue(pid, player);
            const confidence = getProdConfidence(pid, player, pos, dynastyValue);
            posPlayerValues[pos].push(dynastyValue * confidence);
          } else if (idpGroup && idpGroup in posPlayerValues) {
            const dynastyValue = getBlendedValue(pid, player);
            const confidence = getProdConfidence(pid, player, idpGroup, dynastyValue);
            posPlayerValues[idpGroup].push(dynastyValue * confidence);
          }
        }
        
        // Score each position: top-N get full weight, depth gets diminishing weight
        const posValues: Record<string, number> = {};
        for (const pos of positionsToRank) {
          const sorted = (posPlayerValues[pos] || []).sort((a, b) => b - a);
          const topN = topNByPosition[pos] || 3;
          let total = 0;
          for (let i = 0; i < sorted.length; i++) {
            if (i < topN) {
              total += sorted[i];
            } else {
              total += sorted[i] * 0.15;
            }
          }
          posValues[pos] = total;
        }
        
        teamPositionValues[ownerId] = posValues;
      }

      // Rank each position group
      const positionRankings: Record<string, { rank: number; total: number; value: number }> = {};
      
      for (const pos of positionsToRank) {
        const sorted = Object.entries(teamPositionValues)
          .map(([oid, vals]) => ({ ownerId: oid, value: vals[pos] || 0 }))
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
      
      // Devy detection: Build a LEAGUE-WIDE devy note map by scanning ALL rosters' p_nick_ metadata
      // Commissioners/owners use p_nick_ (player nickname) to label devy placeholder players
      // Also detect placeholder positions (K/DEF/IDP) in leagues without those roster slots
      const hasKickerSlot = rosterPositions.includes("K");
      const hasDefSlot = rosterPositions.includes("DEF");
      const devyNoteMap = new Map<string, { devyName: string; devyPosition: string; devySchool: string }>();
      const hasRosterPlayers = playerIds.length > 0;
      
      if (hasRosterPlayers) {
        // Scan ALL rosters in the league for p_nick_ and p_note_ entries
        // This catches devy notes set by any owner or the commissioner
        for (const roster of rosters) {
          const meta = roster.metadata || {};
          for (const [key, noteValue] of Object.entries(meta)) {
            if (!noteValue || typeof noteValue !== 'string') continue;
            
            let targetPlayerId: string | null = null;
            if (key.startsWith('p_nick_')) {
              targetPlayerId = key.replace('p_nick_', '');
            } else if (key.startsWith('p_note_')) {
              targetPlayerId = key.replace('p_note_', '');
            }
            
            if (targetPlayerId && noteValue.trim().length >= 2 && playerIds.includes(targetPlayerId)) {
              const parsed = parseDevyNote(noteValue.trim());
              if (parsed && !devyNoteMap.has(targetPlayerId)) {
                devyNoteMap.set(targetPlayerId, parsed);
              }
            }
          }

        }
      }

      const devyPlayers = ktcValues.getDevyPlayers();

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
        
        // Devy detection: Check if this player is a placeholder with a devy note
        let devyInfo: { devyName: string; devyPosition: string; devySchool: string } | null = null;
        let isDevyPlaceholder = false;
        let devyPlayerData: any = null;
        if (hasRosterPlayers) {
          const playerPos = player?.position || "?";
          const isKicker = playerPos === "K";
          const isDef = playerPos === "DEF";
          const isRetired = !player?.team && (player?.status === "Inactive" || player?.active === false);
          const isIDPPlayer = ["CB", "S", "DB", "LB", "ILB", "OLB", "MLB", "DL", "DE", "DT", "NT", "EDGE", "ED", "FS", "SS"].includes(playerPos);
          
          // Real NFL players with active NFL teams are never devy placeholders
          const isActiveNFLPlayer = !!player?.team && player.team !== "" && player.team !== "FA";
          
          // Detect placeholder: K in league without K slots, DEF without DEF slots, IDP without IDP slots
          const isPlaceholderByPosition = (isKicker && !hasKickerSlot) || (isDef && !hasDefSlot) || (isIDPPlayer && !isIDPLeague);
          
          // Additional heuristic: In leagues that use devy notes (any p_nick_ entries exist),
          // FA kickers (no NFL team) are almost certainly devy placeholders even if the league has K slots
          const isLikelyDevyPlaceholder = devyNoteMap.size > 0 && isKicker && !player?.team;
          
          if (!isActiveNFLPlayer && devyNoteMap.has(playerId)) {
            devyInfo = devyNoteMap.get(playerId)!;
            isDevyPlaceholder = true;
          } else if (!isActiveNFLPlayer && (isPlaceholderByPosition || isRetired || isLikelyDevyPlaceholder)) {
            isDevyPlaceholder = true;
          }

          if (devyInfo) {
            const normalizedName = devyInfo.devyName.toLowerCase().trim();
            let matchedDevy = devyPlayers.find((dp: any) => dp.name.toLowerCase().trim() === normalizedName);
            if (!matchedDevy) {
              matchedDevy = devyPlayers.find((dp: any) => {
                const dpName = dp.name.toLowerCase().trim();
                return dpName.includes(normalizedName) || normalizedName.includes(dpName);
              });
            }
            if (matchedDevy) {
              if (devyInfo.devyPosition === "?") {
                devyInfo.devyPosition = matchedDevy.position;
              }
              if (devyInfo.devySchool === "Unknown") {
                devyInfo.devySchool = matchedDevy.college;
              }
              devyPlayerData = {
                playerId: matchedDevy.id,
                name: matchedDevy.name,
                position: matchedDevy.position,
                positionRank: matchedDevy.positionRank,
                college: matchedDevy.college,
                draftEligibleYear: matchedDevy.draftEligibleYear,
                tier: matchedDevy.tier,
                value: matchedDevy.value,
                trend7Day: matchedDevy.trend7Day,
                trend30Day: matchedDevy.trend30Day,
                seasonChange: matchedDevy.seasonChange,
                rank: (matchedDevy as any).rank || 0,
                starterPct: matchedDevy.starterPct,
                elitePct: matchedDevy.elitePct,
                bustPct: matchedDevy.bustPct,
                top10Pct: matchedDevy.top10Pct,
                round1Pct: matchedDevy.round1Pct,
                round2PlusPct: matchedDevy.round2PlusPct,
                pickEquivalent: matchedDevy.pickEquivalent,
                pickMultiplier: matchedDevy.pickMultiplier,
                dominatorRating: matchedDevy.dominatorRating,
                yardShare: matchedDevy.yardShare,
                tdShare: matchedDevy.tdShare,
                breakoutAge: matchedDevy.breakoutAge,
                comps: matchedDevy.comps,
                depthRole: matchedDevy.depthRole,
                pathContext: matchedDevy.pathContext,
                ageClass: matchedDevy.ageClass,
              };
            }
          }
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
          projectedPoints: Math.round((dynastyValue / 80000) * 10 + Math.random() * 5),
          isStarter,
          slotPosition,
          starterIndex: isStarter ? starterIndex : -1,
          headshot,
          devyInfo,
          isDevyPlaceholder,
          devyPlayerData,
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

      const responseData = {
        players,
        teamName: "My Team",
        ownerId: userProfile.sleeperUserId,
        totalValue,
        starters,
        positionRankings,
        leagueSize,
        isIDPLeague,
      };
      rosterCache.set(cacheKey, responseData);
      res.json(responseData);
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
      const userRoster = rosters?.find(r => r.owner_id === userProfile.sleeperUserId);
      const leagueSize = rosters?.length || 0;

      if (!rosters || rosters.length === 0) {
        return res.json({
          rosterStrength: { QB: 0, RB: 0, WR: 0, TE: 0 },
          positionRanks: { QB: { rank: 0, total: 0 }, RB: { rank: 0, total: 0 }, WR: { rank: 0, total: 0 }, TE: { rank: 0, total: 0 } },
          teamProfile: "balanced",
          biggestNeed: null,
          recommendations: [],
          weeklyBlurb: "Rosters not yet available for this season. Check back when the season starts!",
          playerCount: 0,
        });
      }

      if (!userRoster) {
        return res.json({
          rosterStrength: { QB: 0, RB: 0, WR: 0, TE: 0 },
          positionRanks: { QB: { rank: 0, total: leagueSize }, RB: { rank: 0, total: leagueSize }, WR: { rank: 0, total: leagueSize }, TE: { rank: 0, total: leagueSize } },
          teamProfile: "balanced",
          biggestNeed: null,
          recommendations: [],
          weeklyBlurb: "Unable to find your roster in this league.",
          playerCount: 0,
        });
      }

      // Parse league scoring settings for accurate position valuations (TEP, PPR, 6pt pass TD, etc.)
      const leagueScoring = league ? dynastyEngine.parseLeagueScoringSettings(league) : null;

      // Calculate dynasty values with league-specific scoring
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
          leagueScoring,
          consensusValue,
          0.5,
          dynastyEngine.parseLeagueRosterSettings(league)
        );
        return valueResult.value;
      };

      // Parse league roster format for format-aware recommendations
      const rosterPositions = (league?.roster_positions || []).filter((pos: string) => pos !== "BN");

      // Count required starters per position (direct slots only)
      const directSlots: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
      for (const slot of rosterPositions) {
        if (slot in directSlots) directSlots[slot as keyof typeof directSlots]++;
      }

      // Count each flex type for demand calculation
      const flexSlotsByType: Record<string, { count: number; eligible: string[] }> = {
        "FLEX": { count: 0, eligible: ["RB", "WR", "TE"] },
        "SUPER_FLEX": { count: 0, eligible: ["QB", "RB", "WR", "TE"] },
        "REC_FLEX": { count: 0, eligible: ["WR", "TE"] },
        "WRRB_FLEX": { count: 0, eligible: ["WR", "RB"] },
      };
      for (const slot of rosterPositions) {
        if (slot in flexSlotsByType) flexSlotsByType[slot].count++;
      }
      const totalFlexSlots = Object.values(flexSlotsByType).reduce((s, v) => s + v.count, 0);

      // Calculate effective starter demand: direct slots + proportional share of each flex type
      const effectiveDemand: Record<string, number> = { ...directSlots };
      for (const [, { count, eligible }] of Object.entries(flexSlotsByType)) {
        if (count === 0) continue;
        const share = count / eligible.length;
        for (const pos of eligible) {
          effectiveDemand[pos] = (effectiveDemand[pos] || 0) + share;
        }
      }
      // In SF, QB gets extra demand weight since it's almost always optimal to start a QB there
      if (flexSlotsByType["SUPER_FLEX"].count > 0) {
        effectiveDemand["QB"] += flexSlotsByType["SUPER_FLEX"].count * 0.5;
      }

      // Derive top-N from effective demand (round up, minimum 2 for QB, 3 for others)
      const topNByPosition: Record<string, number> = {};
      for (const pos of ["QB", "RB", "WR", "TE"]) {
        const minN = pos === "QB" ? 2 : 3;
        topNByPosition[pos] = Math.max(minN, Math.ceil(effectiveDemand[pos] * 1.5));
      }

      // Production tier thresholds (PPR PPG)
      const elitePPG: Record<string, number> = { QB: 18, RB: 14, WR: 14, TE: 12 };
      const starterPPG: Record<string, number> = { QB: 14, RB: 10, WR: 10, TE: 8 };

      const teamPositionValues: Record<string, { QB: number; RB: number; WR: number; TE: number }> = {};
      const teamAges: Record<string, number[]> = {};

      // Production confidence multiplier: scales dynasty value by how much a player has proven on the field
      // This prevents unproven players (high DV from draft capital/age alone) from inflating position rankings
      const getProductionConfidence = (playerId: string, player: any, pos: string, dynastyValue: number): number => {
        const pStats = stats?.[playerId] || {} as any;
        const gp = pStats.gp || 0;
        const pts = pStats.pts_ppr || 0;
        const ppg = gp > 0 ? pts / gp : 0;
        const yearsExp = player?.years_exp || 0;
        const injuryStatus = player?.injury_status;
        const isCurrentlyInjured = injuryStatus && ["IR", "Out", "Doubtful", "PUP"].includes(injuryStatus);

        // Proven elite producer — full confidence
        if (gp >= 8 && ppg >= (elitePPG[pos] || 14)) return 1.0;
        // Solid starter-level production — high confidence
        if (gp >= 6 && ppg >= (starterPPG[pos] || 10)) return 0.9;
        // Some production but not starter-level — moderate confidence
        if (gp >= 4 && ppg >= (starterPPG[pos] || 10) * 0.7) return 0.75;
        // Limited games but showed something
        if (gp >= 2 && ppg >= (starterPPG[pos] || 10) * 0.5) return 0.6;
        // Proven player who missed time due to injury — trust dynasty value as proxy for talent
        // High DV + few games + injury = likely a good player who just got hurt, not a bust
        if (isCurrentlyInjured && dynastyValue >= 6000 && gp < 6) return 0.75;
        if (dynastyValue >= 7000 && gp < 6 && yearsExp >= 1 && yearsExp <= 3) return 0.65;
        // Rookie (0 years exp) — give benefit of the doubt based on dynasty value
        if (yearsExp === 0) return dynastyValue >= 7000 ? 0.65 : 0.45;
        // Veteran with no/minimal production — they've had chances and haven't produced
        if (yearsExp >= 2 && gp < 4) return 0.35;
        // Default — some experience but limited data
        return 0.5;
      };

      // Track user's player-level detail for quality tier analysis
      type PlayerDetail = { name: string; value: number; ppg: number; gp: number; age: number };
      let userPositionPlayers: Record<string, PlayerDetail[]> = { QB: [], RB: [], WR: [], TE: [] };
      
      for (const roster of rosters) {
        const ownerId = roster.owner_id;
        const rosterPlayers = roster.players || [];
        const isUserRoster = ownerId === userProfile.sleeperUserId;
        
        const posPlayerValues: Record<string, number[]> = { QB: [], RB: [], WR: [], TE: [] };
        const ages: number[] = [];
        
        for (const pid of rosterPlayers) {
          const player = allPlayers[pid];
          if (!player) continue;
          
          const pos = player.position as "QB" | "RB" | "WR" | "TE";
          if (pos in posPlayerValues) {
            const dynastyValue = getBlendedValue(pid, player);
            const confidence = getProductionConfidence(pid, player, pos, dynastyValue);
            const strengthValue = dynastyValue * confidence;
            posPlayerValues[pos].push(strengthValue);
            if (player.age) ages.push(player.age);

            if (isUserRoster) {
              const pStats = stats?.[pid] || {} as any;
              const gp = pStats.gp || 0;
              const pts = pStats.pts_ppr || 0;
              const ppg = gp > 0 ? pts / gp : 0;
              userPositionPlayers[pos].push({
                name: player.full_name || `${player.first_name} ${player.last_name}`,
                value: dynastyValue,
                ppg,
                gp,
                age: player.age || 25,
              });
            }
          }
        }
        
        const posValues = { QB: 0, RB: 0, WR: 0, TE: 0 };
        for (const pos of ["QB", "RB", "WR", "TE"] as const) {
          const sorted = posPlayerValues[pos].sort((a, b) => b - a);
          const topN = topNByPosition[pos];
          let total = 0;
          for (let i = 0; i < sorted.length; i++) {
            if (i < topN) {
              total += sorted[i];
            } else {
              total += sorted[i] * 0.15;
            }
          }
          posValues[pos] = total;
        }
        
        teamPositionValues[ownerId] = posValues;
        teamAges[ownerId] = ages;
      }

      // Sort user's position players by value descending
      for (const pos of ["QB", "RB", "WR", "TE"]) {
        userPositionPlayers[pos].sort((a, b) => b.value - a.value);
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

      const rosterStrength: Record<string, number> = {};
      for (const pos of positions) {
        const { rank, total } = positionRanks[pos];
        rosterStrength[pos] = total > 0 ? Math.round(((total - rank + 1) / total) * 100) : 0;
      }

      // Calculate team age profile
      const userAges = teamAges[userProfile.sleeperUserId] || [];
      const avgAge = userAges.length > 0 ? userAges.reduce((a, b) => a + b, 0) / userAges.length : 25;
      const youngPlayers = userAges.filter(a => a <= 24).length;
      const oldPlayers = userAges.filter(a => a >= 28).length;
      
      // Competitive strength: average percentile across position groups (0-1, higher = stronger)
      const posStrengthScores = positions.map(pos => {
        const rank = positionRanks[pos]?.rank || leagueSize;
        return (leagueSize - rank) / (leagueSize - 1);
      });
      const avgStrength = posStrengthScores.reduce((a, b) => a + b, 0) / posStrengthScores.length;
      const bottomThirdCount = posStrengthScores.filter(s => s < 0.33).length;
      const topThirdCount = posStrengthScores.filter(s => s > 0.66).length;

      // Age tendency: "old" leans contender, "young" leans rebuild
      let ageTendency: "old" | "young" | "middle" = "middle";
      if (avgAge >= 27 || oldPlayers > youngPlayers * 1.5) ageTendency = "old";
      else if (avgAge <= 24 || youngPlayers > oldPlayers * 1.5) ageTendency = "young";
      
      // Combined classification: strength matters more than age
      // A team needs both competitive strength AND age profile to be a contender
      let teamProfile: "contender" | "balanced" | "rebuild" = "balanced";
      if (avgStrength >= 0.55 && bottomThirdCount <= 1) {
        teamProfile = "contender";
      } else if (avgStrength >= 0.40 && topThirdCount >= 2 && ageTendency === "old") {
        teamProfile = "contender";
      } else if (bottomThirdCount >= 3 || avgStrength < 0.25) {
        teamProfile = "rebuild";
      } else if (ageTendency === "young" && avgStrength < 0.40) {
        teamProfile = "rebuild";
      } else if (ageTendency === "old" && avgStrength < 0.33) {
        teamProfile = "rebuild";
      }

      // Build quality tier analysis for each position
      // Uses both production stats AND dynasty value to classify players:
      //   - Elite: proven top-tier production OR very high dynasty value (handles injury/limited games)
      //   - Starter: solid production OR strong dynasty value
      //   - Depth: everything else (speculative, unproven, low value)
      const eliteValueThreshold = 7000;
      const starterValueThreshold = 4000;
      const positionQuality: Record<string, { eliteCount: number; starterCount: number; depthCount: number; totalCount: number; hasProvenSurplus: boolean; bestPlayerPPG: number }> = {};
      for (const pos of positions) {
        const players = userPositionPlayers[pos];
        const eliteThreshold = elitePPG[pos];
        const starterThreshold = starterPPG[pos];

        const elites = players.filter(p =>
          (p.gp >= 4 && p.ppg >= eliteThreshold) || p.value >= eliteValueThreshold
        );
        const nonElites = players.filter(p => !elites.includes(p));
        const starters = nonElites.filter(p =>
          (p.gp >= 4 && p.ppg >= starterThreshold) || p.value >= starterValueThreshold
        );
        const depth = nonElites.filter(p => !starters.includes(p));
        const neededStarters = Math.ceil(effectiveDemand[pos]);
        const provenCount = elites.length + starters.length;

        positionQuality[pos] = {
          eliteCount: elites.length,
          starterCount: starters.length,
          depthCount: depth.length,
          totalCount: players.length,
          hasProvenSurplus: provenCount > neededStarters,
          bestPlayerPPG: players[0]?.ppg || 0,
        };
      }

      // Find biggest need — weighted by how far below league median + format demand
      let biggestNeed: { position: string; rank: number; total: number; message: string } | null = null;
      let worstNeedScore = -Infinity;
      for (const pos of positions) {
        const rank = positionRanks[pos].rank;
        const demand = effectiveDemand[pos];
        const quality = positionQuality[pos];
        const provenCount = quality.eliteCount + quality.starterCount;
        const neededStarters = Math.ceil(demand);
        const starterGap = neededStarters - provenCount;
        const rankPct = rank / leagueSize;
        // Need score: combines league rank percentile (0-1, higher = worse) + starter gap
        const needScore = rankPct + (starterGap > 0 ? starterGap * 0.25 : 0);
        if (needScore > worstNeedScore) {
          worstNeedScore = needScore;
          biggestNeed = {
            position: pos,
            rank,
            total: leagueSize,
            message: provenCount < neededStarters
              ? `Your ${pos} room ranks #${rank} of ${leagueSize} — you need ${starterGap} more proven starter${starterGap > 1 ? "s" : ""}`
              : `Your ${pos} room ranks #${rank} of ${leagueSize}`
          };
        }
      }

      // Generate format-aware, quality-aware recommendations
      const recommendations: Array<{ type: string; priority: "high" | "medium" | "low"; title: string; description: string; action?: string }> = [];

      // Find strongest position (for trade-from suggestions)
      const strongestPos = positions.reduce((strongest, pos) => {
        if (!strongest || positionRanks[pos].rank < positionRanks[strongest].rank) return pos;
        return strongest;
      }, null as string | null);

      // 1. Waiver recommendation — only if position truly needs help
      if (biggestNeed && biggestNeed.rank > leagueSize / 2) {
        const quality = positionQuality[biggestNeed.position];
        const neededStarters = Math.ceil(effectiveDemand[biggestNeed.position]);
        const provenCount = quality.eliteCount + quality.starterCount;

        if (provenCount < neededStarters) {
          recommendations.push({
            type: "waiver",
            priority: "high",
            title: `Upgrade ${biggestNeed.position}`,
            description: `You have ${provenCount} proven ${biggestNeed.position}${provenCount !== 1 ? "s" : ""} but need ~${neededStarters} starters in this format. Look for a reliable producer.`,
            action: `/league/waivers?id=${leagueId}&position=${biggestNeed.position}`,
          });
        } else {
          recommendations.push({
            type: "waiver",
            priority: "medium",
            title: `Add ${biggestNeed.position} depth`,
            description: `Your ${biggestNeed.position} room ranks #${biggestNeed.rank} — consider adding depth behind your starters.`,
            action: `/league/waivers?id=${leagueId}&position=${biggestNeed.position}`,
          });
        }
      }

      // 2. Trade recommendation — format-aware, quality-aware
      if (strongestPos && biggestNeed && strongestPos !== biggestNeed.position) {
        const strongQuality = positionQuality[strongestPos];
        const weakQuality = positionQuality[biggestNeed.position];
        const strongRank = positionRanks[strongestPos].rank;
        const weakRank = positionRanks[biggestNeed.position].rank;

        if (strongRank <= 3 && weakRank > leagueSize / 2) {
          // Only recommend trading from strongest if they have PROVEN surplus
          if (strongQuality.hasProvenSurplus) {
            const surplusProven = (strongQuality.eliteCount + strongQuality.starterCount) - Math.ceil(effectiveDemand[strongestPos]);
            if (surplusProven > 0) {
              // Check if target position actually needs a proven asset or just depth
              const targetNeedsElite = weakQuality.eliteCount === 0;
              recommendations.push({
                type: "trade",
                priority: "high",
                title: targetNeedsElite
                  ? `Trade ${strongestPos} depth for a ${biggestNeed.position} upgrade`
                  : `Move ${strongestPos} surplus to bolster ${biggestNeed.position}`,
                description: `You have ${surplusProven} extra proven ${strongestPos}${surplusProven > 1 ? "s" : ""} beyond what you start. ${
                  targetNeedsElite
                    ? `Your ${biggestNeed.position} room lacks an elite option — package depth for a top-end upgrade.`
                    : `Consider moving a piece for ${biggestNeed.position} help.`
                }`,
                action: `/league/trade?id=${leagueId}`,
              });
            }
          } else {
            // Strong rank but no proven surplus — mostly young/speculative assets
            // Don't recommend trading them, they're upside pieces not tradeable surplus
            if (teamProfile === "contender") {
              recommendations.push({
                type: "trade",
                priority: "medium",
                title: `Target a proven ${biggestNeed.position}`,
                description: `As a contender, look to acquire an established ${biggestNeed.position} — your ${strongestPos} group ranks well but your assets there are mostly upside plays, not tradeable surplus.`,
                action: `/league/trade?id=${leagueId}`,
              });
            }
          }
        }
      }

      // 3. Format-specific recommendation for SF/Flex leagues
      if (isSuperflex && positionRanks["QB"]?.rank > leagueSize * 0.6) {
        const qbQuality = positionQuality["QB"];
        if (qbQuality.eliteCount + qbQuality.starterCount < 2) {
          recommendations.push({
            type: "trade",
            priority: "high",
            title: "Acquire a starting QB",
            description: `In Superflex, QB is king. You only have ${qbQuality.eliteCount + qbQuality.starterCount} reliable QB${qbQuality.eliteCount + qbQuality.starterCount !== 1 ? "s" : ""} — a 2nd starter will significantly boost your weekly floor.`,
            action: `/league/trade?id=${leagueId}`,
          });
        }
      }

      // 4. Leverage strength recommendation (for positions where user has elite assets in flex-heavy formats)
      if (totalFlexSlots >= 2 && strongestPos && ["WR", "RB"].includes(strongestPos)) {
        const quality = positionQuality[strongestPos];
        if (quality.eliteCount >= 2 && positionRanks[strongestPos].rank <= 2) {
          // Don't tell them to add depth — they should leverage their elite players through flex
          const alreadyHasTradeRec = recommendations.some(r => r.type === "trade");
          if (!alreadyHasTradeRec) {
            recommendations.push({
              type: "strategy",
              priority: "low",
              title: `Leverage your elite ${strongestPos} room`,
              description: `With ${quality.eliteCount} elite ${strongestPos}s and ${totalFlexSlots} flex spots, your ${strongestPos} room is a huge advantage. Keep starting them in flex — no need to trade strength away.`,
            });
          }
        }
      }

      // 5. Lineup check
      recommendations.push({
        type: "lineup",
        priority: "low",
        title: "Review your lineup",
        description: "Make sure your best players are in the starting spots.",
        action: `/league/lineup?id=${leagueId}`,
      });

      // Generate weekly blurb based on combined strength + age profile
      const formatNote = isSuperflex ? " (Superflex)" : totalFlexSlots >= 2 ? ` (${totalFlexSlots} Flex)` : "";
      let weeklyBlurb: string;
      if (teamProfile === "contender") {
        weeklyBlurb = `Your roster is built to win now${formatNote}. Focus on maximizing points and making win-now moves.`;
      } else if (teamProfile === "rebuild") {
        if (ageTendency === "old" && avgStrength < 0.33) {
          weeklyBlurb = `Your roster skews older but lacks competitive depth${formatNote}. Consider selling aging assets for younger talent and future picks.`;
        } else if (bottomThirdCount >= 3) {
          weeklyBlurb = `Multiple position groups need work${formatNote}. Focus on acquiring picks and young upside players to build a foundation.`;
        } else {
          weeklyBlurb = `Your roster has upside but needs development${formatNote}. Prioritize acquiring future picks and developing your young players.`;
        }
      } else {
        if (topThirdCount >= 1 && bottomThirdCount >= 1) {
          weeklyBlurb = `Your roster is a mix of strengths and gaps${formatNote}. Shore up your weak spots to push into contention.`;
        } else {
          weeklyBlurb = `Your roster is well-balanced${formatNote}. Look for opportunities to tip the scales in your favor.`;
        }
      }

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

  // Smart Trade Ideas API - generates AI-powered trade suggestions (Premium)
  app.get("/api/fantasy/trade-ideas", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
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
          consensusValue,
          0.5,
          dynastyEngine.parseLeagueRosterSettings(league)
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
        fairnessScore: number; // 0-100 percentage, 50 = perfectly fair
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
                    if (fairnessScore >= 50 && give.value >= 1500 && get.value >= 1500) {
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

  // Draft War Room API - Get league drafts and picks (Premium)
  app.get("/api/fantasy/drafts/:leagueId", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      
      const drafts = await sleeperApi.getLeagueDrafts(leagueId);
      res.json({ drafts });
    } catch (error) {
      console.error("Error fetching drafts:", error);
      res.status(500).json({ message: "Failed to fetch drafts" });
    }
  });

  // Draft picks (Premium)
  app.get("/api/fantasy/draft/:draftId/picks", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
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

  // Draft War Room - Get smart pick recommendations (Premium)
  app.get("/api/fantasy/draft-recommendations/:leagueId", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { leagueId } = req.params;
      const { draftId, mode: requestedMode } = req.query;
      
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

      // Handle invalid/missing league
      if (!league) {
        return res.status(404).json({ message: "League not found. Please select a valid league." });
      }

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

      let mode = requestedMode as string;
      if (!mode && activeDraft) {
        const rounds = activeDraft.settings?.rounds || 0;
        if (rounds > 10) {
          mode = "startup";
        } else {
          mode = "rookie";
        }
      } else if (!mode) {
        mode = "rookie";
      }

      // Get user's draft picks from this draft
      const userDraftPicks: any[] = [];
      const userRosterId = userRoster?.roster_id;
      
      // Helper function to calculate within-round pick position
      const calculateWithinRoundPick = (round: number, draftSlot: number, numTeams: number) => {
        const reversalRound = activeDraft?.settings?.reversal_round || 1;
        const draftType = activeDraft?.type || "snake";
        
        if (draftType === "linear") {
          return draftSlot;
        }
        
        // Snake draft with reversal_round setting:
        // reversal_round = the specific round where direction STAYS the same (no flip)
        // Example with reversal_round = 3:
        //   Round 1: Normal (1→12), Round 2: Reversed (12→1)
        //   Round 3: STAYS reversed (12→1) - the reversal round skips the flip
        //   Round 4: Normal (1→12), Round 5: Reversed (12→1), Round 6: Normal (1→12)
        
        // Track direction changes by simulating round-by-round
        let isReversed = false;
        for (let r = 2; r <= round; r++) {
          // On the reversal_round, direction stays the same (skip the flip)
          if (r === reversalRound) {
            continue;
          }
          // Normal snake behavior: flip direction each round
          isReversed = !isReversed;
        }
        
        return isReversed ? numTeams - draftSlot + 1 : draftSlot;
      };
      
      const numTeams = activeDraft?.settings?.teams || 12;
      
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
              slot: calculateWithinRoundPick(pick.round, pick.draft_slot, numTeams),
              pickNo: pick.pick_no, // Use actual pick_no from API - correct for both snake and linear drafts
            });
          }
        }
      }

      // Determine if league supports IDP positions based on roster_positions
      const leagueRosterPositions = league?.roster_positions || [];
      const IDP_ROSTER_SLOTS = ["DL", "LB", "DB", "IDP_FLEX", "EDGE", "DL1T", "DL3T", "DL5T", "ILB", "CB", "S"];
      const IDP_POSITION_GROUPS = new Set(["EDGE", "DL", "LB", "CB", "S"]);
      const hasIDPSlots = leagueRosterPositions.some((pos: string) => IDP_ROSTER_SLOTS.includes(pos));

      // Analyze roster needs - include BOTH existing roster AND user's draft picks from this draft
      const positionCounts: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
      
      // Add IDP position tracking if league has IDP slots
      if (hasIDPSlots) {
        // Count IDP roster slot targets from league settings
        for (const pos of leagueRosterPositions) {
          if (IDP_ROSTER_SLOTS.includes(pos)) {
            // Map IDP slots to trackable position groups
            if (pos === "DL" || pos === "DL1T" || pos === "DL3T" || pos === "DL5T") {
              if (!positionCounts["DL"]) positionCounts["DL"] = 0;
            } else if (pos === "LB" || pos === "ILB") {
              if (!positionCounts["LB"]) positionCounts["LB"] = 0;
            } else if (pos === "DB" || pos === "CB") {
              if (!positionCounts["CB"]) positionCounts["CB"] = 0;
            } else if (pos === "S") {
              if (!positionCounts["S"]) positionCounts["S"] = 0;
            } else if (pos === "EDGE") {
              if (!positionCounts["EDGE"]) positionCounts["EDGE"] = 0;
            } else if (pos === "IDP_FLEX") {
              // IDP_FLEX can be filled by any IDP - ensure all IDP groups are tracked
              if (!positionCounts["DL"]) positionCounts["DL"] = 0;
              if (!positionCounts["LB"]) positionCounts["LB"] = 0;
              if (!positionCounts["CB"]) positionCounts["CB"] = 0;
              if (!positionCounts["S"]) positionCounts["S"] = 0;
              if (!positionCounts["EDGE"]) positionCounts["EDGE"] = 0;
            }
          }
        }
      }
      
      // Map specific IDP positions to their tracked group
      const mapToIDPGroup = (pos: string): string => {
        if (["DL", "DE", "DT", "DL1T", "DL3T", "DL5T"].includes(pos)) return "DL";
        if (["LB", "ILB", "OLB"].includes(pos)) return "LB";
        if (["CB"].includes(pos)) return "CB";
        if (["S", "SS", "FS"].includes(pos)) return "S";
        if (["EDGE"].includes(pos)) return "EDGE";
        if (["DB"].includes(pos)) return "CB"; // DB maps to CB group
        return pos;
      };
      
      const rosterPlayers: any[] = [];
      const countedPlayerIds = new Set<string>(); // Prevent double-counting
      
      // Count existing roster players
      if (userRoster?.players) {
        for (const playerId of userRoster.players) {
          countedPlayerIds.add(playerId);
          const player = allPlayers[playerId];
          if (player?.position) {
            const countPos = hasIDPSlots && IDP_POSITION_GROUPS.has(player.position) 
              ? mapToIDPGroup(player.position) 
              : player.position;
            positionCounts[countPos] = (positionCounts[countPos] || 0) + 1;
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
        
        const countPos = hasIDPSlots && IDP_POSITION_GROUPS.has(pick.position)
          ? mapToIDPGroup(pick.position)
          : pick.position;
        
        countedPlayerIds.add(pick.playerId);
        positionCounts[countPos] = (positionCounts[countPos] || 0) + 1;
        rosterPlayers.push({
          id: pick.playerId,
          name: pick.name,
          position: pick.position,
          age: allPlayers[pick.playerId]?.age,
          ppg: 0,
        });
      }

      // Calculate roster age average
      const ages = rosterPlayers.filter(p => p.age).map(p => p.age);
      const avgAge = ages.length > 0 ? ages.reduce((a, b) => a + b, 0) / ages.length : 0;

      // Determine biggest needs based on position counts
      // Calculate IDP slot targets from league roster settings
      const idpSlotCounts: Record<string, number> = {};
      if (hasIDPSlots) {
        for (const pos of leagueRosterPositions) {
          if (pos === "DL" || pos === "DL1T" || pos === "DL3T" || pos === "DL5T") {
            idpSlotCounts["DL"] = (idpSlotCounts["DL"] || 0) + 1;
          } else if (pos === "LB" || pos === "ILB") {
            idpSlotCounts["LB"] = (idpSlotCounts["LB"] || 0) + 1;
          } else if (pos === "DB" || pos === "CB") {
            idpSlotCounts["CB"] = (idpSlotCounts["CB"] || 0) + 1;
          } else if (pos === "S") {
            idpSlotCounts["S"] = (idpSlotCounts["S"] || 0) + 1;
          } else if (pos === "EDGE") {
            idpSlotCounts["EDGE"] = (idpSlotCounts["EDGE"] || 0) + 1;
          }
        }
      }
      
      const needs: string[] = [];
      if (positionCounts.QB < 2 && isSuperflex) needs.push("QB");
      if (positionCounts.RB < 4) needs.push("RB");
      if (positionCounts.WR < 5) needs.push("WR");
      if (positionCounts.TE < 2) needs.push("TE");
      
      // Add IDP needs if league has IDP slots
      if (hasIDPSlots) {
        for (const [idpPos, slotCount] of Object.entries(idpSlotCounts)) {
          const currentCount = positionCounts[idpPos] || 0;
          // Need at least 1.5x the required starters for depth
          const targetCount = Math.ceil(slotCount * 1.5);
          if (currentCount < targetCount) {
            needs.push(idpPos);
          }
        }
      }

      // Get available players (not drafted yet)
      const draftedPlayerIds = new Set(draftPicks.map(p => p.player_id));
      
      // Draft phase intelligence
      const currentRound = Math.floor(draftPicks.length / numTeams) + 1;
      
      // Calculate positional starter slots for scarcity analysis
      const positionStarterSlots: Record<string, number> = {};
      for (const pos of leagueRosterPositions) {
        if (["QB","RB","WR","TE"].includes(pos) || (pos === "FLEX") || (pos === "SUPER_FLEX") || (pos === "REC_FLEX")) {
          if (pos === "FLEX") { positionStarterSlots["RB"] = (positionStarterSlots["RB"] || 0) + 0.33; positionStarterSlots["WR"] = (positionStarterSlots["WR"] || 0) + 0.33; positionStarterSlots["TE"] = (positionStarterSlots["TE"] || 0) + 0.34; }
          else if (pos === "SUPER_FLEX") { positionStarterSlots["QB"] = (positionStarterSlots["QB"] || 0) + 0.5; positionStarterSlots["RB"] = (positionStarterSlots["RB"] || 0) + 0.17; positionStarterSlots["WR"] = (positionStarterSlots["WR"] || 0) + 0.17; positionStarterSlots["TE"] = (positionStarterSlots["TE"] || 0) + 0.16; }
          else if (pos === "REC_FLEX") { positionStarterSlots["WR"] = (positionStarterSlots["WR"] || 0) + 0.5; positionStarterSlots["TE"] = (positionStarterSlots["TE"] || 0) + 0.5; }
          else { positionStarterSlots[pos] = (positionStarterSlots[pos] || 0) + 1; }
        }
      }
      
      // Build player recommendations
      const availablePlayers: any[] = [];
      const isRookieDraft = mode === "rookie";
      
      if (isRookieDraft) {
        // ROOKIE DRAFT: Use curated 2026 Draft Board data instead of Sleeper's generic player pool
        const { getDraft2026Players } = await import('./draft-2026-data');
        const draftBoardPlayers = getDraft2026Players();
        
        // Normalize names by stripping suffixes like Jr., Sr., II, III, IV, V
        const NAME_SUFFIXES = /\s+(jr\.?|sr\.?|ii|iii|iv|v|2nd|3rd)$/i;
        const normalizeName = (name: string) => name.toLowerCase().trim().replace(NAME_SUFFIXES, '').trim();
        const getLastName = (fullName: string) => {
          const cleaned = fullName.replace(NAME_SUFFIXES, '').trim();
          return cleaned.split(' ').slice(-1)[0]?.toLowerCase() || '';
        };
        
        // Build a map of drafted player names for matching (since draft board uses custom IDs)
        const draftedPlayerNames = new Set<string>();
        const draftedNormalizedNames = new Set<string>();
        const draftedLastNamePos = new Set<string>();
        for (const pick of draftPicks) {
          const p = allPlayers[pick.player_id];
          if (p?.full_name) {
            draftedPlayerNames.add(p.full_name.toLowerCase());
            draftedNormalizedNames.add(normalizeName(p.full_name));
            const lastName = getLastName(p.full_name);
            if (lastName && p.position) {
              draftedLastNamePos.add(`${lastName}|${p.position}`);
            }
          }
          if (pick.metadata?.first_name && pick.metadata?.last_name) {
            const metaName = `${pick.metadata.first_name} ${pick.metadata.last_name}`;
            draftedPlayerNames.add(metaName.toLowerCase());
            draftedNormalizedNames.add(normalizeName(metaName));
            const pos = pick.metadata?.position || p?.position;
            if (pos) {
              draftedLastNamePos.add(`${getLastName(metaName)}|${pos}`);
            }
          }
          
          // In devy leagues, K/DEF/retired players are placeholders - resolve the actual prospect name
          // from commissioner notes on the roster that drafted the player
          const pickPos = pick.metadata?.position || p?.position;
          const isPlaceholder = ["K", "DEF"].includes(pickPos) || (!p?.team && p?.status === "Inactive");
          if (isPlaceholder) {
            const draftingRoster = rosters.find(r => r.roster_id === pick.roster_id);
            if (draftingRoster?.metadata) {
              for (const [key, val] of Object.entries(draftingRoster.metadata)) {
                if (key.includes(pick.player_id) && val && typeof val === 'string') {
                  const parsed = parseDevyNote(val);
                  if (parsed) {
                    draftedPlayerNames.add(parsed.devyName.toLowerCase());
                    draftedNormalizedNames.add(normalizeName(parsed.devyName));
                    const devyLast = getLastName(parsed.devyName);
                    if (devyLast && parsed.devyPosition) {
                      draftedLastNamePos.add(`${devyLast}|${parsed.devyPosition}`);
                    }
                    break;
                  }
                }
              }
            }
          }
        }
        
        // Also check all roster players across all teams to exclude already-owned prospects
        const ownedPlayerNames = new Set<string>();
        const ownedNormalizedNames = new Set<string>();
        const ownedLastNamePos = new Set<string>();
        for (const roster of rosters) {
          if (!roster?.players) continue;
          for (const pid of roster.players) {
            const p = allPlayers[pid];
            if (p?.full_name) {
              ownedPlayerNames.add(p.full_name.toLowerCase());
              ownedNormalizedNames.add(normalizeName(p.full_name));
              const lastName = getLastName(p.full_name);
              if (lastName && p.position) {
                ownedLastNamePos.add(`${lastName}|${p.position}`);
              }
            }
          }
          if (roster?.metadata) {
            for (const [key, val] of Object.entries(roster.metadata)) {
              if (!val || typeof val !== 'string') continue;
              if (key.startsWith('p_nick_') || key.startsWith('p_note_')) {
                const parsed = parseDevyNote(val.trim());
                if (parsed) {
                  ownedPlayerNames.add(parsed.devyName.toLowerCase());
                  ownedNormalizedNames.add(normalizeName(parsed.devyName));
                  const devyLast = getLastName(parsed.devyName);
                  if (devyLast && parsed.devyPosition) {
                    ownedLastNamePos.add(`${devyLast}|${parsed.devyPosition}`);
                  }
                }
              }
            }
          }
        }
        
        const isProspectTaken = (prospectName: string, prospectPos: string) => {
          const nameLower = prospectName.toLowerCase();
          const nameNormalized = normalizeName(prospectName);
          if (draftedPlayerNames.has(nameLower)) return true;
          if (draftedNormalizedNames.has(nameNormalized)) return true;
          if (ownedPlayerNames.has(nameLower)) return true;
          if (ownedNormalizedNames.has(nameNormalized)) return true;
          const lastName = getLastName(prospectName);
          if (lastName) {
            const posGroup = prospectPos.replace(/[0-9T]/g, '') || prospectPos;
            const posVariants = [prospectPos, posGroup];
            if (["WRS"].includes(prospectPos)) posVariants.push("WR");
            if (["ILB"].includes(prospectPos)) posVariants.push("LB");
            for (const pv of posVariants) {
              if (draftedLastNamePos.has(`${lastName}|${pv}`)) return true;
              if (ownedLastNamePos.has(`${lastName}|${pv}`)) return true;
            }
          }
          return false;
        };
        
        for (const prospect of draftBoardPlayers) {
          if (isProspectTaken(prospect.name, prospect.position)) continue;
          
          if (!hasIDPSlots && IDP_POSITION_GROUPS.has(prospect.positionGroup)) continue;
          
          const totalProspects = draftBoardPlayers.length;
          const baseValue = Math.max(10, 95 - ((prospect.rank - 1) / Math.max(1, totalProspects - 1)) * 85);
          
          let stockAdjust = 0;
          if (prospect.stockStatus === 'rising') stockAdjust = prospect.stockChange * 0.3;
          if (prospect.stockStatus === 'falling') stockAdjust = -prospect.stockChange * 0.3;
          
          const value = Math.round(Math.max(5, Math.min(99, baseValue + stockAdjust)));
          
          const mappedPos = prospect.positionGroup;
          const needFit = needs.includes(mappedPos) ? "High" : "Medium";
          
          const tags: string[] = [];
          if (prospect.stockStatus === 'rising') tags.push("High Upside");
          if (needFit === "High") tags.push("Roster Stabilizer");
          if (prospect.rank <= 15) tags.push("Elite Prospect");
          if (prospect.rank > 30 && prospect.stockStatus === 'rising') tags.push("Boom/Bust Dart");
          
          const tier = prospect.rank <= 10 ? 1 : prospect.rank <= 30 ? 2 : prospect.rank <= 60 ? 3 : 4;
          
          let recScore: number;
          if (currentRound <= 2) {
            recScore = value * 10;
          } else if (currentRound <= 5) {
            recScore = value * 8 + (needFit === "High" ? 150 : 0);
          } else {
            recScore = value * 5 + (needFit === "High" ? 250 : 0) + (prospect.stockStatus === 'rising' ? 200 : 0);
          }
          
          availablePlayers.push({
            playerId: prospect.id,
            name: prospect.name,
            position: prospect.position,
            team: prospect.college,
            age: null,
            value,
            recScore: Math.round(recScore),
            needFit,
            ppg: 0,
            tags,
            tier,
            upsideScore: prospect.stockStatus === 'rising' ? 80 : prospect.stockStatus === 'falling' ? 30 : 50,
            roleProbability: null,
            scarcity: null,
            leverageScore: null,
            depthChartOrder: null,
            explanation: null,
            draftRank: prospect.rank,
            college: prospect.college,
            stockStatus: prospect.stockStatus,
            stockChange: prospect.stockChange,
            scouting: prospect.scouting,
            intangibles: prospect.intangibles,
          });
        }
      } else {
        // STARTUP DRAFT: Use Sleeper player pool with dynasty values
        const leagueScoring = dynastyEngine.parseLeagueScoringSettings(league);
        const rosterSettings = dynastyEngine.parseLeagueRosterSettings(league);
        
        const OFFENSIVE_POSITIONS = new Set(["QB", "RB", "WR", "TE"]);
        const IDP_POSITIONS_SET = new Set(["DL", "LB", "DB", "EDGE", "CB", "S", "SAF", "DE", "DT", "ILB", "OLB", "SS", "FS"]);
        const allowedPositions = new Set(OFFENSIVE_POSITIONS);
        if (hasIDPSlots) {
          Array.from(IDP_POSITIONS_SET).forEach(pos => allowedPositions.add(pos));
        }
        
        const draftedStartupNames = new Set<string>();
        for (const pick of draftPicks) {
          const p = allPlayers[pick.player_id];
          if (p?.full_name) draftedStartupNames.add(p.full_name.toLowerCase().trim());
          if (pick.metadata?.first_name && pick.metadata?.last_name) {
            draftedStartupNames.add(`${pick.metadata.first_name} ${pick.metadata.last_name}`.toLowerCase().trim());
          }
        }
        
        // HARD RELEVANCE FILTER — dynasty-irrelevant players never enter pipeline
        const STARTUP_AGE_CEILING: Record<string, number> = { QB: 38, RB: 29, WR: 31, TE: 32, K: 40, DEF: 99, LB: 32, DL: 32, DB: 32, EDGE: 32, CB: 32, S: 32, SAF: 32, DE: 32, DT: 32, ILB: 32, OLB: 32, SS: 32, FS: 32 };
        const STARTUP_VALUE_FLOOR = 1500;

        // First pass: collect candidate players with base data
        const startupCandidates: { playerId: string; player: any; blendedValue: any; gamesPlayed: number; ppg: number; needFit: string; depthOrder: number; upsideScore: number; roleProbability: number; rosterNeedFit: number }[] = [];
        
        for (const [playerId, player] of Object.entries(allPlayers)) {
          if (draftedPlayerIds.has(playerId)) continue;
          if (!player || !player.position) continue;
          if (!allowedPositions.has(player.position)) continue;
          
          const yearsExp = player.years_exp || 0;
          const hasTeam = player.team && player.team !== "";
          const playerStatus = player.status;
          
          if (yearsExp === 0 && !hasTeam) continue;
          if (!hasTeam && playerStatus === "Inactive") continue;
          if (playerStatus === "Inactive" && (player.search_rank || 9999) > 1000) continue;
          const fantasyPos = player.fantasy_positions || [player.position];
          if (!fantasyPos.some((fp: string) => allowedPositions.has(fp))) continue;

          const playerAge = player.age || 99;
          const ageCeiling = STARTUP_AGE_CEILING[player.position] || 32;
          if (playerAge > ageCeiling) continue;

          const isFreeAgent = !player.team || player.team === "" || player.team === "FA";
          const isPracticeSquad = player.practice_squad || false;
          const searchRank = player.search_rank || 9999;
          if (isFreeAgent && searchRank > 500) continue;
          if (isPracticeSquad && searchRank > 500) continue;
          if (!isFreeAgent && searchRank > 2000) continue;
          
          const playerName = player.full_name || `${player.first_name} ${player.last_name}`;
          if (draftedStartupNames.has(playerName.toLowerCase().trim())) continue;
          
          const playerStats = stats?.[playerId] || {};
          const gamesPlayed = playerStats.gp || 0;
          const ppg = gamesPlayed > 0 ? (playerStats.pts_ppr || 0) / gamesPlayed : 0;
          
          const consensusValue = dynastyConsensusService.getNormalizedValue(playerName, player.position, isSuperflex);
          const posForValue = IDP_POSITIONS_SET.has(player.position) ? player.position : player.position;
          
          const blendedValue = dynastyEngine.getBlendedPlayerValue(
            playerId,
            playerName,
            posForValue,
            player.age || null,
            yearsExp,
            player.injury_status || null,
            { points: playerStats.pts_ppr || 0, games: gamesPlayed, ppg },
            player.depth_chart_order || null,
            leagueScoring,
            consensusValue,
            0.5,
            rosterSettings
          );

          if (currentRound <= 12 && blendedValue.value <= STARTUP_VALUE_FLOOR) continue;
          
          const depthOrder = player.depth_chart_order || 99;
          const hasTeamVal = player.team && player.team !== "" && player.team !== "FA" ? 1 : 0;
          const snapFactor = gamesPlayed >= 14 ? 1.0 : gamesPlayed >= 8 ? 0.7 : gamesPlayed >= 1 ? 0.4 : 0.15;
          const depthFactor = depthOrder <= 1 ? 1.0 : depthOrder <= 2 ? 0.7 : depthOrder <= 3 ? 0.4 : 0.2;
          const roleProbability = hasTeamVal * (snapFactor * 0.5 + depthFactor * 0.5);
          
          if (currentRound > 15) {
            const isActive = player.team && player.team !== "" && player.team !== "FA";
            if (!isActive || roleProbability < 0.20) {
              continue;
            }
          }
          
          const ageVal = player.age || 26;
          const upsideScore = ageVal <= 23 ? 1.0 : ageVal <= 25 ? 0.8 : ageVal <= 27 ? 0.5 : ageVal <= 30 ? 0.3 : 0.1;
          
          const mappedPos = hasIDPSlots && IDP_POSITIONS_SET.has(player.position) ? mapToIDPGroup(player.position) : player.position;
          const needFit = needs.includes(player.position) || needs.includes(mappedPos) ? "High" : "Medium";
          const rosterNeedFit = needs.includes(player.position) ? 1.0 : 0.5;
          
          startupCandidates.push({ playerId, player, blendedValue, gamesPlayed, ppg, needFit, depthOrder, upsideScore, roleProbability, rosterNeedFit });
        }
        
        // Compute positional scarcity from collected candidates
        const viableByPosition: Record<string, number> = {};
        for (const c of startupCandidates) { viableByPosition[c.player.position] = (viableByPosition[c.player.position] || 0) + 1; }
        const getScarcity = (pos: string) => {
          const viable = viableByPosition[pos] || 1;
          const slots = positionStarterSlots[pos] || 1;
          const ratio = viable / (slots * numTeams);
          return ratio <= 1 ? 1.0 : ratio <= 2 ? 0.8 : ratio <= 3 ? 0.5 : ratio <= 5 ? 0.3 : 0.1;
        };
        
        // Second pass: compute recScore with scarcity and push to availablePlayers
        for (const c of startupCandidates) {
          const { playerId, player, blendedValue, gamesPlayed, ppg, needFit, depthOrder, upsideScore, roleProbability, rosterNeedFit } = c;
          
          const yearsExp = player.years_exp || 0;
          const hasActiveRole = depthOrder <= 2 || gamesPlayed >= 8 || ppg >= 5.0;
          if (currentRound <= 18) {
            if (yearsExp >= 2 && gamesPlayed === 0 && ppg === 0 && depthOrder > 2) continue;
            if (yearsExp >= 2 && !hasActiveRole && blendedValue.value < 3000) continue;
            if (yearsExp >= 1 && gamesPlayed === 0 && depthOrder > 3) continue;
          }

          let recScore: number;
          if (currentRound <= 5) {
            recScore = blendedValue.value * 0.70 + (upsideScore * 1000) * 0.10 + (roleProbability * 1000) * 0.15 + (rosterNeedFit * 1000) * 0.05;
          } else if (currentRound <= 15) {
            recScore = blendedValue.value * 0.40 + (upsideScore * 1000) * 0.20 + (roleProbability * 1000) * 0.15 + (getScarcity(player.position) * 1000) * 0.10 + (rosterNeedFit * 1000) * 0.15;
          } else if (currentRound <= 30) {
            recScore = blendedValue.value * 0.20 + (upsideScore * 1000) * 0.30 + (roleProbability * 1000) * 0.25 + (getScarcity(player.position) * 1000) * 0.10 + (rosterNeedFit * 1000) * 0.15;
          } else {
            recScore = (upsideScore * 1000) * 0.40 + (roleProbability * 1000) * 0.25 + (getScarcity(player.position) * 1000) * 0.20 + (rosterNeedFit * 1000) * 0.15;
          }
          
          let leverageMultiplier = 1.0;
          if (currentRound > 15) {
            if (player.position === "RB" && depthOrder === 2 && gamesPlayed < 10) {
              leverageMultiplier = 1.3;
            }
            if (depthOrder === 2 && player.injury_status === null && gamesPlayed >= 1) {
              leverageMultiplier = Math.max(leverageMultiplier, 1.15);
            }
          }
          recScore *= leverageMultiplier;

          const isRookie = yearsExp === 0;
          if (isRookie && currentRound <= 8) {
            recScore *= 1.1;
          }
          if (isRookie && currentRound > 18) {
            recScore *= 1.2;
          }
          if (!isRookie && currentRound > 20 && roleProbability >= 0.40) {
            recScore *= 1.15;
          }
          
          const tags: string[] = [];
          if (upsideScore >= 0.8) tags.push("High Upside");
          if (player.position === "RB" && depthOrder === 2) tags.push("Handcuff");
          if (depthOrder === 2 && player.injury_status === null && gamesPlayed >= 1) tags.push("Injury-Away Value");
          if (getScarcity(player.position) >= 0.7) tags.push("Scarcity Play");
          if (rosterNeedFit >= 1.0) tags.push("Roster Stabilizer");
          if (upsideScore >= 0.6 && roleProbability < 0.4) tags.push("Boom/Bust Dart");
          
          let tier: number;
          if (recScore >= 800) tier = 1;
          else if (recScore >= 500) tier = 2;
          else if (recScore >= 300) tier = 3;
          else tier = 4;
          
          availablePlayers.push({
            playerId,
            name: player.full_name,
            position: player.position,
            team: player.team || "FA",
            age: player.age,
            value: blendedValue.value,
            recScore: Math.round(recScore),
            needFit,
            ppg: Math.round(ppg * 10) / 10,
            tags,
            tier,
            upsideScore: Math.round(upsideScore * 100),
            roleProbability: Math.round(roleProbability * 100),
            scarcity: Math.round(getScarcity(player.position) * 100),
            leverageScore: leverageMultiplier > 1 ? Math.round(leverageMultiplier * 100) : null,
            depthChartOrder: depthOrder <= 10 ? depthOrder : null,
            explanation: null,
          });
        }
      }

      // Sort by recScore (falling back to value)
      availablePlayers.sort((a, b) => (b.recScore || b.value) - (a.recScore || a.value));

      // Generate explanations for top 15 players
      for (const p of availablePlayers.slice(0, 15)) {
        const reasons: string[] = [];
        if (p.needFit === "High") reasons.push("Fits roster need");
        if (p.upsideScore >= 80) reasons.push("High ceiling relative to cost");
        if (p.leverageScore) reasons.push("Strong leverage profile");
        if (p.scarcity >= 70) reasons.push("Scarce position");
        if (p.roleProbability >= 70) reasons.push("Strong role security");
        if (p.tier <= 2) reasons.push("Impact-level talent");
        p.explanation = reasons.length > 0 ? reasons.join(" | ") : null;
      }

      // Detect positional runs in last 6 picks
      const hasKickerSlot = leagueRosterPositions.includes("K");
      const hasDefSlot = leagueRosterPositions.includes("DEF");
      
      const recentPicks = draftPicks.slice(-6);
      const positionRuns: Record<string, number> = {};
      for (const pick of recentPicks) {
        const pos = pick.metadata?.position;
        if (!pos) continue;
        
        if (pos === "K" && !hasKickerSlot) continue;
        if (pos === "DEF" && !hasDefSlot) continue;
        
        positionRuns[pos] = (positionRuns[pos] || 0) + 1;
      }

      const activeRuns: { position: string; count: number }[] = [];
      for (const [pos, count] of Object.entries(positionRuns)) {
        if (count >= 3) {
          activeRuns.push({ position: pos, count });
        }
      }

      // Detect tier cliffs
      const tierCliffs: { position: string; message: string }[] = [];
      const posGroups: Record<string, any[]> = {};
      for (const p of availablePlayers.slice(0, 50)) {
        if (!posGroups[p.position]) posGroups[p.position] = [];
        posGroups[p.position].push(p);
      }
      for (const [pos, players] of Object.entries(posGroups)) {
        if (players.length >= 2) {
          const top = players[0];
          const second = players[1];
          const dropoff = (top.recScore || top.value) - (second.recScore || second.value);
          if (dropoff > 200) {
            tierCliffs.push({ position: pos, message: `${pos} Tier Cliff Approaching - big drop after ${top.name}` });
          }
        }
      }

      // Get top recommendations by category (filter out low-role players from top picks)
      const bestValue = availablePlayers
        .filter(p => (p.roleProbability || 0) >= 15 || (p.upsideScore || 0) >= 60)
        .slice(0, 5);
      const bestForNeeds = availablePlayers
        .filter(p => {
          if (needs.includes(p.position)) return true;
          if (p.position === 'WRS' && needs.includes('WR')) return true;
          if (hasIDPSlots) {
            const mapped = mapToIDPGroup(p.position);
            if (needs.includes(mapped)) return true;
          }
          return false;
        })
        .sort((a, b) => (b.recScore || b.value) - (a.recScore || a.value))
        .slice(0, 5);
      const bestUpside = isRookieDraft
        ? availablePlayers
            .filter(p => p.stockStatus === 'rising' || p.draftRank <= 30)
            .sort((a, b) => {
              const aRising = a.stockStatus === 'rising' ? 1 : 0;
              const bRising = b.stockStatus === 'rising' ? 1 : 0;
              if (bRising !== aRising) return bRising - aRising;
              return (a.draftRank || 999) - (b.draftRank || 999);
            })
            .slice(0, 5)
        : [...availablePlayers]
            .sort((a, b) => (b.upsideScore || 0) - (a.upsideScore || 0))
            .slice(0, 5);

      // Detect value drops - players whose draft board rank is much higher than current pick number
      const valueDrops: any[] = [];
      const pickNumber = draftPicks.length + 1;
      
      if (isRookieDraft) {
        // For rookie draft, compare draft board rank vs current pick
        for (const player of availablePlayers.slice(0, 50)) {
          const draftRank = player.draftRank || 999;
          const spotsFallen = pickNumber - draftRank;
          
          if (spotsFallen >= 5 && draftRank <= 100) {
            valueDrops.push({
              ...player,
              expectedPick: draftRank,
              spotsFallen,
            });
          }
        }
      } else {
        // For startup, use dynasty value ranking
        const sortedAll = [...availablePlayers].sort((a, b) => b.value - a.value);
        const globalRankMap = new Map<string, number>();
        sortedAll.forEach((p, idx) => globalRankMap.set(p.playerId, idx + 1));
        
        for (const player of availablePlayers.slice(0, 30)) {
          const globalRank = globalRankMap.get(player.playerId) || 999;
          const spotsFallen = pickNumber - globalRank;
          
          if (spotsFallen >= 10 && globalRank <= 100) {
            valueDrops.push({
              ...player,
              expectedPick: globalRank,
              spotsFallen,
            });
          }
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
          hasIDP: hasIDPSlots,
          idpSlotTargets: hasIDPSlots ? idpSlotCounts : undefined,
        },
        positionalRuns: activeRuns,
        tierCliffs,
        currentRound,
        draftPhase: currentRound <= 5 ? "early" : currentRound <= 15 ? "mid" : currentRound <= 30 ? "late" : "deep",
        mode,
        draft: activeDraft ? {
          id: activeDraft.draft_id,
          status: activeDraft.status,
          type: activeDraft.type,
          rounds: activeDraft.settings?.rounds || 0,
          picksMade: draftPicks.length,
          totalPicks: (activeDraft.settings?.rounds || 0) * (activeDraft.settings?.teams || 0),
          reversalRound: activeDraft.settings?.reversal_round || 1,
        } : null,
        draftBoard: draftPicks
          .filter(p => p.player_id)
          .map(p => {
            const computedPickNo = (p.round - 1) * numTeams + p.draft_slot;
            const pickNo = p.pick_no ?? computedPickNo;
            const playerData = allPlayers[p.player_id];
            const playerName = p.metadata?.first_name ? `${p.metadata.first_name} ${p.metadata.last_name}` : playerData?.full_name || "Unknown";
            const playerPos = p.metadata?.position || playerData?.position || "?";
            const playerTeam = p.metadata?.team || playerData?.team || "FA";
            
            // Check if this is a devy placeholder (K/DEF/retired)
            let devyInfo: { devyName: string; devyPosition: string; devySchool: string } | null = null;
            if (["K", "DEF"].includes(playerPos) || (!playerData?.team && playerData?.status === "Inactive")) {
              // Try to find devy note from the roster that drafted this player
              const draftingRoster = rosters.find(r => r.roster_id === p.roster_id);
              if (draftingRoster?.metadata) {
                for (const [key, val] of Object.entries(draftingRoster.metadata)) {
                  if (key.includes(p.player_id) && val && typeof val === 'string') {
                    const parsed = parseDevyNote(val);
                    if (parsed) {
                      devyInfo = parsed;
                      break;
                    }
                  }
                }
              }
            }
            
            return {
              pickNo,
              round: p.round,
              slot: calculateWithinRoundPick(p.round, p.draft_slot, numTeams),
              rosterId: p.roster_id,
              player: {
                id: p.player_id,
                name: devyInfo ? devyInfo.devyName : playerName,
                position: devyInfo ? devyInfo.devyPosition : playerPos,
                team: devyInfo ? devyInfo.devySchool : playerTeam,
              },
              isDevy: !!devyInfo,
              originalPlayer: devyInfo ? playerName : undefined,
            };
          })
          .sort((a, b) => a.pickNo - b.pickNo),
        myPicks: userDraftPicks.sort((a, b) => a.pickNo - b.pickNo),
      });
    } catch (error) {
      console.error("Error generating draft recommendations:", error);
      res.status(500).json({ message: "Failed to generate draft recommendations" });
    }
  });

  // ===== Manager Profile (AI Learning) Routes =====

  app.get("/api/manager-profile/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { leagueId } = req.params;
      const profile = await storage.getManagerProfile(userId, leagueId);
      if (!profile) {
        return res.json({ profile: null, needsAnalysis: true });
      }
      const hoursSinceUpdate = (Date.now() - new Date(profile.updatedAt!).getTime()) / (1000 * 60 * 60);
      res.json({ profile: profile.profileData, stale: hoursSinceUpdate > 24, lastUpdated: profile.updatedAt, tradesAnalyzed: profile.tradesAnalyzed, transactionsAnalyzed: profile.transactionsAnalyzed });
    } catch (error) {
      console.error("Error fetching manager profile:", error);
      res.status(500).json({ message: "Failed to fetch manager profile" });
    }
  });

  app.post("/api/manager-profile/:leagueId/analyze", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { leagueId } = req.params;
      const userProfile = await storage.getUserProfile(userId);
      if (!userProfile?.sleeperUserId) {
        return res.status(400).json({ message: "Sleeper account not connected" });
      }

      const league = await sleeperApi.getLeague(leagueId);
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      const rosters = await sleeperApi.getLeagueRosters(leagueId);
      const userRoster = rosters?.find((r: any) => r.owner_id === userProfile.sleeperUserId);
      if (!userRoster) {
        return res.status(404).json({ message: "Your roster not found in this league" });
      }

      const userRosterId = userRoster.roster_id;
      const allPlayers = await sleeperApi.getAllPlayers();

      const takeover = await storage.getLeagueTakeover(userId, leagueId);
      const takeoverSeason = takeover?.takeoverSeason || null;

      const leagueHistory = await sleeperApi.getLeagueHistory(leagueId);
      const completedHistory = leagueHistory.filter(h => h.status === "complete" || h.status === "in_season");
      const filteredHistory = takeoverSeason
        ? completedHistory.filter(h => parseInt(h.season) >= takeoverSeason)
        : completedHistory;
      const allTransactions: any[] = [];
      const maxSeasons = 3;
      const seasonsToAnalyze = filteredHistory.slice(0, maxSeasons);

      for (const season of seasonsToAnalyze) {
        try {
          const txns = await sleeperApi.getAllLeagueTransactions(season.leagueId);
          allTransactions.push(...txns.map((t: any) => ({ ...t, season: season.season })));
        } catch (e) {}
      }

      const allTrades = allTransactions.filter((t: any) => t.type === "trade" && t.status === "complete");
      const userTrades = allTrades.filter((t: any) => t.roster_ids?.includes(userRosterId));
      const userWaivers = allTransactions.filter((t: any) => (t.type === "waiver" || t.type === "free_agent") && t.status === "complete" && (t.adds && Object.values(t.adds).includes(userRosterId)));

      const leagueType = league.settings?.type === 2 ? "dynasty" : league.settings?.type === 1 ? "keeper" : "redraft";
      const rosterPositions = league.roster_positions || [];
      const isSuperFlex = rosterPositions.some((p: string) => p === "SUPER_FLEX");
      const hasTaxiSquad = (league.settings?.taxi_slots || 0) > 0;

      let hasRookieDraft = false;
      let hasFuturePickTrades = false;
      let hasDevyAssets = false;
      const currentYear = new Date().getFullYear();

      const agesAcquired: number[] = [];
      const agesTradedAway: number[] = [];
      const positionsAcquired: Record<string, number> = {};
      const positionsTradedAway: Record<string, number> = {};
      let totalPicksAcquired = 0;
      let totalPicksTraded = 0;
      const futurePicksByYear: Record<number, number> = {};
      let tradesWithPicks = 0;

      const tradeDetails = userTrades.map((t: any) => {
        const acquired: string[] = [];
        const traded: string[] = [];
        const picksAcquired: string[] = [];
        const picksTraded: string[] = [];
        if (t.adds) {
          for (const [pid, rid] of Object.entries(t.adds)) {
            const p = allPlayers?.[pid];
            const name = p ? (p.full_name || `${p.first_name} ${p.last_name}`) : pid;
            const pos = p?.position || "?";
            const age = p?.age || null;
            if (rid === userRosterId) {
              acquired.push(`${name} (${pos}, age ${age || "?"})`);
              if (age) agesAcquired.push(age);
              if (pos !== "?") positionsAcquired[pos] = (positionsAcquired[pos] || 0) + 1;
            } else {
              traded.push(`${name} (${pos}, age ${age || "?"})`);
              if (age) agesTradedAway.push(age);
              if (pos !== "?") positionsTradedAway[pos] = (positionsTradedAway[pos] || 0) + 1;
            }
          }
        }
        if (t.drops) {
          for (const [pid, rid] of Object.entries(t.drops)) {
            if (rid === userRosterId && !t.adds?.[pid]) {
              const p = allPlayers?.[pid];
              const name = p ? (p.full_name || `${p.first_name} ${p.last_name}`) : pid;
              traded.push(`${name} (${p?.position || "?"}, age ${p?.age || "?"})`);
              if (p?.age) agesTradedAway.push(p.age);
            }
          }
        }
        if (t.draft_picks) {
          let tradeHasPicks = false;
          for (const pick of t.draft_picks) {
            const pickStr = `${pick.season} Round ${pick.round}`;
            if (pick.owner_id === userRosterId) {
              picksAcquired.push(pickStr);
              totalPicksAcquired++;
              tradeHasPicks = true;
              if (pick.season > currentYear) {
                hasFuturePickTrades = true;
                futurePicksByYear[pick.season] = (futurePicksByYear[pick.season] || 0) + 1;
              }
            } else if (pick.previous_owner_id === userRosterId) {
              picksTraded.push(pickStr);
              totalPicksTraded++;
              tradeHasPicks = true;
              if (pick.season > currentYear) {
                hasFuturePickTrades = true;
                futurePicksByYear[pick.season] = (futurePicksByYear[pick.season] || 0) - 1;
              }
            }
          }
          if (tradeHasPicks) tradesWithPicks++;
        }
        return { season: t.season, acquired, traded, picksAcquired, picksTraded };
      });

      if (leagueType === "dynasty" || leagueType === "keeper") {
        try {
          const drafts = await sleeperApi.getLeagueDrafts(leagueId);
          hasRookieDraft = drafts?.some((d: any) => d.type === "snake" && d.metadata?.type === "rookie") || false;
        } catch (e) {}
      }

      if (userRoster?.taxi?.length > 0) {
        const taxiPlayers = userRoster.taxi.map((pid: string) => allPlayers?.[pid]).filter(Boolean);
        hasDevyAssets = taxiPlayers.some((p: any) => p?.years_exp === 0 || (p?.status === "Inactive" && p?.team === null));
      }

      let primaryFormat = "Redraft";
      const alsoActiveIn: string[] = [];
      if (leagueType === "dynasty") {
        primaryFormat = "Dynasty";
        if (league.settings?.best_ball === 1) { primaryFormat = "Dynasty Best Ball"; }
        if (hasDevyAssets || hasTaxiSquad) alsoActiveIn.push("Devy");
      } else if (leagueType === "keeper") {
        primaryFormat = "Keeper";
      }
      if (league.settings?.best_ball === 1 && primaryFormat !== "Dynasty Best Ball") alsoActiveIn.push("Best Ball");

      const avgAgeAcquired = agesAcquired.length > 0 ? +(agesAcquired.reduce((a, b) => a + b, 0) / agesAcquired.length).toFixed(1) : null;
      const avgAgeTradedAway = agesTradedAway.length > 0 ? +(agesTradedAway.reduce((a, b) => a + b, 0) / agesTradedAway.length).toFixed(1) : null;
      const netAgeDelta = avgAgeAcquired && avgAgeTradedAway ? +(avgAgeAcquired - avgAgeTradedAway).toFixed(1) : null;
      const ageBiasLabel = netAgeDelta === null ? "Insufficient Data" : netAgeDelta < -1.5 ? "Youth-Leaning" : netAgeDelta > 1.5 ? "Veteran-Leaning" : "Balanced";

      const pickExposurePct = userTrades.length > 0 ? Math.round((tradesWithPicks / userTrades.length) * 100) : 0;
      const netPicksGainedLost = totalPicksAcquired - totalPicksTraded;

      const totalManagerTradesInLeague = allTrades.length;
      const tradesByRoster: Record<number, number> = {};
      allTrades.forEach((t: any) => { t.roster_ids?.forEach((rid: number) => { tradesByRoster[rid] = (tradesByRoster[rid] || 0) + 1; }); });
      const tradeCountsSorted = Object.values(tradesByRoster).sort((a, b) => a - b);
      const userTradeCount = tradesByRoster[userRosterId] || 0;
      let tradePercentile = 50;
      if (tradeCountsSorted.length > 0) {
        const belowCount = tradeCountsSorted.filter(c => c < userTradeCount).length;
        tradePercentile = Math.round((belowCount / tradeCountsSorted.length) * 100);
      }

      const rosterPlayerIds = userRoster.players || [];
      const rosterAges: number[] = [];
      const rosterByPosition: Record<string, number> = {};
      for (const pid of rosterPlayerIds) {
        const p = allPlayers?.[pid];
        if (p) {
          if (p.age) rosterAges.push(p.age);
          const pos = p.position || "?";
          rosterByPosition[pos] = (rosterByPosition[pos] || 0) + 1;
        }
      }
      const avgRosterAge = rosterAges.length > 0 ? +(rosterAges.reduce((a, b) => a + b, 0) / rosterAges.length).toFixed(1) : null;

      const leagueAvgByPosition: Record<string, number> = {};
      for (const r of rosters || []) {
        for (const pid of (r.players || [])) {
          const p = allPlayers?.[pid];
          if (p?.position) {
            leagueAvgByPosition[p.position] = (leagueAvgByPosition[p.position] || 0) + 1;
          }
        }
      }
      const rosterCount = rosters?.length || 1;
      for (const pos of Object.keys(leagueAvgByPosition)) {
        leagueAvgByPosition[pos] = +(leagueAvgByPosition[pos] / rosterCount).toFixed(1);
      }

      const overweightPositions: string[] = [];
      const underweightPositions: string[] = [];
      for (const pos of Object.keys({ ...rosterByPosition, ...leagueAvgByPosition })) {
        const userCount = rosterByPosition[pos] || 0;
        const leagueAvg = leagueAvgByPosition[pos] || 0;
        if (userCount > leagueAvg + 1) overweightPositions.push(pos);
        else if (userCount < leagueAvg - 1) underweightPositions.push(pos);
      }

      const qbWarning = isSuperFlex && (rosterByPosition["QB"] || 0) < (leagueAvgByPosition["QB"] || 0)
        ? "QB exposure below league allocation average — potential structural risk in Superflex formats."
        : null;

      const isDynasty = leagueType === "dynasty" || leagueType === "keeper";

      const computedMetrics = {
        primaryFormat,
        alsoActiveIn,
        isSuperFlex,
        isDynasty,
        tradeCount: userTrades.length,
        waiverCount: userWaivers.length,
        tradePercentile,
        pickExposurePct,
        netPicksGainedLost,
        futurePicksByYear,
        avgAgeAcquired,
        avgAgeTradedAway,
        netAgeDelta,
        ageBiasLabel,
        overweightPositions,
        underweightPositions,
        qbWarning,
        avgRosterAge,
        rosterByPosition,
        leagueAvgByPosition,
      };

      const waiverDetails = userWaivers.slice(0, 30).map((t: any) => {
        const added: string[] = [];
        const dropped: string[] = [];
        if (t.adds) {
          for (const [pid, rid] of Object.entries(t.adds)) {
            if (rid === userRosterId) {
              const p = allPlayers?.[pid];
              added.push(`${p?.full_name || pid} (${p?.position || "?"})`);
            }
          }
        }
        if (t.drops) {
          for (const [pid, rid] of Object.entries(t.drops)) {
            if (rid === userRosterId) {
              const p = allPlayers?.[pid];
              dropped.push(`${p?.full_name || pid} (${p?.position || "?"})`);
            }
          }
        }
        return { season: t.season, added, dropped, type: t.type };
      });

      const dynastySection = isDynasty ? `
DYNASTY-SPECIFIC ANALYSIS:
- Roster avg age: ${avgRosterAge || "unknown"}
- Has taxi squad: ${hasTaxiSquad}
- Has devy assets: ${hasDevyAssets}
- Has rookie drafts: ${hasRookieDraft}
- Future pick trades detected: ${hasFuturePickTrades}
- Net picks gained/lost: ${netPicksGainedLost > 0 ? "+" : ""}${netPicksGainedLost}
- Age bias: ${ageBiasLabel} (avg acquired: ${avgAgeAcquired || "N/A"}, avg traded away: ${avgAgeTradedAway || "N/A"})

Provide dynasty-specific fields:
  "assetPortfolioOutlook": {
    "rosterAgeCurve": "one of: below_avg, avg, above_avg",
    "contenderWindow": "one of: 1-2 years, 2-4 years, rebuild",
    "volatilityScore": "one of: low, medium, high",
    "liquidityScore": "one of: low, medium, high"
  },
  "competitiveTimeline": {
    "year1": "one of: rebuild, fringe, contender",
    "year2": "one of: fringe, strong_contender, contender",
    "year3plus": "one of: window_closing, sustainable, dependent_on_draft_conversion"
  },` : "";

      const analysisPrompt = `You are a professional fantasy football portfolio analyst. Analyze this manager's transaction history using institutional asset management language. Be specific and data-driven.

League: ${league.name} (${leagueType}, ${league.scoring_settings?.rec !== undefined ? `${league.scoring_settings.rec} PPR` : "Standard"}${isSuperFlex ? ", Superflex" : ""})
Format: ${primaryFormat}${alsoActiveIn.length > 0 ? ` | Also active in: ${alsoActiveIn.join(", ")}` : ""}

PRE-COMPUTED METRICS:
- Trade activity: ${userTrades.length} trades, ${tradePercentile}th percentile in league
- ${pickExposurePct}% of trades included draft picks
- Net draft capital: ${netPicksGainedLost > 0 ? "+" : ""}${netPicksGainedLost} picks
- Age curve: avg acquired ${avgAgeAcquired || "N/A"}, avg traded away ${avgAgeTradedAway || "N/A"}, delta ${netAgeDelta || "N/A"} (${ageBiasLabel})
- Waiver moves: ${userWaivers.length}
- Positional overweight: ${overweightPositions.length > 0 ? overweightPositions.join(", ") : "none"}
- Positional underweight: ${underweightPositions.length > 0 ? underweightPositions.join(", ") : "none"}

TRADES (${tradeDetails.length} total):
${tradeDetails.length > 0 ? tradeDetails.map((t, i) => `Trade ${i + 1} (${t.season}): Acquired [${t.acquired.join(", ")}${t.picksAcquired.length ? ", picks: " + t.picksAcquired.join(", ") : ""}] | Traded away [${t.traded.join(", ")}${t.picksTraded.length ? ", picks: " + t.picksTraded.join(", ") : ""}]`).join("\n") : "No trades found."}

WAIVER/FA MOVES (${waiverDetails.length} shown of ${userWaivers.length} total):
${waiverDetails.length > 0 ? waiverDetails.map((w) => `${w.type === "waiver" ? "Waiver" : "FA"} (${w.season}): Added [${w.added.join(", ")}]${w.dropped.length ? " | Dropped [" + w.dropped.join(", ") + "]" : ""}`).join("\n") : "No waiver moves found."}
${dynastySection}

Create a JSON profile. Use professional asset management language throughout — variance instead of risk, asset appreciation instead of improvement, conviction instead of activity. Strategic tendencies should be sharp analytical bullets. Competitive advantages and strategic leaks should use institutional analyst tone.

{
  "managerStyle": "one of: aggressive_trader, patient_builder, win_now, rebuilder, balanced, opportunistic",
  "riskVariance": "one of: high_variance, moderate_variance, low_variance",
  "timeHorizon": "one of: win_now, balanced, long_term_growth",
  "archetypeDescription": "2-3 sentence professional description of this manager's approach using portfolio analysis language",
  "topSummaryLine": "one punchy shareable sentence summarizing this manager, e.g. 'High-upside dynasty builder with aggressive asset cycling and strong long-term orientation.'",
  "tradeActivity": "one of: very_active, active, passive",
  "agePreference": "one of: youth_chaser, prime_age, veteran_friendly, balanced",
  "draftPickStrategy": "one of: accumulator, spender, balanced",
  "waiverActivity": "one of: aggressive, moderate, passive",
  "positionalBias": {
    "overweight": ["positions overweighted vs league avg"],
    "underweight": ["positions underweighted vs league avg"]
  },
  "strategicTendencies": ["3-5 sharp analytical bullets using institutional language, e.g. 'Actively converts peak-value veterans into multi-asset packages'"],
  "competitiveAdvantages": ["3-4 strengths using professional tone, e.g. 'Strong long-term asset valuation'"],
  "strategicLeaks": ["3-4 weaknesses using professional tone, e.g. 'Underinvestment in positional scarcity (QB/TE)'"],
  "radarChart": {
    "riskVariance": 0-100,
    "youthBias": 0-100,
    "pickAggression": 0-100,
    "tradeFrequency": 0-100,
    "positionalBalance": 0-100,
    "contenderIndex": 0-100
  }${isDynasty ? `,
  "assetPortfolioOutlook": { "rosterAgeCurve": "below_avg/avg/above_avg", "contenderWindow": "1-2 years/2-4 years/rebuild", "volatilityScore": "low/medium/high", "liquidityScore": "low/medium/high" },
  "competitiveTimeline": { "year1": "rebuild/fringe/contender", "year2": "fringe/strong_contender/contender", "year3plus": "window_closing/sustainable/dependent_on_draft_conversion" }` : `,
  "shortTermCompetitiveIndex": "one of: strong_contender, competitive, rebuilding",
  "rosterStabilityScore": "one of: high, moderate, low"`}
}

Return ONLY valid JSON, no markdown.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an elite fantasy football portfolio analyst. Analyze transaction histories to build quantified, professional manager profiles. Use institutional asset management language. Return only valid JSON." },
          { role: "user", content: analysisPrompt },
        ],
        max_tokens: 2000,
        temperature: 0.3,
      });

      let aiProfile;
      try {
        const raw = response.choices[0]?.message?.content || "{}";
        aiProfile = JSON.parse(raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
      } catch (e) {
        aiProfile = {
          managerStyle: "balanced", riskVariance: "moderate_variance", timeHorizon: "balanced",
          archetypeDescription: "Unable to generate detailed analysis.", topSummaryLine: "Manager profile analysis incomplete.",
          tradeActivity: userTrades.length > 10 ? "very_active" : userTrades.length > 5 ? "active" : "passive",
          agePreference: "balanced", draftPickStrategy: "balanced", waiverActivity: userWaivers.length > 20 ? "aggressive" : "moderate",
          positionalBias: { overweight: overweightPositions, underweight: underweightPositions },
          strategicTendencies: [], competitiveAdvantages: [], strategicLeaks: [],
          radarChart: { riskVariance: 50, youthBias: 50, pickAggression: 50, tradeFrequency: 50, positionalBalance: 50, contenderIndex: 50 },
        };
      }

      const profileData = {
        ...aiProfile,
        _computedMetrics: computedMetrics,
      };

      const saved = await storage.upsertManagerProfile(userId, leagueId, profileData, userTrades.length, userWaivers.length);

      res.json({ profile: profileData, tradesAnalyzed: userTrades.length, transactionsAnalyzed: userWaivers.length, lastUpdated: saved.updatedAt });
    } catch (error) {
      console.error("Error analyzing manager profile:", error);
      res.status(500).json({ message: "Failed to analyze manager profile" });
    }
  });

  // ===== AI Chat Assistant Routes =====
  const { chatStorage } = await import("./replit_integrations/chat/storage");

  // Get all conversations for the current user
  app.get("/api/ai-chat/conversations", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const convos = await chatStorage.getConversationsByUser(userId);
      res.json(convos);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  // Get single conversation with messages
  app.get("/api/ai-chat/conversations/:id", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const conversation = await chatStorage.getConversation(id);
      if (!conversation || conversation.userId !== userId) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      const msgs = await chatStorage.getMessagesByConversation(id);
      res.json({ ...conversation, messages: msgs });
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ message: "Failed to fetch conversation" });
    }
  });

  // Create new conversation
  app.post("/api/ai-chat/conversations", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { title } = req.body;
      const conversation = await chatStorage.createConversation(title || "New Chat", userId);
      res.status(201).json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  // Delete conversation
  app.delete("/api/ai-chat/conversations/:id", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const conversation = await chatStorage.getConversation(id);
      if (!conversation || conversation.userId !== userId) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      await chatStorage.deleteConversation(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ message: "Failed to delete conversation" });
    }
  });

  // Send a text message and get AI response (streaming)
  app.post("/api/ai-chat/conversations/:id/messages", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const conversationId = parseInt(req.params.id);
      const { message, leagueId } = req.body;

      if (!message || typeof message !== "string" || message.trim().length === 0) {
        return res.status(400).json({ message: "Message is required" });
      }

      const conversation = await chatStorage.getConversation(conversationId);
      if (!conversation || conversation.userId !== userId) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // Save user message
      await chatStorage.createMessage(conversationId, "user", message.trim());

      let contextParts: string[] = [];
      let managerProfileContext = "";

      try {
        const profile = await storage.getUserProfile(userId);
        const targetLeagueId = leagueId || profile?.selectedLeagueId;

        if (targetLeagueId && targetLeagueId !== "all") {
          const mgrProfile = await storage.getManagerProfile(userId, targetLeagueId);
          if (mgrProfile?.profileData) {
            const mp: any = mgrProfile.profileData;
            managerProfileContext = `\nMANAGER PROFILE (learned from ${mgrProfile.tradesAnalyzed || 0} trades and ${mgrProfile.transactionsAnalyzed || 0} transactions):
- Style: ${mp.managerStyle || "unknown"} | Risk: ${mp.riskTolerance || "unknown"} | Age preference: ${mp.agePreference || "unknown"}
- Trade frequency: ${mp.tradeFrequency || "unknown"} | Draft picks: ${mp.draftPickStrategy || "unknown"} | Waivers: ${mp.waiverActivity || "unknown"}
- Position preferences: Favors ${(mp.positionPreferences?.favored || []).join(", ") || "none"} | Avoids ${(mp.positionPreferences?.avoided || []).join(", ") || "none"}
- Key patterns: ${(mp.keyPatterns || []).join("; ") || "none identified"}
- Summary: ${mp.summary || "No summary"}
Use this profile to personalize all advice. Align trade suggestions, roster moves, and strategy with their tendencies. If a recommendation goes against their style, acknowledge it and explain why it's worth considering.`;
          }
        }

        if (targetLeagueId && targetLeagueId !== "all") {
          const [league, rosters, leagueUsers, state, allPlayers] = await Promise.all([
            sleeperApi.getLeague(targetLeagueId),
            sleeperApi.getLeagueRosters(targetLeagueId),
            sleeperApi.getLeagueUsers(targetLeagueId),
            sleeperApi.getState(),
            sleeperApi.getAllPlayers(),
          ]);

          if (league) {
            contextParts.push(`League: "${league.name}" (${league.roster_positions?.length || 0} roster spots, ${league.total_rosters || 0} teams, ${league.scoring_settings?.rec !== undefined ? `PPR: ${league.scoring_settings.rec}` : "Standard"} scoring, ${league.settings?.type === 2 ? "Dynasty" : league.settings?.type === 1 ? "Keeper" : "Redraft"})`);
          }

          // Find user's roster
          const sleeperUserId = profile?.sleeperUserId;
          if (sleeperUserId && rosters && allPlayers) {
            const userRoster = rosters.find((r: any) => r.owner_id === sleeperUserId);

            if (userRoster) {
              // Fetch season stats to provide production context to AI
              let seasonStats: any = {};
              try {
                seasonStats = await sleeperApi.getSeasonStats("2025", "regular") || {};
              } catch (e) { /* best effort */ }

              const starters = new Set(userRoster.starters || []);
              const rosterPlayers = (userRoster.players || []).map((pid: string) => {
                const p = allPlayers[pid];
                if (!p) return null;
                const name = p.full_name || `${p.first_name} ${p.last_name}`;
                const pStats = seasonStats[pid] || {};
                const gp = pStats.gp || 0;
                const pts = pStats.pts_ppr || 0;
                const ppg = gp > 0 ? (pts / gp).toFixed(1) : "0";
                const isStarter = starters.has(pid) ? "starter" : "bench";
                const age = p.age ? `, age ${p.age}` : "";
                return `${name} (${p.position}, ${p.team || "FA"}${age}, ${ppg} PPG, ${gp}g, ${isStarter})`;
              }).filter(Boolean);

              if (rosterPlayers.length > 0) {
                contextParts.push(`User's roster (${rosterPlayers.length} players): ${rosterPlayers.join(", ")}`);
              }

              // Record and standings
              if (userRoster.settings) {
                const wins = userRoster.settings.wins || 0;
                const losses = userRoster.settings.losses || 0;
                const ties = userRoster.settings.ties || 0;
                const fpts = userRoster.settings.fpts || 0;
                contextParts.push(`Record: ${wins}-${losses}${ties > 0 ? `-${ties}` : ""}, Points: ${fpts}`);
              }
            }

            // League standings summary
            if (rosters.length > 0) {
              const standings = rosters
                .map((r: any) => {
                  const owner = leagueUsers?.find((u: any) => u.user_id === r.owner_id);
                  const w = r.settings?.wins || 0;
                  const l = r.settings?.losses || 0;
                  return { name: owner?.display_name || `Team ${r.roster_id}`, wins: w, losses: l, pts: r.settings?.fpts || 0 };
                })
                .sort((a: any, b: any) => b.wins - a.wins || b.pts - a.pts);
              contextParts.push(`Standings: ${standings.map((s: any, i: number) => `${i + 1}. ${s.name} (${s.wins}-${s.losses})`).join(", ")}`);
            }
          }

          if (state) {
            contextParts.push(`Current NFL week: ${state.week || "offseason"}, Season: ${state.season || "2025"}`);
          }
        }
      } catch (ctxError) {
        // Context gathering is best-effort, don't fail the chat
      }

      // Get conversation history (last 20 messages for context window)
      const existingMessages = await chatStorage.getMessagesByConversation(conversationId);
      const recentMessages = existingMessages.slice(-20);
      const chatHistory = recentMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      const currentDate = new Date();
      const currentDateStr = currentDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const aiCurrentMonth = currentDate.getMonth();
      const aiCurrentYear = currentDate.getFullYear();
      const mostRecentSeason = aiCurrentMonth < 8 ? aiCurrentYear - 1 : aiCurrentYear;

      const systemPrompt = `You are the DT Sleeper Agent AI Assistant — an expert dynasty fantasy football advisor. You help users with:
- Start/sit decisions and lineup advice
- Trade evaluations and dynasty value analysis  
- Waiver wire recommendations
- Roster construction and team building strategy
- Player analysis, trends, and breakout candidates
- Draft strategy (rookie drafts, startup drafts)
- League strategy and playoff positioning
- Devy (college prospect) scouting and rankings

IMPORTANT DATE CONTEXT: Today is ${currentDateStr}. The most recently completed NFL season is ${mostRecentSeason}. The upcoming NFL season is ${mostRecentSeason + 1}. All player recommendations, buy-low targets, sell-high candidates, and analysis should be based on the ${mostRecentSeason} season performance and the upcoming ${mostRecentSeason + 1} season outlook. Do NOT reference outdated seasons.

${contextParts.length > 0 ? `\nCurrent context about the user's fantasy situation:\n${contextParts.join("\n")}` : ""}

Guidelines:
- Be concise but thorough. Use bullet points for clarity.
- When discussing trades, consider dynasty value, age, positional scarcity, and team construction.
- For start/sit advice, consider matchups, recent performance, and usage trends.
- IMPORTANT: Use the actual player stats (PPG, games played) provided in the roster context to assess player quality. Do NOT assume players are unproven or developing if their stats show strong production. A player averaging 14+ PPG in PPR is an established producer.
- Reference specific player data when available from the user's context.
- If you don't have specific data, provide general expert advice and note any assumptions.
- Be opinionated — give clear recommendations rather than wishy-washy answers.
- Use fantasy football terminology naturally (PPR, FLEX, superflex, TEP, etc.).
- Format responses with markdown for readability.
${managerProfileContext}`;

      // Set up SSE for streaming
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...chatHistory,
        ],
        max_tokens: 1500,
        temperature: 0.7,
        stream: true,
      });

      let fullResponse = "";

      for await (const chunk of stream) {
        const content = chunk.choices?.[0]?.delta?.content;
        if (content) {
          fullResponse += content;
          res.write(`data: ${JSON.stringify({ type: "content", data: content })}\n\n`);
        }
      }

      // Save assistant message
      await chatStorage.createMessage(conversationId, "assistant", fullResponse);

      // Auto-title the conversation based on first message
      if (recentMessages.length <= 1) {
        const shortTitle = message.trim().slice(0, 50) + (message.length > 50 ? "..." : "");
        await chatStorage.updateConversationTitle(conversationId, shortTitle);
        res.write(`data: ${JSON.stringify({ type: "title", data: shortTitle })}\n\n`);
      }

      res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Error in AI chat:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ type: "error", data: "Failed to generate response" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ message: "Failed to process message" });
      }
    }
  });

  app.get("/api/draft-pick-values", isAuthenticated, (req: Request, res: Response) => {
    const position = (req.query as any).position as string | undefined;

    const POS_PICK_MODIFIERS: Record<string, Record<string, { eliteMod: number; starterMod: number; bustMod: number }>> = {
      QB: {
        "1": { eliteMod: 1.1, starterMod: 0.95, bustMod: 0.9 },
        "2": { eliteMod: 0.8, starterMod: 0.7, bustMod: 1.15 },
        "3": { eliteMod: 0.5, starterMod: 0.6, bustMod: 1.1 },
        "4": { eliteMod: 0, starterMod: 0.3, bustMod: 1.05 },
      },
      RB: {
        "1": { eliteMod: 1.3, starterMod: 1.1, bustMod: 0.85 },
        "2": { eliteMod: 1.0, starterMod: 0.9, bustMod: 1.0 },
        "3": { eliteMod: 0.8, starterMod: 0.7, bustMod: 1.1 },
        "4": { eliteMod: 0, starterMod: 0.3, bustMod: 1.05 },
      },
      WR: {
        "1": { eliteMod: 0.9, starterMod: 1.0, bustMod: 1.05 },
        "2": { eliteMod: 1.2, starterMod: 1.1, bustMod: 0.9 },
        "3": { eliteMod: 0.8, starterMod: 0.8, bustMod: 1.1 },
        "4": { eliteMod: 0, starterMod: 0.3, bustMod: 1.05 },
      },
      TE: {
        "1": { eliteMod: 0.7, starterMod: 0.8, bustMod: 1.15 },
        "2": { eliteMod: 0.6, starterMod: 0.7, bustMod: 1.1 },
        "3": { eliteMod: 0.3, starterMod: 0.5, bustMod: 1.15 },
        "4": { eliteMod: 0, starterMod: 0.2, bustMod: 1.1 },
      },
    };

    const draftPickData = {
      rounds: [
        {
          round: 1,
          picks: [
            { pick: 1, displayName: "1.01", value: 100, hitRate: 82, eliteRate: 45, starterRate: 72, bustRate: 18, avgPPG: 16.2, notablePicks: ["Saquon Barkley '18", "Ja'Marr Chase '21", "Bijan Robinson '23"] },
            { pick: 2, displayName: "1.02", value: 93, hitRate: 78, eliteRate: 38, starterRate: 68, bustRate: 22, avgPPG: 14.8, notablePicks: ["Jonathan Taylor '20", "Breece Hall '22"] },
            { pick: 3, displayName: "1.03", value: 87, hitRate: 75, eliteRate: 32, starterRate: 65, bustRate: 25, avgPPG: 14.1, notablePicks: ["CeeDee Lamb '20", "Garrett Wilson '22"] },
            { pick: 4, displayName: "1.04", value: 82, hitRate: 72, eliteRate: 28, starterRate: 62, bustRate: 28, avgPPG: 13.5, notablePicks: ["D'Andre Swift '20", "Drake London '22"] },
            { pick: 5, displayName: "1.05", value: 77, hitRate: 68, eliteRate: 24, starterRate: 58, bustRate: 32, avgPPG: 12.8, notablePicks: ["Jaylen Waddle '21", "Jaxon Smith-Njigba '23"] },
            { pick: 6, displayName: "1.06", value: 73, hitRate: 64, eliteRate: 20, starterRate: 54, bustRate: 36, avgPPG: 12.2, notablePicks: ["Kyle Pitts '21", "Quentin Johnston '23"] },
            { pick: 7, displayName: "1.07", value: 68, hitRate: 58, eliteRate: 16, starterRate: 48, bustRate: 42, avgPPG: 11.5, notablePicks: ["Javonte Williams '21", "Zay Flowers '23"] },
            { pick: 8, displayName: "1.08", value: 64, hitRate: 54, eliteRate: 14, starterRate: 44, bustRate: 46, avgPPG: 10.9, notablePicks: ["Kenneth Walker '22", "Ladd McConkey '24"] },
            { pick: 9, displayName: "1.09", value: 60, hitRate: 50, eliteRate: 12, starterRate: 40, bustRate: 50, avgPPG: 10.3, notablePicks: ["James Cook '22", "Rome Odunze '24"] },
            { pick: 10, displayName: "1.10", value: 56, hitRate: 46, eliteRate: 10, starterRate: 36, bustRate: 54, avgPPG: 9.7, notablePicks: ["Chris Olave '22", "Brian Thomas Jr '24"] },
            { pick: 11, displayName: "1.11", value: 53, hitRate: 42, eliteRate: 8, starterRate: 32, bustRate: 58, avgPPG: 9.1, notablePicks: ["Skyy Moore '22", "Keon Coleman '24"] },
            { pick: 12, displayName: "1.12", value: 50, hitRate: 38, eliteRate: 6, starterRate: 28, bustRate: 62, avgPPG: 8.5, notablePicks: ["George Pickens '22", "Adonai Mitchell '24"] },
          ]
        },
        {
          round: 2,
          picks: [
            { pick: 1, displayName: "2.01", value: 47, hitRate: 35, eliteRate: 5, starterRate: 25, bustRate: 65, avgPPG: 7.8, notablePicks: ["Nico Collins '21", "Tank Dell '23"] },
            { pick: 2, displayName: "2.02", value: 44, hitRate: 32, eliteRate: 4, starterRate: 22, bustRate: 68, avgPPG: 7.4, notablePicks: ["Elijah Moore '21", "Jayden Reed '23"] },
            { pick: 3, displayName: "2.03", value: 41, hitRate: 30, eliteRate: 4, starterRate: 20, bustRate: 70, avgPPG: 7.0, notablePicks: ["Rashod Bateman '21", "Josh Downs '23"] },
            { pick: 4, displayName: "2.04", value: 38, hitRate: 28, eliteRate: 3, starterRate: 18, bustRate: 72, avgPPG: 6.6, notablePicks: ["Kadarius Toney '21", "Jordan Addison '23"] },
            { pick: 5, displayName: "2.05", value: 35, hitRate: 25, eliteRate: 3, starterRate: 16, bustRate: 75, avgPPG: 6.2, notablePicks: ["Amon-Ra St. Brown '21", "Puka Nacua '23"] },
            { pick: 6, displayName: "2.06", value: 33, hitRate: 23, eliteRate: 2, starterRate: 14, bustRate: 77, avgPPG: 5.9, notablePicks: ["Wan'Dale Robinson '22"] },
            { pick: 7, displayName: "2.07", value: 30, hitRate: 20, eliteRate: 2, starterRate: 12, bustRate: 80, avgPPG: 5.5, notablePicks: ["Isaiah Pacheco '22"] },
            { pick: 8, displayName: "2.08", value: 28, hitRate: 18, eliteRate: 2, starterRate: 10, bustRate: 82, avgPPG: 5.2, notablePicks: ["DeMario Douglas '23"] },
            { pick: 9, displayName: "2.09", value: 26, hitRate: 16, eliteRate: 1, starterRate: 9, bustRate: 84, avgPPG: 4.8, notablePicks: [] },
            { pick: 10, displayName: "2.10", value: 24, hitRate: 15, eliteRate: 1, starterRate: 8, bustRate: 85, avgPPG: 4.5, notablePicks: [] },
            { pick: 11, displayName: "2.11", value: 22, hitRate: 14, eliteRate: 1, starterRate: 7, bustRate: 86, avgPPG: 4.2, notablePicks: [] },
            { pick: 12, displayName: "2.12", value: 20, hitRate: 12, eliteRate: 1, starterRate: 6, bustRate: 88, avgPPG: 3.9, notablePicks: [] },
          ]
        },
        {
          round: 3,
          picks: [
            { pick: 1, displayName: "3.01", value: 18, hitRate: 10, eliteRate: 1, starterRate: 5, bustRate: 90, avgPPG: 3.5, notablePicks: [] },
            { pick: 2, displayName: "3.02", value: 16, hitRate: 9, eliteRate: 0, starterRate: 5, bustRate: 91, avgPPG: 3.2, notablePicks: [] },
            { pick: 3, displayName: "3.03", value: 15, hitRate: 8, eliteRate: 0, starterRate: 4, bustRate: 92, avgPPG: 3.0, notablePicks: [] },
            { pick: 4, displayName: "3.04", value: 13, hitRate: 7, eliteRate: 0, starterRate: 3, bustRate: 93, avgPPG: 2.7, notablePicks: [] },
            { pick: 5, displayName: "3.05", value: 12, hitRate: 6, eliteRate: 0, starterRate: 3, bustRate: 94, avgPPG: 2.5, notablePicks: [] },
            { pick: 6, displayName: "3.06", value: 10, hitRate: 5, eliteRate: 0, starterRate: 2, bustRate: 95, avgPPG: 2.2, notablePicks: [] },
            { pick: 7, displayName: "3.07", value: 9, hitRate: 5, eliteRate: 0, starterRate: 2, bustRate: 95, avgPPG: 2.0, notablePicks: [] },
            { pick: 8, displayName: "3.08", value: 8, hitRate: 4, eliteRate: 0, starterRate: 2, bustRate: 96, avgPPG: 1.8, notablePicks: [] },
            { pick: 9, displayName: "3.09", value: 7, hitRate: 4, eliteRate: 0, starterRate: 1, bustRate: 96, avgPPG: 1.6, notablePicks: [] },
            { pick: 10, displayName: "3.10", value: 6, hitRate: 3, eliteRate: 0, starterRate: 1, bustRate: 97, avgPPG: 1.4, notablePicks: [] },
            { pick: 11, displayName: "3.11", value: 5, hitRate: 3, eliteRate: 0, starterRate: 1, bustRate: 97, avgPPG: 1.2, notablePicks: [] },
            { pick: 12, displayName: "3.12", value: 4, hitRate: 2, eliteRate: 0, starterRate: 1, bustRate: 98, avgPPG: 1.0, notablePicks: [] },
          ]
        },
        {
          round: 4,
          picks: [
            { pick: 1, displayName: "4.01", value: 3, hitRate: 2, eliteRate: 0, starterRate: 1, bustRate: 98, avgPPG: 0.8, notablePicks: [] },
            { pick: 2, displayName: "4.02", value: 3, hitRate: 2, eliteRate: 0, starterRate: 1, bustRate: 98, avgPPG: 0.7, notablePicks: [] },
            { pick: 3, displayName: "4.03", value: 2, hitRate: 1, eliteRate: 0, starterRate: 0, bustRate: 99, avgPPG: 0.5, notablePicks: [] },
            { pick: 4, displayName: "4.04", value: 2, hitRate: 1, eliteRate: 0, starterRate: 0, bustRate: 99, avgPPG: 0.4, notablePicks: [] },
            { pick: 5, displayName: "4.05", value: 1, hitRate: 1, eliteRate: 0, starterRate: 0, bustRate: 99, avgPPG: 0.3, notablePicks: [] },
            { pick: 6, displayName: "4.06", value: 1, hitRate: 1, eliteRate: 0, starterRate: 0, bustRate: 99, avgPPG: 0.2, notablePicks: [] },
          ]
        }
      ],
      methodology: "Based on historical dynasty rookie draft data from 2018-2024. Hit Rate = produced fantasy-relevant seasons. Starter Rate = finished as weekly starter. Elite Rate = finished as top-5 at position. Bust Rate = failed to produce meaningful fantasy value within 2 years.",
      lastUpdated: "2025-01-15"
    };

    if (position && POS_PICK_MODIFIERS[position]) {
      const mods = POS_PICK_MODIFIERS[position];
      draftPickData.rounds = draftPickData.rounds.map(round => ({
        ...round,
        picks: round.picks.map(pick => {
          const roundMod = mods[String(round.round)] || mods["4"];
          return {
            ...pick,
            eliteRate: Math.round(Math.min(100, pick.eliteRate * roundMod.eliteMod)),
            starterRate: Math.round(Math.min(100, pick.starterRate * roundMod.starterMod)),
            bustRate: Math.round(Math.min(100, pick.bustRate * roundMod.bustMod)),
          };
        }),
      }));
      draftPickData.methodology = `Position-specific (${position}) historical data from 2018-2024. Rates adjusted for ${position} hit rates at each draft slot.`;
    }

    const { getDraft2026Players } = require('./draft-2026-data');
    const { KTC_DEVY_PLAYERS } = require('./ktc-values');

    const allDraftPlayers = getDraft2026Players();
    const ktcByName: Record<string, any> = {};
    for (const dp of KTC_DEVY_PLAYERS) {
      ktcByName[dp.name.toLowerCase().trim()] = dp;
    }

    const prospectsPerPick: Record<string, { name: string; position: string; college: string; rank: number; elitePct: number; bustPct: number }[]> = {};
    for (const player of allDraftPlayers) {
      if (position && player.positionGroup !== position) continue;
      const round = Math.ceil(player.rank / 12);
      const pick = ((player.rank - 1) % 12) + 1;
      const slot = `${round}.${pick.toString().padStart(2, '0')}`;
      if (!prospectsPerPick[slot]) prospectsPerPick[slot] = [];
      const ktc = ktcByName[player.name.toLowerCase().trim()];
      prospectsPerPick[slot].push({
        name: player.name,
        position: player.position,
        college: player.college,
        rank: player.rank,
        elitePct: ktc?.elitePct ?? 0,
        bustPct: ktc?.bustPct ?? 0,
      });
    }

    const strategyPerPick: Record<string, { strategy: string; tradeAdvice: string; positionTip: string }> = {};
    const tradeEvDelta: Record<string, { tradeUpValue: number; tradeDownValue: number; tradeUpSlot: string; tradeDownSlot: string; evDelta: number }> = {};

    for (const round of draftPickData.rounds) {
      for (let i = 0; i < round.picks.length; i++) {
        const pick = round.picks[i];
        const slot = pick.displayName;

        let strategy = "";
        let tradeAdvice = "";
        let positionTip = "";

        if (pick.eliteRate >= 30) {
          strategy = "BPA (Best Player Available) - Elite hit rates justify taking the best talent regardless of position.";
          tradeAdvice = "Hold this pick unless offered significant overpay. Premium draft capital is scarce.";
        } else if (pick.eliteRate >= 15) {
          strategy = "Positional Need with BPA lean - Still strong hit rates. Target position of need but don't reach.";
          tradeAdvice = "Consider trading down 2-3 spots if you can gain future capital. Value gap is small.";
        } else if (pick.starterRate >= 20) {
          strategy = "Target high-ceiling upside plays - Starter rates are decent, so swing for upside.";
          tradeAdvice = "Accumulate picks in this range by trading down from premium spots. Volume matters here.";
        } else if (pick.hitRate >= 10) {
          strategy = "Dart throw territory - Focus on traits and landing spot over polish.";
          tradeAdvice = "Package multiple picks here to trade up into earlier rounds for better hit rates.";
        } else {
          strategy = "Lottery ticket - Target developmental prospects with elite athletic traits.";
          tradeAdvice = "Use as sweeteners in larger trade packages. Individual value is minimal.";
        }

        if (position) {
          const posMap: Record<string, string> = {
            QB: pick.eliteRate >= 20 ? "Premium QB range - franchise QB upside justifies early selection." : "Low QB hit rate at this slot. Consider waiting or trading up for a QB.",
            RB: pick.starterRate >= 30 ? "Strong RB range - good chance of landing a weekly starter." : pick.hitRate >= 15 ? "Viable RB range but expect volatile outcomes. Landing spot is key." : "Late RB dart throw - target pass-catching backs for PPR upside.",
            WR: pick.starterRate >= 25 ? "Prime WR territory - WRs hit more consistently in mid-rounds." : pick.hitRate >= 10 ? "WR depth pick - target route runners over raw athletes at this stage." : "Deep WR flier - college production matters more than athleticism here.",
            TE: pick.starterRate >= 15 ? "Rare TE value slot - TEs who hit here often become league-winners." : "TE is historically hard to hit. Consider other positions unless elite talent falls.",
          };
          positionTip = posMap[position] || "";
        }

        strategyPerPick[slot] = { strategy, tradeAdvice, positionTip };

        const allPicks = draftPickData.rounds.flatMap(r => r.picks.map(p => ({ ...p, roundNum: r.round })));
        const currentIdx = allPicks.findIndex(p => p.displayName === slot);
        const prevPick = currentIdx > 0 ? allPicks[currentIdx - 1] : null;
        const nextPick = currentIdx < allPicks.length - 1 ? allPicks[currentIdx + 1] : null;

        tradeEvDelta[slot] = {
          tradeUpValue: prevPick ? prevPick.value - pick.value : 0,
          tradeDownValue: nextPick ? pick.value - nextPick.value : 0,
          tradeUpSlot: prevPick ? prevPick.displayName : "",
          tradeDownSlot: nextPick ? nextPick.displayName : "",
          evDelta: prevPick && nextPick ? (prevPick.eliteRate - pick.eliteRate) - (pick.eliteRate - nextPick.eliteRate) : 0,
        };
      }
    }

    res.json({ ...draftPickData, prospectsPerPick, strategyPerPick, tradeEvDelta, positionFilter: position || null });
  });

  app.get("/api/sleeper/league-timeline/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;

      const [leagueHistory, allPlayers] = await Promise.all([
        sleeperApi.getLeagueHistory(leagueId),
        sleeperApi.getAllPlayers(),
      ]);

      if (!leagueHistory || leagueHistory.length === 0) {
        return res.status(404).json({ message: "League not found" });
      }

      const leagueName = leagueHistory[0].name;

      const completedHistory = leagueHistory.filter(h => h.status === "complete" || h.status === "in_season");

      if (completedHistory.length === 0) {
        return res.json({ leagueName, seasons: [] });
      }

      const seasonDataPromises = completedHistory.map(async (h) => {
        const [rosters, users, bracket, transactions] = await Promise.all([
          sleeperApi.getLeagueRosters(h.leagueId),
          sleeperApi.getLeagueUsers(h.leagueId),
          sleeperApi.getPlayoffBracket(h.leagueId),
          sleeperApi.getAllLeagueTransactions(h.leagueId),
        ]);
        return { history: h, rosters, users, bracket, transactions };
      });

      const allSeasonData = (await Promise.all(seasonDataPromises)).filter(sd => {
        const totalGames = sd.rosters.reduce((sum, r) => sum + (r.settings.wins || 0) + (r.settings.losses || 0) + (r.settings.ties || 0), 0);
        return totalGames > 0;
      });

      const seasons = allSeasonData.map((sd) => {
        const { history: h, rosters, users, bracket, transactions } = sd;

        const userMap = new Map<string, sleeperApi.SleeperUser>();
        for (const u of users) {
          userMap.set(u.user_id, u);
        }

        const rosterOwnerMap = new Map<number, { ownerName: string; avatar: string | null; ownerId: string }>();
        for (const r of rosters) {
          const u = userMap.get(r.owner_id);
          rosterOwnerMap.set(r.roster_id, {
            ownerName: u?.metadata?.team_name || u?.display_name || u?.username || "Unknown",
            avatar: sleeperApi.getAvatarUrl(u?.avatar || null),
            ownerId: r.owner_id,
          });
        }

        const events: { type: string; title: string; description: string; ownerName: string | null; avatar: string | null }[] = [];

        const championRosterId = sleeperApi.findChampionFromBracket(bracket);
        if (championRosterId) {
          const championRoster = rosters.find(r => r.roster_id === championRosterId);
          const owner = rosterOwnerMap.get(championRosterId);
          if (owner && championRoster) {
            const w = championRoster.settings.wins || 0;
            const l = championRoster.settings.losses || 0;
            events.push({
              type: "championship",
              title: `Champion: ${owner.ownerName}`,
              description: `Won the championship with a ${w}-${l} record`,
              ownerName: owner.ownerName,
              avatar: owner.avatar,
            });
          }
        }

        let topScorer: sleeperApi.SleeperRoster | null = null;
        let topPts = -1;
        for (const r of rosters) {
          const fpts = (r.settings.fpts || 0) + (r.settings.fpts_decimal || 0) / 100;
          if (fpts > topPts) {
            topPts = fpts;
            topScorer = r;
          }
        }
        if (topScorer && topPts > 0) {
          const owner = rosterOwnerMap.get(topScorer.roster_id);
          if (owner) {
            events.push({
              type: "top_scorer",
              title: `Scoring Leader: ${owner.ownerName}`,
              description: `Led the league with ${topPts.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} points`,
              ownerName: owner.ownerName,
              avatar: owner.avatar,
            });
          }
        }

        let bestRecord: sleeperApi.SleeperRoster | null = null;
        let bestWinPct = -1;
        for (const r of rosters) {
          const w = r.settings.wins || 0;
          const l = r.settings.losses || 0;
          const t = r.settings.ties || 0;
          const total = w + l + t;
          const pct = total > 0 ? (w + t * 0.5) / total : 0;
          if (pct > bestWinPct || (pct === bestWinPct && w > (bestRecord?.settings.wins || 0))) {
            bestWinPct = pct;
            bestRecord = r;
          }
        }
        if (bestRecord) {
          const owner = rosterOwnerMap.get(bestRecord.roster_id);
          if (owner) {
            const w = bestRecord.settings.wins || 0;
            const l = bestRecord.settings.losses || 0;
            const t = bestRecord.settings.ties || 0;
            const recordStr = t > 0 ? `${w}-${l}-${t}` : `${w}-${l}`;
            if (!(championRosterId && bestRecord.roster_id === championRosterId && w === (rosters.find(r => r.roster_id === championRosterId)?.settings.wins || 0))) {
              events.push({
                type: "best_record",
                title: `Best Record: ${owner.ownerName}`,
                description: `Finished ${recordStr}`,
                ownerName: owner.ownerName,
                avatar: owner.avatar,
              });
            } else {
              events.push({
                type: "best_record",
                title: `Best Record: ${owner.ownerName}`,
                description: `Finished ${recordStr}`,
                ownerName: owner.ownerName,
                avatar: owner.avatar,
              });
            }
          }
        }

        const trades = transactions.filter(t => t.type === "trade" && t.status === "complete");
        const significantTrades = trades
          .map(trade => {
            const addCount = trade.adds ? Object.keys(trade.adds).length : 0;
            const dropCount = trade.drops ? Object.keys(trade.drops).length : 0;
            const pickCount = trade.draft_picks ? trade.draft_picks.length : 0;
            const totalAssets = addCount + pickCount;
            return { trade, totalAssets, addCount, pickCount };
          })
          .filter(t => t.totalAssets >= 3)
          .sort((a, b) => b.totalAssets - a.totalAssets)
          .slice(0, 3);

        for (const { trade } of significantTrades) {
          const rosterIds = trade.roster_ids || [];
          const teamNames = rosterIds.map(rid => rosterOwnerMap.get(rid)?.ownerName || "Unknown");

          const parts: string[] = [];
          if (trade.adds) {
            const addsByRoster = new Map<number, string[]>();
            for (const [playerId, rosterId] of Object.entries(trade.adds)) {
              if (!addsByRoster.has(rosterId)) addsByRoster.set(rosterId, []);
              const player = allPlayers[playerId];
              const name = player ? `${player.first_name} ${player.last_name}` : `Player ${playerId}`;
              addsByRoster.get(rosterId)!.push(name);
            }

            addsByRoster.forEach((players, rosterId) => {
              const teamName = rosterOwnerMap.get(rosterId)?.ownerName || "Unknown";
              parts.push(`${teamName} received ${players.join(", ")}`);
            });
          }

          if (trade.draft_picks && trade.draft_picks.length > 0) {
            for (const pick of trade.draft_picks) {
              const receiver = rosterOwnerMap.get(pick.owner_id)?.ownerName || "Unknown";
              parts.push(`${receiver} received ${pick.season} Round ${pick.round}`);
            }
          }

          events.push({
            type: "trade",
            title: "Big Trade",
            description: parts.length > 0 ? parts.join(" | ") : `${teamNames.join(" and ")} made a trade`,
            ownerName: null,
            avatar: null,
          });
        }

        return {
          season: h.season,
          leagueId: h.leagueId,
          leagueName: h.name,
          totalTeams: rosters.length,
          events,
        };
      });

      seasons.sort((a, b) => b.season.localeCompare(a.season));

      res.json({ leagueName, seasons });
    } catch (error) {
      console.error("Error fetching league timeline:", error);
      res.status(500).json({ message: "Failed to fetch league timeline" });
    }
  });

  // ===== TRASH TALK GENERATOR =====
  app.post("/api/ai/trash-talk/:leagueId", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      const { opponentOwnerId, tone } = req.body;
      const userId = req.user.claims.sub;

      const userProfile = await storage.getUserProfile(userId);
      if (!userProfile?.sleeperUserId) {
        return res.status(400).json({ message: "Sleeper account not connected" });
      }

      const [rosters, users, state, league] = await Promise.all([
        sleeperApi.getLeagueRosters(leagueId),
        sleeperApi.getLeagueUsers(leagueId),
        sleeperApi.getState(),
        sleeperApi.getLeague(leagueId),
      ]);

      const userMap = new Map((users || []).map(u => [u.user_id, u]));
      const currentWeek = state?.display_week || state?.week || 1;

      const myRoster = rosters.find(r => r.owner_id === userProfile.sleeperUserId);
      const oppRoster = rosters.find(r => r.owner_id === opponentOwnerId);
      if (!myRoster || !oppRoster) {
        return res.status(404).json({ message: "Rosters not found" });
      }

      const myUser = userMap.get(userProfile.sleeperUserId);
      const oppUser = userMap.get(opponentOwnerId);
      const myName = myUser?.display_name || myUser?.username || "You";
      const oppName = oppUser?.display_name || oppUser?.username || "Opponent";

      const myRecord = `${myRoster.settings.wins || 0}-${myRoster.settings.losses || 0}`;
      const oppRecord = `${oppRoster.settings.wins || 0}-${oppRoster.settings.losses || 0}`;
      const myPts = ((myRoster.settings.fpts || 0) + (myRoster.settings.fpts_decimal || 0) / 100).toFixed(1);
      const oppPts = ((oppRoster.settings.fpts || 0) + (oppRoster.settings.fpts_decimal || 0) / 100).toFixed(1);

      const allPlayers = await sleeperApi.getAllPlayers();
      const getTopPlayers = (rosterPlayers: string[]) => {
        return (rosterPlayers || []).slice(0, 5).map(id => {
          const p = allPlayers?.[id];
          return p ? `${p.full_name} (${p.position} - ${p.team || 'FA'})` : id;
        }).join(", ");
      };

      const toneGuide = tone === "savage" ? "Be ruthless, savage, and brutally funny. No mercy."
        : tone === "friendly" ? "Keep it lighthearted and fun, like ribbing a buddy."
        : "Be witty with sharp humor, like a sports commentator roasting someone.";

      const prompt = `Generate 3 unique fantasy football trash talk messages I can send to my opponent.

My Team: ${myName} (Record: ${myRecord}, Points: ${myPts})
Top Players: ${getTopPlayers(myRoster.players || [])}

Opponent: ${oppName} (Record: ${oppRecord}, Points: ${oppPts})
Top Players: ${getTopPlayers(oppRoster.players || [])}

League: ${league?.name || 'Dynasty League'}, Week ${currentWeek}
Tone: ${toneGuide}

Rules:
- Reference specific players, records, or stats for maximum impact
- Each message should be 1-3 sentences
- Make them copy-paste ready for a group chat
- Number them 1-3
- Be creative and original`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a hilarious fantasy football trash talk expert. Generate clever, targeted trash talk that references real matchup data. Keep it fun and sports-focused." },
          { role: "user", content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.9,
      });

      const content = response.choices[0]?.message?.content || "";
      const messages = content.split(/\n\d+[\.\)]\s*/).filter(m => m.trim().length > 0).map(m => m.trim());

      res.json({
        messages: messages.length > 0 ? messages : [content],
        myTeam: { name: myName, record: myRecord, points: myPts },
        opponent: { name: oppName, record: oppRecord, points: oppPts },
      });
    } catch (error) {
      console.error("Error generating trash talk:", error);
      res.status(500).json({ message: "Failed to generate trash talk" });
    }
  });

  // ===== POWER RANKINGS COMMENTARY =====
  app.get("/api/ai/power-rankings-commentary/:leagueId", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;

      const [rosters, users, state, league, allPlayers] = await Promise.all([
        sleeperApi.getLeagueRosters(leagueId),
        sleeperApi.getLeagueUsers(leagueId),
        sleeperApi.getState(),
        sleeperApi.getLeague(leagueId),
        sleeperApi.getAllPlayers(),
      ]);

      const userMap = new Map((users || []).map(u => [u.user_id, u]));
      const currentWeek = state?.display_week || state?.week || 1;
      const playerData = allPlayers || {};

      const teams = rosters.map(roster => {
        const user = userMap.get(roster.owner_id);
        const fpts = (roster.settings.fpts || 0) + (roster.settings.fpts_decimal || 0) / 100;
        const topPlayers = (roster.players || []).slice(0, 3).map(id => {
          const p = playerData[id];
          return p ? `${p.full_name} (${p.position})` : "Unknown";
        }).join(", ");

        return {
          name: user?.display_name || user?.username || `Team ${roster.roster_id}`,
          record: `${roster.settings.wins || 0}-${roster.settings.losses || 0}`,
          points: fpts.toFixed(1),
          topPlayers,
          rosterId: roster.roster_id,
        };
      }).sort((a, b) => {
        const [aW] = a.record.split("-").map(Number);
        const [bW] = b.record.split("-").map(Number);
        if (aW !== bW) return bW - aW;
        return parseFloat(b.points) - parseFloat(a.points);
      });

      const teamsContext = teams.map((t, i) => `${i + 1}. ${t.name} (${t.record}, ${t.points} pts) - Key players: ${t.topPlayers}`).join("\n");

      const prompt = `Write brief ESPN-style power rankings commentary for each team in this fantasy football league.

League: ${league?.name || 'Dynasty League'}, Week ${currentWeek}

Teams (ranked by record):
${teamsContext}

For each team write a 2-3 sentence blurb that:
- References their record and trajectory
- Mentions a key player or roster strength/weakness
- Has personality and flair like an ESPN columnist
- Uses the team owner name (not "Team 1")

Format: Return a JSON array of objects with "name" and "commentary" fields. Return ONLY the JSON array, no markdown.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an ESPN fantasy football columnist known for witty, insightful power rankings write-ups. Always return valid JSON." },
          { role: "user", content: prompt }
        ],
        max_tokens: 1500,
        temperature: 0.8,
      });

      const raw = response.choices[0]?.message?.content || "[]";
      let commentary: Array<{ name: string; commentary: string }> = [];
      try {
        const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
        commentary = JSON.parse(cleaned);
      } catch {
        commentary = teams.map(t => ({ name: t.name, commentary: "Commentary unavailable." }));
      }

      res.json({ commentary, leagueName: league?.name, week: currentWeek });
    } catch (error) {
      console.error("Error generating commentary:", error);
      res.status(500).json({ message: "Failed to generate commentary" });
    }
  });

  // ===== BUST/BOOM PROBABILITY DATA =====
  app.get("/api/fantasy/boom-bust/:leagueId", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      const userId = req.user.claims.sub;

      const userProfile = await storage.getUserProfile(userId);
      if (!userProfile?.sleeperUserId) {
        return res.status(400).json({ message: "Sleeper account not connected" });
      }

      const [rosters, allPlayers] = await Promise.all([
        sleeperApi.getLeagueRosters(leagueId),
        sleeperApi.getAllPlayers(),
      ]);

      const myRoster = rosters.find(r => r.owner_id === userProfile.sleeperUserId);
      if (!myRoster) {
        return res.status(404).json({ message: "Roster not found" });
      }

      const playerData = allPlayers || {};
      const playerIds = myRoster.players || [];

      const cards = playerIds.map(playerId => {
        const player = playerData[playerId];
        if (!player) return null;

        const pos = player.position || "?";
        if (!["QB", "RB", "WR", "TE"].includes(pos)) return null;

        const age = player.age || 0;
        const yearsExp = player.years_exp || 0;
        const team = player.team || "FA";
        const dynastyVal = getSimplePlayerValue(playerId, player);

        const ageFactor = pos === "QB" ? Math.max(0, 1 - (age - 24) * 0.03) :
          pos === "RB" ? Math.max(0, 1 - (age - 23) * 0.08) :
          pos === "WR" ? Math.max(0, 1 - (age - 24) * 0.04) :
          Math.max(0, 1 - (age - 24) * 0.05);

        const expBonus = yearsExp <= 2 ? 0.15 : yearsExp <= 4 ? 0.05 : -0.05;
        const baseValue = dynastyVal / 10000;

        const boomPct = Math.min(95, Math.max(5, Math.round((baseValue * 60 + ageFactor * 20 + expBonus * 100) * (pos === "QB" ? 1.1 : 1))));
        const bustPct = Math.min(95, Math.max(5, Math.round(100 - boomPct + (pos === "RB" ? 10 : 0) - (yearsExp >= 3 ? 5 : 10))));

        const ceiling = Math.round(dynastyVal * (1 + ageFactor * 0.3 + expBonus));
        const floor = Math.round(dynastyVal * Math.max(0.1, 0.5 - (pos === "RB" ? 0.15 : 0) + (yearsExp >= 3 ? 0.1 : 0)));

        let riskLevel: string;
        if (bustPct >= 60) riskLevel = "High Risk";
        else if (bustPct >= 40) riskLevel = "Moderate";
        else riskLevel = "Safe";

        let outlook: string;
        if (boomPct >= 70) outlook = "Elite Upside";
        else if (boomPct >= 50) outlook = "Strong Upside";
        else if (boomPct >= 30) outlook = "Steady";
        else outlook = "Declining";

        return {
          playerId,
          name: player.full_name || "Unknown",
          position: pos,
          team,
          age,
          yearsExp,
          dynastyValue: dynastyVal,
          boomPct,
          bustPct,
          ceiling,
          floor,
          riskLevel,
          outlook,
          headshot: player.espn_id ? `https://a.espncdn.com/i/headshots/nfl/players/full/${player.espn_id}.png` : null,
        };
      }).filter(Boolean);

      cards.sort((a: any, b: any) => b.dynastyValue - a.dynastyValue);

      res.json({ cards });
    } catch (error) {
      console.error("Error generating boom/bust data:", error);
      res.status(500).json({ message: "Failed to generate boom/bust data" });
    }
  });

  // ===== TRADE ANALYZER AI =====
  app.post("/api/ai/trade-analyzer/:leagueId", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      const { givePlayers, getPlayers } = req.body;
      const userId = req.user.claims.sub;

      const userProfile = await storage.getUserProfile(userId);
      if (!userProfile?.sleeperUserId) {
        return res.status(400).json({ message: "Sleeper account not connected" });
      }

      const [rosters, allPlayers, league] = await Promise.all([
        sleeperApi.getLeagueRosters(leagueId),
        sleeperApi.getAllPlayers(),
        sleeperApi.getLeague(leagueId),
      ]);

      const myRoster = rosters.find(r => r.owner_id === userProfile.sleeperUserId);
      if (!myRoster) return res.status(404).json({ message: "Roster not found" });

      const playerData = allPlayers || {};
      const formatPlayer = (id: string) => {
        const p = playerData[id];
        if (!p) return { name: id, details: id };
        const val = getSimplePlayerValue(id, p);
        return {
          name: p.full_name || id,
          details: `${p.full_name} (${p.position} - ${p.team || 'FA'}, Age: ${p.age || '?'}, Value: ${val})`,
        };
      };

      const giveDetails = (givePlayers || []).map((id: string) => formatPlayer(id));
      const getDetails = (getPlayers || []).map((id: string) => formatPlayer(id));
      const giveTotal = (givePlayers || []).reduce((sum: number, id: string) => sum + getSimplePlayerValue(id, playerData[id]), 0);
      const getTotal = (getPlayers || []).reduce((sum: number, id: string) => sum + getSimplePlayerValue(id, playerData[id]), 0);

      const myPositions = (myRoster.players || []).reduce((acc: Record<string, number>, id: string) => {
        const pos = playerData[id]?.position;
        if (pos && ["QB", "RB", "WR", "TE"].includes(pos)) acc[pos] = (acc[pos] || 0) + 1;
        return acc;
      }, {});

      let tradeManagerContext = "";
      try {
        const mgrProfile = await storage.getManagerProfile(userId, leagueId);
        if (mgrProfile?.profileData) {
          const mp: any = mgrProfile.profileData;
          tradeManagerContext = `\nMANAGER PROFILE: Style=${mp.managerStyle}, Risk=${mp.riskTolerance}, Age preference=${mp.agePreference}, Draft picks=${mp.draftPickStrategy}. Summary: ${mp.summary || "N/A"}. Factor this manager's tendencies into your analysis — note if the trade aligns with or contradicts their usual approach.`;
        }
      } catch (e) { /* best effort */ }

      const prompt = `Analyze this dynasty fantasy football trade and give a recommendation.

GIVING AWAY:
${giveDetails.map((d: any) => d.details).join("\n")}
Total Value Giving: ${giveTotal}

RECEIVING:
${getDetails.map((d: any) => d.details).join("\n")}
Total Value Receiving: ${getTotal}

Value Difference: ${getTotal - giveTotal} (${getTotal > giveTotal ? 'receiving more value' : 'giving more value'})

My Current Roster Composition: ${Object.entries(myPositions).map(([k, v]) => `${k}: ${v}`).join(", ")}
League Type: ${league?.settings?.type === 2 ? 'Dynasty' : 'Redraft'}
Scoring: ${league?.scoring_settings?.rec === 1 ? 'PPR' : league?.scoring_settings?.rec === 0.5 ? 'Half PPR' : 'Standard'}
${tradeManagerContext}

Provide your analysis as JSON with these fields:
- "verdict": one of "ACCEPT", "REJECT", or "COUNTER"
- "grade": a letter grade A+ through F
- "summary": 2-3 sentence summary of your recommendation
- "giveSideAnalysis": 2 sentences about what you're giving up
- "getSideAnalysis": 2 sentences about what you're receiving
- "rosterImpact": 1-2 sentences on how this affects roster construction
- "counterSuggestion": if verdict is COUNTER, suggest what would make it fair (otherwise null)

Return ONLY valid JSON, no markdown.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an expert dynasty fantasy football trade analyst. Always return valid JSON. Be decisive in your recommendations." },
          { role: "user", content: prompt }
        ],
        max_tokens: 800,
        temperature: 0.7,
      });

      const raw = response.choices[0]?.message?.content || "{}";
      let analysis;
      try {
        const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
        analysis = JSON.parse(cleaned);
      } catch {
        analysis = { verdict: "REJECT", grade: "C", summary: "Unable to analyze trade at this time.", giveSideAnalysis: "", getSideAnalysis: "", rosterImpact: "", counterSuggestion: null };
      }

      res.json({
        analysis,
        giveTotal,
        getTotal,
        givePlayers: giveDetails,
        getPlayers: getDetails,
      });
    } catch (error) {
      console.error("Error analyzing trade:", error);
      res.status(500).json({ message: "Failed to analyze trade" });
    }
  });

  // ===== MID-SEASON REVIEW =====
  app.get("/api/ai/mid-season-review/:leagueId", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      const userId = req.user.claims.sub;

      const userProfile = await storage.getUserProfile(userId);
      if (!userProfile?.sleeperUserId) {
        return res.status(400).json({ message: "Sleeper account not connected" });
      }

      const [rosters, users, state, league, allPlayers] = await Promise.all([
        sleeperApi.getLeagueRosters(leagueId),
        sleeperApi.getLeagueUsers(leagueId),
        sleeperApi.getState(),
        sleeperApi.getLeague(leagueId),
        sleeperApi.getAllPlayers(),
      ]);

      const userMap = new Map((users || []).map(u => [u.user_id, u]));
      const myRoster = rosters.find(r => r.owner_id === userProfile.sleeperUserId);
      if (!myRoster) return res.status(404).json({ message: "Roster not found" });

      const currentWeek = state?.display_week || state?.week || 1;
      const myUser = userMap.get(userProfile.sleeperUserId);
      const myName = myUser?.display_name || myUser?.username || "My Team";
      const playerData = allPlayers || {};
      const playoffTeams = league?.settings?.playoff_teams || 6;

      const sorted = [...rosters].sort((a, b) => {
        if ((b.settings.wins || 0) !== (a.settings.wins || 0)) return (b.settings.wins || 0) - (a.settings.wins || 0);
        const bPts = (b.settings.fpts || 0) + (b.settings.fpts_decimal || 0) / 100;
        const aPts = (a.settings.fpts || 0) + (a.settings.fpts_decimal || 0) / 100;
        return bPts - aPts;
      });
      const myRank = sorted.findIndex(r => r.roster_id === myRoster.roster_id) + 1;

      const myFpts = ((myRoster.settings.fpts || 0) + (myRoster.settings.fpts_decimal || 0) / 100).toFixed(1);
      const myRecord = `${myRoster.settings.wins || 0}-${myRoster.settings.losses || 0}`;

      const posCounts: Record<string, string[]> = {};
      (myRoster.players || []).forEach(id => {
        const p = playerData[id];
        if (p && ["QB", "RB", "WR", "TE"].includes(p.position)) {
          if (!posCounts[p.position]) posCounts[p.position] = [];
          posCounts[p.position].push(`${p.full_name} (${p.team || 'FA'}, Age: ${p.age || '?'})`);
        }
      });

      const rosterBreakdown = Object.entries(posCounts).map(([pos, names]) => `${pos} (${names.length}): ${names.join(", ")}`).join("\n");

      const standings = sorted.map((r, i) => {
        const u = userMap.get(r.owner_id);
        const pts = ((r.settings.fpts || 0) + (r.settings.fpts_decimal || 0) / 100).toFixed(1);
        return `${i + 1}. ${u?.display_name || 'Unknown'}: ${r.settings.wins || 0}-${r.settings.losses || 0} (${pts} pts)`;
      }).join("\n");

      const prompt = `Provide a comprehensive mid-season fantasy football review for my team.

MY TEAM: ${myName}
Record: ${myRecord} (Rank: ${myRank}/${rosters.length})
Total Points: ${myFpts}
Week: ${currentWeek}
Playoff Spots: ${playoffTeams}
League: ${league?.name || 'League'} (${league?.settings?.type === 2 ? 'Dynasty' : 'Redraft'})

MY ROSTER:
${rosterBreakdown}

LEAGUE STANDINGS:
${standings}

Provide your analysis as JSON with these fields:
- "overallGrade": letter grade A+ through F
- "playoffOutlook": "Contender", "Bubble", "Longshot", or "Eliminated"
- "playoffProbability": number 0-100
- "summary": 3-4 sentence overview
- "strengths": array of 2-3 roster strengths
- "weaknesses": array of 2-3 roster weaknesses
- "recommendations": array of 3-4 specific actionable moves (trade targets, waiver adds, position needs)
- "strategy": either "WIN_NOW" or "REBUILD" with a brief explanation

Return ONLY valid JSON, no markdown.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an expert fantasy football analyst providing mid-season team reviews. Be specific and actionable. Always return valid JSON." },
          { role: "user", content: prompt }
        ],
        max_tokens: 1200,
        temperature: 0.7,
      });

      const raw = response.choices[0]?.message?.content || "{}";
      let review;
      try {
        const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
        review = JSON.parse(cleaned);
      } catch {
        review = {
          overallGrade: "C",
          playoffOutlook: "Bubble",
          playoffProbability: 50,
          summary: "Unable to generate review at this time.",
          strengths: [],
          weaknesses: [],
          recommendations: [],
          strategy: "WIN_NOW",
        };
      }

      res.json({
        review,
        teamInfo: { name: myName, record: myRecord, rank: myRank, totalTeams: rosters.length, points: myFpts },
        week: currentWeek,
      });
    } catch (error) {
      console.error("Error generating mid-season review:", error);
      res.status(500).json({ message: "Failed to generate mid-season review" });
    }
  });

  // ===== TAXI SQUAD OPTIMIZER =====
  app.get("/api/fantasy/taxi-optimizer/:leagueId", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      const userId = req.user.claims.sub;

      const userProfile = await storage.getUserProfile(userId);
      if (!userProfile?.sleeperUserId) {
        return res.status(400).json({ message: "Sleeper account not connected" });
      }

      const [rosters, league, allPlayers] = await Promise.all([
        sleeperApi.getLeagueRosters(leagueId),
        sleeperApi.getLeague(leagueId),
        sleeperApi.getAllPlayers(),
      ]);

      const myRoster = rosters.find(r => r.owner_id === userProfile.sleeperUserId);
      if (!myRoster) return res.status(404).json({ message: "Roster not found" });

      const taxiSlots = (league?.settings as any)?.taxi_slots || 0;
      if (taxiSlots === 0) {
        return res.json({ taxiSlots: 0, currentTaxi: [], recommendations: [], message: "This league does not have taxi squad slots." });
      }

      const playerData = allPlayers || {};
      const currentTaxi = (myRoster.taxi || []).map(id => {
        const p = playerData[id];
        return {
          playerId: id,
          name: p?.full_name || "Unknown",
          position: p?.position || "?",
          team: p?.team || "FA",
          age: p?.age || 0,
          yearsExp: p?.years_exp || 0,
          dynastyValue: getSimplePlayerValue(id, p),
        };
      });

      const starters = new Set(myRoster.starters || []);
      const taxiSet = new Set(myRoster.taxi || []);
      const benchPlayers = (myRoster.players || [])
        .filter(id => !starters.has(id) && !taxiSet.has(id))
        .map(id => {
          const p = playerData[id];
          if (!p) return null;
          const pos = p.position || "?";
          if (!["QB", "RB", "WR", "TE"].includes(pos)) return null;
          const yearsExp = p.years_exp || 0;
          const age = p.age || 0;
          const val = getSimplePlayerValue(id, p);

          const upside = yearsExp <= 2 ? "High" : yearsExp <= 3 ? "Medium" : "Low";
          const taxiScore = (yearsExp <= 2 ? 30 : yearsExp <= 3 ? 15 : 0) + (age <= 23 ? 20 : age <= 25 ? 10 : 0) + Math.min(30, val / 300) + (pos === "WR" ? 10 : pos === "RB" ? 5 : 0);

          return {
            playerId: id,
            name: p.full_name || "Unknown",
            position: pos,
            team: p.team || "FA",
            age,
            yearsExp,
            dynastyValue: val,
            upside,
            taxiScore: Math.round(taxiScore),
            reason: yearsExp <= 1 ? "Rookie with high development potential" :
              yearsExp <= 2 ? "Second-year player still developing" :
              age <= 23 ? "Young player with room to grow" :
              "Veteran depth piece",
          };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => b.taxiScore - a.taxiScore);

      res.json({
        taxiSlots,
        currentTaxi,
        recommendations: benchPlayers.slice(0, taxiSlots + 3),
      });
    } catch (error) {
      console.error("Error generating taxi optimizer:", error);
      res.status(500).json({ message: "Failed to generate taxi recommendations" });
    }
  });

  // ===== MATCHUP HEAT MAP =====
  app.get("/api/fantasy/matchup-heatmap/:leagueId", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      const userId = req.user.claims.sub;
      const requestedWeek = req.query.week ? parseInt(req.query.week as string) : null;

      const userProfile = await storage.getUserProfile(userId);
      if (!userProfile?.sleeperUserId) {
        return res.status(400).json({ message: "Sleeper account not connected" });
      }

      const [rosters, users, state, league, allPlayers] = await Promise.all([
        sleeperApi.getLeagueRosters(leagueId),
        sleeperApi.getLeagueUsers(leagueId),
        sleeperApi.getState(),
        sleeperApi.getLeague(leagueId),
        sleeperApi.getAllPlayers(),
      ]);

      const currentWeek = state?.display_week || state?.week || 1;
      const selectedWeek = requestedWeek || currentWeek;
      const userMap = new Map((users || []).map(u => [u.user_id, u]));
      const playerData = allPlayers || {};

      const matchupsRaw = await sleeperApi.getMatchups(leagueId, selectedWeek);
      const myRoster = rosters.find(r => r.owner_id === userProfile.sleeperUserId);
      if (!myRoster) return res.status(404).json({ message: "Roster not found" });

      const myMatchup = matchupsRaw.find(m => m.roster_id === myRoster.roster_id);
      if (!myMatchup || !myMatchup.matchup_id) return res.json({ heatmap: null, message: "No matchup this week" });

      const oppMatchup = matchupsRaw.find(m => m.matchup_id === myMatchup.matchup_id && m.roster_id !== myRoster.roster_id);
      if (!oppMatchup) return res.json({ heatmap: null, message: "Opponent not found" });

      const oppRoster = rosters.find(r => r.roster_id === oppMatchup.roster_id);
      const oppUser = oppRoster ? userMap.get(oppRoster.owner_id) : null;

      const getPositionValue = (starters: string[], pos: string) => {
        return (starters || []).reduce((sum, id) => {
          const p = playerData[id];
          if (p?.position === pos || (pos === "FLEX" && ["RB", "WR", "TE"].includes(p?.position || ""))) {
            return sum + getSimplePlayerValue(id, p);
          }
          return sum;
        }, 0);
      };

      const positions = ["QB", "RB", "WR", "TE"];
      const heatmap = positions.map(pos => {
        const myVal = getPositionValue(myMatchup.starters || [], pos);
        const oppVal = getPositionValue(oppMatchup.starters || [], pos);
        const diff = myVal - oppVal;
        const advantage = diff > 500 ? "Strong" : diff > 0 ? "Slight" : diff > -500 ? "Slight Disadvantage" : "Disadvantage";

        return {
          position: pos,
          myValue: myVal,
          oppValue: oppVal,
          difference: diff,
          advantage,
          myPlayers: (myMatchup.starters || []).filter(id => playerData[id]?.position === pos).map(id => ({
            name: playerData[id]?.full_name || id,
            value: getSimplePlayerValue(id, playerData[id]),
          })),
          oppPlayers: (oppMatchup.starters || []).filter(id => playerData[id]?.position === pos).map(id => ({
            name: playerData[id]?.full_name || id,
            value: getSimplePlayerValue(id, playerData[id]),
          })),
        };
      });

      const myUser = userMap.get(userProfile.sleeperUserId);
      res.json({
        heatmap,
        week: selectedWeek,
        myTeam: myUser?.display_name || myUser?.username || "My Team",
        opponent: oppUser?.display_name || oppUser?.username || "Opponent",
        myPoints: myMatchup.points || 0,
        oppPoints: oppMatchup.points || 0,
      });
    } catch (error) {
      console.error("Error generating matchup heatmap:", error);
      res.status(500).json({ message: "Failed to generate matchup heatmap" });
    }
  });

  // ===== DRAFT PICK PREDICTIONS =====
  app.get("/api/fantasy/draft-predictions/:leagueId", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      const userId = req.user.claims.sub;

      const userProfile = await storage.getUserProfile(userId);
      if (!userProfile?.sleeperUserId) {
        return res.status(400).json({ message: "Sleeper account not connected" });
      }

      const [rosters, league, allPlayers, users] = await Promise.all([
        sleeperApi.getLeagueRosters(leagueId),
        sleeperApi.getLeague(leagueId),
        sleeperApi.getAllPlayers(),
        sleeperApi.getLeagueUsers(leagueId),
      ]);

      const myRoster = rosters.find(r => r.owner_id === userProfile.sleeperUserId);
      if (!myRoster) return res.status(404).json({ message: "Roster not found" });

      const playerData = allPlayers || {};
      const userMap = new Map((users || []).map(u => [u.user_id, u]));
      const leagueSize = rosters.length || 12;

      const drafts = await sleeperApi.getLeagueDrafts(leagueId);
      const upcomingDraft = drafts?.find((d: any) => d.status === "pre_draft" || d.status === "drafting");

      if (!upcomingDraft) {
        return res.json({ predictions: [], message: "No upcoming draft found for this league." });
      }

      const draftOrder = upcomingDraft.draft_order || {};
      const slotToRoster = upcomingDraft.slot_to_roster_id || {};
      const myDraftSlot = draftOrder[userProfile.sleeperUserId] || 0;
      const totalRounds = upcomingDraft.settings?.rounds || 4;
      const draftType = upcomingDraft.type || "snake";
      const currentSeason = upcomingDraft.season || new Date().getFullYear().toString();

      const myRosterForDraft = rosters.find(r => r.owner_id === userProfile.sleeperUserId);
      const myRosterIdForDraft = myRosterForDraft?.roster_id;

      let tradedPicksData: any[] = [];
      try {
        const tpRes = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/traded_picks`);
        tradedPicksData = await tpRes.json();
      } catch {}

      const rosterIdToSlotPred: Record<number, number> = {};
      for (const [slot, rid] of Object.entries(slotToRoster)) {
        rosterIdToSlotPred[rid as number] = parseInt(slot);
      }

      const pickOwnershipPred: Record<string, number> = {};
      for (let round = 1; round <= totalRounds; round++) {
        for (let slot = 1; slot <= leagueSize; slot++) {
          const rosterId = slotToRoster[slot] || slot;
          pickOwnershipPred[`${round}-${slot}`] = rosterId;
        }
      }
      if (Array.isArray(tradedPicksData)) {
        for (const tp of tradedPicksData) {
          if (tp.season === currentSeason) {
            const origSlot = rosterIdToSlotPred[tp.roster_id] || tp.roster_id;
            pickOwnershipPred[`${tp.round}-${origSlot}`] = tp.owner_id;
          }
        }
      }

      const myPicks: Array<{ round: number; pick: number; overall: number }> = [];
      for (let round = 1; round <= totalRounds; round++) {
        for (let slot = 1; slot <= leagueSize; slot++) {
          const currentOwner = pickOwnershipPred[`${round}-${slot}`];
          if (currentOwner === myRosterIdForDraft) {
            let pickInRound: number;
            if (draftType === "snake" && round % 2 === 0) {
              pickInRound = leagueSize - slot + 1;
            } else {
              pickInRound = slot;
            }
            const overall = (round - 1) * leagueSize + pickInRound;
            myPicks.push({ round, pick: pickInRound, overall });
          }
        }
      }
      myPicks.sort((a, b) => a.overall - b.overall);

      const devyPlayers = ktcValues.getDevyPlayers();
      const rookieProspects = devyPlayers
        .filter((p: any) => p.draftEligibleYear === "2026" || p.draftEligibleYear === "2025")
        .sort((a: any, b: any) => (b.value || 0) - (a.value || 0));

      const predictions = myPicks.map(pick => {
        const startIdx = Math.max(0, pick.overall - 3);
        const endIdx = Math.min(rookieProspects.length, pick.overall + 3);
        const likelyAvailable = rookieProspects.slice(startIdx, endIdx).map((p: any) => ({
          id: p.id,
          name: p.name,
          position: p.position,
          college: p.college,
          value: p.value,
          tier: p.tier,
          rank: p.rank || 0,
        }));

        return {
          round: pick.round,
          pick: pick.pick,
          overall: pick.overall,
          likelyAvailable,
        };
      });

      res.json({
        predictions,
        myDraftSlot,
        totalRounds,
        draftType,
        leagueSize,
        draftStatus: upcomingDraft.status,
      });
    } catch (error) {
      console.error("Error generating draft predictions:", error);
      res.status(500).json({ message: "Failed to generate draft predictions" });
    }
  });

  // ========================
  // FRIENDS SYSTEM ENDPOINTS
  // ========================

  app.get("/api/users/search", isAuthenticated, async (req: any, res: Response) => {
    try {
      const query = (req.query.query as string || "").trim();
      if (query.length < 2) return res.json([]);

      const currentUserId = req.user.claims.sub;
      const results = await db
        .select({
          id: schema.users.id,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
          profileImageUrl: schema.users.profileImageUrl,
          sleeperUsername: schema.userProfiles.sleeperUsername,
          sleeperUserId: schema.userProfiles.sleeperUserId,
        })
        .from(schema.users)
        .leftJoin(schema.userProfiles, eq(schema.users.id, schema.userProfiles.userId))
        .where(
          and(
            ne(schema.users.id, currentUserId),
            or(
              ilike(schema.users.firstName, `%${query}%`),
              ilike(schema.users.lastName, `%${query}%`),
              ilike(schema.users.email, `%${query}%`),
              ilike(schema.userProfiles.sleeperUsername, `%${query}%`)
            )
          )
        )
        .limit(20);

      res.json(results);
    } catch (error) {
      console.error("Error searching users:", error);
      res.status(500).json({ message: "Failed to search users" });
    }
  });

  const friendRequestSchema = z.object({ addresseeId: z.string().min(1) });
  const friendRespondSchema = z.object({ friendId: z.string().min(1), action: z.enum(["accept", "reject"]) });

  app.post("/api/friends/request", isAuthenticated, async (req: any, res: Response) => {
    try {
      const parsed = friendRequestSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid request" });
      const { addresseeId } = parsed.data;
      const requesterId = req.user.claims.sub;
      if (requesterId === addresseeId) {
        return res.status(400).json({ message: "Cannot add yourself" });
      }

      const existing = await db
        .select()
        .from(schema.friends)
        .where(
          or(
            and(eq(schema.friends.requesterId, requesterId), eq(schema.friends.addresseeId, addresseeId)),
            and(eq(schema.friends.requesterId, addresseeId), eq(schema.friends.addresseeId, requesterId))
          )
        )
        .limit(1);

      if (existing.length > 0) {
        const f = existing[0];
        if (f.status === "accepted") return res.status(400).json({ message: "Already friends" });
        if (f.status === "pending") return res.status(400).json({ message: "Friend request already pending" });
        if (f.status === "rejected") {
          await db.update(schema.friends).set({ status: "pending", requesterId, addresseeId, updatedAt: new Date() }).where(eq(schema.friends.id, f.id));
          return res.json({ message: "Friend request sent" });
        }
      }

      await db.insert(schema.friends).values({ requesterId, addresseeId, status: "pending" });
      res.json({ message: "Friend request sent" });
    } catch (error) {
      console.error("Error sending friend request:", error);
      res.status(500).json({ message: "Failed to send friend request" });
    }
  });

  app.post("/api/friends/respond", isAuthenticated, async (req: any, res: Response) => {
    try {
      const parsed = friendRespondSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid response" });
      const { friendId, action } = parsed.data;
      const userId = req.user.claims.sub;

      const request = await db.select().from(schema.friends).where(eq(schema.friends.id, friendId)).limit(1);
      if (!request.length || request[0].addresseeId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const newStatus = action === "accept" ? "accepted" : "rejected";
      await db.update(schema.friends).set({ status: newStatus, updatedAt: new Date() }).where(eq(schema.friends.id, friendId));
      res.json({ message: `Friend request ${newStatus}` });
    } catch (error) {
      console.error("Error responding to friend request:", error);
      res.status(500).json({ message: "Failed to respond to friend request" });
    }
  });

  app.get("/api/friends", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const friendships = await db
        .select()
        .from(schema.friends)
        .where(
          and(
            eq(schema.friends.status, "accepted"),
            or(
              eq(schema.friends.requesterId, userId),
              eq(schema.friends.addresseeId, userId)
            )
          )
        );

      const friendUserIds = friendships.map(f =>
        f.requesterId === userId ? f.addresseeId : f.requesterId
      );

      if (friendUserIds.length === 0) return res.json([]);

      const friendUsers = await db
        .select({
          id: schema.users.id,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
          profileImageUrl: schema.users.profileImageUrl,
          sleeperUsername: schema.userProfiles.sleeperUsername,
          sleeperUserId: schema.userProfiles.sleeperUserId,
        })
        .from(schema.users)
        .leftJoin(schema.userProfiles, eq(schema.users.id, schema.userProfiles.userId))
        .where(sql`${schema.users.id} IN (${sql.join(friendUserIds.map(id => sql`${id}`), sql`, `)})`);

      res.json(friendUsers);
    } catch (error) {
      console.error("Error fetching friends:", error);
      res.status(500).json({ message: "Failed to fetch friends" });
    }
  });

  app.get("/api/friends/requests", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const incoming = await db
        .select({
          id: schema.friends.id,
          requesterId: schema.friends.requesterId,
          status: schema.friends.status,
          createdAt: schema.friends.createdAt,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
          profileImageUrl: schema.users.profileImageUrl,
        })
        .from(schema.friends)
        .innerJoin(schema.users, eq(schema.friends.requesterId, schema.users.id))
        .where(and(eq(schema.friends.addresseeId, userId), eq(schema.friends.status, "pending")));

      const outgoing = await db
        .select({
          id: schema.friends.id,
          addresseeId: schema.friends.addresseeId,
          status: schema.friends.status,
          createdAt: schema.friends.createdAt,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
          profileImageUrl: schema.users.profileImageUrl,
        })
        .from(schema.friends)
        .innerJoin(schema.users, eq(schema.friends.addresseeId, schema.users.id))
        .where(and(eq(schema.friends.requesterId, userId), eq(schema.friends.status, "pending")));

      res.json({ incoming, outgoing });
    } catch (error) {
      console.error("Error fetching friend requests:", error);
      res.status(500).json({ message: "Failed to fetch friend requests" });
    }
  });

  app.delete("/api/friends/:id", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const friendshipId = req.params.id;

      const friendship = await db.select().from(schema.friends).where(eq(schema.friends.id, friendshipId)).limit(1);
      if (!friendship.length) return res.status(404).json({ message: "Friendship not found" });
      if (friendship[0].requesterId !== userId && friendship[0].addresseeId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      await db.delete(schema.friends).where(eq(schema.friends.id, friendshipId));
      res.json({ message: "Friend removed" });
    } catch (error) {
      console.error("Error removing friend:", error);
      res.status(500).json({ message: "Failed to remove friend" });
    }
  });

  app.get("/api/friends/status/:userId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const currentUserId = req.user.claims.sub;
      const targetUserId = req.params.userId;

      const friendship = await db
        .select()
        .from(schema.friends)
        .where(
          or(
            and(eq(schema.friends.requesterId, currentUserId), eq(schema.friends.addresseeId, targetUserId)),
            and(eq(schema.friends.requesterId, targetUserId), eq(schema.friends.addresseeId, currentUserId))
          )
        )
        .limit(1);

      if (!friendship.length) return res.json({ status: "none" });
      const f = friendship[0];
      res.json({
        status: f.status,
        friendshipId: f.id,
        isRequester: f.requesterId === currentUserId,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to check friendship status" });
    }
  });

  // ========================
  // USER PROFILE ENDPOINT
  // ========================

  app.get("/api/profile/:userId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const targetUserId = req.params.userId;

      const userResult = await db
        .select({
          id: schema.users.id,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
          profileImageUrl: schema.users.profileImageUrl,
          createdAt: schema.users.createdAt,
          sleeperUsername: schema.userProfiles.sleeperUsername,
          sleeperUserId: schema.userProfiles.sleeperUserId,
          bio: schema.userProfiles.bio,
          favoriteTeams: schema.userProfiles.favoriteTeams,
        })
        .from(schema.users)
        .leftJoin(schema.userProfiles, eq(schema.users.id, schema.userProfiles.userId))
        .where(eq(schema.users.id, targetUserId))
        .limit(1);

      if (!userResult.length) return res.status(404).json({ message: "User not found" });
      const user = userResult[0];

      const stats = await db.select().from(schema.userStats).where(eq(schema.userStats.userId, targetUserId)).limit(1);

      const friendCount = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.friends)
        .where(
          and(
            eq(schema.friends.status, "accepted"),
            or(
              eq(schema.friends.requesterId, targetUserId),
              eq(schema.friends.addresseeId, targetUserId)
            )
          )
        );

      res.json({
        ...user,
        stats: stats[0] || null,
        friendCount: friendCount[0]?.count || 0,
      });
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  app.patch("/api/profile/bio", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { bio } = req.body;
      if (typeof bio !== "string" || bio.length > 500) {
        return res.status(400).json({ message: "Bio must be a string under 500 characters" });
      }
      const existing = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).limit(1);
      if (existing.length > 0) {
        await db.update(schema.userProfiles).set({ bio: bio.trim(), updatedAt: new Date() }).where(eq(schema.userProfiles.userId, userId));
      } else {
        await db.insert(schema.userProfiles).values({ userId, bio: bio.trim() });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating bio:", error);
      res.status(500).json({ message: "Failed to update bio" });
    }
  });

  app.patch("/api/profile/favorite-teams", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { favoriteTeams } = req.body;
      if (typeof favoriteTeams !== "object") {
        return res.status(400).json({ message: "Invalid favorite teams format" });
      }
      const existing = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).limit(1);
      if (existing.length > 0) {
        await db.update(schema.userProfiles).set({ favoriteTeams, updatedAt: new Date() }).where(eq(schema.userProfiles.userId, userId));
      } else {
        await db.insert(schema.userProfiles).values({ userId, favoriteTeams });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating favorite teams:", error);
      res.status(500).json({ message: "Failed to update favorite teams" });
    }
  });

  // ========================
  // LEADERBOARD ENDPOINTS
  // ========================

  app.post("/api/leaderboard/refresh", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const userProfile = await storage.getUserProfile(userId);
      if (!userProfile?.sleeperUserId) {
        return res.status(400).json({ message: "No Sleeper account linked" });
      }

      const existingStats = await db.select().from(schema.userStats).where(eq(schema.userStats.userId, userId)).limit(1);
      if (existingStats.length > 0 && existingStats[0].computedAt) {
        const hoursSince = (Date.now() - new Date(existingStats[0].computedAt).getTime()) / (1000 * 60 * 60);
        if (hoursSince < 1) {
          return res.json({ message: "Stats were recently refreshed. Try again later.", cooldown: true });
        }
      }

      const sleeperUserId = userProfile.sleeperUserId;
      const sleeperUsername = userProfile.sleeperUsername || "";

      let sleeperAvatar = "";
      try {
        const sleeperUserRes = await fetch(`https://api.sleeper.app/v1/user/${sleeperUserId}`);
        if (sleeperUserRes.ok) {
          const sleeperUser = await sleeperUserRes.json();
          sleeperAvatar = sleeperUser.avatar ? `https://sleepercdn.com/avatars/thumbs/${sleeperUser.avatar}` : "";
        }
      } catch {}

      const careerSummary = await computeCareerSummary(userId, sleeperUserId, true);

      const displayName = [userProfile.sleeperUsername || req.user?.firstName, req.user?.lastName].filter(Boolean).join(" ") || sleeperUsername;

      await db.insert(schema.userStats).values({
        userId,
        sleeperUserId,
        sleeperUsername,
        displayName,
        avatarUrl: sleeperAvatar || req.user?.profileImageUrl || "",
        totalWins: careerSummary.totalWins,
        totalLosses: careerSummary.totalLosses,
        totalTies: careerSummary.totalTies,
        championships: careerSummary.championships,
        runnerUps: careerSummary.runnerUps,
        playoffAppearances: careerSummary.playoffAppearances,
        bestFinish: careerSummary.bestFinishRank,
        totalLeagues: careerSummary.totalLeagues,
        activeLeagues: careerSummary.totalLeagues,
        totalPointsFor: careerSummary.totalPointsFor,
        computedAt: new Date(),
      }).onConflictDoUpdate({
        target: schema.userStats.userId,
        set: {
          sleeperUserId,
          sleeperUsername,
          displayName,
          avatarUrl: sleeperAvatar || req.user?.profileImageUrl || "",
          totalWins: careerSummary.totalWins,
          totalLosses: careerSummary.totalLosses,
          totalTies: careerSummary.totalTies,
          championships: careerSummary.championships,
          runnerUps: careerSummary.runnerUps,
          playoffAppearances: careerSummary.playoffAppearances,
          bestFinish: careerSummary.bestFinishRank,
          totalLeagues: careerSummary.totalLeagues,
          activeLeagues: careerSummary.totalLeagues,
          totalPointsFor: careerSummary.totalPointsFor,
          computedAt: new Date(),
        },
      });

      res.json({ message: "Stats refreshed successfully" });
    } catch (error) {
      console.error("Error refreshing leaderboard:", error);
      res.status(500).json({ message: "Failed to refresh stats" });
    }
  });

  app.get("/api/leaderboard", isAuthenticated, async (req: any, res: Response) => {
    try {
      const sortBy = (req.query.sort as string) || "championships";
      const validSorts: Record<string, any> = {
        championships: desc(schema.userStats.championships),
        wins: desc(schema.userStats.totalWins),
        points: desc(schema.userStats.totalPointsFor),
        winpct: sql`CASE WHEN (${schema.userStats.totalWins} + ${schema.userStats.totalLosses}) > 0 THEN ${schema.userStats.totalWins}::float / (${schema.userStats.totalWins} + ${schema.userStats.totalLosses})::float ELSE 0 END DESC`,
        leagues: desc(schema.userStats.totalLeagues),
      };

      const orderClause = validSorts[sortBy] || validSorts.championships;

      const leaderboard = await db
        .select()
        .from(schema.userStats)
        .orderBy(orderClause, desc(schema.userStats.totalWins))
        .limit(100);

      res.json(leaderboard);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  // ========================
  // LEAGUE ACCOUNTING ENDPOINTS
  // ========================

  app.get("/api/fantasy/accounting/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { leagueId } = req.params;
      const entries = await db
        .select()
        .from(schema.leagueFinances)
        .where(and(eq(schema.leagueFinances.userId, userId), eq(schema.leagueFinances.leagueId, leagueId)))
        .orderBy(desc(schema.leagueFinances.createdAt));
      res.json(entries);
    } catch (error) {
      console.error("Error fetching accounting:", error);
      res.status(500).json({ message: "Failed to fetch accounting data" });
    }
  });

  const accountingSchema = z.object({
    leagueName: z.string().min(1),
    season: z.string().min(1),
    type: z.enum(["dues", "prize", "penalty", "other"]),
    description: z.string().min(1),
    amount: z.number().int(),
  });

  app.post("/api/fantasy/accounting/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { leagueId } = req.params;
      const parsed = accountingSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data" });

      const entry = await db.insert(schema.leagueFinances).values({
        userId,
        leagueId,
        leagueName: parsed.data.leagueName,
        season: parsed.data.season,
        type: parsed.data.type,
        description: parsed.data.description,
        amount: parsed.data.amount,
      }).returning();

      res.json(entry[0]);
    } catch (error) {
      console.error("Error adding accounting entry:", error);
      res.status(500).json({ message: "Failed to add entry" });
    }
  });

  app.delete("/api/fantasy/accounting/:id", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const entry = await db.select().from(schema.leagueFinances).where(eq(schema.leagueFinances.id, id)).limit(1);
      if (!entry.length || entry[0].userId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      await db.delete(schema.leagueFinances).where(eq(schema.leagueFinances.id, id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting accounting entry:", error);
      res.status(500).json({ message: "Failed to delete entry" });
    }
  });

  app.get("/api/fantasy/accounting-summary", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const entries = await db
        .select()
        .from(schema.leagueFinances)
        .where(eq(schema.leagueFinances.userId, userId))
        .orderBy(desc(schema.leagueFinances.createdAt));

      const byLeague: Record<string, { leagueName: string; totalDues: number; totalWinnings: number; entries: typeof entries }> = {};
      entries.forEach(e => {
        if (!byLeague[e.leagueId]) {
          byLeague[e.leagueId] = { leagueName: e.leagueName, totalDues: 0, totalWinnings: 0, entries: [] };
        }
        byLeague[e.leagueId].entries.push(e);
        if (e.type === "dues" || e.type === "penalty") {
          byLeague[e.leagueId].totalDues += Math.abs(e.amount);
        } else {
          byLeague[e.leagueId].totalWinnings += e.amount;
        }
      });

      const totalDues = Object.values(byLeague).reduce((s, l) => s + l.totalDues, 0);
      const totalWinnings = Object.values(byLeague).reduce((s, l) => s + l.totalWinnings, 0);

      res.json({ leagues: byLeague, totalDues, totalWinnings, net: totalWinnings - totalDues });
    } catch (error) {
      console.error("Error fetching accounting summary:", error);
      res.status(500).json({ message: "Failed to fetch accounting summary" });
    }
  });

  // ========================
  // WEEKLY PREDICTIONS ENDPOINTS
  // ========================

  app.get("/api/fantasy/predictions/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { leagueId } = req.params;
      const week = parseInt(req.query.week as string) || 1;

      const matchupsRes = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`);
      const matchups = await matchupsRes.json();

      const rostersRes = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`);
      const rosters = await rostersRes.json();

      const usersRes = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`);
      const leagueUsers = await usersRes.json();

      const userMap: Record<string, { name: string; avatar: string | null }> = {};
      leagueUsers.forEach((u: any) => {
        userMap[u.user_id] = { name: u.display_name || u.username, avatar: u.avatar };
      });

      const rosterMap: Record<number, { ownerId: string; name: string; avatar: string | null }> = {};
      rosters.forEach((r: any) => {
        const owner = userMap[r.owner_id] || { name: "Unknown", avatar: null };
        rosterMap[r.roster_id] = { ownerId: r.owner_id, name: owner.name, avatar: owner.avatar };
      });

      const matchupGroups: Record<number, any[]> = {};
      matchups.forEach((m: any) => {
        if (!matchupGroups[m.matchup_id]) matchupGroups[m.matchup_id] = [];
        matchupGroups[m.matchup_id].push(m);
      });

      const formattedMatchups = Object.entries(matchupGroups).map(([mid, teams]) => {
        if (teams.length < 2) return null;
        const [a, b] = teams;
        const rA = rosterMap[a.roster_id] || { ownerId: "", name: "Team A", avatar: null };
        const rB = rosterMap[b.roster_id] || { ownerId: "", name: "Team B", avatar: null };
        return {
          matchupId: parseInt(mid),
          teamA: { rosterId: a.roster_id, ownerId: rA.ownerId, name: rA.name, avatar: rA.avatar, points: a.points || 0 },
          teamB: { rosterId: b.roster_id, ownerId: rB.ownerId, name: rB.name, avatar: rB.avatar, points: b.points || 0 },
        };
      }).filter(Boolean);

      const existingPredictions = await db
        .select()
        .from(schema.weeklyPredictions)
        .where(and(
          eq(schema.weeklyPredictions.userId, userId),
          eq(schema.weeklyPredictions.leagueId, leagueId),
          eq(schema.weeklyPredictions.week, week)
        ));

      res.json({ matchups: formattedMatchups, predictions: existingPredictions, week });
    } catch (error) {
      console.error("Error fetching predictions:", error);
      res.status(500).json({ message: "Failed to fetch predictions" });
    }
  });

  const predictionSchema = z.object({
    week: z.number().int().min(1).max(18),
    matchupId: z.number().int(),
    predictedWinnerId: z.string().min(1),
  });

  app.post("/api/fantasy/predictions/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { leagueId } = req.params;
      const parsed = predictionSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid prediction" });

      const existing = await db
        .select()
        .from(schema.weeklyPredictions)
        .where(and(
          eq(schema.weeklyPredictions.userId, userId),
          eq(schema.weeklyPredictions.leagueId, leagueId),
          eq(schema.weeklyPredictions.week, parsed.data.week),
          eq(schema.weeklyPredictions.matchupId, parsed.data.matchupId)
        ))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(schema.weeklyPredictions)
          .set({ predictedWinnerId: parsed.data.predictedWinnerId })
          .where(eq(schema.weeklyPredictions.id, existing[0].id));
      } else {
        await db.insert(schema.weeklyPredictions).values({
          userId,
          leagueId,
          week: parsed.data.week,
          matchupId: parsed.data.matchupId,
          predictedWinnerId: parsed.data.predictedWinnerId,
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error saving prediction:", error);
      res.status(500).json({ message: "Failed to save prediction" });
    }
  });

  app.get("/api/fantasy/predictions-leaderboard/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;

      const allPredictions = await db
        .select()
        .from(schema.weeklyPredictions)
        .where(eq(schema.weeklyPredictions.leagueId, leagueId));

      const leaderboard: Record<string, { correct: number; total: number; userId: string }> = {};
      allPredictions.forEach(p => {
        if (!leaderboard[p.userId]) leaderboard[p.userId] = { correct: 0, total: 0, userId: p.userId };
        leaderboard[p.userId].total++;
        if (p.correct) leaderboard[p.userId].correct++;
      });

      const sorted = Object.values(leaderboard).sort((a, b) => {
        if (b.correct !== a.correct) return b.correct - a.correct;
        return (b.correct / (b.total || 1)) - (a.correct / (a.total || 1));
      });

      res.json(sorted);
    } catch (error) {
      console.error("Error fetching predictions leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  // ========================
  // COMMUNITY CHAT ENDPOINTS
  // ========================

  app.get("/api/chat/messages", isAuthenticated, async (req: any, res: Response) => {
    try {
      const messages = await db
        .select()
        .from(schema.chatMessages)
        .orderBy(desc(schema.chatMessages.createdAt))
        .limit(100);
      res.json(messages.reverse());
    } catch (error) {
      console.error("Error fetching chat messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  const chatMessageSchema = z.object({
    message: z.string().min(1).max(500),
  });

  app.post("/api/chat/messages", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = chatMessageSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid message" });

      const userProfile = await storage.getUserProfile(userId);
      const dbUser = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
      const username = userProfile?.sleeperUsername || dbUser[0]?.firstName || dbUser[0]?.email?.split("@")[0] || "Anonymous";

      let avatarUrl = null;
      if (userProfile?.sleeperUserId) {
        try {
          const sleeperRes = await fetch(`https://api.sleeper.app/v1/user/${userProfile.sleeperUserId}`);
          const sleeperUser = await sleeperRes.json();
          if (sleeperUser?.avatar) avatarUrl = `https://sleepercdn.com/avatars/thumbs/${sleeperUser.avatar}`;
        } catch {}
      }

      const msg = await db.insert(schema.chatMessages).values({
        userId,
        username,
        avatarUrl,
        message: parsed.data.message,
      }).returning();

      res.json(msg[0]);
    } catch (error) {
      console.error("Error sending chat message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // ========================
  // DRAFT RECAP & GRADES ENDPOINT
  // ========================

  app.get("/api/ai/draft-recap/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      const cacheKey = `draft-recap-${leagueId}`;
      const cached = externalApiCache.get(cacheKey);
      if (cached) return res.json(cached);

      const draftsRes = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/drafts`);
      const drafts = await draftsRes.json();
      if (!drafts || drafts.length === 0) {
        return res.json({ teams: [], overallSummary: "No drafts found for this league." });
      }

      const draft = drafts[0];
      const picksRes = await fetch(`https://api.sleeper.app/v1/draft/${draft.draft_id}/picks`);
      const picks = await picksRes.json();

      const usersRes = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`);
      const leagueUsers = await usersRes.json();
      const userMap: Record<string, string> = {};
      const avatarMap: Record<string, string | null> = {};
      leagueUsers.forEach((u: any) => {
        userMap[u.user_id] = u.display_name || u.username;
        avatarMap[u.user_id] = u.avatar;
      });

      const teamPicks: Record<string, Array<{ name: string; position: string; round: number; pick: number }>> = {};
      picks.forEach((p: any) => {
        const ownerId = p.picked_by;
        if (!teamPicks[ownerId]) teamPicks[ownerId] = [];
        teamPicks[ownerId].push({
          name: `${p.metadata?.first_name || ""} ${p.metadata?.last_name || ""}`.trim() || `Pick ${p.pick_no}`,
          position: p.metadata?.position || "?",
          round: p.round,
          pick: p.pick_no,
        });
      });

      const teamSummaries = Object.entries(teamPicks).map(([ownerId, tPicks]) => ({
        teamName: userMap[ownerId] || "Unknown",
        avatar: avatarMap[ownerId] ? `https://sleepercdn.com/avatars/thumbs/${avatarMap[ownerId]}` : null,
        picks: tPicks,
      }));

      try {
        const openai = new OpenAI();
        const prompt = `You are a dynasty fantasy football expert. Grade each team's draft performance. For each team, provide:
- A letter grade (A+, A, A-, B+, B, B-, C+, C, C-, D, F)
- Their best pick (player name and why)
- Their worst pick (player name and why)
- A 1-2 sentence summary

Teams and their picks:
${teamSummaries.map(t => `${t.teamName}: ${t.picks.map(p => `R${p.round}P${p.pick} ${p.name} (${p.position})`).join(", ")}`).join("\n")}

Respond in JSON format:
{
  "overallSummary": "Brief 2-3 sentence overview of the draft",
  "teams": [{"teamName": "...", "grade": "...", "bestPick": "...", "worstPick": "...", "summary": "..."}]
}`;

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          max_tokens: 2000,
        });

        const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
        const result = {
          teams: (parsed.teams || []).map((t: any) => ({
            ...t,
            avatar: teamSummaries.find(ts => ts.teamName === t.teamName)?.avatar || null,
          })),
          overallSummary: parsed.overallSummary || "Draft analysis complete.",
        };

        externalApiCache.set(cacheKey, result);
        res.json(result);
      } catch (aiError) {
        const fallbackTeams = teamSummaries.map(t => ({
          teamName: t.teamName,
          avatar: t.avatar,
          grade: "B",
          bestPick: t.picks[0]?.name || "N/A",
          worstPick: t.picks[t.picks.length - 1]?.name || "N/A",
          summary: `Drafted ${t.picks.length} players across ${t.picks.length} rounds.`,
        }));
        res.json({ teams: fallbackTeams, overallSummary: "Draft data retrieved. AI grading unavailable." });
      }
    } catch (error) {
      console.error("Error fetching draft recap:", error);
      res.status(500).json({ message: "Failed to generate draft recap" });
    }
  });


  // ========================
  // UNIFIED DRAFT COMMAND CENTER ENDPOINT
  // Combines Live Draft Board + Draft Assistant + Draft Predictions
  // ========================

  app.get("/api/fantasy/draft-command/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { leagueId } = req.params;

      const userProfile = await storage.getUserProfile(userId);
      const sleeperUserId = userProfile?.sleeperUserId;

      let effectiveLeagueId = leagueId;
      let drafts: any[] = [];

      const draftsRes = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/drafts`);
      const rawDrafts = await draftsRes.json();
      drafts = Array.isArray(rawDrafts) ? rawDrafts : [];

      const hasActiveDraft = drafts.some((d: any) => d.status === "drafting" || d.status === "paused");

      if (!hasActiveDraft && sleeperUserId) {
        try {
          const leagueRes = await fetch(`https://api.sleeper.app/v1/league/${leagueId}`);
          const leagueInfo = await leagueRes.json();
          const leagueName = leagueInfo?.name?.toLowerCase().trim();

          const allLeagues = await getAllUserLeagues(sleeperUserId);

          for (const lg of allLeagues) {
            if (lg.league_id === leagueId) continue;
            const nameMatch = leagueName
              ? lg.name?.toLowerCase().trim() === leagueName
              : false;
            const prevMatch = lg.previous_league_id === leagueId;
            if (nameMatch || prevMatch) {
              const altDraftsRes = await fetch(`https://api.sleeper.app/v1/league/${lg.league_id}/drafts`);
              const altDrafts = await altDraftsRes.json();
              if (Array.isArray(altDrafts) && altDrafts.some((d: any) => d.status === "drafting" || d.status === "paused")) {
                drafts = altDrafts;
                effectiveLeagueId = lg.league_id;
                break;
              }
            }
          }

          const stillNoActive = !drafts.some((d: any) => d.status === "drafting" || d.status === "paused");
          if (stillNoActive) {
            for (const lg of allLeagues) {
              if (lg.league_id === leagueId || lg.league_id === effectiveLeagueId) continue;
              if (lg.status !== "drafting" && lg.status !== "pre_draft") continue;
              try {
                const altDraftsRes = await fetch(`https://api.sleeper.app/v1/league/${lg.league_id}/drafts`);
                const altDrafts = await altDraftsRes.json();
                if (Array.isArray(altDrafts)) {
                  const activeDraft = altDrafts.find((d: any) => d.status === "drafting" || d.status === "paused");
                  if (activeDraft) {
                    drafts = altDrafts;
                    effectiveLeagueId = lg.league_id;
                    break;
                  }
                }
              } catch {}
            }
          }
        } catch (e) {
          console.error("[DraftCommand] Error resolving league chain:", e);
        }
      }

      if (drafts.length === 0) {
        return res.json({
          status: "none",
          board: { picks: [], teamOrder: [], totalRounds: 0, totalTeams: 0, currentPick: 0 },
          assistant: { myPicks: [], rosterNeeds: {}, recommendations: [], myDraftSlot: 0 },
        });
      }

      const draft = drafts.find((d: any) => d.status === "drafting") || drafts[0];
      const [picksRes2, rostersRes2, usersRes, tradedPicksRes2] = await Promise.all([
        fetch(`https://api.sleeper.app/v1/draft/${draft.draft_id}/picks`),
        fetch(`https://api.sleeper.app/v1/league/${effectiveLeagueId}/rosters`),
        fetch(`https://api.sleeper.app/v1/league/${effectiveLeagueId}/users`),
        fetch(`https://api.sleeper.app/v1/league/${effectiveLeagueId}/traded_picks`),
      ]);
      const picks = await picksRes2.json();
      const rosters = await rostersRes2.json();
      const leagueUsers = await usersRes.json();
      const tradedPicks = await tradedPicksRes2.json().catch(() => []);

      const userMap: Record<string, { name: string; avatar: string | null }> = {};
      (leagueUsers || []).forEach((u: any) => {
        userMap[u.user_id] = { name: u.display_name || u.username, avatar: u.avatar };
      });

      const rosterOwnerMap: Record<number, string> = {};
      const rosterMap: Record<number, any> = {};
      (rosters || []).forEach((r: any) => {
        if (r.owner_id) rosterOwnerMap[r.roster_id] = r.owner_id;
        rosterMap[r.roster_id] = r;
      });

      const totalTeams = draft.settings?.teams || rosters.length || 12;
      const totalRounds = draft.settings?.rounds || 4;
      const draftType = draft.type || "snake";
      const slotToRoster = draft.slot_to_roster_id || {};
      const draftOrder = draft.draft_order || {};
      const currentSeason = draft.season || new Date().getFullYear().toString();

      // Build rosterIdToSlot mapping - critical for grid placement
      // Priority: slot_to_roster_id > draft_order > derive from picks
      const rosterIdToSlot: Record<number, number> = {};
      if (Object.keys(slotToRoster).length > 0) {
        for (const [slot, rid] of Object.entries(slotToRoster)) {
          rosterIdToSlot[Number(rid)] = parseInt(slot);
        }
      } else if (Object.keys(draftOrder).length > 0) {
        for (const [userId, slot] of Object.entries(draftOrder)) {
          const roster = (rosters || []).find((r: any) => r.owner_id === userId);
          if (roster) {
            rosterIdToSlot[roster.roster_id] = Number(slot);
          }
        }
      } else {
        // Last resort: derive slot mapping from actual pick data (draft_slot field)
        for (const p of (picks || [])) {
          if (p.draft_slot && p.roster_id && !rosterIdToSlot[p.roster_id]) {
            rosterIdToSlot[p.roster_id] = p.draft_slot;
          }
        }
      }

      // Build team order - columns for the draft board
      const teamOrder: Array<{ slot: number; name: string; avatar: string | null; rosterId: number }> = [];
      if (Object.keys(slotToRoster).length > 0) {
        for (let slot = 1; slot <= totalTeams; slot++) {
          const rosterId = slotToRoster[slot] || slot;
          const ownerId = rosterOwnerMap[rosterId];
          const owner = ownerId ? userMap[ownerId] : null;
          teamOrder.push({
            slot,
            rosterId: typeof rosterId === "number" ? rosterId : parseInt(rosterId),
            name: owner?.name || `Team ${slot}`,
            avatar: owner?.avatar ? `https://sleepercdn.com/avatars/thumbs/${owner.avatar}` : null,
          });
        }
      } else if (Object.keys(draftOrder).length > 0) {
        // Build from draft_order (user_id → slot)
        const slotToUserId: Record<number, string> = {};
        for (const [userId, slot] of Object.entries(draftOrder)) {
          slotToUserId[Number(slot)] = userId;
        }
        for (let slot = 1; slot <= totalTeams; slot++) {
          const userId = slotToUserId[slot];
          const owner = userId ? userMap[userId] : null;
          const roster = (rosters || []).find((r: any) => r.owner_id === userId);
          teamOrder.push({
            slot,
            rosterId: roster?.roster_id || slot,
            name: owner?.name || `Team ${slot}`,
            avatar: owner?.avatar ? `https://sleepercdn.com/avatars/thumbs/${owner.avatar}` : null,
          });
        }
      } else {
        // Derive from picks or fall back to roster order
        const slotToRosterId: Record<number, number> = {};
        for (const [rid, slot] of Object.entries(rosterIdToSlot)) {
          slotToRosterId[slot] = Number(rid);
        }
        for (let slot = 1; slot <= totalTeams; slot++) {
          const rosterId = slotToRosterId[slot] || slot;
          const ownerId = rosterOwnerMap[rosterId];
          const owner = ownerId ? userMap[ownerId] : null;
          teamOrder.push({
            slot,
            rosterId: typeof rosterId === "number" ? rosterId : Number(rosterId),
            name: owner?.name || `Team ${slot}`,
            avatar: owner?.avatar ? `https://sleepercdn.com/avatars/thumbs/${owner.avatar}` : null,
          });
        }
      }

      // Format picks for the board
      // Use draft_slot from Sleeper (the column position) directly - this is the most reliable source
      // pick_no from Sleeper is the OVERALL pick number (1-50 for 5x10), NOT within-round
      const formattedPicks = (picks || []).map((p: any) => {
        const owner = userMap[p.picked_by] || { name: "Unknown", avatar: null };
        const draftSlot = p.draft_slot || rosterIdToSlot[p.roster_id] || ((p.pick_no - 1) % totalTeams) + 1;
        return {
          round: p.round,
          pick: draftSlot,
          draftSlot,
          playerId: p.player_id,
          playerName: `${p.metadata?.first_name || ""} ${p.metadata?.last_name || ""}`.trim(),
          position: p.metadata?.position || "?",
          teamName: owner.name,
          teamAvatar: owner.avatar ? `https://sleepercdn.com/avatars/thumbs/${owner.avatar}` : null,
          pickedBy: p.picked_by,
        };
      });

      const currentPick = formattedPicks.length + 1;
      const rawStatus = draft.status;
      const status = rawStatus === "complete" ? "complete" : (rawStatus === "drafting" || (formattedPicks.length > 0 && rawStatus !== "pre_draft") ? "in_progress" : "pre_draft");

      // === ASSISTANT SECTION ===
      const myRoster = rosters.find((r: any) => r.owner_id === sleeperUserId);
      const myRosterId = myRoster?.roster_id;
      const myDraftSlot = draftOrder[sleeperUserId || ""] || (myRosterId ? rosterIdToSlot[myRosterId] : undefined) || 0;

      // Pick ownership: keyed by "round-slot", value is owning roster_id (number)
      const pickOwnership: Record<string, number> = {};
      for (let round = 1; round <= totalRounds; round++) {
        for (let slot = 1; slot <= totalTeams; slot++) {
          const teamEntry = teamOrder.find(t => t.slot === slot);
          const rosterId = teamEntry?.rosterId || slot;
          pickOwnership[`${round}-${slot}`] = typeof rosterId === "number" ? rosterId : parseInt(String(rosterId));
        }
      }
      // Override ownership with traded picks from Sleeper API
      // tp.roster_id = original owner's roster_id (determines column)
      // tp.owner_id = current owner's roster_id
      if (Array.isArray(tradedPicks)) {
        for (const tp of tradedPicks) {
          if (String(tp.season) === String(currentSeason) && tp.round <= totalRounds) {
            const origRosterId = Number(tp.roster_id);
            const newOwnerId = Number(tp.owner_id);
            const origSlot = rosterIdToSlot[origRosterId];
            if (origSlot && origRosterId !== newOwnerId) {
              pickOwnership[`${tp.round}-${origSlot}`] = newOwnerId;
            }
          }
        }
      }

      // Find MY picks (including traded ones), filtering out already-made picks
      const myRosterIdNum = Number(myRosterId);
      // Track which round-slot combinations already have a pick made
      const alreadyPickedSlots = new Set(formattedPicks.map((p: any) => `${p.round}-${p.draftSlot}`));
      const myPicks: Array<{ round: number; pick: number; overall: number; slot: number }> = [];
      for (let round = 1; round <= totalRounds; round++) {
        for (let slot = 1; slot <= totalTeams; slot++) {
          const currentOwner = pickOwnership[`${round}-${slot}`];
          if (currentOwner === myRosterIdNum) {
            const overall = (round - 1) * totalTeams + slot;
            if (!alreadyPickedSlots.has(`${round}-${slot}`)) {
              myPicks.push({ round, pick: slot, overall, slot });
            }
          }
        }
      }
      myPicks.sort((a, b) => a.overall - b.overall);

      // Count my drafted players by position (from this draft's picks)
      const myDraftedInThisDraft = formattedPicks.filter((p: any) => p.pickedBy === sleeperUserId);
      const existingRoster = myRoster?.players || [];
      const posCount: Record<string, number> = {};

      const [allPlayers, seasonStats] = await Promise.all([
        sleeperApi.getAllPlayers(),
        sleeperApi.getSeasonStats("2025", "regular").catch(() => ({})),
      ]);
      for (const pid of existingRoster) {
        const player = allPlayers?.[pid];
        if (player) {
          const pos = player.position || "?";
          posCount[pos] = (posCount[pos] || 0) + 1;
        }
      }
      myDraftedInThisDraft.forEach((p: any) => {
        const pos = p.position || "?";
        posCount[pos] = (posCount[pos] || 0) + 1;
      });

      // Roster needs based on league roster positions
      const leagueData = await sleeperApi.getLeague(effectiveLeagueId);
      const rosterPositions = leagueData?.roster_positions || [];
      const posSlots: Record<string, number> = {};
      for (const pos of rosterPositions) {
        if (pos !== "BN" && pos !== "FLEX" && pos !== "SUPER_FLEX" && pos !== "IDP_FLEX") {
          posSlots[pos] = (posSlots[pos] || 0) + 1;
        }
      }
      const idealCounts: Record<string, number> = {
        QB: Math.max(posSlots["QB"] || 1, 2),
        RB: Math.max(posSlots["RB"] || 2, 4),
        WR: Math.max(posSlots["WR"] || 2, 4),
        TE: Math.max(posSlots["TE"] || 1, 2),
      };
      const rosterNeeds: Record<string, string> = {};
      Object.entries(idealCounts).forEach(([pos, ideal]) => {
        const have = posCount[pos] || 0;
        const need = ideal - have;
        if (need >= 3) rosterNeeds[pos] = "Critical";
        else if (need >= 2) rosterNeeds[pos] = "High";
        else if (need >= 1) rosterNeeds[pos] = "Moderate";
        else rosterNeeds[pos] = "Low";
      });

      // Determine draft type
      const draftPlayerType = draft.settings?.player_type;
      const draftYear = parseInt(currentSeason) || new Date().getFullYear();
      const autoDetectedPool = draftPlayerType === 1 || (draft.settings?.rounds && draft.settings.rounds <= 5)
        ? "rookies" : "all";

      // Allow manual override via query parameter: "all" | "veterans" | "rookies"
      const playerPoolOverride = (req.query.playerPool as string) || "";
      const playerPool = ["all", "veterans", "rookies"].includes(playerPoolOverride)
        ? playerPoolOverride
        : autoDetectedPool;
      const isRookieDraft = playerPool === "rookies";

      // Build set of already-drafted player IDs (Sleeper numeric IDs)
      const pickedPlayerIds = new Set(formattedPicks.map((p: any) => p.playerId));
      const pickedNames = new Set(formattedPicks.map((p: any) => p.playerName?.toLowerCase().trim().replace(/[^a-z]/g, "") || ""));

      const { getDraft2026Players } = await import('./draft-2026-data');
      const draftBoardPlayers = getDraft2026Players();
      const NAME_SUFFIXES_DRAFT = /\s+(jr\.?|sr\.?|ii|iii|iv|v|2nd|3rd)$/i;
      const normalizeName = (name: string) => {
        return name?.toLowerCase().trim()
          .replace(NAME_SUFFIXES_DRAFT, "")
          .replace(/[^a-z]/g, "") || "";
      };

      // Build available player pool based on playerPool setting
      let availablePlayers: Array<{
        id: string;
        name: string;
        position: string;
        value: number;
        college: string;
        tier: number;
        searchRank: number;
        nflTeam?: string;
      }> = [];

      const draftBoardByName = new Map<string, any>();
      draftBoardPlayers.forEach((p: any) => {
        draftBoardByName.set(normalizeName(p.name), p);
      });
      const devyPlayers = ktcValues.getDevyPlayers();
      const devyByName = new Map<string, any>();
      devyPlayers.forEach((p: any) => {
        devyByName.set(normalizeName(p.name), p);
      });

      // Build rookie pool (years_exp === 0)
      const buildRookiePool = () => {
        const sleeperRookies: any[] = [];
        Object.entries(allPlayers).forEach(([pid, p]: [string, any]) => {
          if (!p || pickedPlayerIds.has(pid)) return;
          if (p.years_exp !== 0) return;
          const pos = p.position;
          if (!pos || ["DEF", "K"].includes(pos)) return;
          if (p.status === "Inactive" && !p.team) return;
          sleeperRookies.push({ pid, ...p });
        });

        return sleeperRookies.map((p) => {
          const normalName = normalizeName(p.full_name || "");
          const boardPlayer = draftBoardByName.get(normalName);
          const devyPlayer = devyByName.get(normalName);
          const value = devyPlayer?.value || (boardPlayer ? Math.max(1000 - (boardPlayer.rank - 1) * 15, 100) : 0);
          const tier = devyPlayer?.tier || (boardPlayer?.rank ? Math.ceil(boardPlayer.rank / 20) : 8);
          return {
            id: p.pid,
            name: p.full_name || `${p.first_name} ${p.last_name}`,
            position: p.position,
            value,
            college: boardPlayer?.college || devyPlayer?.college || p.college || "",
            tier,
            searchRank: p.search_rank || 9999,
            nflTeam: p.team || undefined,
          };
        })
        .filter(p => p.value > 0 || p.searchRank < 500);
      };

      // Build veteran pool (years_exp > 0, established NFL players)
      // RELEVANCE GATING: Filter → Qualify → Score → Tier → Strategy → Recommend
      const buildVeteranPool = () => {
        const AGE_CEILING: Record<string, number> = { QB: 38, RB: 29, WR: 31, TE: 32, K: 40, DEF: 99, LB: 32, DL: 32, CB: 32, S: 32, SAF: 32, EDGE: 32 };
        const DYNASTY_VALUE_FLOOR = 1500;
        const stats = seasonStats || {};

        const veterans: any[] = [];
        Object.entries(allPlayers).forEach(([pid, p]: [string, any]) => {
          if (!p || pickedPlayerIds.has(pid)) return;
          if (p.years_exp === 0 || p.years_exp === undefined) return;
          const pos = p.position;
          if (!pos || !["QB", "RB", "WR", "TE", "K", "DEF", "LB", "DL", "CB", "S", "SAF", "EDGE"].includes(pos)) return;

          const age = p.age || 99;
          const ageCeiling = AGE_CEILING[pos] || 32;
          if (age > ageCeiling) return;

          if (p.status === "Inactive" && !p.team) return;

          const isFreeAgent = !p.team || p.team === "" || p.team === "FA";
          const searchRank = p.search_rank || 9999;

          if (isFreeAgent && searchRank > 500) return;
          if (!isFreeAgent && searchRank > 2000) return;

          const playerStats = stats[pid];
          const gp = playerStats?.gp || playerStats?.gms_active || 0;
          const pts = playerStats?.pts_ppr || playerStats?.pts_half_ppr || 0;
          const ppg = gp > 0 ? pts / gp : 0;
          const depthChart = p.depth_chart_order || 99;
          const yearsExp = p.years_exp || 0;

          if (yearsExp >= 2 && gp === 0 && depthChart > 2) return;
          if (yearsExp >= 2 && ppg < 3.0 && depthChart > 2 && searchRank > 200) return;
          if (isFreeAgent && gp < 5) return;

          veterans.push({ pid, ...p, _gp: gp, _pts: pts, _ppg: ppg });
        });

        return veterans.map((p) => {
          let value = ktcValues.getPlayerValue(p.pid, p.position, p.age || 25, p.years_exp || 1, p.search_rank, !!p.team);
          const searchRk = p.search_rank || 9999;
          const depthOrd = p.depth_chart_order || 99;
          const playerPpg = p._ppg || 0;
          const playerGp = p._gp || 0;

          if (playerGp === 0 || playerPpg < 2.0) {
            value = Math.round(value * 0.3);
          } else if (playerPpg < 5.0 && depthOrd > 2) {
            value = Math.round(value * 0.5);
          } else if (playerPpg < 8.0 && depthOrd > 1) {
            value = Math.round(value * 0.7);
          }

          const posCeiling: Record<string, number> = { QB: 9500, RB: 8500, WR: 9000, TE: 7500, K: 800, DEF: 800 };
          const ceil = posCeiling[p.position] || 3000;
          const pct = ceil > 0 ? value / ceil : 0;
          const tier = pct >= 0.85 ? 1 : pct >= 0.65 ? 2 : pct >= 0.4 ? 3 : pct >= 0.18 ? 4 : pct >= 0.06 ? 5 : 6;
          return {
            id: p.pid,
            name: p.full_name || `${p.first_name} ${p.last_name}`,
            position: p.position,
            value,
            college: p.college || "",
            tier,
            searchRank: searchRk,
            nflTeam: p.team || undefined,
          };
        })
        .filter(p => p.value >= DYNASTY_VALUE_FLOOR);
      };

      if (playerPool === "rookies") {
        availablePlayers = buildRookiePool();
      } else if (playerPool === "veterans") {
        availablePlayers = buildVeteranPool();
      } else {
        // "all" — combine both pools
        availablePlayers = [...buildVeteranPool(), ...buildRookiePool()];
      }

      availablePlayers.sort((a, b) => (b.value || 0) - (a.value || 0));

      const IDP_POSITIONS = new Set(["LB", "DL", "CB", "S", "SAF", "EDGE", "ILB", "OLB", "DE", "DT", "NT", "DB", "FS", "SS", "MLB", "DEF"]);
      const userSettings = await storage.getLeagueSettings(userId, leagueId);
      const idpEnabled = userSettings?.idpEnabled !== false;
      if (!idpEnabled) {
        availablePlayers = availablePlayers.filter(p => !IDP_POSITIONS.has(p.position));
      }

      // === DYNASTY-AWARE STRATEGIC SUGGESTION ENGINE v2 ===

      // --- 1. DYNASTY WINDOW CLASSIFIER ---
      const myRosterPlayers: Array<{ name: string; pos: string; age: number; value: number }> = [];
      for (const pid of existingRoster) {
        const player = allPlayers?.[pid];
        if (player) {
          const pv = ktcValues.getPlayerValue(pid, player.position || "?", player.age || 25, player.years_exp || 1, player.search_rank, !!player.team);
          myRosterPlayers.push({
            name: player.full_name || "",
            pos: player.position || "?",
            age: player.age || 25,
            value: pv,
          });
        }
      }

      const avgAge = myRosterPlayers.length > 0
        ? myRosterPlayers.reduce((s, p) => s + p.age, 0) / myRosterPlayers.length
        : 25;
      const ageWeightedValue = myRosterPlayers.length > 0
        ? myRosterPlayers.reduce((s, p) => s + p.value * (1 - Math.max(0, p.age - 26) * 0.03), 0) / Math.max(myRosterPlayers.length, 1)
        : 0;

      type DynastyWindow = "win_now" | "balanced" | "productive_struggle" | "rebuild";
      let dynastyWindow: DynastyWindow;
      if (avgAge >= 28 && ageWeightedValue < 3000) dynastyWindow = "rebuild";
      else if (avgAge >= 27) dynastyWindow = "productive_struggle";
      else if (avgAge <= 25.5 && ageWeightedValue > 4000) dynastyWindow = "win_now";
      else dynastyWindow = "balanced";

      const WINDOW_LABELS: Record<DynastyWindow, string> = {
        win_now: "Win Now", balanced: "Balanced", productive_struggle: "Productive Struggle", rebuild: "Rebuild",
      };

      // --- 2. POSITIONAL DEPTH + AGE CURVE ANALYSIS ---
      const starterThreshold: Record<string, number> = { QB: 2, RB: 4, WR: 4, TE: 2 };
      const posDepth: Record<string, { count: number; need: string; gapSize: number; avgAge: number; agingCliff: boolean }> = {};
      const posAges: Record<string, number[]> = {};
      myRosterPlayers.forEach(p => {
        if (!posAges[p.pos]) posAges[p.pos] = [];
        posAges[p.pos].push(p.age);
      });

      Object.entries(rosterNeeds).forEach(([pos, need]) => {
        const have = posCount[pos] || 0;
        const ideal = starterThreshold[pos] || 2;
        const ages = posAges[pos] || [];
        const posAvgAge = ages.length > 0 ? ages.reduce((a, b) => a + b, 0) / ages.length : 25;
        const ageCutoff = pos === "RB" ? 27 : pos === "QB" ? 32 : 29;
        const agingCliff = ages.filter(a => a >= ageCutoff).length >= Math.ceil(ages.length * 0.5);
        posDepth[pos] = { count: have, need, gapSize: Math.max(0, ideal - have), avgAge: posAvgAge, agingCliff };
      });

      // --- 3. POSITIONAL SATURATION PENALTY ---
      const saturationPenalty = (pos: string, count: number): number => {
        const thresholds: Record<string, number[]> = {
          QB: [2, 3], RB: [5, 7], WR: [5, 7], TE: [2, 3],
        };
        const [soft, hard] = thresholds[pos] || [3, 5];
        if (count >= hard) return 0.45;
        if (count >= soft) return 0.25;
        return 0;
      };

      // --- 4. TIER GROUPING + DROPOFF DETECTION ---
      const tierLabel = (t: number): string => {
        if (t <= 1) return "Elite";
        if (t <= 2) return "Premium";
        if (t <= 3) return "Solid";
        if (t <= 4) return "Upside";
        if (t <= 5) return "Depth";
        return "Flier";
      };

      const tierGroups: Record<string, typeof availablePlayers> = {};
      availablePlayers.forEach(p => {
        const tl = tierLabel(p.tier);
        if (!tierGroups[tl]) tierGroups[tl] = [];
        tierGroups[tl].push(p);
      });

      const isLastInTier = (player: typeof availablePlayers[0]): boolean => {
        const tl = tierLabel(player.tier);
        const group = tierGroups[tl] || [];
        const samePosTier = group.filter(p => p.position === player.position);
        return samePosTier.length <= 1;
      };

      const tierDropoffScore = (player: typeof availablePlayers[0]): number => {
        if (!isLastInTier(player)) return 0;
        const tl = tierLabel(player.tier);
        const nextTierPlayers = availablePlayers.filter(
          p => p.position === player.position && p.tier > player.tier
        );
        if (nextTierPlayers.length === 0) return 0.3;
        const valueDrop = player.value - (nextTierPlayers[0]?.value || 0);
        const dropPct = player.value > 0 ? valueDrop / player.value : 0;
        return dropPct > 0.3 ? 1.0 : dropPct > 0.15 ? 0.6 : 0.2;
      };

      // --- 5. LEAGUE DRAFT FLOW DETECTION ---
      const recentPicks = formattedPicks.slice(-12);
      const recentPosCounts: Record<string, number> = {};
      recentPicks.forEach(p => {
        recentPosCounts[p.position] = (recentPosCounts[p.position] || 0) + 1;
      });

      const posRunDetection = (pos: string): number => {
        const runCount = recentPosCounts[pos] || 0;
        if (runCount >= 5) return 0.8;
        if (runCount >= 4) return 0.5;
        if (runCount >= 3) return 0.2;
        return 0;
      };

      // --- 6. POSITIONAL SCARCITY CALCULATOR ---
      const posScarcity = (pos: string): number => {
        const available = availablePlayers.filter(p => p.position === pos);
        const topAvailable = available.filter(p => p.tier <= 3).length;
        if (topAvailable === 0) return 1.0;
        if (topAvailable <= 2) return 0.8;
        if (topAvailable <= 5) return 0.5;
        if (topAvailable <= 10) return 0.2;
        return 0;
      };

      // --- 7. DYNASTY WINDOW FIT SCORE ---
      const dynastyFitScore = (player: typeof availablePlayers[0]): number => {
        const playerAge = (() => {
          const sp = allPlayers?.[player.id];
          return sp?.age || (player.college ? 21 : 25);
        })();

        if (dynastyWindow === "win_now") {
          if (playerAge >= 26 && playerAge <= 30 && player.tier <= 3) return 0.9;
          if (playerAge >= 24) return 0.5;
          if (playerAge <= 22) return 0.2;
          return 0.4;
        }
        if (dynastyWindow === "rebuild") {
          if (playerAge <= 23) return 1.0;
          if (playerAge <= 25) return 0.7;
          if (playerAge >= 28) return 0.1;
          return 0.4;
        }
        if (dynastyWindow === "productive_struggle") {
          if (playerAge <= 24) return 0.8;
          if (playerAge <= 26) return 0.6;
          return 0.3;
        }
        return 0.5;
      };

      // --- 8. ROSTER NEED WEIGHT ---
      const rosterNeedWeight = (pos: string): number => {
        const depth = posDepth[pos];
        if (!depth) return 0.3;
        const needMultiplier = depth.need === "Critical" ? 1.0 : depth.need === "High" ? 0.7 : depth.need === "Moderate" ? 0.4 : 0.1;
        const agingBonus = depth.agingCliff ? 0.2 : 0;
        return Math.min(1.0, needMultiplier + agingBonus);
      };

      // --- 9. DRAFT CAPITAL VALUE (round-based) ---
      const currentRound = Math.ceil(currentPick / totalTeams) || 1;
      const draftCapitalValue = (round: number): number => {
        if (round <= 2) return 1.0;
        if (round <= 4) return 0.8;
        if (round <= 8) return 0.5;
        if (round <= 12) return 0.3;
        return 0.15;
      };
      const currentDraftCapital = draftCapitalValue(currentRound);

      // --- 10. COMPOSITE DRAFT SCORE ---
      const WEIGHTS = {
        baseValue: 0.35,
        rosterNeed: 0.20,
        scarcity: 0.15,
        dynastyFit: 0.10,
        draftCapital: 0.10,
        tierDropoff: 0.05,
        runDetection: 0.05,
      };

      const maxValue = availablePlayers.length > 0 ? availablePlayers[0].value : 1;

      const scoredPlayers = availablePlayers.map(player => {
        const baseNorm = maxValue > 0 ? player.value / maxValue : 0;
        const needW = rosterNeedWeight(player.position);
        const scarcityW = posScarcity(player.position);
        const dynastyW = dynastyFitScore(player);
        const capitalW = currentDraftCapital;
        const dropoffW = tierDropoffScore(player);
        const runW = posRunDetection(player.position);

        const satPenalty = saturationPenalty(player.position, posCount[player.position] || 0);

        const rawScore =
          (baseNorm * WEIGHTS.baseValue) +
          (needW * WEIGHTS.rosterNeed) +
          (scarcityW * WEIGHTS.scarcity) +
          (dynastyW * WEIGHTS.dynastyFit) +
          (capitalW * WEIGHTS.draftCapital) +
          (dropoffW * WEIGHTS.tierDropoff) +
          (runW * WEIGHTS.runDetection);

        const finalScore = rawScore * (1 - satPenalty);

        return { ...player, compositeScore: finalScore, baseNorm, needW, scarcityW, dynastyW, dropoffW, runW, satPenalty };
      });

      scoredPlayers.sort((a, b) => b.compositeScore - a.compositeScore);

      // --- 11. CONTEXTUAL BADGE ASSIGNMENT ---
      type ContextualBadge = "Win Now Anchor" | "Rebuild Cornerstone" | "Scarcity Play" | "Tier Break Risk" | "Value vs ADP" | "Depth Stabilizer" | "High Variance Bet";

      const assignBadge = (p: typeof scoredPlayers[0]): ContextualBadge => {
        if (p.dropoffW >= 0.6) return "Tier Break Risk";
        if (p.scarcityW >= 0.7 && p.needW >= 0.5) return "Scarcity Play";
        if (dynastyWindow === "win_now" && p.dynastyW >= 0.8) return "Win Now Anchor";
        if (dynastyWindow === "rebuild" && p.dynastyW >= 0.8) return "Rebuild Cornerstone";
        if (p.baseNorm >= 0.7 && p.needW <= 0.2) return "Value vs ADP";
        if (p.needW >= 0.6 && p.baseNorm < 0.4) return "Depth Stabilizer";
        if (p.tier >= 4 && p.baseNorm >= 0.3) return "High Variance Bet";
        if (dynastyWindow === "win_now") return "Win Now Anchor";
        if (dynastyWindow === "rebuild") return "Rebuild Cornerstone";
        return "Value vs ADP";
      };

      const BADGE_COLORS: Record<ContextualBadge, string> = {
        "Win Now Anchor": "amber",
        "Rebuild Cornerstone": "emerald",
        "Scarcity Play": "red",
        "Tier Break Risk": "red",
        "Value vs ADP": "blue",
        "Depth Stabilizer": "emerald",
        "High Variance Bet": "violet",
      };

      // --- 12. PICK EXPLANATION ENGINE ---
      const buildExplanation = (p: typeof scoredPlayers[0], rank: number) => {
        const badge = assignBadge(p);
        const depth = posDepth[p.position];
        const playerAge = allPlayers?.[p.id]?.age || (p.college ? 21 : 25);

        let strategicReason = "";
        if (badge === "Scarcity Play") {
          strategicReason = `Only ${availablePlayers.filter(x => x.position === p.position && x.tier <= 3).length} quality ${p.position}s remain in this draft pool`;
        } else if (badge === "Tier Break Risk") {
          strategicReason = `Last ${tierLabel(p.tier)}-tier ${p.position} available — significant drop after this pick`;
        } else if (badge === "Win Now Anchor") {
          strategicReason = `Peak-age producer who accelerates your contention window`;
        } else if (badge === "Rebuild Cornerstone") {
          strategicReason = `Young asset (${playerAge}) with long-term dynasty upside for your rebuild`;
        } else if (badge === "Value vs ADP") {
          strategicReason = `Ranked significantly higher than current draft position — falling value`;
        } else if (badge === "Depth Stabilizer") {
          strategicReason = `Fills a positional gap — you have ${depth?.count || 0} ${p.position}s rostered`;
        } else {
          strategicReason = `High-ceiling prospect with breakout potential`;
        }

        let rosterImpact = "";
        if (depth) {
          if (depth.need === "Critical") rosterImpact = `Fills critical ${p.position} hole (${depth.count} rostered, need ${starterThreshold[p.position] || 2})`;
          else if (depth.need === "High") rosterImpact = `Addresses high ${p.position} need (${depth.count}/${starterThreshold[p.position] || 2})`;
          else if (depth.need === "Moderate") rosterImpact = `Adds depth at ${p.position} (${depth.count} rostered)`;
          else rosterImpact = `Luxury add at ${p.position} — ${depth.count} already rostered`;
        }

        const dynastyFit = `${WINDOW_LABELS[dynastyWindow]} build | Player age: ${playerAge} | ${
          dynastyWindow === "rebuild" && playerAge <= 23 ? "Core dynasty asset" :
          dynastyWindow === "win_now" && playerAge >= 26 ? "Immediate impact" :
          "Versatile timeline fit"
        }`;

        let riskProfile: "Low" | "Medium" | "High" = "Medium";
        if (p.tier <= 1 && p.needW >= 0.5) riskProfile = "Low";
        else if (p.tier >= 4 || p.satPenalty > 0.2) riskProfile = "High";

        const alternativePath = (() => {
          if (p.needW <= 0.2 && depth) {
            const betterNeedPos = Object.entries(posDepth)
              .filter(([pos, d]) => pos !== p.position && (d.need === "Critical" || d.need === "High"))
              .sort((a, b) => b[1].gapSize - a[1].gapSize)[0];
            if (betterNeedPos) {
              return `Consider ${betterNeedPos[0]} instead — ${betterNeedPos[1].need.toLowerCase()} need with ${betterNeedPos[1].count} rostered`;
            }
          }
          if (p.satPenalty > 0) {
            return `You have ${posCount[p.position] || 0} ${p.position}s — diversify to strengthen other positions`;
          }
          return null;
        })();

        return { badge, badgeColor: BADGE_COLORS[badge], strategicReason, rosterImpact, dynastyFit, riskProfile, alternativePath };
      };

      // --- 13. DIVERSIFIED OUTPUT (max 2/position, min 3 positions, 1 contrarian) ---
      const picksLeft = myPicks.length;
      const nextPick = myPicks[0];
      const picksBetweenMyNext = nextPick ? nextPick.overall - currentPick : 0;

      const recommendations: Array<{
        playerId: string;
        name: string;
        position: string;
        value: number;
        compositeScore: number;
        reason: string;
        college?: string;
        nflTeam?: string;
        tier?: string;
        badge?: string;
        badgeColor?: string;
        strategicReason?: string;
        rosterImpact?: string;
        dynastyFit?: string;
        riskProfile?: string;
        alternativePath?: string | null;
      }> = [];
      const addedIds = new Set<string>();
      const posInRecs: Record<string, number> = {};

      if (scoredPlayers.length > 0) {
        for (const player of scoredPlayers) {
          if (recommendations.length >= 7) break;
          if (addedIds.has(player.id)) continue;

          const posUsed = posInRecs[player.position] || 0;
          if (posUsed >= 2) continue;

          addedIds.add(player.id);
          posInRecs[player.position] = posUsed + 1;

          const explanation = buildExplanation(player, recommendations.length + 1);

          let reason = explanation.strategicReason;
          if (player.nflTeam) reason += ` | ${player.nflTeam}`;

          recommendations.push({
            playerId: player.id,
            name: player.name,
            position: player.position,
            value: player.value,
            compositeScore: Math.round(player.compositeScore * 1000),
            reason,
            college: player.college,
            nflTeam: player.nflTeam,
            tier: tierLabel(player.tier),
            badge: explanation.badge,
            badgeColor: explanation.badgeColor,
            strategicReason: explanation.strategicReason,
            rosterImpact: explanation.rosterImpact,
            dynastyFit: explanation.dynastyFit,
            riskProfile: explanation.riskProfile,
            alternativePath: explanation.alternativePath,
          });
        }

        const positionsUsed = new Set(recommendations.map(r => r.position));
        if (positionsUsed.size < 3 && recommendations.length < 7) {
          const missingPositions = ["QB", "RB", "WR", "TE"].filter(p => !positionsUsed.has(p));
          for (const pos of missingPositions) {
            if (recommendations.length >= 7) break;
            const candidate = scoredPlayers.find(p => p.position === pos && !addedIds.has(p.id));
            if (candidate) {
              addedIds.add(candidate.id);
              posInRecs[pos] = (posInRecs[pos] || 0) + 1;
              const explanation = buildExplanation(candidate, recommendations.length + 1);
              let reason = explanation.strategicReason;
              if (candidate.nflTeam) reason += ` | ${candidate.nflTeam}`;
              recommendations.push({
                playerId: candidate.id,
                name: candidate.name,
                position: candidate.position,
                value: candidate.value,
                compositeScore: Math.round(candidate.compositeScore * 1000),
                reason,
                college: candidate.college,
                nflTeam: candidate.nflTeam,
                tier: tierLabel(candidate.tier),
                badge: explanation.badge,
                badgeColor: explanation.badgeColor,
                strategicReason: explanation.strategicReason,
                rosterImpact: explanation.rosterImpact,
                dynastyFit: explanation.dynastyFit,
                riskProfile: explanation.riskProfile,
                alternativePath: explanation.alternativePath,
              });
            }
          }
        }

        if (recommendations.length < 7) {
          const contrarian = scoredPlayers.find(p =>
            !addedIds.has(p.id) &&
            (p.tier >= 3 && p.baseNorm >= 0.2) &&
            (posInRecs[p.position] || 0) < 2
          );
          if (contrarian) {
            addedIds.add(contrarian.id);
            const explanation = buildExplanation(contrarian, recommendations.length + 1);
            explanation.badge = "High Variance Bet" as any;
            explanation.badgeColor = BADGE_COLORS["High Variance Bet"];
            recommendations.push({
              playerId: contrarian.id,
              name: contrarian.name,
              position: contrarian.position,
              value: contrarian.value,
              compositeScore: Math.round(contrarian.compositeScore * 1000),
              reason: `Contrarian upside — ${explanation.strategicReason}`,
              college: contrarian.college,
              nflTeam: contrarian.nflTeam,
              tier: tierLabel(contrarian.tier),
              badge: "High Variance Bet",
              badgeColor: "violet",
              strategicReason: explanation.strategicReason,
              rosterImpact: explanation.rosterImpact,
              dynastyFit: explanation.dynastyFit,
              riskProfile: "High",
              alternativePath: explanation.alternativePath,
            });
          }
        }

        recommendations.sort((a, b) => (b.compositeScore || 0) - (a.compositeScore || 0));
        if (recommendations.length > 5) recommendations.length = 5;

        const hasQualityPicks = recommendations.some(r => {
          const tl = r.tier || "Flier";
          return tl === "Elite" || tl === "Premium" || tl === "Solid";
        });

        if (!hasQualityPicks && recommendations.length > 0) {
          const tradeStrategies = [
            "Trade Down — move back and accumulate picks",
            "Trade Future Pick — flip this pick for 2026 2nds",
            "Package for Contender Asset — bundle picks to acquire a proven player",
            "Accumulate 2026 2nds — stockpile future draft capital",
          ];
          const strategyAdvice = tradeStrategies[Math.floor(currentRound / 5) % tradeStrategies.length];

          recommendations.unshift({
            playerId: "trade-recommendation",
            name: "No Impact Player Available",
            position: "TRADE",
            value: 0,
            compositeScore: 9999,
            reason: `Meaningful talent tier has ended. ${strategyAdvice}`,
            tier: "Strategy",
            badge: "Trade Capital" as any,
            badgeColor: "amber",
            strategicReason: `Remaining pool is replacement-level. ${strategyAdvice}`,
            rosterImpact: "No dynasty-relevant player available at this pick",
            dynastyFit: `Consider trading this pick rather than adding a depth piece with no upside`,
            riskProfile: "Low",
            alternativePath: strategyAdvice,
          });

          if (recommendations.length > 5) recommendations.length = 5;
        }
      }

      // Predictions: for each remaining pick, show likely available players
      const predictions = myPicks.map(pick => {
        const picksBefore = pick.overall - currentPick;
        const startIdx = Math.max(0, picksBefore - 2);
        const endIdx = Math.min(availablePlayers.length, picksBefore + 5);
        const likelyAvailable = availablePlayers.slice(startIdx, endIdx).map((p, idx) => ({
          id: p.id,
          name: p.name,
          position: p.position,
          college: p.college || "",
          nflTeam: p.nflTeam || undefined,
          value: p.value || 0,
          tier: tierLabel(p.tier),
          rank: startIdx + idx + 1,
        }));

        return {
          round: pick.round,
          pick: pick.pick,
          overall: pick.overall,
          likelyAvailable,
        };
      });

      // My already-drafted players in this draft
      // Use draftSlot for the within-round pick display (e.g., R1.5 means round 1, slot 5)
      const mySelections = myDraftedInThisDraft.map((p: any) => ({
        round: p.round,
        pick: p.draftSlot,
        playerName: p.playerName,
        position: p.position,
        playerId: p.playerId,
      }));

      // Build traded picks map: key = "round-slot", value = { originalOwner, newOwner }
      const tradedPicksMap: Record<string, { originalOwnerName: string; newOwnerName: string; newOwnerAvatar: string | null }> = {};
      if (Array.isArray(tradedPicks)) {
        for (const tp of tradedPicks) {
          if (String(tp.season) === String(currentSeason) && tp.round <= totalRounds) {
            const origRosterId = Number(tp.roster_id);
            const newOwnerId = Number(tp.owner_id);
            const origSlot = rosterIdToSlot[origRosterId];
            if (origSlot && origRosterId !== newOwnerId) {
              const newOwnerUserId = rosterOwnerMap[newOwnerId];
              const origOwnerUserId = rosterOwnerMap[origRosterId];
              const newOwner = newOwnerUserId ? userMap[newOwnerUserId] : null;
              const origOwner = origOwnerUserId ? userMap[origOwnerUserId] : null;
              tradedPicksMap[`${tp.round}-${origSlot}`] = {
                originalOwnerName: origOwner?.name || `Team ${origSlot}`,
                newOwnerName: newOwner?.name || `Team ?`,
                newOwnerAvatar: newOwner?.avatar ? `https://sleepercdn.com/avatars/thumbs/${newOwner.avatar}` : null,
              };
            }
          }
        }
      }

      let activeDraftLeagueName: string | undefined;
      if (effectiveLeagueId !== leagueId) {
        try {
          const effLeagueRes = await sleeperApi.getLeague(effectiveLeagueId);
          activeDraftLeagueName = effLeagueRes?.name;
        } catch {}
      }

      res.json({
        status,
        draftType,
        isRookieDraft,
        playerPool,
        autoDetectedPool,
        effectiveLeagueId: effectiveLeagueId !== leagueId ? effectiveLeagueId : undefined,
        activeDraftLeagueName,
        board: {
          picks: formattedPicks,
          teamOrder,
          totalRounds,
          totalTeams,
          currentPick,
          tradedPicks: tradedPicksMap,
        },
        assistant: {
          myPicks,
          myDraftSlot,
          rosterNeeds,
          recommendations,
          predictions,
          mySelections,
          posCount,
          dynastyWindow,
          dynastyWindowLabel: WINDOW_LABELS[dynastyWindow],
          currentRound,
        },
      });
    } catch (error) {
      console.error("Error fetching draft command:", error);
      res.status(500).json({ message: "Failed to fetch draft data" });
    }
  });

  // ========================
  // NOTIFICATION PREFERENCES ENDPOINTS
  // ========================

  // ========================
  // DECISION ENGINE ENDPOINTS
  // ========================

  app.get("/api/engine/matchup-sim/:leagueId", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      const week = parseInt(req.query.week as string) || undefined;
      const userId = req.user?.claims?.sub;
      const profile = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).limit(1);
      const sleeperUserId = profile[0]?.sleeperUserId;
      if (!sleeperUserId) return res.status(400).json({ error: "Sleeper account not linked" });

      const leagueCtx = await getLeagueContext(leagueId);
      const targetWeek = week || leagueCtx.currentWeek;

      const analysis = await engineOptimizer.runMatchupAnalysis(leagueId, sleeperUserId, targetWeek);

      let explanation: string | undefined;
      try {
        explanation = await engineExplainer.explainMatchup(analysis);
      } catch (e) {}

      await db.insert(schema.simulationResults).values({
        userId,
        leagueId,
        simulationType: 'matchup',
        week: targetWeek,
        resultData: analysis as any,
        explanation,
      });

      res.json({ ...analysis, explanation });
    } catch (error: any) {
      console.error("Engine matchup sim error:", error);
      res.status(500).json({ error: error.message || "Matchup simulation failed" });
    }
  });

  app.get("/api/engine/lineup-optimize/:leagueId", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      const week = parseInt(req.query.week as string) || undefined;
      const userId = req.user?.claims?.sub;
      const profile = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).limit(1);
      const sleeperUserId = profile[0]?.sleeperUserId;
      if (!sleeperUserId) return res.status(400).json({ error: "Sleeper account not linked" });

      const leagueCtx = await getLeagueContext(leagueId);
      const targetWeek = week || leagueCtx.currentWeek;

      const result = await engineOptimizer.runLineupOptimization(leagueId, sleeperUserId, targetWeek);

      let explanation: string | undefined;
      try {
        explanation = await engineExplainer.explainLineupOptimization(result);
      } catch (e) {}

      res.json({ ...result, explanation });
    } catch (error: any) {
      console.error("Engine lineup optimize error:", error);
      res.status(500).json({ error: error.message || "Lineup optimization failed" });
    }
  });

  app.post("/api/engine/trade-eval/:leagueId", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      const { givePlayerIds, getPlayerIds } = req.body;
      if (!Array.isArray(givePlayerIds) || !Array.isArray(getPlayerIds)) {
        return res.status(400).json({ error: "givePlayerIds and getPlayerIds must be arrays" });
      }
      const userId = req.user?.claims?.sub;
      const profile = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).limit(1);
      const sleeperUserId = profile[0]?.sleeperUserId;
      if (!sleeperUserId) return res.status(400).json({ error: "Sleeper account not linked" });

      const analysis = await engineOptimizer.runTradeAnalysis(leagueId, sleeperUserId, givePlayerIds, getPlayerIds);

      let explanation: string | undefined;
      try {
        explanation = await engineExplainer.explainTrade(analysis);
      } catch (e) {}

      await db.insert(schema.simulationResults).values({
        userId,
        leagueId,
        simulationType: 'trade',
        resultData: analysis as any,
        explanation,
      });

      res.json({ ...analysis, explanation });
    } catch (error: any) {
      console.error("Engine trade eval error:", error);
      res.status(500).json({ error: error.message || "Trade evaluation failed" });
    }
  });

  app.get("/api/engine/faab-context/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      const userId = req.user?.claims?.sub;
      const profile = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).limit(1);
      const sleeperUserId = profile[0]?.sleeperUserId;
      if (!sleeperUserId) return res.status(400).json({ error: "Sleeper account not linked" });

      const [leagueCtx, allRosters, allPlayers, leagueUsers] = await Promise.all([
        getLeagueContext(leagueId),
        getAllRosterContexts(leagueId),
        sleeperApi.getAllPlayers(),
        sleeperApi.getLeagueUsers(leagueId),
      ]);

      const userRoster = allRosters.find(r => r.ownerId === sleeperUserId);
      if (!userRoster) return res.status(404).json({ error: "Roster not found" });

      const waiverBudget = leagueCtx.waiverBudget || 100;
      const userMap = new Map(leagueUsers.map((u: any) => [u.user_id, u]));

      const rosteredPlayerIds = new Set<string>();
      const rostersData = await sleeperApi.getLeagueRosters(leagueId);
      for (const r of rostersData) {
        for (const pid of (r.players || [])) rosteredPlayerIds.add(pid);
        for (const pid of (r.reserve || [])) rosteredPlayerIds.add(pid);
        for (const pid of (r.taxi || [])) rosteredPlayerIds.add(pid);
      }

      const OFFENSIVE_POS = new Set(['QB', 'RB', 'WR', 'TE']);
      const waiverPool: Array<{
        playerId: string;
        name: string;
        position: string;
        team: string | null;
        age: number;
        searchRank: number;
        injuryStatus: string | null;
      }> = [];

      for (const [pid, player] of Object.entries(allPlayers) as [string, any][]) {
        if (rosteredPlayerIds.has(pid)) continue;
        if (!player?.position || !OFFENSIVE_POS.has(player.position)) continue;
        if (!player.team || player.team === 'FA') continue;
        if (player.active === false) continue;

        waiverPool.push({
          playerId: pid,
          name: player.full_name || `${player.first_name || ''} ${player.last_name || ''}`.trim(),
          position: player.position,
          team: player.team,
          age: player.age || 0,
          searchRank: player.search_rank || 9999,
          injuryStatus: player.injury_status || null,
        });
      }

      waiverPool.sort((a, b) => a.searchRank - b.searchRank);
      const topWaiverPlayers = waiverPool.slice(0, 60);

      const teamBudgets = allRosters.map(r => {
        const user = userMap.get(r.ownerId);
        return {
          rosterId: r.rosterId,
          teamName: user?.metadata?.team_name || user?.display_name || user?.username || "Unknown",
          faabRemaining: r.faabRemaining,
          faabPct: waiverBudget > 0 ? Math.round((r.faabRemaining / waiverBudget) * 1000) / 10 : 0,
          record: { wins: r.wins, losses: r.losses, ties: r.ties },
          rank: r.rank,
          isUser: r.rosterId === userRoster.rosterId,
        };
      }).sort((a, b) => b.faabRemaining - a.faabRemaining);

      const leagueAvgBudget = allRosters.reduce((sum, r) => sum + r.faabRemaining, 0) / allRosters.length;

      res.json({
        initialBudget: waiverBudget,
        userBudget: userRoster.faabRemaining,
        userBudgetPct: waiverBudget > 0 ? Math.round((userRoster.faabRemaining / waiverBudget) * 1000) / 10 : 0,
        leagueAvgBudget: Math.round(leagueAvgBudget),
        leagueAvgPct: waiverBudget > 0 ? Math.round((leagueAvgBudget / waiverBudget) * 1000) / 10 : 0,
        teamBudgets,
        waiverPool: topWaiverPlayers,
        currentWeek: leagueCtx.currentWeek,
        remainingWeeks: Math.max(0, leagueCtx.totalRegularSeasonWeeks - leagueCtx.currentWeek + 1),
      });
    } catch (error: any) {
      console.error("FAAB context error:", error);
      res.status(500).json({ error: error.message || "Failed to load FAAB context" });
    }
  });

  app.post("/api/engine/waiver-eval/:leagueId", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      const { targetPlayerId } = req.body;
      if (!targetPlayerId) return res.status(400).json({ error: "targetPlayerId required" });
      const userId = req.user?.claims?.sub;
      const profile = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).limit(1);
      const sleeperUserId = profile[0]?.sleeperUserId;
      if (!sleeperUserId) return res.status(400).json({ error: "Sleeper account not linked" });

      const analysis = await engineOptimizer.runWaiverAnalysis(leagueId, sleeperUserId, targetPlayerId);

      let explanation: string | undefined;
      try {
        explanation = await engineExplainer.explainWaiver(analysis);
      } catch (e) {}

      res.json({ ...analysis, explanation });
    } catch (error: any) {
      console.error("Engine waiver eval error:", error);
      res.status(500).json({ error: error.message || "Waiver evaluation failed" });
    }
  });

  app.get("/api/engine/season-outlook/:leagueId", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      const userId = req.user?.claims?.sub;
      const profile = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).limit(1);
      const sleeperUserId = profile[0]?.sleeperUserId;
      if (!sleeperUserId) return res.status(400).json({ error: "Sleeper account not linked" });

      const result = await engineOptimizer.runSeasonOutlook(leagueId, sleeperUserId);

      let explanation: string | undefined;
      try {
        explanation = await engineExplainer.explainSeasonOutlook(result);
      } catch (e) {}

      await db.insert(schema.simulationResults).values({
        userId,
        leagueId,
        simulationType: 'season_outlook',
        resultData: result as any,
        explanation,
      });

      if (result.seasonSim) {
        try {
          const leagueCtxSnap = await getLeagueContext(leagueId);
          await db.insert(schema.titleEquitySnapshots).values({
            userId,
            leagueId,
            week: leagueCtxSnap.currentWeek,
            championshipOdds: result.seasonSim.championshipProbability || 0,
            playoffOdds: result.seasonSim.playoffProbability || 0,
          });
        } catch (e) {}
      }

      res.json({ ...result, explanation });
    } catch (error: any) {
      console.error("Engine season outlook error:", error);
      res.status(500).json({ error: error.message || "Season outlook failed" });
    }
  });

  app.get("/api/engine/portfolio/:leagueId", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      const userId = req.user?.claims?.sub;
      const profile = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).limit(1);
      const sleeperUserId = profile[0]?.sleeperUserId;
      if (!sleeperUserId) return res.status(400).json({ error: "Sleeper account not linked" });

      const [leagueCtx, allRosters, allPlayers] = await Promise.all([
        getLeagueContext(leagueId),
        getAllRosterContexts(leagueId),
        sleeperApi.getAllPlayers(),
      ]);

      const userRoster = allRosters.find(r => r.ownerId === sleeperUserId);
      if (!userRoster) return res.status(404).json({ error: "Roster not found" });

      const userProjs = await getPlayerProjections(
        userRoster.starters || [],
        leagueCtx.scoringSettings,
        leagueCtx.season,
        leagueCtx.currentWeek,
      );

      const portfolio = analyzePortfolio(userRoster, userProjs, allPlayers, leagueCtx);

      let explanation: string | undefined;
      try {
        explanation = await engineExplainer.explainPortfolio(portfolio);
      } catch (e) {}

      const leagueCtxForWeek = await getLeagueContext(leagueId);
      await db.insert(schema.portfolioSnapshots).values({
        userId,
        leagueId,
        snapshotData: portfolio as any,
        week: leagueCtxForWeek.currentWeek,
      });

      res.json({ ...portfolio, explanation });
    } catch (error: any) {
      console.error("Engine portfolio error:", error);
      res.status(500).json({ error: error.message || "Portfolio analysis failed" });
    }
  });

  app.get("/api/engine/championship-path/:leagueId", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      const userId = req.user?.claims?.sub;
      const profile = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).limit(1);
      const sleeperUserId = profile[0]?.sleeperUserId;
      if (!sleeperUserId) return res.status(400).json({ error: "Sleeper account not linked" });

      const [leagueCtx, allRosters, standings, allPlayers] = await Promise.all([
        getLeagueContext(leagueId),
        getAllRosterContexts(leagueId),
        getStandings(leagueId),
        sleeperApi.getAllPlayers(),
      ]);

      const userRoster = allRosters.find(r => r.ownerId === sleeperUserId);
      if (!userRoster) return res.status(404).json({ error: "Roster not found" });

      const allPlayerIds = new Set<string>();
      allRosters.forEach(r => r.players.forEach(id => allPlayerIds.add(id)));
      const projections = await getPlayerProjections(
        Array.from(allPlayerIds),
        leagueCtx.scoringSettings,
        leagueCtx.season,
        leagueCtx.currentWeek,
      );

      const projMap = new Map(projections.map(p => [p.playerId, p]));
      const projByRoster = new Map<number, PlayerProjection[]>();
      for (const roster of allRosters) {
        const rosterProjs = (roster.starters || [])
          .map((id: string) => projMap.get(id))
          .filter(Boolean) as PlayerProjection[];
        projByRoster.set(roster.rosterId, rosterProjs);
      }

      const corrMatrix = buildCorrelationMatrix(projections, allPlayers);
      const path = computeChampionshipPath(userRoster.rosterId, standings, projByRoster, corrMatrix, leagueCtx);

      let explanation: string | undefined;
      try {
        explanation = await engineExplainer.explainChampionshipPath(path);
      } catch (e) {}

      res.json({ ...path, explanation });
    } catch (error: any) {
      console.error("Engine championship path error:", error);
      res.status(500).json({ error: error.message || "Championship path analysis failed" });
    }
  });

  app.get("/api/engine/exploit-report/:leagueId", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      const userId = req.user?.claims?.sub;
      const profile = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).limit(1);
      const sleeperUserId = profile[0]?.sleeperUserId;
      if (!sleeperUserId) return res.status(400).json({ error: "Sleeper account not linked" });

      const [leagueCtx, allRosters, allPlayers, leagueUsers] = await Promise.all([
        getLeagueContext(leagueId),
        getAllRosterContexts(leagueId),
        sleeperApi.getAllPlayers(),
        sleeperApi.getLeagueUsers(leagueId),
      ]);

      const userMap = new Map<string, string>();
      for (const u of leagueUsers) {
        userMap.set(u.user_id, u.display_name || u.username || u.user_id.slice(0, 8));
      }

      const allPlayerIds = new Set<string>();
      allRosters.forEach(r => r.starters.forEach(id => allPlayerIds.add(id)));
      const projections = await getPlayerProjections(
        Array.from(allPlayerIds),
        leagueCtx.scoringSettings,
        leagueCtx.season,
        leagueCtx.currentWeek,
      );

      const projByRoster = new Map<number, typeof projections>();
      for (const roster of allRosters) {
        const rosterProjs = roster.starters
          .map(id => projections.find(p => p.playerId === id))
          .filter(Boolean) as typeof projections;
        projByRoster.set(roster.rosterId, rosterProjs);
      }

      const scarcity = getPositionalScarcity(projections, leagueCtx);
      const report = scanForExploits(leagueCtx, allRosters, projByRoster, scarcity, allPlayers, userMap);

      res.json(report);
    } catch (error: any) {
      console.error("Engine exploit report error:", error);
      res.status(500).json({ error: error.message || "Exploit report failed" });
    }
  });

  app.get("/api/engine/regression-alerts/:leagueId", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      const userId = req.user?.claims?.sub;
      const profile = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).limit(1);
      const sleeperUserId = profile[0]?.sleeperUserId;
      if (!sleeperUserId) return res.status(400).json({ error: "Sleeper account not linked" });

      const [leagueCtx, allRosters, allPlayers] = await Promise.all([
        getLeagueContext(leagueId),
        getAllRosterContexts(leagueId),
        sleeperApi.getAllPlayers(),
      ]);

      const allPlayerIds = new Set<string>();
      allRosters.forEach(r => r.players.forEach(id => allPlayerIds.add(id)));
      const projections = await getPlayerProjections(
        Array.from(allPlayerIds),
        leagueCtx.scoringSettings,
        leagueCtx.season,
        leagueCtx.currentWeek,
      );

      const alerts = detectRegressionAlerts(projections, allPlayers);
      res.json({ alerts });
    } catch (error: any) {
      console.error("Engine regression alerts error:", error);
      res.status(500).json({ error: error.message || "Regression alert detection failed" });
    }
  });

  app.get("/api/engine/title-equity/:leagueId", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      const userId = req.user?.claims?.sub;
      const profile = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).limit(1);
      const sleeperUserId = profile[0]?.sleeperUserId;
      if (!sleeperUserId) return res.status(400).json({ error: "Sleeper account not linked" });

      const snapshots = await db.select().from(schema.titleEquitySnapshots)
        .where(and(eq(schema.titleEquitySnapshots.userId, userId), eq(schema.titleEquitySnapshots.leagueId, leagueId)))
        .orderBy(asc(schema.titleEquitySnapshots.week));

      res.json({ snapshots });
    } catch (error: any) {
      console.error("Engine title equity error:", error);
      res.status(500).json({ error: error.message || "Title equity retrieval failed" });
    }
  });

  app.get("/api/engine/risk-profile/:leagueId", isAuthenticated, requireSubscription, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      const userId = req.user?.claims?.sub;
      const profile = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).limit(1);
      const sleeperUserId = profile[0]?.sleeperUserId;
      if (!sleeperUserId) return res.status(400).json({ error: "Sleeper account not linked" });

      const existing = await db.select().from(schema.engineRiskProfiles)
        .where(and(eq(schema.engineRiskProfiles.userId, userId), eq(schema.engineRiskProfiles.leagueId, leagueId)))
        .limit(1);

      if (existing[0] && Date.now() - new Date(existing[0].computedAt!).getTime() < 24 * 60 * 60 * 1000) {
        return res.json(existing[0].profileData);
      }

      const transactions = await sleeperApi.getAllLeagueTransactions(leagueId);
      const riskProfile = analyzeRiskProfile(
        sleeperUserId,
        leagueId,
        transactions,
        [],
        [],
        [],
      );

      if (existing[0]) {
        await db.update(schema.engineRiskProfiles)
          .set({ classification: riskProfile.classification, profileData: riskProfile as any, updatedAt: new Date() })
          .where(eq(schema.engineRiskProfiles.id, existing[0].id));
      } else {
        await db.insert(schema.engineRiskProfiles).values({
          userId,
          leagueId,
          classification: riskProfile.classification,
          profileData: riskProfile as any,
        });
      }

      res.json(riskProfile);
    } catch (error: any) {
      console.error("Engine risk profile error:", error);
      res.status(500).json({ error: error.message || "Risk profile analysis failed" });
    }
  });

  // ========================================
  // Dynasty AI Engine v3 API Routes
  // ========================================

  const dynastyPlayersCache = new RouteCache(15 * 60 * 1000, 10);

  app.get("/api/engine/v3/players-dynasty", isAuthenticated, async (req: any, res: Response) => {
    try {
      const position = (req.query.position as string || "").toUpperCase();
      const sort = (req.query.sort as string) || "dynastyValue";
      const order = (req.query.order as string) || "desc";
      const search = (req.query.search as string) || "";
      const minAge = req.query.minAge ? parseInt(req.query.minAge as string, 10) : undefined;
      const maxAge = req.query.maxAge ? parseInt(req.query.maxAge as string, 10) : undefined;
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 100, 500);
      const offset = parseInt(req.query.offset as string, 10) || 0;

      const fullCacheKey = "players-dynasty-full-v3";
      let fullDataset: any[] | null = dynastyPlayersCache.get(fullCacheKey);

      if (!fullDataset) {
        try {
          await dynastyConsensusService.fetchAndCacheValues();
        } catch (e) {
          // ignore
        }

        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        const latestSeason = currentMonth < 8 ? String(currentYear - 1) : String(currentYear);

        const seasons = [latestSeason, String(parseInt(latestSeason) - 1), String(parseInt(latestSeason) - 2)];

        const [allPlayers, ...seasonStatsArr] = await Promise.all([
          sleeperApi.getAllPlayers(),
          ...seasons.map(s => sleeperApi.getSeasonStats(s, "regular")),
        ]);

        const devyPlayerIds = new Set(ktcValues.KTC_DEVY_PLAYERS.map((p: any) => p.id));
        const validPositions = new Set(["QB", "RB", "WR", "TE"]);
        const playerEntries: any[] = [];

        const allPlayerValues: Array<{ position: string; value: number }> = [];

        for (const [playerId, player] of Object.entries(allPlayers) as [string, any][]) {
          if (devyPlayerIds.has(playerId)) continue;
          const pos = player.position || player.fantasy_positions?.[0];
          if (!validPositions.has(pos)) continue;
          if (!player.team) continue;

          const age = player.age || 25;
          const yearsExp = player.years_exp || 0;
          const currentValue = ktcValues.getPlayerValue(playerId, pos, age, yearsExp, player.search_rank, true);

          allPlayerValues.push({ position: pos, value: currentValue });

          const seasonPPGs: number[] = [];
          const allWeeklyScores: number[] = [];
          let totalGames = 0;

          for (const stats of seasonStatsArr) {
            const pStats = stats[playerId];
            if (pStats) {
              const gp = pStats.gp || 0;
              const pts = pStats.pts_ppr || 0;
              totalGames += gp;
              if (gp > 0) {
                seasonPPGs.push(pts / gp);
              }
              if (pts > 0) {
                const weeklyEstimate = gp > 0 ? pts / gp : 0;
                for (let w = 0; w < Math.max(1, gp); w++) {
                  allWeeklyScores.push(weeklyEstimate);
                }
              }
            }
          }

          const threeYearAvgPPG = seasonPPGs.length > 0
            ? Math.round((seasonPPGs.reduce((a, b) => a + b, 0) / seasonPPGs.length) * 100) / 100
            : 0;

          const name = player.full_name || `${player.first_name || ""} ${player.last_name || ""}`.trim();

          playerEntries.push({
            playerId,
            name,
            position: pos,
            team: player.team || "FA",
            age,
            yearsExp,
            currentValue,
            threeYearAvgPPG,
            weeklyScores: allWeeklyScores,
            totalGames,
            seasonPPGs,
          });
        }

        const scarcityData = ufasService.computePositionalScarcity(allPlayerValues);
        const avgValue = allPlayerValues.length > 0
          ? allPlayerValues.reduce((s, p) => s + p.value, 0) / allPlayerValues.length
          : 3000;

        const positionalRankCounters: Record<string, number> = {};

        const enriched = playerEntries.map((pe) => {
          const valuation = playerValuationService.computePlayerValuation(
            pe.playerId, pe.position, pe.age, pe.currentValue,
            pe.weeklyScores, pe.yearsExp,
            pe.totalGames, Math.max(pe.totalGames, 17), 0
          );

          const ufasResult = ufasService.computeUFAS(
            pe.weeklyScores, pe.currentValue, pe.age, pe.position,
            pe.yearsExp, pe.totalGames, Math.max(pe.totalGames, 17), 0,
            'balanced', scarcityData, avgValue
          );

          const ageCurve = playerValuationService.getAgeCurve(pe.position);
          let projectedPPG = pe.threeYearAvgPPG;
          if (pe.threeYearAvgPPG > 0) {
            const ageMultiplier = playerValuationService.computeAgeMultiplier(pe.age + 1, pe.position);
            projectedPPG = Math.round(pe.threeYearAvgPPG * ageMultiplier * 100) / 100;
          }

          return {
            playerId: pe.playerId,
            name: pe.name,
            position: pe.position,
            team: pe.team,
            age: pe.age,
            dynastyValue: pe.currentValue,
            threeYearAvgPPG: pe.threeYearAvgPPG,
            projectedPPG,
            riskScore: Math.round(valuation.injuryRiskScore * 100),
            ufasScore: ufasResult.ufas,
            ufasTier: ufasResult.tier,
            positionalRank: 0,
            trajectory: valuation.productionTrajectory,
            archetypeCluster: valuation.archetypeCluster,
            longevityScore: valuation.longevityScore,
            dnpv: valuation.dnpv.dnpv,
          };
        });

        enriched.sort((a, b) => b.dynastyValue - a.dynastyValue);

        for (const pos of ["QB", "RB", "WR", "TE"]) {
          let rank = 1;
          enriched
            .filter(p => p.position === pos)
            .forEach(p => { p.positionalRank = rank++; });
        }

        fullDataset = enriched;
        dynastyPlayersCache.set(fullCacheKey, fullDataset);
      }

      let filtered = fullDataset!;

      if (position && ["QB", "RB", "WR", "TE"].includes(position)) {
        filtered = filtered.filter(p => p.position === position);
      }

      if (search) {
        const searchLower = search.toLowerCase();
        filtered = filtered.filter(p =>
          p.name.toLowerCase().includes(searchLower) ||
          p.team.toLowerCase().includes(searchLower)
        );
      }

      if (minAge !== undefined) {
        filtered = filtered.filter(p => p.age >= minAge);
      }
      if (maxAge !== undefined) {
        filtered = filtered.filter(p => p.age <= maxAge);
      }

      const sortKey = sort as keyof typeof filtered[0];
      const validSortKeys = new Set(["dynastyValue", "threeYearAvgPPG", "projectedPPG", "riskScore", "ufasScore", "age", "name", "positionalRank", "dnpv"]);
      const effectiveSort = validSortKeys.has(sort) ? sort : "dynastyValue";

      filtered.sort((a: any, b: any) => {
        const aVal = a[effectiveSort];
        const bVal = b[effectiveSort];
        if (typeof aVal === "string" && typeof bVal === "string") {
          return order === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return order === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
      });

      const total = filtered.length;
      const paginated = filtered.slice(offset, offset + limit);

      res.json({
        players: paginated,
        total,
        limit,
        offset,
      });
    } catch (error: any) {
      console.error("Players dynasty list error:", error);
      res.status(500).json({ error: error.message || "Failed to compute dynasty players list" });
    }
  });

  app.get("/api/engine/v3/player-valuation/:playerId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const playerId = req.params.playerId as string;
      const cached = playerValuationService.getCachedValuation(playerId);
      if (cached) return res.json(cached);

      const allPlayers = await sleeperApi.getAllPlayers();
      const player = allPlayers[playerId as string];
      if (!player) return res.status(404).json({ error: "Player not found" });

      const age = player.age || 25;
      const position = player.position || "WR";
      const yearsExp = player.years_exp || 0;
      const currentValue = ktcValues.getPlayerValue(playerId as string, position, age, yearsExp, player.search_rank, !!player.team);
      const weeklyScores: number[] = [];
      const gamesPlayed = weeklyScores.filter((s: number) => s > 0).length;

      const valuation = playerValuationService.computePlayerValuation(
        playerId as string, position, age, currentValue, weeklyScores,
        yearsExp, gamesPlayed, 17, 0
      );
      playerValuationService.cacheValuation(valuation);

      const ufas = ufasService.computeUFAS(
        weeklyScores, currentValue, age, position, yearsExp,
        gamesPlayed, 17, 0, 'balanced',
        ufasService.computePositionalScarcity([{ position, value: currentValue }]),
        currentValue
      );

      const briefing = aiExplanationService.generatePlayerBriefing(valuation, ufas, 'balanced');

      res.json({ valuation, ufas, briefing });
    } catch (error: any) {
      console.error("Player valuation error:", error);
      res.status(500).json({ error: error.message || "Player valuation failed" });
    }
  });

  app.get("/api/engine/v3/devy-projections", isAuthenticated, async (_req: Request, res: Response) => {
    try {
      const cacheKey = "devy-projections-v3";
      const cached = engineV3Cache.get(cacheKey);
      if (cached) return res.json(cached);

      const rankings = devyProjectionService.getDevyDNPVRankings();
      engineV3Cache.set(cacheKey, rankings);
      res.json(rankings);
    } catch (error: any) {
      console.error("Devy projections error:", error);
      res.status(500).json({ error: error.message || "Devy projections failed" });
    }
  });

  app.get("/api/engine/v3/devy-projection/:playerId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const devyPlayers = ktcValues.getDevyPlayers();
      const player = devyPlayers.find(p => p.id === req.params.playerId as string);
      if (!player) return res.status(404).json({ error: "Devy player not found" });

      const projection = devyProjectionService.projectDevyPlayer(player as any);
      res.json(projection);
    } catch (error: any) {
      console.error("Devy projection error:", error);
      res.status(500).json({ error: error.message || "Devy projection failed" });
    }
  });

  app.get("/api/engine/v3/franchise-window/:leagueId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const leagueId = req.params.leagueId as string;
      const userId = (req as any).userId;

      const cacheKey = `franchise-window-v3-${leagueId}-${userId}`;
      const cached = engineV3Cache.get(cacheKey);
      if (cached) return res.json(cached);

      const allPlayers = await sleeperApi.getAllPlayers();
      const rosters = await sleeperApi.getLeagueRosters(leagueId);
      const leagueInfo = await sleeperApi.getLeague(leagueId);

      const userRoster = rosters.find((r: any) => {
        const leagueUsers = r.owner_id;
        return leagueUsers;
      });
      if (!userRoster) return res.status(404).json({ error: "Roster not found" });

      const rosterPlayers: franchiseModelingService.RosterPlayer[] = (userRoster.players || []).map((pid: string) => {
        const p = allPlayers[pid];
        if (!p) return null;
        const age = p.age || 25;
        const position = p.position || "WR";
        const yearsExp = p.years_exp || 0;
        const value = ktcValues.getPlayerValue(pid, position, age, yearsExp, p.search_rank, !!p.team);
        const isStarter = (userRoster.starters || []).includes(pid);
        return { playerId: pid, position, age, value, weeklyScores: [], isStarter, yearsExp };
      }).filter(Boolean) as franchiseModelingService.RosterPlayer[];

      const draftPicks = await sleeperApi.getLeagueDraftPicks(leagueId);
      const draftCapital: franchiseModelingService.DraftCapital[] = (draftPicks || [])
        .filter((dp: any) => dp.owner_id === userRoster.roster_id)
        .map((dp: any) => ({
          year: String(dp.season),
          round: dp.round,
          estimatedValue: ktcValues.getPickValue(String(dp.season), dp.round),
        }));

      const result = franchiseModelingService.analyzefranchiseWindow(rosterPlayers, draftCapital);
      engineV3Cache.set(cacheKey, result);
      res.json(result);
    } catch (error: any) {
      console.error("Franchise window error:", error);
      res.status(500).json({ error: error.message || "Franchise window analysis failed" });
    }
  });

  app.get("/api/engine/v3/ufas/:leagueId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const leagueId = req.params.leagueId as string;
      const userId = (req as any).userId;

      const cacheKey = `ufas-v3-${leagueId}-${userId}`;
      const cached = engineV3Cache.get(cacheKey);
      if (cached) return res.json(cached);

      const allPlayers = await sleeperApi.getAllPlayers();
      const rosters = await sleeperApi.getLeagueRosters(leagueId);

      const userRoster = rosters.find((r: any) => r.owner_id);
      if (!userRoster) return res.status(404).json({ error: "Roster not found" });

      const allPlayerValues: Array<{ position: string; value: number }> = [];
      for (const roster of rosters) {
        for (const pid of (roster.players || [])) {
          const p = allPlayers[pid];
          if (p?.position) {
            const value = ktcValues.getPlayerValue(pid, p.position, p.age || 25, p.years_exp || 0, p.search_rank, !!p.team);
            allPlayerValues.push({ position: p.position, value });
          }
        }
      }

      const scarcityData = ufasService.computePositionalScarcity(allPlayerValues);
      const leagueAvgValue = allPlayerValues.length > 0
        ? allPlayerValues.reduce((s, p) => s + p.value, 0) / allPlayerValues.length : 0;

      const players = (userRoster.players || []).map((pid: string) => {
        const p = allPlayers[pid];
        if (!p) return null;
        const age = p.age || 25;
        const position = p.position || "WR";
        const value = ktcValues.getPlayerValue(pid, position, age, p.years_exp || 0, p.search_rank, !!p.team);
        return {
          playerId: pid, weeklyScores: [] as number[], currentValue: value,
          age, position, yearsExp: p.years_exp || 0,
          gamesPlayed: 0, totalPossibleGames: 17, injuryHistoryCount: 0,
        };
      }).filter(Boolean) as any[];

      const ufasResults = ufasService.batchComputeUFAS(players, 'balanced', scarcityData, leagueAvgValue);

      const results: any[] = [];
      ufasResults.forEach((ufas, playerId) => {
        const p = allPlayers[playerId];
        results.push({
          playerId,
          name: p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : playerId,
          position: p?.position || 'UNK',
          ...ufas,
        });
      });

      results.sort((a, b) => b.ufas - a.ufas);

      const response = { scarcityData, leagueAvgValue, players: results };
      engineV3Cache.set(cacheKey, response);
      res.json(response);
    } catch (error: any) {
      console.error("UFAS error:", error);
      res.status(500).json({ error: error.message || "UFAS computation failed" });
    }
  });

  app.post("/api/engine/v3/trade-simulation", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { givePlayerIds, getPlayerIds, franchiseWindow = 'balanced' } = req.body;
      if (!givePlayerIds?.length || !getPlayerIds?.length) {
        return res.status(400).json({ error: "Both give and get player IDs required" });
      }

      const allPlayers = await sleeperApi.getAllPlayers();

      const toAsset = (pid: string): tradeSimulationService.TradeAsset | null => {
        const p = allPlayers[pid];
        if (!p) return null;
        const age = p.age || 25;
        const position = p.position || "WR";
        const value = ktcValues.getPlayerValue(pid, position, age, p.years_exp || 0, p.search_rank, !!p.team);
        return {
          playerId: pid,
          name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
          position, age, currentValue: value,
          weeklyScores: [], yearsExp: p.years_exp || 0,
        };
      };

      const giveAssets = givePlayerIds.map(toAsset).filter(Boolean) as tradeSimulationService.TradeAsset[];
      const getAssets = getPlayerIds.map(toAsset).filter(Boolean) as tradeSimulationService.TradeAsset[];

      if (giveAssets.length === 0 || getAssets.length === 0) {
        return res.status(400).json({ error: "Invalid player IDs" });
      }

      const result = tradeSimulationService.simulateTrade(giveAssets, getAssets, franchiseWindow);
      const briefing = aiExplanationService.generateTradeBriefing(result, franchiseWindow);

      res.json({ simulation: result, briefing });
    } catch (error: any) {
      console.error("Trade simulation error:", error);
      res.status(500).json({ error: error.message || "Trade simulation failed" });
    }
  });

  app.get("/api/engine/v3/market-snapshot/:leagueId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const leagueId = req.params.leagueId as string;
      const userId = (req as any).userId;

      const cacheKey = `market-snapshot-v3-${leagueId}-${userId}`;
      const cached = engineV3Cache.get(cacheKey);
      if (cached) return res.json(cached);

      const allPlayers = await sleeperApi.getAllPlayers();
      const rosters = await sleeperApi.getLeagueRosters(leagueId);
      const leagueUsers = await sleeperApi.getLeagueUsers(leagueId);
      const transactions = await sleeperApi.getAllLeagueTransactions(leagueId);

      const userMap = new Map<string, string>();
      for (const u of leagueUsers) {
        userMap.set(u.user_id, u.display_name || u.username || 'Unknown');
      }

      const rosterData = rosters.map((r: any) => ({
        rosterId: r.roster_id,
        ownerName: userMap.get(r.owner_id) || `Team ${r.roster_id}`,
        players: r.players || [],
        wins: r.settings?.wins || 0,
        losses: r.settings?.losses || 0,
        fpts: r.settings?.fpts || 0,
      }));

      const playerValues = new Map<string, number>();
      for (const roster of rosters) {
        for (const pid of (roster.players || [])) {
          const p = allPlayers[pid];
          if (p) {
            playerValues.set(pid, ktcValues.getPlayerValue(pid, p.position || 'WR', p.age || 25, p.years_exp || 0, p.search_rank, !!p.team));
          }
        }
      }

      const franchiseWindows = new Map<number, franchiseModelingService.FranchiseWindow>();
      for (const r of rosterData) {
        franchiseWindows.set(r.rosterId, 'balanced' as franchiseModelingService.FranchiseWindow);
      }

      const snapshot = marketDynamicsService.buildLeagueMarketSnapshot(
        rosterData, transactions, allPlayers, franchiseWindows,
        rosterData[0]?.rosterId || 1, 'balanced', {}, playerValues
      );

      const briefing = aiExplanationService.generateMarketBriefing(snapshot, 'balanced');

      const response = { snapshot, briefing };
      engineV3Cache.set(cacheKey, response);
      res.json(response);
    } catch (error: any) {
      console.error("Market snapshot error:", error);
      res.status(500).json({ error: error.message || "Market snapshot failed" });
    }
  });

  app.get("/api/engine/v3/power-rankings/:leagueId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const leagueId = req.params.leagueId as string;

      const cacheKey = `power-rankings-v3-${leagueId}`;
      const cached = engineV3Cache.get(cacheKey);
      if (cached) return res.json(cached);

      const allPlayers = await sleeperApi.getAllPlayers();
      const rosters = await sleeperApi.getLeagueRosters(leagueId);
      const leagueUsers = await sleeperApi.getLeagueUsers(leagueId);

      const userMap = new Map<string, string>();
      for (const u of leagueUsers) {
        userMap.set(u.user_id, u.display_name || u.username || 'Unknown');
      }

      const allPlayerValues: Array<{ position: string; value: number }> = [];
      const rosterData: any[] = [];

      for (const roster of rosters) {
        const players: any[] = [];
        for (const pid of (roster.players || [])) {
          const p = allPlayers[pid];
          if (!p) continue;
          const age = p.age || 25;
          const position = p.position || "WR";
          const value = ktcValues.getPlayerValue(pid, position, age, p.years_exp || 0, p.search_rank, !!p.team);
          const isStarter = (roster.starters || []).includes(pid);
          allPlayerValues.push({ position, value });
          players.push({
            playerId: pid,
            name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
            position, age, value, weeklyScores: [], isStarter,
          });
        }

        rosterData.push({
          rosterId: roster.roster_id,
          ownerName: userMap.get(roster.owner_id) || `Team ${roster.roster_id}`,
          players,
          wins: roster.settings?.wins || 0,
          losses: roster.settings?.losses || 0,
          fpts: roster.settings?.fpts || 0,
        });
      }

      const scarcityData = ufasService.computePositionalScarcity(allPlayerValues);
      const leagueAvgValue = allPlayerValues.length > 0
        ? allPlayerValues.reduce((s, p) => s + p.value, 0) / allPlayerValues.length : 0;

      const ufasScores = new Map<string, ufasService.UFASResult>();
      const franchiseResults = new Map<number, franchiseModelingService.FranchiseWindowResult>();

      for (const rData of rosterData) {
        const rosterPlayers: franchiseModelingService.RosterPlayer[] = rData.players.map((p: any) => ({
          playerId: p.playerId, position: p.position, age: p.age,
          value: p.value, weeklyScores: p.weeklyScores, isStarter: p.isStarter, yearsExp: 0,
        }));

        const windowResult = franchiseModelingService.analyzefranchiseWindow(rosterPlayers, []);
        franchiseResults.set(rData.rosterId, windowResult);

        for (const p of rData.players) {
          const ufas = ufasService.computeUFAS(
            p.weeklyScores, p.value, p.age, p.position, 0,
            0, 17, 0, windowResult.classification, scarcityData, leagueAvgValue
          );
          ufasScores.set(p.playerId, ufas);
        }
      }

      const result = powerRankingsService.computePowerRankings(rosterData, ufasScores, franchiseResults);

      engineV3Cache.set(cacheKey, result);
      res.json(result);
    } catch (error: any) {
      console.error("Power rankings error:", error);
      res.status(500).json({ error: error.message || "Power rankings failed" });
    }
  });

  app.post("/api/engine/v3/draft-simulation", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { leagueId, currentPick = 1, iterations = 1000 } = req.body;
      if (!leagueId) return res.status(400).json({ error: "leagueId required" });

      const allPlayers = await sleeperApi.getAllPlayers();
      const rosters = await sleeperApi.getLeagueRosters(leagueId);
      const leagueInfo = await sleeperApi.getLeague(leagueId);
      const totalTeams = leagueInfo?.total_rosters || rosters.length || 12;

      const devyPlayers = ktcValues.getDevyPlayers();
      const availablePlayers: draftSimulationService.DraftPlayer[] = devyPlayers.slice(0, 60).map((dp, idx) => ({
        playerId: dp.id,
        name: dp.name,
        position: dp.position,
        value: dp.value,
        adp: idx + 1,
        tier: dp.tier,
        college: dp.college,
      }));

      const rostersByTeam = new Map<number, string[]>();
      for (const r of rosters) {
        rostersByTeam.set(r.roster_id, r.players || []);
      }

      const userRosterId = rosters[0]?.roster_id || 1;

      const result = draftSimulationService.buildDraftSimulation(
        availablePlayers, userRosterId, currentPick,
        totalTeams, 4, rostersByTeam, allPlayers,
        Math.min(iterations, 2000)
      );

      const briefing = aiExplanationService.generateDraftBriefing(result, {});

      res.json({ simulation: result, briefing });
    } catch (error: any) {
      console.error("Draft simulation error:", error);
      res.status(500).json({ error: error.message || "Draft simulation failed" });
    }
  });

  app.get("/api/engine/v3/war-room/:leagueId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const leagueId = req.params.leagueId as string;
      const userId = (req as any).userId;

      const cacheKey = `war-room-v3-${leagueId}-${userId}`;
      const cached = engineV3Cache.get(cacheKey);
      if (cached) return res.json(cached);

      const allPlayers = await sleeperApi.getAllPlayers();
      const rosters = await sleeperApi.getLeagueRosters(leagueId);
      const leagueUsers = await sleeperApi.getLeagueUsers(leagueId);
      const transactions = await sleeperApi.getAllLeagueTransactions(leagueId);

      const userMap = new Map<string, string>();
      for (const u of leagueUsers) {
        userMap.set(u.user_id, u.display_name || u.username || 'Unknown');
      }

      const userRoster = rosters[0];
      if (!userRoster) return res.status(404).json({ error: "Roster not found" });

      const allPlayerValues: Array<{ position: string; value: number }> = [];
      const rosterPlayersData: franchiseModelingService.RosterPlayer[] = [];

      for (const pid of (userRoster.players || [])) {
        const p = allPlayers[pid];
        if (!p) continue;
        const age = p.age || 25;
        const position = p.position || "WR";
        const value = ktcValues.getPlayerValue(pid, position, age, p.years_exp || 0, p.search_rank, !!p.team);
        const isStarter = (userRoster.starters || []).includes(pid);
        allPlayerValues.push({ position, value });
        rosterPlayersData.push({
          playerId: pid, position, age, value, weeklyScores: [], isStarter, yearsExp: p.years_exp || 0,
        });
      }

      const franchiseResult = franchiseModelingService.analyzefranchiseWindow(rosterPlayersData, []);

      const scarcityData = ufasService.computePositionalScarcity(allPlayerValues);
      const leagueAvgValue = allPlayerValues.length > 0
        ? allPlayerValues.reduce((s, p) => s + p.value, 0) / allPlayerValues.length : 0;

      const ufasScores = new Map<string, ufasService.UFASResult>();
      for (const rp of rosterPlayersData) {
        const ufas = ufasService.computeUFAS(
          rp.weeklyScores, rp.value, rp.age, rp.position, rp.yearsExp,
          0, 17, 0, franchiseResult.classification, scarcityData, leagueAvgValue
        );
        ufasScores.set(rp.playerId, ufas);
      }

      const playerValues = new Map<string, number>();
      for (const r of rosters) {
        for (const pid of (r.players || [])) {
          const p = allPlayers[pid];
          if (p) playerValues.set(pid, ktcValues.getPlayerValue(pid, p.position || 'WR', p.age || 25, p.years_exp || 0, p.search_rank, !!p.team));
        }
      }

      const rosterList = rosters.map((r: any) => ({
        rosterId: r.roster_id,
        ownerName: userMap.get(r.owner_id) || `Team ${r.roster_id}`,
        players: r.players || [],
        wins: r.settings?.wins || 0,
        losses: r.settings?.losses || 0,
        fpts: r.settings?.fpts || 0,
      }));

      const franchiseWindows = new Map<number, franchiseModelingService.FranchiseWindow>();
      franchiseWindows.set(userRoster.roster_id, franchiseResult.classification);

      const marketSnapshot = marketDynamicsService.buildLeagueMarketSnapshot(
        rosterList, transactions, allPlayers, franchiseWindows,
        userRoster.roster_id, franchiseResult.classification, {}, playerValues
      );

      const prData = rosterList.map((r: any) => ({
        ...r,
        players: (r.players as string[]).map((pid: string) => {
          const p = allPlayers[pid];
          return {
            playerId: pid,
            name: p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : pid,
            position: p?.position || 'UNK',
            age: p?.age || 25,
            value: playerValues.get(pid) || 0,
            weeklyScores: [] as number[],
            isStarter: false,
          };
        }),
      }));

      const franchiseResultsMap = new Map<number, franchiseModelingService.FranchiseWindowResult>();
      franchiseResultsMap.set(userRoster.roster_id, franchiseResult);

      const powerRankings = powerRankingsService.computePowerRankings(prData, ufasScores, franchiseResultsMap);
      const userRanking = powerRankings.rankings.find(r => r.rosterId === userRoster.roster_id);

      let warRoomBriefing: aiExplanationService.GMBriefing | null = null;
      if (userRanking) {
        warRoomBriefing = aiExplanationService.generateWarRoomBriefing(userRanking, franchiseResult, marketSnapshot);
      }

      const topUFASPlayers: any[] = [];
      ufasScores.forEach((ufas, playerId) => {
        const p = allPlayers[playerId];
        topUFASPlayers.push({
          playerId,
          name: p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : playerId,
          position: p?.position || 'UNK',
          ...ufas,
        });
      });
      topUFASPlayers.sort((a, b) => b.ufas - a.ufas);

      const response = {
        briefing: warRoomBriefing,
        franchiseWindow: franchiseResult,
        powerRank: userRanking,
        ufasRoster: topUFASPlayers,
        marketSnapshot: {
          contenderCount: marketSnapshot.contenderCount,
          rebuilderCount: marketSnapshot.rebuilderCount,
          proactiveTargets: marketSnapshot.proactiveTargets.slice(0, 5),
          marketNarrative: marketSnapshot.marketNarrative,
        },
        scarcityData,
      };

      engineV3Cache.set(cacheKey, response);
      res.json(response);
    } catch (error: any) {
      console.error("War room error:", error);
      res.status(500).json({ error: error.message || "War room analysis failed" });
    }
  });

  // ========================================
  // Dynasty Player Card API (T001)
  // ========================================
  const playerCardCache = new RouteCache(10 * 60 * 1000, 500);

  app.get("/api/engine/v3/player-card/:playerId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const playerId = req.params.playerId as string;

      const cacheKey = `player-card-v3-${playerId}`;
      const cached = playerCardCache.get(cacheKey);
      if (cached) return res.json(cached);

      const [allPlayers, state] = await Promise.all([
        sleeperApi.getAllPlayers(),
        sleeperApi.getState(),
      ]);

      const player = allPlayers[playerId];
      if (!player) return res.status(404).json({ error: "Player not found" });

      const age = player.age || 25;
      const position = player.position || "WR";
      const yearsExp = player.years_exp || 0;
      const currentSeason = parseInt(state?.season || "2025");
      const playerName = `${player.first_name || ""} ${player.last_name || ""}`.trim();

      const currentValue = ktcValues.getPlayerValue(playerId, position, age, yearsExp, player.search_rank, !!player.team);

      const seasons = [2022, 2023, 2024, 2025];
      const seasonStatsPromises = seasons.map(s =>
        sleeperApi.getSeasonStats(String(s), "regular").catch(() => ({}))
      );
      const seasonStatsResults = await Promise.all(seasonStatsPromises);

      const multiSeasonStats: Record<string, any> = {};
      const seasonPPGs: number[] = [];
      let careerGames = 0;
      let careerPoints = 0;
      const trendPPG: { season: number; value: number }[] = [];
      const trendTargets: { season: number; value: number }[] = [];
      const trendRZUsage: { season: number; value: number }[] = [];
      const trendSnap: { season: number; value: number }[] = [];

      for (let i = 0; i < seasons.length; i++) {
        const seasonYear = seasons[i];
        const stats = (seasonStatsResults[i] as any)?.[playerId];
        if (!stats) continue;

        const gp = stats.gp || 0;
        const pts = stats.pts_ppr ?? stats.pts_half_ppr ?? stats.pts_std ?? 0;
        const ppg = gp > 0 ? Math.round((pts / gp) * 100) / 100 : 0;

        multiSeasonStats[String(seasonYear)] = {
          gp,
          pts: Math.round(pts * 100) / 100,
          ppg,
          pass_yd: stats.pass_yd || 0,
          pass_td: stats.pass_td || 0,
          pass_int: stats.pass_int || 0,
          rush_yd: stats.rush_yd || 0,
          rush_td: stats.rush_td || 0,
          rush_att: stats.rush_att || 0,
          rec: stats.rec || 0,
          rec_yd: stats.rec_yd || 0,
          rec_td: stats.rec_td || 0,
          rec_tgt: stats.rec_tgt || 0,
          fum_lost: stats.fum_lost || 0,
          snp: stats.snp || 0,
          tm_snp: stats.tm_snp || 0,
          snp_pct: stats.tm_snp > 0 ? Math.round((stats.snp / stats.tm_snp) * 10000) / 100 : 0,
          rz_tgt: stats.rz_tgt || 0,
          rz_att: stats.rz_att || 0,
        };

        if (gp > 0) {
          seasonPPGs.push(ppg);
          careerGames += gp;
          careerPoints += pts;
        }

        trendPPG.push({ season: seasonYear, value: ppg });
        trendTargets.push({ season: seasonYear, value: stats.rec_tgt || 0 });
        trendRZUsage.push({ season: seasonYear, value: (stats.rz_tgt || 0) + (stats.rz_att || 0) });
        const snapPct = stats.tm_snp > 0 ? Math.round((stats.snp / stats.tm_snp) * 10000) / 100 : 0;
        trendSnap.push({ season: seasonYear, value: snapPct });
      }

      const threeYearAvgPPG = seasonPPGs.length > 0
        ? Math.round((seasonPPGs.slice(-3).reduce((a, b) => a + b, 0) / Math.min(seasonPPGs.length, 3)) * 100) / 100
        : 0;
      const careerPPG = careerGames > 0 ? Math.round((careerPoints / careerGames) * 100) / 100 : 0;

      const careerAggregates = { gp: careerGames, pts: Math.round(careerPoints * 100) / 100, ppg: careerPPG, threeYearAvgPPG };

      const latestSeasonStats = seasonStatsResults[seasonStatsResults.length - 1] as any;
      const latestPlayerStats = latestSeasonStats?.[playerId];
      const weeklyScores: number[] = [];
      if (latestPlayerStats) {
        const gp = latestPlayerStats.gp || 0;
        const pts = latestPlayerStats.pts_ppr ?? latestPlayerStats.pts_half_ppr ?? latestPlayerStats.pts_std ?? 0;
        const ppgApprox = gp > 0 ? pts / gp : 0;
        for (let w = 0; w < gp; w++) {
          weeklyScores.push(ppgApprox + (Math.random() - 0.5) * ppgApprox * 0.4);
        }
      }

      const gamesPlayed = weeklyScores.filter(s => s > 0).length;

      const valuation = playerValuationService.computePlayerValuation(
        playerId, position, age, currentValue, weeklyScores,
        yearsExp, gamesPlayed, 17, 0
      );
      playerValuationService.cacheValuation(valuation);

      const allPlayerValues: Array<{ position: string; value: number }> = [];
      const positionPlayers = Object.entries(allPlayers).filter(([_, p]: [string, any]) =>
        p.position === position && p.active && p.team
      );
      for (const [pid, p] of positionPlayers as [string, any][]) {
        const v = ktcValues.getPlayerValue(pid, p.position, p.age || 25, p.years_exp || 0, p.search_rank, !!p.team);
        allPlayerValues.push({ position: p.position, value: v });
      }

      const scarcityData = ufasService.computePositionalScarcity(allPlayerValues);
      const leagueAvgValue = allPlayerValues.length > 0
        ? allPlayerValues.reduce((s, p) => s + p.value, 0) / allPlayerValues.length : 0;

      const ufasResult = ufasService.computeUFAS(
        weeklyScores, currentValue, age, position, yearsExp,
        gamesPlayed, 17, 0, 'balanced', scarcityData, leagueAvgValue
      );

      const sortedPosByValue = positionPlayers
        .map(([pid, p]: [string, any]) => ({
          pid,
          value: ktcValues.getPlayerValue(pid, p.position, p.age || 25, p.years_exp || 0, p.search_rank, !!p.team),
        }))
        .sort((a, b) => b.value - a.value);
      const positionalRank = sortedPosByValue.findIndex(p => p.pid === playerId) + 1;

      const ageCurve = playerValuationService.getAgeCurve(position);
      let ageCurveIndicator: 'ascending' | 'peak' | 'declining' | 'twilight';
      if (age < ageCurve.peakStart) ageCurveIndicator = 'ascending';
      else if (age <= ageCurve.peakEnd) ageCurveIndicator = 'peak';
      else if (age <= ageCurve.peakEnd + 3) ageCurveIndicator = 'declining';
      else ageCurveIndicator = 'twilight';

      const outlookMap: Record<string, string> = {
        elite_franchise: 'A+', ascending_star: 'A', prime_producer: 'B+',
        volatile_talent: 'B', aging_asset: 'C', depth_piece: 'D', unknown: 'C-',
      };
      const threeYearOutlook = outlookMap[valuation.archetypeCluster] || 'C';

      let contenderGrade = 'B';
      let rebuildGrade = 'B';
      if (ageCurveIndicator === 'peak' || ageCurveIndicator === 'ascending') {
        contenderGrade = valuation.archetypeCluster === 'elite_franchise' ? 'A+' : 'A';
        rebuildGrade = ageCurveIndicator === 'ascending' ? 'A' : 'B-';
      } else if (ageCurveIndicator === 'declining') {
        contenderGrade = 'B';
        rebuildGrade = 'D';
      } else {
        contenderGrade = 'C';
        rebuildGrade = 'F';
      }

      const distribution = computePlayerDistribution(weeklyScores);

      const ageMultiplierY1 = playerValuationService.computeAgeMultiplier(age + 1, position);
      const ageMultiplierY2 = playerValuationService.computeAgeMultiplier(age + 2, position);
      const ageMultiplierY3 = playerValuationService.computeAgeMultiplier(age + 3, position);
      const basePPG = threeYearAvgPPG > 0 ? threeYearAvgPPG : (distribution.mean || careerPPG);

      const y1PPG = Math.round(basePPG * ageMultiplierY1 * 100) / 100;
      const y2PPG = Math.round(basePPG * ageMultiplierY2 * 100) / 100;
      const y3PPG = Math.round(basePPG * ageMultiplierY3 * 100) / 100;

      const stdDev = distribution.stdDev || basePPG * 0.3;
      let trajectory: 'ascending' | 'stable' | 'declining' = 'stable';
      if (y3PPG > y1PPG * 1.05) trajectory = 'ascending';
      else if (y3PPG < y1PPG * 0.90) trajectory = 'declining';

      const projection = {
        year1: { ppg: y1PPG, totalPoints: Math.round(y1PPG * 17 * 100) / 100, confidenceLow: Math.round((y1PPG - stdDev) * 100) / 100, confidenceHigh: Math.round((y1PPG + stdDev) * 100) / 100 },
        year2: { ppg: y2PPG, totalPoints: Math.round(y2PPG * 17 * 100) / 100, confidenceLow: Math.round((y2PPG - stdDev * 1.2) * 100) / 100, confidenceHigh: Math.round((y2PPG + stdDev * 1.2) * 100) / 100 },
        year3: { ppg: y3PPG, totalPoints: Math.round(y3PPG * 17 * 100) / 100, confidenceLow: Math.round((y3PPG - stdDev * 1.5) * 100) / 100, confidenceHigh: Math.round((y3PPG + stdDev * 1.5) * 100) / 100 },
        trajectory,
      };

      const response = {
        playerId,
        name: playerName,
        position,
        age,
        team: player.team || 'FA',
        yearsExp,
        dynastySnapshot: {
          dynastyScore: ufasResult.ufas,
          tier: ufasResult.tier,
          tierRank: ufasResult.tierRank,
          positionalRank,
          ageCurveIndicator,
          threeYearOutlook,
          contenderGrade,
          rebuildGrade,
          archetypeCluster: valuation.archetypeCluster,
          dynastyValue: currentValue,
          injuryRiskScore: valuation.injuryRiskScore,
          longevityScore: valuation.longevityScore,
          productionTrajectory: valuation.productionTrajectory,
        },
        multiSeasonStats,
        careerAggregates,
        trendData: {
          ppg: trendPPG,
          targets: trendTargets,
          redZoneUsage: trendRZUsage,
          snapPct: trendSnap,
        },
        contractTeamContext: {
          team: player.team || 'FA',
          depthChartOrder: player.depth_chart_order || null,
          depthChartPosition: player.depth_chart_position || null,
          injuryStatus: player.injury_status || null,
          contractYear: yearsExp >= 3 && position === 'RB' ? true : yearsExp >= 4 ? true : false,
          number: player.number || null,
          height: player.height || null,
          weight: player.weight || null,
          college: player.college || null,
        },
        projection,
        distribution: {
          median: distribution.median,
          floor: distribution.floor,
          ceiling: distribution.ceiling,
          mean: distribution.mean,
          stdDev: distribution.stdDev,
          coefficientOfVariation: distribution.coefficientOfVariation,
        },
        ufasComponents: ufasResult.components,
        dnpv: {
          dnpv: valuation.dnpv.dnpv,
          annualizedValue: valuation.dnpv.annualizedValue,
          peakYearValue: valuation.dnpv.peakYearValue,
        },
      };

      playerCardCache.set(cacheKey, response);
      res.json(response);
    } catch (error: any) {
      console.error("Player card error:", error);
      res.status(500).json({ error: error.message || "Player card generation failed" });
    }
  });

  app.get("/api/market-psychology/categories", isAuthenticated, async (_req: any, res: Response) => {
    try {
      const all = await storage.getAllPlayerMarketMetrics(500, 0);

      const mostOverhyped = [...all]
        .filter(p => p.hypePremiumPct > 0)
        .sort((a, b) => b.hypePremiumPct - a.hypePremiumPct)
        .slice(0, 10);

      const undervalued = [...all]
        .filter(p => p.hypePremiumPct < 0)
        .sort((a, b) => a.hypePremiumPct - b.hypePremiumPct)
        .slice(0, 10);

      const risingFast = [...all]
        .filter(p => p.hypeVelocity > 0)
        .sort((a, b) => b.hypeVelocity - a.hypeVelocity)
        .slice(0, 10);

      const panicSells = [...all]
        .filter(p => p.hypeVelocity < 0 && p.demandIndex < 40)
        .sort((a, b) => a.hypeVelocity - b.hypeVelocity)
        .slice(0, 10);

      const artificialScarcity = [...all]
        .filter(p => p.supplyIndex < 40 && p.demandIndex > 60)
        .sort((a, b) => (b.demandIndex - b.supplyIndex) - (a.demandIndex - a.supplyIndex))
        .slice(0, 10);

      const lastUpdated = all.length > 0 ? all.reduce((latest, m) => {
        const t = m.lastUpdated ? new Date(m.lastUpdated).getTime() : 0;
        return t > latest ? t : latest;
      }, 0) : null;

      res.json({
        overhyped: mostOverhyped,
        undervalued,
        risingFast,
        panicSells,
        artificialScarcity,
        lastUpdated: lastUpdated ? new Date(lastUpdated).toISOString() : null,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch market categories" });
    }
  });

  app.get("/api/market-psychology/:playerId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const metrics = await storage.getPlayerMarketMetrics(req.params.playerId);
      if (!metrics) {
        return res.status(404).json({ error: "No market metrics found for this player" });
      }
      res.json(metrics);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch player market metrics" });
    }
  });

  app.get("/api/market-psychology", isAuthenticated, async (req: any, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const offset = parseInt(req.query.offset as string) || 0;
      const heatLevel = req.query.heatLevel as string | undefined;
      const sortBy = (req.query.sortBy as string) || "sentimentScore";
      const sortOrder = (req.query.sortOrder as string) || "desc";

      let metrics = await storage.getAllPlayerMarketMetrics(limit, offset, heatLevel);

      const validSortFields = [
        "sentimentScore", "hypeVelocity", "demandIndex", "supplyIndex",
        "hypePremiumPct", "adjustedMarketValue", "baseDynastyValue"
      ];

      if (validSortFields.includes(sortBy)) {
        metrics = metrics.sort((a: any, b: any) => {
          const aVal = a[sortBy] ?? 0;
          const bVal = b[sortBy] ?? 0;
          return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
        });
      }

      res.json({ metrics, limit, offset, count: metrics.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch market metrics" });
    }
  });

  app.post("/api/market-psychology/refresh", isAuthenticated, requireAdmin, async (req: any, res: Response) => {
    try {
      const { refreshMarketPsychologyData } = await import("./engine/market-psychology-refresh");
      const count = await refreshMarketPsychologyData();
      res.json({ success: true, playersProcessed: count });
    } catch (error: any) {
      console.error("Market psychology refresh error:", error);
      res.status(500).json({ error: error.message || "Failed to refresh market data" });
    }
  });

  app.get("/api/market-terminal/overview", isAuthenticated, async (_req: any, res: Response) => {
    try {
      const cache = await storage.getMarketIndexCache();
      if (!cache) {
        return res.json({
          dynastyMarketIndex: 0,
          dynastyVolatilityIndex: 0,
          avgHypePremium: 0,
          leagueTradeVolume7d: 0,
          leagueAvgVolatility: 0,
          lastUpdated: null,
        });
      }
      res.json({
        dynastyMarketIndex: cache.dynastyMarketIndex,
        dynastyVolatilityIndex: cache.dynastyVolatilityIndex,
        avgHypePremium: cache.avgHypePremium,
        leagueTradeVolume7d: cache.leagueTradeVolume7d,
        leagueAvgVolatility: cache.leagueAvgVolatility,
        lastUpdated: cache.lastUpdated,
      });
    } catch (error: any) {
      console.error("Market terminal overview error:", error);
      res.status(500).json({ error: "Failed to fetch market overview" });
    }
  });

  app.get("/api/market-terminal/arbitrage", isAuthenticated, async (req: any, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const allMetrics = await storage.getAllPlayerMarketMetrics(5000, 0);
      const withGap = allMetrics
        .filter(m => m.gapScore !== 0 && m.gapScore !== null)
        .sort((a, b) => Math.abs(b.gapScore) - Math.abs(a.gapScore))
        .slice(0, limit)
        .map(m => ({
          playerId: m.playerId,
          playerName: m.playerName,
          position: m.position,
          team: m.team,
          gapScore: m.gapScore,
          signal: m.gapScore > 0 ? "BUY" : "SELL",
          fundamentalRank: m.fundamentalRank,
          marketRank: m.marketRank,
          baseDynastyValue: m.baseDynastyValue,
          adjustedMarketValue: m.adjustedMarketValue,
          hypePremiumPct: m.hypePremiumPct,
          marketLabel: m.marketLabel,
          volatility14d: m.volatility14d,
          betaScore: m.betaScore,
        }));
      res.json({ arbitrage: withGap });
    } catch (error: any) {
      console.error("Market terminal arbitrage error:", error);
      res.status(500).json({ error: "Failed to fetch arbitrage data" });
    }
  });

  app.get("/api/market-terminal/portfolio-exposure/:leagueId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { leagueId } = req.params;
      const userId = req.user?.id || req.session?.userId;
      if (!leagueId) {
        return res.status(400).json({ error: "League ID required" });
      }

      const rosters = await sleeperApi.getLeagueRosters(leagueId);
      const users = await sleeperApi.getLeagueUsers(leagueId);

      let userRoster = rosters.find((r: any) => {
        const matchedUser = users.find((u: any) => u.user_id === userId);
        return matchedUser && r.owner_id === matchedUser.user_id;
      });

      if (!userRoster && rosters.length > 0) {
        userRoster = rosters[0];
      }

      if (!userRoster || !userRoster.players || userRoster.players.length === 0) {
        return res.json({
          overexposedPct: 0,
          underexposedPct: 0,
          portfolioBeta: 1,
          classification: "Balanced",
          playerBreakdown: [],
        });
      }

      const playerIds = userRoster.players;
      const metrics = await storage.getPlayerMarketMetricsBatch(playerIds);

      const totalValue = metrics.reduce((s, m) => s + Math.abs(m.adjustedMarketValue || 0), 0);

      let overexposedValue = 0;
      let underexposedValue = 0;
      let weightedBetaSum = 0;

      const playerBreakdown = metrics.map(m => {
        const value = Math.abs(m.adjustedMarketValue || 0);
        const weight = totalValue > 0 ? value / totalValue : 0;

        if (m.hypePremiumPct > 15) overexposedValue += value;
        if (m.hypePremiumPct < -10) underexposedValue += value;
        weightedBetaSum += (m.betaScore || 1) * weight;

        return {
          playerId: m.playerId,
          playerName: m.playerName,
          position: m.position,
          team: m.team,
          adjustedMarketValue: m.adjustedMarketValue,
          hypePremiumPct: m.hypePremiumPct,
          betaScore: m.betaScore,
          marketLabel: m.marketLabel,
          volatility14d: m.volatility14d,
          weight: Math.round(weight * 1000) / 10,
        };
      }).sort((a, b) => (b.adjustedMarketValue || 0) - (a.adjustedMarketValue || 0));

      const overexposedPct = totalValue > 0 ? Math.round((overexposedValue / totalValue) * 1000) / 10 : 0;
      const underexposedPct = totalValue > 0 ? Math.round((underexposedValue / totalValue) * 1000) / 10 : 0;
      const portfolioBeta = Math.round(weightedBetaSum * 100) / 100;

      let classification = "Balanced";
      if (portfolioBeta > 1.3 || overexposedPct > 40) classification = "Aggressive";
      else if (portfolioBeta < 0.8 && overexposedPct < 15) classification = "Defensive";

      res.json({
        overexposedPct,
        underexposedPct,
        portfolioBeta,
        classification,
        playerBreakdown,
      });
    } catch (error: any) {
      console.error("Portfolio exposure error:", error);
      res.status(500).json({ error: "Failed to compute portfolio exposure" });
    }
  });

  app.get("/api/draft-intelligence/adp", isAuthenticated, async (req: any, res: Response) => {
    try {
      const format = (req.query.format as string) || "all";
      const position = req.query.position as string | undefined;
      const search = req.query.search as string | undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const sort = (req.query.sort as string) || "consensus";
      const category = (req.query.category as string) || "offense";

      const result = await draftIntelService.getCachedADP({ format, position, search, page, limit, sort, category });
      res.json(result);
    } catch (error: any) {
      console.error("Draft ADP error:", error);
      res.status(500).json({ error: "Failed to fetch ADP data" });
    }
  });

  app.get("/api/draft-intelligence/sources", isAuthenticated, async (_req: any, res: Response) => {
    try {
      const sources = await getExternalRankingsSummary();
      const sleeperStats = await draftIntelService.getSleeperStats();
      sources.unshift({
        source: "sleeper",
        playerCount: sleeperStats.playerCount,
        matchedCount: sleeperStats.playerCount,
        draftCount: sleeperStats.draftCount,
        pickCount: sleeperStats.pickCount,
        lastUpdated: new Date().toISOString(),
        description: "Community ADP from real Sleeper league drafts across all registered users. Grows as more users connect their accounts.",
      });
      res.json(sources);
    } catch (error: any) {
      console.error("Draft sources error:", error);
      res.status(500).json({ error: "Failed to fetch data sources" });
    }
  });

  app.get("/api/draft-intelligence/adp/:playerId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const adp = await draftIntelService.getPlayerADP(req.params.playerId);
      if (!adp) {
        return res.status(404).json({ error: "Player ADP not found" });
      }
      res.json(adp);
    } catch (error: any) {
      console.error("Player ADP error:", error);
      res.status(500).json({ error: "Failed to fetch player ADP" });
    }
  });

  app.get("/api/draft-intelligence/pick-distribution/:playerName", isAuthenticated, async (req: any, res: Response) => {
    try {
      const playerName = decodeURIComponent(req.params.playerName);
      const draftType = (req.query.type as string) || "rookie";
      const data = await draftIntelService.getPlayerPickDistribution(playerName, draftType);
      res.json(data);
    } catch (error: any) {
      console.error("Pick distribution error:", error);
      res.status(500).json({ error: "Failed to fetch pick distribution" });
    }
  });

  app.get("/api/draft-intelligence/pick-value-curve", isAuthenticated, async (req: any, res: Response) => {
    try {
      const rawType = (req.query.type as string) || "rookie";
      const draftType = rawType === "startup" ? "startup" : "rookie";
      const enhanced = req.query.enhanced === "true";
      if (enhanced) {
        const curve = await draftIntelService.getEnhancedPickValueCurve(draftType);
        res.json(curve);
      } else {
        const curve = await draftIntelService.getCachedPickValueCurve(draftType);
        res.json(curve);
      }
    } catch (error: any) {
      console.error("Pick value curve error:", error);
      res.status(500).json({ error: "Failed to fetch pick value curve" });
    }
  });

  app.post("/api/draft-intelligence/refresh", isAuthenticated, async (req: any, res: Response) => {
    try {
      res.json({ message: "Draft intelligence refresh started" });
      draftIntelService.runFullDraftIntelPipeline().catch(err => {
        console.error("[DraftIntel] Background refresh error:", err);
      });
    } catch (error: any) {
      console.error("Draft intel refresh error:", error);
      res.status(500).json({ error: "Failed to start refresh" });
    }
  });

  return httpServer;
}
