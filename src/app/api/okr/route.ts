import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { currentChildId } from '@/lib/childscope';
import { nowVN, dateStrVN } from '@/lib/dates';
import { savePhoto } from '@/lib/photos';

/**
 * OKR gia đình (strategy-okr.md) — 5 tầm, lồng nhau, cá nhân/gia đình.
 * Phân quyền theo DÒNG: OKR child_id=NULL (gia đình) chỉ parent sửa;
 * OKR cá nhân con tự CRUD, parent giúp sửa được. KHÔNG sao/thưởng — guardrail.
 */
const HORIZONS = ['month', 'year', '5y', '10y', '20y'];

function isParent(role: string) { return role === 'parent' || role === 'system_admin'; }

function loadOkrs(familyId: number, viewerChildId: number | null, isParentView: boolean) {
  // child: OKR của MÌNH + OKR gia đình (chống so sánh anh em); parent: tất cả
  const rows = db.prepare(`
    SELECT o.*, u.name owner_name, u.avatar owner_avatar FROM okrs o
    LEFT JOIN users u ON u.id = o.child_id
    WHERE o.family_id=? AND o.status='active'
      ${isParentView ? '' : 'AND (o.child_id=? OR o.child_id IS NULL)'}
    ORDER BY o.id DESC`).all(...(isParentView ? [familyId] : [familyId, viewerChildId])) as any[];
  const krs = db.prepare(`
    SELECT k.*, (SELECT COUNT(*) c FROM okr_updates up WHERE up.kr_id=k.id) n_updates
    FROM okr_krs k JOIN okrs o ON o.id=k.okr_id WHERE o.family_id=? ORDER BY k.sort, k.id`).all(familyId) as any[];
  const updatesRaw = db.prepare(`
    SELECT up.*, u.name created_by_name FROM okr_updates up
    JOIN okr_krs k ON k.id=up.kr_id JOIN okrs o ON o.id=k.okr_id
    LEFT JOIN users u ON u.id=up.created_by
    WHERE o.family_id=? ORDER BY up.id DESC LIMIT 300`).all(familyId) as any[];
  const updates = updatesRaw.map((u) => ({ ...u, photoUrl: u.photo_path ? `/api/photo?p=${encodeURIComponent(u.photo_path)}` : null }));
  const krByOkr = new Map<number, any[]>();
  for (const k of krs) {
    if (!krByOkr.has(k.okr_id)) krByOkr.set(k.okr_id, []);
    krByOkr.get(k.okr_id)!.push({ ...k, updates: updates.filter((u) => u.kr_id === k.id).slice(0, 8) });
  }
  return rows.map((o) => ({ ...o, krs: krByOkr.get(o.id) || [] }));
}

/** OKR thuộc family mình + quyền sửa: parent mọi dòng, child chỉ OKR của mình */
function editableOkr(me: any, okrId: number) {
  const o = db.prepare(`SELECT * FROM okrs WHERE id=?`).get(okrId) as any;
  if (!o || o.family_id !== me.familyId) return null;
  if (!isParent(me.role) && o.child_id !== me.id) return null;
  return o;
}

/** chặn cycle: đi ngược tổ tiên không được gặp chính mình */
function makesCycle(okrId: number, parentId: number): boolean {
  let cur: number | null = parentId;
  for (let i = 0; i < 20 && cur; i++) {
    if (cur === okrId) return true;
    cur = (db.prepare(`SELECT parent_id FROM okrs WHERE id=?`).get(cur) as any)?.parent_id ?? null;
  }
  return false;
}

export async function GET() {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const okrs = loadOkrs(me.familyId ?? -1, currentChildId(me), isParent(me.role));
  return NextResponse.json({ okrs, isParent: isParent(me.role), myChildId: me.role === 'child' ? me.id : currentChildId(me) });
}

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { action } = body;
  const now = nowVN().toISOString();
  const fam = me.familyId;

  if (action === 'create-okr') {
    const { horizon, title, icon, strategy, parentId, scope, krs } = body;
    if (!HORIZONS.includes(horizon)) return NextResponse.json({ error: 'tầm không hợp lệ' }, { status: 400 });
    if (!String(title || '').trim()) return NextResponse.json({ error: 'thiếu tên mục tiêu' }, { status: 400 });
    // scope: 'family' (parent only) | 'child' (con hiện tại — child tự đặt, hoặc parent đặt hộ)
    const childId = scope === 'family' ? null : (me.role === 'child' ? me.id : currentChildId(me));
    if (scope === 'family' && !isParent(me.role)) return NextResponse.json({ error: 'chỉ bố mẹ đặt OKR gia đình' }, { status: 403 });
    if (parentId) {
      const p = db.prepare(`SELECT * FROM okrs WHERE id=?`).get(parentId) as any;
      if (!p || p.family_id !== fam) return NextResponse.json({ error: 'OKR cha không hợp lệ' }, { status: 400 });
      if (makesCycle(-1, parentId)) return NextResponse.json({ error: 'vòng lặp' }, { status: 400 });
    }
    const info = db.prepare(`INSERT INTO okrs (family_id, child_id, horizon, parent_id, title, icon, strategy, created_by, created_at)
      VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(fam, childId, horizon, parentId || null, String(title).slice(0, 120), String(icon || '🧭').slice(0, 4),
        String(strategy || '').slice(0, 2000), me.id, now);
    const okrId = Number(info.lastInsertRowid);
    for (const [i, k] of (Array.isArray(krs) ? krs : []).entries()) {
      if (!k?.title || !Number.isFinite(Number(k.target))) continue;
      db.prepare(`INSERT INTO okr_krs (okr_id, title, unit, start_value, target_value, current_value, sort) VALUES (?,?,?,?,?,?,?)`)
        .run(okrId, String(k.title).slice(0, 120), String(k.unit || '').slice(0, 20),
          Number(k.start) || 0, Number(k.target), Number(k.start) || 0, i);
    }
    return NextResponse.json({ ok: true, id: okrId });
  }

  if (action === 'update-okr') {
    const { id, title, icon, strategy, parentId, status } = body;
    const o = editableOkr(me, id);
    if (!o) return NextResponse.json({ error: 'không sửa được OKR này' }, { status: 403 });
    if (parentId && makesCycle(id, parentId)) return NextResponse.json({ error: 'vòng lặp' }, { status: 400 });
    db.prepare(`UPDATE okrs SET title=COALESCE(?,title), icon=COALESCE(?,icon), strategy=COALESCE(?,strategy),
      parent_id=?, status=COALESCE(?,status) WHERE id=?`)
      .run(title ? String(title).slice(0, 120) : null, icon ? String(icon).slice(0, 4) : null,
        strategy !== undefined ? String(strategy).slice(0, 2000) : null, parentId || null, status || null, id);
    return NextResponse.json({ ok: true });
  }

  if (action === 'delete-okr') {
    const { id } = body;
    const o = editableOkr(me, id);
    if (!o) return NextResponse.json({ error: 'không xóa được OKR này' }, { status: 403 });
    const nChild = (db.prepare(`SELECT COUNT(*) c FROM okrs WHERE parent_id=?`).get(id) as any).c;
    if (nChild > 0) return NextResponse.json({ error: 'OKR này đang chứa OKR nhỏ hơn — gắn lại chúng trước đã' }, { status: 400 });
    db.prepare(`UPDATE okrs SET status='archived' WHERE id=?`).run(id); // soft-delete giữ album hành trình
    return NextResponse.json({ ok: true });
  }

  if (action === 'add-kr') {
    const { okrId, title, unit, target } = body;
    const o = editableOkr(me, okrId);
    if (!o) return NextResponse.json({ error: 'không sửa được OKR này' }, { status: 403 });
    if (!title || !Number.isFinite(Number(target))) return NextResponse.json({ error: 'thiếu tên hoặc mục tiêu KR' }, { status: 400 });
    db.prepare(`INSERT INTO okr_krs (okr_id, title, unit, target_value) VALUES (?,?,?,?)`)
      .run(okrId, String(title).slice(0, 120), String(unit || '').slice(0, 20), Number(target));
    return NextResponse.json({ ok: true });
  }

  if (action === 'delete-kr') {
    const { krId } = body;
    const kr = db.prepare(`SELECT k.* FROM okr_krs k JOIN okrs o ON o.id=k.okr_id WHERE k.id=?`).get(krId) as any;
    if (!kr) return NextResponse.json({ error: 'không tìm thấy KR' }, { status: 404 });
    const o = editableOkr(me, kr.okr_id);
    if (!o) return NextResponse.json({ error: 'không sửa được' }, { status: 403 });
    db.prepare(`DELETE FROM okr_krs WHERE id=?`).run(krId);
    return NextResponse.json({ ok: true });
  }

  if (action === 'update') {
    // Update KR: chỉ số mới + ảnh làm bằng chứng (append-only — album hành trình)
    const { krId, value, photo, note } = body;
    const kr = db.prepare(`SELECT k.*, o.family_id, o.child_id FROM okr_krs k JOIN okrs o ON o.id=k.okr_id WHERE k.id=?`).get(krId) as any;
    if (!kr || kr.family_id !== fam) return NextResponse.json({ error: 'không tìm thấy KR' }, { status: 404 });
    if (!isParent(me.role) && kr.child_id !== me.id) return NextResponse.json({ error: 'không cập nhật được KR này' }, { status: 403 });
    const v = Number(value);
    if (!Number.isFinite(v)) return NextResponse.json({ error: 'nhập số mới nhé' }, { status: 400 });
    const photoPath = photo ? savePhoto(dateStrVN(), String(photo), 'okr') : null;
    db.prepare(`INSERT INTO okr_updates (kr_id, value, photo_path, note, created_by, created_at) VALUES (?,?,?,?,?,?)`)
      .run(krId, v, photoPath, String(note || '').slice(0, 200), me.id, now);
    db.prepare(`UPDATE okr_krs SET current_value=? WHERE id=?`).run(v, krId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
