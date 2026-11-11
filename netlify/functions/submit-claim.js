const { getStore } = require('@netlify/blobs');

const json = (code, obj) => ({
  statusCode: code,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(obj)
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
  try {
    const b = JSON.parse(event.body || '{}');
    const email = String(b.userEmail || '').trim().toLowerCase();
    const product = String(b.product || '').trim().slice(0, 200);
    const description = String(b.description || '').trim().slice(0, 2000);
    const coverage = b.coverage === 'extended' ? 'extended' : 'guarantee';
    if (!email.includes('@') || !product || description.length < 10) {
      return json(400, { error: 'Please choose your stone and describe the problem (at least 10 characters).' });
    }
    const photos = (Array.isArray(b.photos) ? b.photos : [])
      .filter(u => typeof u === 'string' && /^https:\/\//.test(u))
      .slice(0, 3);

    const store = getStore({
      name: 'galaxy-gems-claims',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });
    const claims = (await store.get('claims.json', { type: 'json' })) || [];
    const isOpen = c => c.userEmail === email && !['closed', 'denied'].includes(c.status);

    if (claims.some(c => isOpen(c) && c.warrantyId === String(b.warrantyId || ''))) {
      return json(409, { error: 'You already have an open claim for this stone.' });
    }
    if (claims.filter(isOpen).length >= 5) {
      return json(429, { error: 'You have 5 open claims already. Please wait for some to be resolved.' });
    }

    const now = Date.now();
    const claim = {
      id: 'cl_' + now + '_' + Math.random().toString(36).slice(2, 7),
      warrantyId: String(b.warrantyId || '').slice(0, 100),
      product,
      orderNo: String(b.orderNo || '').slice(0, 100),
      coverage,
      userEmail: email,
      userName: String(b.userName || '').slice(0, 100),
      description,
      photos,
      status: 'open',
      note: '',
      history: [{ status: 'open', at: now }],
      createdAt: now
    };
    claims.push(claim);
    await store.setJSON('claims.json', claims);
    return json(200, { ok: true, id: claim.id });
  } catch (err) {
    return json(500, { error: err.message });
  }
};
