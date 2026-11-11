const { getStore } = require('@netlify/blobs');

function shortName(name) {
  const parts = String(name || 'Customer').trim().split(/\s+/);
  const first = parts[0] || 'Customer';
  const last = parts[1] ? ' ' + parts[1][0].toUpperCase() + '.' : '';
  return first + last;
}

function publicView(r) {
  return {
    id: r.id,
    productName: r.productName,
    userName: shortName(r.userName),
    rating: r.rating,
    title: r.title,
    text: r.text,
    photos: r.photos || [],
    createdAt: r.createdAt
  };
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-token',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const q = event.queryStringParameters || {};
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

    const newestFirst = function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); };

    // Admin: every review, all statuses (needs secret token)
    if (q.admin) {
      if (!process.env.REVIEW_ADMIN_TOKEN) {
        return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: 'Admin token is not configured on the server' }) };
      }
      if ((event.headers['x-admin-token'] || '') !== process.env.REVIEW_ADMIN_TOKEN) {
        return { statusCode: 401, headers, body: JSON.stringify({ ok: false, error: 'Wrong admin token' }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, reviews: reviews.slice().sort(newestFirst) }) };
    }

    // Star summary for every product (approved only)
    if (q.summary) {
      const sums = {};
      reviews.filter(function (r) { return r.status === 'approved'; }).forEach(function (r) {
        if (!sums[r.productName]) sums[r.productName] = { total: 0, count: 0 };
        sums[r.productName].total += r.rating;
        sums[r.productName].count += 1;
      });
      const out = {};
      Object.keys(sums).forEach(function (k) {
        out[k] = { avg: Math.round((sums[k].total / sums[k].count) * 10) / 10, count: sums[k].count };
      });
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, summary: out }) };
    }

    // A customer's own reviews (every status)
    if (q.email) {
      const email = String(q.email).trim().toLowerCase();
      const mine = reviews.filter(function (r) { return r.userEmail === email; }).sort(newestFirst);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, reviews: mine }) };
    }

    // Public reviews for one product (approved only, no email addresses)
    if (q.product) {
      const list = reviews
        .filter(function (r) { return r.status === 'approved' && r.productName === q.product; })
        .sort(newestFirst)
        .map(publicView);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, reviews: list }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, reviews: [] }) };
  } catch (err) {
    console.error('get-reviews error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
