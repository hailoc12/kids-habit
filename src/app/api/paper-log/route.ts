import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { getToday } from '@/lib/service';
import { dateStrVN, minutesOf } from '@/lib/dates';

/**
 * F14 — Paper mode: bố nhập bù sticker giấy khung 21h sáng hôm sau.
 * { date, entries: [{ templateId, done, onTime }] }
 */
export async function POST(req: Request) {
  const role = await requireRole('parent');
  if (!role) return NextResponse.json({ error: 'parent only' }, { status: 403 });
  const { date, entries } = await req.json();
  if (date > dateStrVN()) return NextResponse.json({ error: 'không nhập tương lai' }, { status: 400 });
  const items = getToday(date);
  const upd = db.prepare(`UPDATE daily_instances SET status='done', checked_at=?, on_time=?, note=? WHERE id=?`);
  const nowIso = new Date().toISOString();
  let n = 0;
  for (const e of entries || []) {
    const item = items.find((i) => i.templateId === e.templateId);
    if (!item || !e.done || item.status !== 'pending') continue;
    upd.run(nowIso, e.onTime ? 1 : 0, 'paper-mode (nhập bù từ sticker giấy)', item.instanceId);
    n++;
  }
  return NextResponse.json({ ok: true, recorded: n });
}
