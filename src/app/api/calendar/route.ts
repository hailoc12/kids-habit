import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import db from '@/lib/db';
import { weekStart, addDays } from '@/lib/dates';
import { getToday } from '@/lib/service';
import { softStreak } from '@/lib/scoring';

/**
 * GET /api/calendar            → view tuần (perDay đầy đủ items)
 * GET /api/calendar?month=YYYY-MM → view tháng (aggregate nhẹ 31 ngày + events + sao/ngày)
 */
export async function GET(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  const month = url.searchParams.get('month');

  if (month) {
    const [y, m] = month.split('-').map(Number);
    const first = `${month}-01`;
    const daysInMonth = new Date(y, m, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
    const last = days[days.length - 1];
    const events = (db.prepare(`SELECT * FROM events WHERE date BETWEEN ? AND ? ORDER BY date`).all(first, last) as any[]);
    const counts = db.prepare(`
      SELECT i.date,
             SUM(CASE WHEN i.status='done' THEN 1 ELSE 0 END) done,
             COUNT(*) total
      FROM daily_instances i WHERE i.date BETWEEN ? AND ? GROUP BY i.date
    `).all(first, last) as any[];
    const stars = db.prepare(`
      SELECT date, SUM(amount) s FROM point_ledger WHERE date BETWEEN ? AND ? GROUP BY date
    `).all(first, last) as any[];
    const selfRatings = db.prepare(`SELECT date FROM self_ratings WHERE date BETWEEN ? AND ?`).all(first, last) as any[];
    const cMap = Object.fromEntries(counts.map((c) => [c.date, c]));
    const sMap = Object.fromEntries(stars.map((s) => [s.date, s.s]));
    const srSet = new Set(selfRatings.map((r: any) => r.date));
    return NextResponse.json({
      month, today, firstDow: new Date(y, m - 1, 1).getDay(), // 0=CN
      days: days.map((d) => ({
        date: d,
        done: cMap[d]?.done || 0,
        total: cMap[d]?.total || 0,
        stars: sMap[d] || 0,
        selfRated: srSet.has(d),
        events: events.filter((e) => e.date === d),
      })),
    });
  }

  // tuần (mặc định — giữ tương thích)
  const date = url.searchParams.get('date') || today;
  const monday = weekStart(date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const events = db.prepare(`SELECT * FROM events WHERE date BETWEEN ? AND ? ORDER BY date`).all(monday, addDays(monday, 6));
  const perDay: Record<string, any[]> = {};
  for (const d of days) perDay[d] = getToday(d);
  const goodDays = (db.prepare(`
    SELECT i.date, SUM(CASE WHEN t.grp='B' AND i.status='done' THEN 1 ELSE 0 END) b
    FROM daily_instances i JOIN task_templates t ON t.id=i.template_id
    GROUP BY i.date HAVING b>=10
  `).all() as any[]).map((r) => r.date);
  return NextResponse.json({ monday, days, events, perDay, streak: softStreak(goodDays, date) });
}
