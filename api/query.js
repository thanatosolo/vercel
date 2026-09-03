const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const idc = (url.searchParams.get('idc') || '').trim();
  const phone = (url.searchParams.get('phone') || '').trim();

  if (!/^\d{4}$/.test(idc) || !/^\d{4}$/.test(phone)) {
    return res.status(400).json({ error: '请输入正确的4位数字' });
  }

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    return res.status(500).json({ error: '数据库未配置' });
  }

  try {
    const sql = neon(DATABASE_URL);
    const staff = await sql`
      SELECT name, total_days, remain_days
      FROM staff_info
      WHERE id_card_last4 = ${idc} AND phone_last4 = ${phone}
      LIMIT 1
    `;

    if (staff.length === 0) {
      return res.status(404).json({ error: '信息不匹配，请核对后重试' });
    }

    const person = staff[0];
    const leaves = await sql`
      SELECT leave_date, days, note
      FROM leave_list
      WHERE name = ${person.name}
      ORDER BY leave_date ASC
    `;

    const usedDays = leaves.reduce((s, l) => s + Number(l.days), 0);
    res.status(200).json({
      name: person.name,
      total_days: Number(person.total_days),
      remain_days: Number(person.remain_days),
      used_days: usedDays,
      leaves: leaves.map(l => ({ leave_date: l.leave_date, days: Number(l.days), note: l.note || '' }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器内部错误' });
  }
};