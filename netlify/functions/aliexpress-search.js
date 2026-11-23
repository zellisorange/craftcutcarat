const crypto = require('crypto');

exports.handler = async (event) => {
  const query = event.queryStringParameters?.q;
  if (!query) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing query' }) };
  }

  const appKey = process.env.ALIEXPRESS_APP_KEY;
  const appSecret = process.env.ALIEXPRESS_APP_SECRET;
  const accessToken = process.env.ALIEXPRESS_ACCESS_TOKEN;

  if (!appKey || !appSecret) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API keys not configured' }) };
  }

  const method = 'aliexpress.affiliate.product.query';
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);

  const params = {
    app_key: appKey, method, timestamp, sign_method: 'md5', v: '2.0',
    keywords: query, page_no: '1', page_size: '20',
    target_currency: 'CAD', target_language: 'EN', tracking_id: 'craftcutcarat'
  };

  if (accessToken) params.session = accessToken;

  const sorted = Object.keys(params).sort().map(k => `${k}${params[k]}`).join('');
  const sign = crypto.createHash('md5').update(appSecret + sorted + appSecret).digest('hex').toUpperCase();
  params.sign = sign;

  const qs = new URLSearchParams(params).toString();
  const url = `https://api-sg.aliexpress.com/sync?${qs}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const raw = data?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product || [];
    const products = raw.map(p => ({
      id: p.product_id, title: p.product_title,
      price: p.target_sale_price || p.target_original_price,
      image: p.product_main_image_url, url: p.product_detail_url
    }));
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ products }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
