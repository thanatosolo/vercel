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
      const name = (new URL(req.url, 'http://localhost')).searchParams.get('name') || '';
      if (!name) return res.status(400).json({ error: '缺少姓名' });
      const rows = await sql`
        SELECT id, name, leave_date, days, note FROM leave_list
        WHERE name = ${name} ORDER BY leave_date DESC
      `;
      return res.status(200).json({ leaves: rows.map(r => ({
        id: r.id, name: r.name, leave_date: r.leave_date, days: Number(r.days), note: r.note || ''
      })) });
    }
    if (req.method === 'POST') {
      const body = parseBody(req);
      if (body.action === 'delete') {
        if (!body.id) return res.status(400).json({ error: '参数缺失' });
        await sql`DELETE FROM leave_list WHERE id = ${Number(body.id)}`;
        return res.status(200).json({ ok: true });
      }
      if (!body.name || !body.date || body.days == null) return res.status(400).json({ error: '参数缺失' });
      await sql`INSERT INTO leave_list (name, days, leave_date, note) VALUES (${body.name}, ${Number(body.days)}, ${body.date}, ${body.note || ''})`;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: '服务器错误' });
  }
};