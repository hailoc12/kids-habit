import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import db from '@/lib/db';
import { weekStart, addDays } from '@/lib/dates';
import { softStreak } from '@/lib/scoring';

// F15 — Báo cáo tuần (HTML render ở client)
export async function GET(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const date = new URL(req.url).searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const monday = weekStart(date);
  const sunday = addDays(monday, 6);
  const ledger = db.prepare(`SELECT * FROM point_ledger WHERE date BETWEEN ? AND ? ORDER BY date, id`).all(monday, sunday);
  const photos = db.prepare(`
    SELECT i.photo_path, i.date, t.title FROM daily_instances i JOIN task_templates t ON t.id=i.template_id
    WHERE i.date BETWEEN ? AND ? AND i.photo_path IS NOT NULL AND i.status='done' ORDER BY i.checked_at DESC LIMIT 30
  `).all(monday, sunday);
  const perTask = db.prepare(`
    SELECT t.title, t.icon, t.grp,
           SUM(CASE WHEN i.status='done' THEN 1 ELSE 0 END) done,
           SUM(CASE WHEN i.status='done' AND i.on_time THEN 1 ELSE 0 END) on_time
    FROM task_templates t LEFT JOIN daily_instances i ON i.template_id=t.id AND i.date BETWEEN ? AND ?
    WHERE t.active=1 GROUP BY t.id ORDER BY t.sort
  `).all(monday, sunday);
  const goodDays = (db.prepare(`
    SELECT i.date, SUM(CASE WHEN t.grp='B' AND i.status='done' THEN 1 ELSE 0 END) b
    FROM daily_instances i JOIN task_templates t ON t.id=i.template_id
    WHERE i.date <= ? GROUP BY i.date HAVING b>=10
  `).all(sunday) as any[]).map((r) => r.date);
  return NextResponse.json({
    monday, sunday,
    stars: (ledger as any[]).reduce((s, r) => s + r.amount, 0),
    ledger,
    photos: (photos as any[]).map((p) => ({ ...p, url: `/api/photo?p=${encodeURIComponent(p.photo_path)}` })),
    perTask,
    streak: softStreak(goodDays, addDays(sunday, 1)),
    graduated: db.prepare(`SELECT title, graduated_at FROM task_templates WHERE graduated_at IS NOT NULL`).all(),
  });
}
