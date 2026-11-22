const https = require('https');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.printful.com',
      path: '/store/products',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.PRINTFUL_API_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ statusCode: 200, headers, body: JSON.stringify(json.result || []) });
        } catch(e) {
          resolve({ statusCode: 500, headers, body: JSON.stringify({ error: 'Parse error' }) });
        }
      });
    });

    req.on('error', (e) => {
      resolve({ statusCode: 500, headers, body: JSON.stringify({ error: e.message }) });
    });

    req.end();
  });
};
