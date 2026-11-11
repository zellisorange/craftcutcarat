const { getStore } = require('@netlify/blobs');

const json = (code, obj) => ({
  statusCode: code,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(obj)
});

const STATUSES = ['open', 'approved', 'received', 'repairing', 'shipped', 'closed', 'denied'];

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
  try {
    const token = event.headers['x-admin-token'];
    if (!process.env.REVIEW_ADMIN_TOKEN || token !== process.env.REVIEW_ADMIN_TOKEN) {
      return json(401, { error: 'Not authorized' });
    }
    const { id, status, note } = JSON.parse(event.body || '{}');
    if (!id || !STATUSES.includes(status)) return json(400, { error: 'Bad request' });

    const store = getStore({
      name: 'galaxy-gems-claims',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });
    const claims = (await store.get('claims.json', { type: 'json' })) || [];
    const c = claims.find(x => x.id === id);
    if (!c) return json(404, { error: 'Claim not found' });

    c.status = status;
    c.note = String(note || '').slice(0, 500);
    c.history = (c.history || []).concat([{ status, at: Date.now() }]);
    await store.setJSON('claims.json', claims);
    return json(200, { ok: true });
  } catch (err) {
    return json(500, { error: err.message });
  }
};
