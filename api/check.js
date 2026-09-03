const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const idc = (url.searchParams.get('idc') || '').trim();

  if (!/^\d{4}$/.test(idc)) {
    return res.status(400).json({ error: '请输入正确的4位数字' });
  }

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    return res.status(500).json({ error: '数据库未配置' });
  }

  try {
    const sql = neon(DATABASE_URL);
    const staff = await sql`
      SELECT name FROM staff_info
      WHERE id_card_last4 = ${idc}
      LIMIT 1
    `;
    res.status(200).json({ found: staff.length > 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器内部错误' });
  }
};