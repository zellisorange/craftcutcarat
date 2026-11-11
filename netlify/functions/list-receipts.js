const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const json = (code, obj) => ({
  statusCode: code,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(obj)
});

exports.handler = async (event) => {
  const started = Date.now();
  try {
    const token = event.headers['x-admin-token'];
    if (!process.env.REVIEW_ADMIN_TOKEN || token !== process.env.REVIEW_ADMIN_TOKEN) {
      return json(401, { error: 'Not authorized' });
    }

    const rows = [];
    let startingAfter;
    let truncated = false;

    for (let page = 0; page < 40; page++) {
      if (Date.now() - started > 7500) { truncated = true; break; }
      const params = {
        limit: 100,
        expand: ['data.line_items', 'data.payment_intent.latest_charge']
      };
      if (startingAfter) params.starting_after = startingAfter;
      const res = await stripe.checkout.sessions.list(params);

      for (const s of res.data) {
        if (s.payment_status !== 'paid') continue;
        const cd = s.customer_details || {};
        const ship = s.shipping_details ||
          (s.collected_information && s.collected_information.shipping_details) || null;
        const a = (ship && ship.address) || {};
        const address = [a.line1, a.line2, a.city, a.state, a.postal_code, a.country]
          .filter(Boolean).join(', ');
        const pi = (s.payment_intent && typeof s.payment_intent === 'object') ? s.payment_intent : null;
        const ch = (pi && pi.latest_charge && typeof pi.latest_charge === 'object') ? pi.latest_charge : null;
        const td = s.total_details || {};
        const items = ((s.line_items && s.line_items.data) || []).map(li => ({
          name: li.description || '',
          qty: li.quantity || 1,
          amount: (li.amount_total || 0) / 100
        }));

        rows.push({
          id: s.id,
          createdAt: s.created * 1000,
          customerName: cd.name || '',
          email: cd.email || s.customer_email || '',
          phone: cd.phone || '',
          shipTo: (ship && ship.name) || '',
          address: address,
          items: items,
          subtotal: (s.amount_subtotal || 0) / 100,
          tax: (td.amount_tax || 0) / 100,
          shipping: (td.amount_shipping || 0) / 100,
          total: (s.amount_total || 0) / 100,
          currency: String(s.currency || 'cad').toUpperCase(),
          refunded: ch ? (ch.amount_refunded || 0) / 100 : 0,
          receiptUrl: ch ? (ch.receipt_url || '') : ''
        });
      }

      if (!res.has_more) break;
      startingAfter = res.data[res.data.length - 1].id;
    }

    return json(200, { receipts: rows, truncated: truncated });
  } catch (err) {
    return json(500, { error: err.message });
  }
};
