const { getStore } = require('@netlify/blobs');

const json = (code, obj) => ({
  statusCode: code,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(obj)
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
  try {
    const token = event.headers['x-admin-token'];
    if (!process.env.REVIEW_ADMIN_TOKEN || token !== process.env.REVIEW_ADMIN_TOKEN) {
      return json(401, { error: 'Not authorized' });
    }
    const { key, used, notes } = JSON.parse(event.body || '{}');
    if (!key) return json(400, { error: 'Missing key' });

    const store = getStore({
      name: 'galaxy-gems-warranty-notes',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });
    const all = (await store.get('notes.json', { type: 'json' })) || {};
    all[key] = {
      used: !!used,
      notes: String(notes || '').slice(0, 3000),
      updatedAt: Date.now()
    };
    await store.setJSON('notes.json', all);
    return json(200, { ok: true });
  } catch (err) {
    return json(500, { error: err.message });
  }
};
