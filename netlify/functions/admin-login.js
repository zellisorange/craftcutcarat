const crypto = require('crypto');

function same(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false }) };
  }
  let email = '', password = '';
  try {
    const b = JSON.parse(event.body || '{}');
    email = String(b.email || '').trim().toLowerCase();
    password = String(b.password || '');
  } catch (e) {}

  const realEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const realPass = process.env.ADMIN_PASSWORD;
  const token = process.env.REVIEW_ADMIN_TOKEN;

  if (!realEmail || !realPass || !token || !same(email, realEmail) || !same(password, realPass)) {
    await new Promise(r => setTimeout(r, 1500));
    return { statusCode: 401, headers, body: JSON.stringify({ ok: false }) };
  }
  return { statusCode: 200, headers, body: JSON.stringify({ ok: true, token }) };
};
