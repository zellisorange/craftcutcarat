const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    const body = JSON.parse(event.body);
    const { product, imageData, videoData } = body;

    const store = getStore({
      name: 'galaxy-gems-products',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });

    if (imageData && imageData.indexOf('data:') === 0) {
      const matches = imageData.match(/^data:(.+);base64,(.+)$/);
      if (matches) {
        const mimeType = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        const ext = mimeType.split('/')[1] || 'jpg';
        const imgKey = 'images/' + product.id + '.' + ext;
        await store.set(imgKey, buffer, { metadata: { contentType: mimeType } });
        product.img = '/.netlify/functions/get-asset?key=' + encodeURIComponent(imgKey);
      }
    }

    if (videoData && videoData.indexOf('data:') === 0) {
      const matches = videoData.match(/^data:(.+);base64,(.+)$/);
      if (matches) {
        const mimeType = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        const ext = mimeType.split('/')[1] || 'mp4';
        const vidKey = 'videos/' + product.id + '.' + ext;
        await store.set(vidKey, buffer, { metadata: { contentType: mimeType } });
        product.video = '/.netlify/functions/get-asset?key=' + encodeURIComponent(vidKey);
      }
    }

    let products = [];
    try {
      const existing = await store.get('products.json', { type: 'text' });
      if (existing) products = JSON.parse(existing);
    } catch(e) {}

    const idx = products.findIndex(function(p){ return p.id === product.id; });
    if (idx >= 0) {
      products[idx] = product;
    } else {
      products.push(product);
    }

    await store.set('products.json', JSON.stringify(products));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, product: product })
    };
  } catch (err) {
    console.error('save-product error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};
