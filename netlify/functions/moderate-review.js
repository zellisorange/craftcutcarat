const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: 'Method Not Allowed' }) };
  }

  try {
    if (!process.env.REVIEW_ADMIN_TOKEN) {
      return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: 'Admin token is not configured on the server' }) };
    }
    if ((event.headers['x-admin-token'] || '') !== process.env.REVIEW_ADMIN_TOKEN) {
      return { statusCode: 401, headers, body: JSON.stringify({ ok: false, error: 'Wrong admin token' }) };
    }

    const b = JSON.parse(event.body || '{}');
    const id = String(b.id || '');
    const action = String(b.action || '');
    const note = String(b.note || '').slice(0, 300);
    if (!id || ['approve', 'reject', 'delete'].indexOf(action) < 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Bad request' }) };
    }

    const store = getStore({
      name: 'galaxy-gems-reviews',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });

    let reviews = [];
    try {
      const data = await store.get('reviews.json', { type: 'text' });
      if (data) reviews = JSON.parse(data);
    } catch (e) {}

    const idx = reviews.findIndex(function (r) { return r.id === id; });
    if (idx < 0) {
      return { statusCode: 404, headers, body: JSON.stringify({ ok: false, error: 'Review not found' }) };
    }

    if (action === 'delete') {
      reviews.splice(idx, 1);
    } else {
      reviews[idx].status = action === 'approve' ? 'approved' : 'rejected';
      reviews[idx].modNote = note;
      reviews[idx].moderatedAt = new Date().toISOString();
    }

    await store.set('reviews.json', JSON.stringify(reviews));
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('moderate-review error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
