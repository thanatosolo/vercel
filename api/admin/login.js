const crypto = require('crypto');

function sign(secret, hour) {
  return crypto.createHmac('sha256', secret).update(String(hour)).digest('hex');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  try {
    const body = JSON.parse(req.body || '{}');
    const u = process.env.ADMIN_USERNAME || '';
    const p = process.env.ADMIN_PASSWORD || '';
    if (body.username === u && body.password === p) {
      const hour = Math.floor(Date.now() / 3600000);
      return res.status(200).json({ ok: true, token: sign(p, hour) });
    }
    return res.status(401).json({ error: '用户名或密码错误' });
  } catch (e) {
    return res.status(500).json({ error: '服务器错误' });
  }
};