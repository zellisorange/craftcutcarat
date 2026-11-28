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
  const method = 'aliexpress.ds.text.search';
  const timestamp = String(Date.now());
  const params = {
    app_key: appKey,
    method,
    timestamp,
    sign_method: 'sha256',
    v: '2.0',
    product_title: query,
    page_index: '1',
    page_size: '20',
    target_currency: 'CAD',
    target_language: 'EN',
    sort: 'SALE_PRICE_ASC', country_code: 'CA',
    country_code: 'CA'
  };
  if (accessToken) params.session = accessToken;
  const sortedKeys = Object.keys(params).sort();
  const signStr = sortedKeys.map(k => `${k}${params[k]}`).join('');
  const sign = crypto.createHmac('sha256', appSecret).update(signStr, 'utf8').digest('hex').toUpperCase();
  params.sign = sign;
  const body = new URLSearchParams(params).toString();
  const url = 'https://api-sg.aliexpress.com/sync';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body
    });
    const data = await res.json();
    const raw = data?.aliexpress_ds_text_search_response?.result?.products ||
                data?.aliexpress_ds_product_search_response?.data?.products || [];
    const products = raw.map(p => ({
      id: p.product_id,
      title: p.product_title,
      price: p.target_sale_price || p.sale_price,
      image: p.product_main_image_url,
      url: p.product_detail_url,
      orders: p.lastest_volume || 0
    }));
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products, _debug: data })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
