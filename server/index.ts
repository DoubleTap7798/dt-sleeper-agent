import { randomUUID } from "crypto";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { runMigrations } from "stripe-replit-sync";
import {
  getStripeSync,
  getUncachableStripeClient,
  getLiveStripeClient,
} from "./stripeClient";
import { WebhookHandlers } from "./webhookHandlers";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import {
  refreshMarketPsychologyData,
  refreshMarketIndices,
} from "./engine/market-psychology-refresh";
import { runFullDraftIntelPipeline } from "./engine/draft-intelligence-service";

async function syncSubscriptionToProfile(customerId: string) {
  console.log(`[syncSub] Starting sync for Stripe customer: ${customerId}`);

  let subscription: any = null;
  let workingStripe: any = null;

  const stripeClients: { stripe: any; label: string }[] = [];
  try {
    const connectorStripe = await getUncachableStripeClient();
    stripeClients.push({ stripe: connectorStripe, label: "connector" });
  } catch (e) {}
  const liveStripe = await getLiveStripeClient();
  if (liveStripe) {
    stripeClients.push({ stripe: liveStripe, label: "live" });
  }
  for (const { stripe, label } of stripeClients) {
    try {
      const stripeSubs = await stripe.subscriptions.list({
        customer: customerId,
        limit: 1,
      });
      if (stripeSubs.data.length > 0) {
        const s = stripeSubs.data[0] as any;
        subscription = {
          id: s.id,
          status: s.status,
          current_period_end: s.current_period_end,
        };
        workingStripe = stripe;
        console.log(
          `[syncSub] Found subscription via ${label}: ${s.id}, status: ${s.status}`,
        );
        break;
      }
    } catch (e: any) {
      console.log(
        `[syncSub] Could not query ${label} Stripe for customer ${customerId}: ${e.message}`,
      );
    }
  }

  if (!subscription) {
    const subResult = await db.execute(sql`
      SELECT id, status, current_period_end 
      FROM stripe.subscriptions 
      WHERE customer = ${customerId}
      ORDER BY created DESC
      LIMIT 1
    `);
    subscription = subResult.rows[0] as any;
  }

  if (!subscription) {
    console.log(`[syncSub] No subscription found for customer ${customerId}`);
    return;
  }

  console.log(
    `[syncSub] Found subscription: ${subscription.id}, status: ${subscription.status}`,
  );

  const profileByCustomer = await db
    .select()
    .from(schema.userProfiles)
    .where(eq(schema.userProfiles.stripeCustomerId, customerId))
    .limit(1);

  if (profileByCustomer[0]) {
    console.log(
      `[syncSub] Matched profile by stripeCustomerId, userId: ${profileByCustomer[0].userId}`,
    );
    await db
      .update(schema.userProfiles)
      .set({
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        subscriptionPeriodEnd: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000)
          : null,
        subscriptionSource: "stripe",
      })
      .where(eq(schema.userProfiles.stripeCustomerId, customerId));
    return;
  }

  console.log(
    `[syncSub] No profile matched by stripeCustomerId, trying email lookup...`,
  );
  let customerEmail: string | null = null;

  for (const { stripe, label } of stripeClients) {
    try {
      const customer = (await stripe.customers.retrieve(customerId)) as any;
      if (customer?.email) {
        customerEmail = customer.email;
        console.log(
          `[syncSub] Got email from ${label} Stripe: ${customerEmail}`,
        );
        break;
      }
    } catch (e: any) {
      console.log(
        `[syncSub] Could not retrieve customer from ${label}: ${e.message}`,
      );
    }
  }

  if (!customerEmail) {
    console.log(
      `[syncSub] Stripe customer ${customerId} has no email, cannot link to user`,
    );
    return;
  }

  const userByEmail = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, customerEmail.toLowerCase()))
    .limit(1);

  if (!userByEmail[0]) {
    console.log(`[syncSub] No user found with email: ${customerEmail}`);
    return;
  }

  const matchedUserId = userByEmail[0].id;
  console.log(`[syncSub] Found user by email, userId: ${matchedUserId}`);

  const profileByUser = await db
    .select()
    .from(schema.userProfiles)
    .where(eq(schema.userProfiles.userId, matchedUserId))
    .limit(1);

  if (profileByUser[0]) {
    await db
      .update(schema.userProfiles)
      .set({
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        subscriptionPeriodEnd: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000)
          : null,
        subscriptionSource: "stripe",
      })
      .where(eq(schema.userProfiles.userId, matchedUserId));
    console.log(
      `[syncSub] Updated existing profile for userId: ${matchedUserId}`,
    );
  } else {
    await db.insert(schema.userProfiles).values({
      id: crypto.randomUUID(),
      userId: matchedUserId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      subscriptionPeriodEnd: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000)
        : null,
      subscriptionSource: "stripe",
    });
    console.log(`[syncSub] Created new profile for userId: ${matchedUserId}`);
  }
}

const app = express();
app.set("trust proxy", 1);
const httpServer = createServer(app);



const app = express();
app.set("trust proxy", 1);
const httpServer = createServer(app);
app.post("/admin/run-pipeline", async (_req, res) => {
  try {
    await db.execute(sql`
      INSERT INTO jobs (id, type, status)
      VALUES (${randomUUID()}, 'full_pipeline', 'pending')
    `);

    res.json({ message: "Pipeline job queued" });
  } catch (err: any) {
    console.error("[jobs] Failed to queue pipeline job:", err?.message || err);
    res.status(500).json({ error: "Failed to queue job" });
  }
});
declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.warn("DATABASE_URL not found - Stripe integration disabled");
    return;
  }

  try {
    console.log("Initializing Stripe schema...");
    await runMigrations({ databaseUrl });
    console.log("Stripe schema ready");

    let stripeSync;
    try {
      stripeSync = await getStripeSync();
    } catch (credErr: any) {
      console.warn(
        "Stripe credentials unavailable, skipping sync:",
        credErr.message,
      );
      return;
    }

    console.log("Setting up managed webhook...");
    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
    try {
      const result = await stripeSync.findOrCreateManagedWebhook(
        `${webhookBaseUrl}/api/stripe/webhook`,
      );
      console.log(
        `Webhook configured: ${result?.webhook?.url || "webhook created"}`,
      );
    } catch (webhookError: any) {
      console.warn("Webhook setup warning:", webhookError.message);
    }

    console.log("Syncing Stripe data...");
    stripeSync
      .syncBackfill()
      .then(() => {
        console.log("Stripe data synced");
      })
      .catch((err: any) => {
        console.warn("Stripe data sync warning:", err.message || err);
      });
  } catch (error: any) {
    console.warn("Stripe initialization skipped:", error.message || error);
  }
}

initStripe().catch(console.error);

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];

    if (!signature) {
      return res.status(400).json({ error: "Missing stripe-signature" });
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;

      if (!Buffer.isBuffer(req.body)) {
        console.error("STRIPE WEBHOOK ERROR: req.body is not a Buffer");
        return res.status(500).json({ error: "Webhook processing error" });
      }

      await WebhookHandlers.processWebhook(req.body as Buffer, sig);

      // After processing webhook, try to sync subscription data to user profiles
      try {
        const event = JSON.parse(req.body.toString());
        if (
          event.type?.startsWith("customer.subscription.") ||
          event.type === "checkout.session.completed"
        ) {
          const customerId = event.data?.object?.customer;
          if (customerId) {
            // Async sync - don't block webhook response
            syncSubscriptionToProfile(customerId).catch((err) =>
              console.error("Auto-sync after webhook failed:", err.message),
            );
          }
        }
      } catch (syncErr) {
        // Don't fail the webhook if sync fails
      }

      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error("Webhook error:", error.message);
      res.status(400).json({ error: "Webhook processing error" });
    }
  },
);

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = process.env.PORT || 3000;

  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`Server running on port ${port}`);

    log(`serving on port ${port}`);
  });
})();
