import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { currentChildId } from '@/lib/childscope';
import { classesOnDate, conflictMode } from '@/lib/service';
import { dateStrVN } from '@/lib/dates';
import { setSetting } from '@/lib/settings';

/** GET /api/classes → lớp theo tuần + lớp HÔM NAY của con + chế độ xung đột */
export async function GET() {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const childId = currentChildId(me);
  const all = db.prepare(`SELECT * FROM classes WHERE family_id=? AND active=1 ORDER BY weekday, start_hhmm`).all(me.familyId ?? -1) as any[];
  return NextResponse.json({
    classes: all,
    today: classesOnDate(dateStrVN(), childId),
    mode: conflictMode(),
    isParent: me.role === 'parent' || me.role === 'system_admin',
  });
}

/** POST /api/classes — CRUD parent-only + set-mode */
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (me.role !== 'parent' && me.role !== 'system_admin') {
    return NextResponse.json({ error: 'chỉ bố mẹ quản lý lớp học' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const { action } = body;

  if (action === 'set-mode') {
    if (!['auto_shift', 'parallel'].includes(body.mode)) return NextResponse.json({ error: 'chế độ không hợp lệ' }, { status: 400 });
    setSetting('class_conflict_mode', body.mode);
    return NextResponse.json({ ok: true });
  }
  if (action === 'create') {
    const { title, icon, weekday, start, end, startsOn, endsOn, childId } = body;
    if (!title || ![2, 3, 4, 5, 6, 7, 8].includes(Number(weekday))) return NextResponse.json({ error: 'thiếu tên hoặc thứ không hợp lệ' }, { status: 400 });
    if (!/^\d{2}:\d{2}$/.test(String(start || '')) || !/^\d{2}:\d{2}$/.test(String(end || ''))) return NextResponse.json({ error: 'giờ dạng HH:MM' }, { status: 400 });
    if (start >= end) return NextResponse.json({ error: 'giờ kết thúc phải sau giờ bắt đầu' }, { status: 400 });
    db.prepare(`INSERT INTO classes (family_id, child_id, title, icon, weekday, start_hhmm, end_hhmm, starts_on, ends_on) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(me.familyId, childId ?? null, String(title).slice(0, 60), String(icon || '🎓').slice(0, 4),
        Number(weekday), String(start), String(end), startsOn || null, endsOn || null);
    return NextResponse.json({ ok: true });
  }
  if (action === 'update') {
    const c = db.prepare(`SELECT * FROM classes WHERE id=?`).get(body.id) as any;
    if (!c || c.family_id !== me.familyId) return NextResponse.json({ error: 'không tìm thấy lớp' }, { status: 404 });
    db.prepare(`UPDATE classes SET title=?, icon=?, weekday=?, start_hhmm=?, end_hhmm=?, starts_on=?, ends_on=?, active=? WHERE id=?`)
      .run(String(body.title ?? c.title).slice(0, 60), String(body.icon ?? c.icon).slice(0, 4),
        Number(body.weekday ?? c.weekday), String(body.start ?? c.start_hhmm), String(body.end ?? c.end_hhmm),
        body.startsOn ?? c.starts_on, body.endsOn ?? c.ends_on, body.active ?? c.active, body.id);
    return NextResponse.json({ ok: true });
  }
  if (action === 'delete') {
    const c = db.prepare(`SELECT * FROM classes WHERE id=?`).get(body.id) as any;
    if (!c || c.family_id !== me.familyId) return NextResponse.json({ error: 'không tìm thấy lớp' }, { status: 404 });
    db.prepare(`DELETE FROM classes WHERE id=?`).run(body.id);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
