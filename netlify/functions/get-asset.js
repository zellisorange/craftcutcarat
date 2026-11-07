const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const key = event.queryStringParameters && event.queryStringParameters.key;
  if (!key) return { statusCode: 400, body: 'Missing key' };

  try {
    const store = getStore({
      name: 'galaxy-gems-products',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });

    const result = await store.getWithMetadata(key, { type: 'arrayBuffer' });
    if (!result || !result.data) return { statusCode: 404, body: 'Not found' };

    const contentType = (result.metadata && result.metadata.contentType) || (key.indexOf('video') >= 0 ? 'video/mp4' : 'image/jpeg');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400'
      },
      body: Buffer.from(result.data).toString('base64'),
      isBase64Encoded: true
    };
  } catch (err) {
    return { statusCode: 500, body: err.message };
  }
};
