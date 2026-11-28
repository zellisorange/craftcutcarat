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
    app_key: appKey, method, timestamp,
    sign_method: 'sha256', v: '2.0',
    keyWord: query,
    local: 'en_US', currency: 'CAD', countryCode: 'CA',
    page_index: '1', page_size: '20',
    target_currency: 'CAD', target_language: 'EN',
    sort: 'SALE_PRICE_ASC'
  };
  if (accessToken) params.session = accessToken;
  const sortedKeys = Object.keys(params).sort();
  const signStr = sortedKeys.map(k => `${k}${params[k]}`).join('');
  const sign = crypto.createHmac('sha256', appSecret).update(signStr, 'utf8').digest('hex').toUpperCase();
  params.sign = sign;
  const body = new URLSearchParams(params).toString();
  try {
    const res = await fetch('https://api-sg.aliexpress.com/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body
    });
    const data = await res.json();
    const raw = data?.aliexpress_ds_text_search_response?.data?.products?.selection_search_product || [];
    const products = Array.isArray(raw) ? raw.map(p => ({
      id: p.itemId,
      title: p.title,
      price: p.targetSalePrice,
      image: p.itemMainPic,
      url: 'https:' + p.itemUrl,
      orders: p.orders || 0,
      rating: p.evaluateRate || '',
      discount: p.discount || ''
    })) : [];
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ products }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
