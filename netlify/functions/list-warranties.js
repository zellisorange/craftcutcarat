const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getStore } = require('@netlify/blobs');

const json = (code, obj) => ({
  statusCode: code,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(obj)
});

const DAYS = { 1: 365, 3: 1095 };

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

exports.handler = async (event) => {
  try {
    const token = event.headers['x-admin-token'];
    if (!process.env.REVIEW_ADMIN_TOKEN || token !== process.env.REVIEW_ADMIN_TOKEN) {
      return json(401, { error: 'Not authorized' });
    }

    const notesStore = getStore({
      name: 'galaxy-gems-warranty-notes',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });
    const notes = (await notesStore.get('notes.json', { type: 'json' })) || {};

    const rows = [];
    let startingAfter;
    for (let page = 0; page < 20; page++) {
      const params = { limit: 100, expand: ['data.line_items'] };
      if (startingAfter) params.starting_after = startingAfter;
      const res = await stripe.checkout.sessions.list(params);

      for (const s of res.data) {
        if (s.payment_status !== 'paid') continue;
        const m = s.metadata || {};
        const lines = (s.line_items && s.line_items.data) || [];
        lines.forEach(li => {
          const name = li.description || '';
          if (!/^Extended Care/i.test(name)) return;

          const years = /\b3 Years?\b/i.test(name) ? 3 : 1;
          const stone = m.product || name.split(': ').slice(1).join(': ');
          const created = new Date(s.created * 1000);
          const startStr = /^\d{4}-\d{2}-\d{2}$/.test(m.deliveryDate || '')
            ? m.deliveryDate
            : isoDate(created);
          const p = startStr.split('-');
          const end = new Date(+p[0], +p[1] - 1, +p[2]);
          end.setDate(end.getDate() + DAYS[years]);

          const key = s.id + '|' + stone;
          const n = notes[key] || {};
          const cd = s.customer_details || {};
          rows.push({
            key: key,
            sessionId: s.id,
            purchasedAt: created.getTime(),
            customerName: cd.name || '',
            email: cd.email || s.customer_email || '',
            phone: cd.phone || '',
            stone: stone,
            plan: years + (years === 1 ? ' Year' : ' Years'),
            qty: li.quantity || 1,
            startDate: startStr,
            endDate: isoDate(end),
            paid: (li.amount_total || 0) / 100,
            used: !!n.used,
            notes: n.notes || ''
          });
        });
      }

      if (!res.has_more) break;
      startingAfter = res.data[res.data.length - 1].id;
    }

    return json(200, { warranties: rows });
  } catch (err) {
    return json(500, { error: err.message });
  }
};
