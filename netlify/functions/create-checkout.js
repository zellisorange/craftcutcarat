const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { items } = JSON.parse(event.body);

    const line_items = items.map(item => ({
      price_data: {
        currency: 'cad',
        product_data: {
          name: item.name,
          description: item.description || undefined,
        },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity || 1,
    }));

    const CARE = {
      '1yr': { label: '1 Year', amount: 9000 },
      '3yr': { label: '3 Years', amount: 25000 },
    };
    items.forEach(item => {
      const c = CARE[item.care];
      if (!c) return;
      line_items.push({
        price_data: {
          currency: 'cad',
          product_data: {
            name: 'Extended Care ' + c.label + ': ' + item.name,
            description: 'Repair-and-return service plan',
          },
          unit_amount: c.amount,
        },
        quantity: item.quantity || 1,
      });
    });

    const session = await stripe.checkout.sessions.create({
      line_items,
        mode: 'payment',
      shipping_options: [
        { shipping_rate_data: { type: 'fixed_amount', fixed_amount: { amount: 1500, currency: 'cad' }, display_name: 'Canada Post Xpresspost - Canada (tracked, $100 coverage included)' } },
        { shipping_rate_data: { type: 'fixed_amount', fixed_amount: { amount: 2500, currency: 'cad' }, display_name: 'Canada Post Xpresspost USA (tracked, $100 coverage included)' } },
        { shipping_rate_data: { type: 'fixed_amount', fixed_amount: { amount: 4000, currency: 'cad' }, display_name: 'Canada Post International - UK and Australia (tracked, $100 coverage included)' } },
      ],
      success_url: 'https://craftcutcarat.com/?payment=success',
      cancel_url: 'https://craftcutcarat.com/?payment=cancelled',
      shipping_address_collection: {
        allowed_countries: ['CA', 'US', 'GB', 'AU'],
      },
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};