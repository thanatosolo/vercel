const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');

function sign(secret, hour) {
  return crypto.createHmac('sha256', secret).update(String(hour)).digest('hex');
}
function ok(req) {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) return false;
  const token = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
  const hour = Math.floor(Date.now() / 3600000);
  return token === sign(secret, hour) || token === sign(secret, hour - 1);
}
function parseBody(req) {
  const raw = req.body;
  if (raw == null) return {};
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch (e) { return {}; } }
  if (Buffer.isBuffer(raw)) { try { return JSON.parse(raw.toString('utf8')); } catch (e) { return {}; } }
  if (typeof raw === 'object') return raw;
  return {};
}

module.exports = async function handler(req, res) {
  if (!ok(req)) return res.status(401).json({ error: '未授权' });
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) return res.status(500).json({ error: '数据库未配置' });
  try {
    const sql = neon(DATABASE_URL);
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT s.id, s.name, s.total_days,
          COALESCE((SELECT SUM(l.days)::float FROM leave_list l WHERE l.name = s.name), 0) AS used
        FROM staff_info s ORDER BY s.id
      `;
      return res.status(200).json({ staff: rows.map(r => ({
        id: r.id, name: r.name,
        total_days: Number(r.total_days),
        used_days: Number(Number(r.used).toFixed(2)),
        remain_days: Number((Number(r.total_days) - Number(r.used)).toFixed(2))
      })) });
    }
    if (req.method === 'POST') {
      const body = parseBody(req);
      if (body.action === 'total') {
        if (!body.name || body.total_days == null) return res.status(400).json({ error: '参数缺失' });
        await sql`UPDATE staff_info SET total_days = ${Number(body.total_days)} WHERE name = ${body.name}`;
        return res.status(200).json({ ok: true });
      }
      if (!body.name || body.total_days == null) return res.status(400).json({ error: '参数缺失' });
      await sql`INSERT INTO staff_info (name, total_days) VALUES (${body.name}, ${Number(body.total_days)})`;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: '服务器错误' });
  }
};