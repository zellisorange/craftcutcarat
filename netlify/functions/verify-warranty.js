const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  try {
    const id = (event.queryStringParameters || {}).session;
    if (!id || !/^cs_/.test(id)) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Bad session' }) };
    }
    const s = await stripe.checkout.sessions.retrieve(id);
    const m = s.metadata || {};
    if (s.payment_status !== 'paid' || m.type !== 'extended_care') {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false }) };
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        plan: m.plan,
        warrantyId: m.warrantyId,
        product: m.product,
        paidAt: s.created * 1000
      })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
