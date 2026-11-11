const { getStore } = require('@netlify/blobs');

const json = (code, obj) => ({
  statusCode: code,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(obj)
});

exports.handler = async (event) => {
  try {
    const q = event.queryStringParameters || {};
    const store = getStore({
      name: 'galaxy-gems-claims',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });
    const claims = (await store.get('claims.json', { type: 'json' })) || [];

    if (q.admin) {
      const token = event.headers['x-admin-token'];
      if (!process.env.REVIEW_ADMIN_TOKEN || token !== process.env.REVIEW_ADMIN_TOKEN) {
        return json(401, { error: 'Not authorized' });
      }
      return json(200, { claims: claims.slice().reverse() });
    }

    const email = String(q.email || '').trim().toLowerCase();
    if (!email) return json(400, { error: 'Email required' });
    return json(200, { claims: claims.filter(c => c.userEmail === email).reverse() });
  } catch (err) {
    return json(500, { error: err.message });
  }
};
