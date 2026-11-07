const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache'
  };

  try {
    const store = getStore({
      name: 'galaxy-gems-products',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });

    let products = [];
    try {
      const data = await store.get('products.json', { type: 'text' });
      if (data) products = JSON.parse(data);
    } catch(e) {}

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(products)
    };
  } catch (err) {
    console.error('get-products error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify([])
    };
  }
};
