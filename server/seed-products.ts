import { getUncachableStripeClient } from './stripeClient';

async function createProducts() {
  const stripe = await getUncachableStripeClient();

  // Check if product already exists
  const existingProducts = await stripe.products.search({ 
    query: "name:'DT Sleeper Agent Premium'" 
  });
  
  if (existingProducts.data.length > 0) {
    console.log('Product already exists:', existingProducts.data[0].id);
    
    // Get existing prices
    const prices = await stripe.prices.list({ 
      product: existingProducts.data[0].id,
      active: true 
    });
    console.log('Existing prices:', prices.data.map(p => ({ id: p.id, amount: p.unit_amount })));
    return;
  }

  // Create the product
  const product = await stripe.products.create({
    name: 'DT Sleeper Agent Premium',
    description: 'Full access to all DT Sleeper Agent features including Trade Calculator, Draft War Room, AI Insights, Waiver Recommendations, and more.',
    metadata: {
      app: 'dt-sleeper-agent',
      tier: 'premium',
    },
  });

  console.log('Created product:', product.id);

  // Create weekly price - $3.99/week
  const weeklyPrice = await stripe.prices.create({
    product: product.id,
    unit_amount: 399, // $3.99 in cents
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

  console.log('\nSetup complete!');
  console.log('Product ID:', product.id);
  console.log('Weekly Price ID:', weeklyPrice.id);
}

createProducts().catch(console.error);
