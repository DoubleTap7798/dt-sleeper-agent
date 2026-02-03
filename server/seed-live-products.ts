import Stripe from 'stripe';

async function createLiveProducts() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  
  if (!secretKey || !secretKey.startsWith('sk_live_')) {
    console.error('ERROR: STRIPE_SECRET_KEY must be a live key (sk_live_...)');
    process.exit(1);
  }

  const stripe = new Stripe(secretKey, {
    apiVersion: '2025-11-17.clover',
  });

  console.log('Connected to LIVE Stripe account');

  try {
    const existingProducts = await stripe.products.search({ 
      query: "name:'DT Sleeper Agent Premium'" 
    });
    
    if (existingProducts.data.length > 0) {
      console.log('Product already exists:', existingProducts.data[0].id);
      
      const prices = await stripe.prices.list({ 
        product: existingProducts.data[0].id,
        active: true 
      });
      console.log('Existing prices:', prices.data.map(p => ({ id: p.id, amount: p.unit_amount, interval: p.recurring?.interval })));
      
      const weeklyPrice = prices.data.find(p => p.recurring?.interval === 'week');
      if (weeklyPrice) {
        console.log('\n*** UPDATE THIS IN upgrade.tsx ***');
        console.log('Live Weekly Price ID:', weeklyPrice.id);
      }
      return;
    }

    const product = await stripe.products.create({
      name: 'DT Sleeper Agent Premium',
      description: 'Full access to all DT Sleeper Agent features including Trade Calculator, Draft War Room, AI Insights, Waiver Recommendations, and more.',
      metadata: {
        app: 'dt-sleeper-agent',
        tier: 'premium',
      },
    });

    console.log('Created product:', product.id);

    const weeklyPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: 399,
      currency: 'usd',
      recurring: { 
        interval: 'week',
        interval_count: 1,
      },
      metadata: {
        display_name: 'Weekly',
      },
    });

    console.log('Created weekly price:', weeklyPrice.id, '- $3.99/week');

    console.log('\n*** UPDATE THIS IN upgrade.tsx ***');
    console.log('Live Weekly Price ID:', weeklyPrice.id);
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

createLiveProducts();
