const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
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
    const b = JSON.parse(event.body || '{}');
    const productName = String(b.productName || '').trim().slice(0, 120);
    const userEmail = String(b.userEmail || '').trim().toLowerCase().slice(0, 120);
    const userName = String(b.userName || '').trim().slice(0, 60) || 'Customer';
    const rating = parseInt(b.rating, 10);
    const title = String(b.title || '').trim().slice(0, 100);
    const text = String(b.text || '').trim().slice(0, 2000);
    const photos = (Array.isArray(b.photos) ? b.photos : [])
      .filter(function (u) { return typeof u === 'string' && /^https:\/\//.test(u); })
      .slice(0, 3);

    if (!productName || !userEmail) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Missing product or account' }) };
    }
    if (!(rating >= 1 && rating <= 5)) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Please choose a star rating' }) };
    }
    if (!text) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Please write a few words' }) };
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

    const already = reviews.some(function (r) {
      return r.userEmail === userEmail && r.productName === productName && r.status !== 'rejected';
    });
    if (already) {
      return { statusCode: 409, headers, body: JSON.stringify({ ok: false, error: 'You have already reviewed this item' }) };
    }

    const pendingCount = reviews.filter(function (r) {
      return r.userEmail === userEmail && r.status === 'pending';
    }).length;
    if (pendingCount >= 5) {
      return { statusCode: 429, headers, body: JSON.stringify({ ok: false, error: 'You have 5 reviews waiting for approval. Please wait for those first.' }) };
    }

    const review = {
      id: 'rv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      productName: productName,
      userEmail: userEmail,
      userName: userName,
      rating: rating,
      title: title,
      text: text,
      photos: photos,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    reviews.push(review);
    await store.set('reviews.json', JSON.stringify(reviews));

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, review: review }) };
  } catch (err) {
    console.error('submit-review error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
