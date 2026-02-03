import Stripe from 'stripe';

let connectionSettings: any;

async function getCredentialsFromConnector(targetEnvironment: string) {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? 'depl ' + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  const connectorName = 'stripe';

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set('include_secrets', 'true');
  url.searchParams.set('connector_names', connectorName);
  url.searchParams.set('environment', targetEnvironment);

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'X_REPLIT_TOKEN': xReplitToken
    }
  });

  const data = await response.json();
  
  connectionSettings = data.items?.[0];

  if (!connectionSettings || (!connectionSettings.settings.publishable || !connectionSettings.settings.secret)) {
    return null;
  }

  return {
    publishableKey: connectionSettings.settings.publishable,
    secretKey: connectionSettings.settings.secret,
  };
}

async function getCredentials() {
  const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
  
  // Try production connector first if in production
  if (isProduction) {
    const prodCreds = await getCredentialsFromConnector('production');
    if (prodCreds) {
      console.log('Using production Stripe connector');
      return prodCreds;
    }
    
    // Fallback to manual secrets if connector not available
    // Only use if keys look valid (start with correct prefixes)
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
    if (secretKey && publishableKey && 
        secretKey.startsWith('sk_live_') && 
        publishableKey.startsWith('pk_live_')) {
      console.log('Using manual Stripe secrets for production');
      return { publishableKey, secretKey };
    }
    
    // Last resort: use development connector in production (test mode)
    console.log('WARNING: Using development Stripe connector in production - payments will be in TEST mode');
    const devCreds = await getCredentialsFromConnector('development');
    if (devCreds) {
      return devCreds;
    }
    
    throw new Error('No Stripe credentials available for production');
  }
  
  // In development, use development connector
  const devCreds = await getCredentialsFromConnector('development');
  if (devCreds) {
    return devCreds;
  }
  
  throw new Error('Stripe development connection not found');
}

export async function getUncachableStripeClient() {
  const { secretKey } = await getCredentials();

  return new Stripe(secretKey, {
    apiVersion: '2025-11-17.clover',
  });
}

export async function getStripePublishableKey() {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}

export async function getStripeSecretKey() {
  const { secretKey } = await getCredentials();
  return secretKey;
}

let stripeSync: any = null;

export async function getStripeSync() {
  if (!stripeSync) {
    const { StripeSync } = await import('stripe-replit-sync');
    const secretKey = await getStripeSecretKey();

    stripeSync = new StripeSync({
      poolConfig: {
        connectionString: process.env.DATABASE_URL!,
        max: 2,
      },
      stripeSecretKey: secretKey,
    });
  }
  return stripeSync;
}
