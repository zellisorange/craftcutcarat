const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  const sig = event.headers['stripe-signature'];
  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const aliItems = JSON.parse(session.metadata?.ali_items || '[]');
    const shipping = session.shipping_details?.address || {};

    for (const item of aliItems) {
      try {
        await fetch('https://craftcutcarat.com/.netlify/functions/aliexpress-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName: session.shipping_details?.name || 'Customer',
            addressLine1: shipping.line1 || '',
            city: shipping.city || '',
            province: shipping.state || '',
            country: shipping.country || 'CA',
            zip: shipping.postal_code || '',
            phone: session.customer_details?.phone || '0000000000',
            productId: item.aliId,
            quantity: item.quantity || 1
          })
        });
      } catch(e) {
        console.error('AliExpress order failed for', item.aliId, e.message);
      }
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
