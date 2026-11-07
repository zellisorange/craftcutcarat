const https = require('https');
const crypto = require('crypto');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

  try {
    const { fileData, fileName, resourceType } = JSON.parse(event.body);
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = 'craftcutcarat';

    const sigStr = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(sigStr).digest('hex');

    const base64Data = fileData.replace(/^data:[^;]+;base64,/, '');
    const boundary = '----FormBoundary' + Date.now();

    const lines = [];
    lines.push('--' + boundary);
    lines.push('Content-Disposition: form-data; name="file"');
    lines.push('');
    lines.push('data:' + (resourceType==='video'?'video/mp4':'image/jpeg') + ';base64,' + base64Data);
    lines.push('--' + boundary);
    lines.push('Content-Disposition: form-data; name="api_key"');
    lines.push(''); lines.push(apiKey);
    lines.push('--' + boundary);
    lines.push('Content-Disposition: form-data; name="timestamp"');
    lines.push(''); lines.push(String(timestamp));
    lines.push('--' + boundary);
    lines.push('Content-Disposition: form-data; name="signature"');
    lines.push(''); lines.push(signature);
    lines.push('--' + boundary);
    lines.push('Content-Disposition: form-data; name="folder"');
    lines.push(''); lines.push(folder);
    lines.push('--' + boundary + '--');

    const body = lines.join('\r\n');
    const type = resourceType === 'video' ? 'video' : 'image';
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/${type}/upload`;

    const result = await new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const req = https.request({
        hostname: urlObj.hostname,
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data; boundary=' + boundary,
          'Content-Length': Buffer.byteLength(body)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });

    if (result.secure_url) {
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, url: result.secure_url }) };
    } else {
      return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: result.error?.message || 'Upload failed' }) };
    }
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
