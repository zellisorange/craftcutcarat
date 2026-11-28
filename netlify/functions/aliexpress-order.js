const crypto = require('crypto');

function signRequest(params, secret) {
  const sorted = Object.keys(params).sort().map(k => `${k}${params[k]}`).join('');
  return crypto.createHmac('sha256', secret).update(sorted).digest('hex').toUpperCase();
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  try {
    const { customerName, addressLine1, city, province, country, zip, phone, productId, quantity } = JSON.parse(event.body);

    const appKey    = process.env.ALIEXPRESS_APP_KEY;
    const appSecret = process.env.ALIEXPRESS_APP_SECRET;
    const token     = process.env.ALIEXPRESS_ACCESS_TOKEN;

    if (!appKey || !appSecret || !token) {
      return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: 'Missing AliExpress credentials' }) };
    }

    const timestamp = new Date().toISOString().replace('T',' ').slice(0,19);
    const method = 'aliexpress.ds.order.create';

    const orderInfo = JSON.stringify({
      logistics_address: {
        full_name: customerName,
        address: addressLine1,
        city,
        province,
        country,
        zip,
        phone_country: '+1',
        mobile_no: phone
      },
      product_items: [{
        product_id: productId,
        product_count: quantity || 1,
        sku_attr: '',
        logistics_service_name: 'CAINIAO_STANDARD'
      }]
    });

    const params = {
      app_key: appKey,
      session: token,
      timestamp,
      format: 'json',
      v: '2.0',
      sign_method: 'sha256',
      method,
      param_place_order_request4_open_api_d_t_o: orderInfo
    };

    params.sign = signRequest(params, appSecret);

    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`https://api-sg.aliexpress.com/sync?${qs}`);
    const data = await res.json();

    console.log('AliExpress response:', JSON.stringify(data));
    const result = data?.aliexpress_ds_order_create_response?.result;
    if (result?.is_success) {
      console.log('Order success:', result.order_id);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, orderId: result.order_id }) };
    } else {
      console.log('Order failed:', result?.error_msg, result?.error_code);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: false, error: result?.error_msg || 'Order failed', data }) };
    }

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
