const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const PLANS = {
  '1yr': { name: 'Extended Care Plan: 1 Year', amount: 9000 },
  '3yr': { name: 'Extended Care Plan: 3 Years', amount: 25000 }
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  try {
    const { plan, warrantyId, product, deliveryDate, orderNo, email } = JSON.parse(event.body);
    const p = PLANS[plan];
    if (!p || !warrantyId || !product) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing or invalid details' }) };
    }
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'cad',
          product_data: {
            name: p.name,
            description: 'For: ' + String(product).slice(0, 200)
          },
          unit_amount: p.amount
        },
        quantity: 1
      }],
      customer_email: (email && String(email).includes('@')) ? email : undefined,
      metadata: {
        type: 'extended_care',
        plan: plan,
        warrantyId: String(warrantyId).slice(0, 100),
        product: String(product).slice(0, 200),
        deliveryDate: String(deliveryDate || '').slice(0, 20),
        orderNo: String(orderNo || '').slice(0, 100)
      },
      success_url: 'https://craftcutcarat.com/?warranty_session={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://craftcutcarat.com/?payment=cancelled'
    });
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
