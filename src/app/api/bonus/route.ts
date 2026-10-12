import { NextResponse } from 'next/server';
import db, { runInTransaction } from '@/lib/db';
import { nowVN, dateStrVN } from '@/lib/dates';
import { currentUser, requireRole } from '@/lib/auth';
import { currentChildId } from '@/lib/childscope';

/**
 * 🎁 Bố mẹ thưởng sao cuối ngày — đánh giá hiệu quả thực hiện + lời chúc.
 * 1 thưởng/ngày (chỉnh lại ghi đè nếu con chưa xem).
 * GET  → thưởng hôm nay + 5 ngày gần nhất (parent xem; child để banner)
 * POST {action:'give', date?, stars, message}   — parent
 * POST {action:'seen', id}                      — child (đánh dấu đã xem banner)
 */
export async function GET(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const today = dateStrVN();
  const childId = currentChildId(me);
  const history = childId
    ? db.prepare(`SELECT * FROM parent_bonuses WHERE child_id=? ORDER BY date DESC LIMIT 6`).all(childId)
    : db.prepare(`SELECT * FROM parent_bonuses WHERE child_id IS NULL ORDER BY date DESC LIMIT 6`).all();
  return NextResponse.json({ today, todayBonus: history.find((b: any) => b.date === today) || null, history });
}

export async function POST(req: Request) {
  const { action, date, stars, message, id } = await req.json().catch(() => ({}));

  if (action === 'seen') {
    const me2 = await currentUser();
    if (!me2) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    db.prepare(`UPDATE parent_bonuses SET seen_at=COALESCE(seen_at, ?) WHERE id=?`).run(nowVN().toISOString(), id);
    return NextResponse.json({ ok: true });
  }

  const role = await requireRole('parent');
  if (!role) return NextResponse.json({ error: 'parent only' }, { status: 403 });
  const d = date || dateStrVN();
  const s = Number(stars);
  if (!Number.isFinite(s) || s < 1 || s > 50) return NextResponse.json({ error: 'Sao thưởng 1–50 nhé' }, { status: 400 });
  const msg = String(message || '').slice(0, 300);
  if (!msg.trim()) return NextResponse.json({ error: 'Thêm lời chúc cho con nhé (mô tả điều con làm được)' }, { status: 400 });
  // guardrail: lời chúc theo chuẩn mô tả — không đánh giá (bỏ dấu trước khi so để không lọt biến thể)
  const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase();
  const banned = ['gioi qua', 'ngoan qua', 'xuat sac', 'con gioi', 'that tuyet', 'gioi that'].filter((p) => strip(msg).includes(p));
  if (banned.length) return NextResponse.json({ error: `Tránh khen đánh giá kiểu "${banned[0]}" — hãy mô tả điều con làm được (vd: "Con tự tắm và tự sắp cặp cả tuần")` }, { status: 400 });

  const now = nowVN().toISOString();
  const existing = db.prepare(`SELECT id, seen_at FROM parent_bonuses WHERE date=?`).get(d) as any;
  if (existing && existing.seen_at) {
    return NextResponse.json({ error: 'Con đã xem lời chúc hôm nay rồi — để mai thưởng tiếp nhé!' }, { status: 400 });
  }
  runInTransaction(() => {
    if (existing) {
      // con CHƯA xem → cho sửa gói/lời; đồng bộ lại ledger cho khớp số sao
      db.prepare(`UPDATE parent_bonuses SET stars=?, message=?, giver=?, created_at=? WHERE id=?`).run(s, msg, role.name, now, existing.id);
      db.prepare(`UPDATE point_ledger SET amount=?, note=?, created_at=? WHERE ref_type='parent_bonus' AND ref_id=?`)
        .run(s, `bố mẹ thưởng: ${msg.slice(0, 60)}`, now, existing.id);
    } else {
      const info = db.prepare(`INSERT INTO parent_bonuses (date, stars, message, giver, created_at, child_id) VALUES (?,?,?,?,?,?)`)
        .run(d, s, msg, role.name, now, currentChildId(role));
      db.prepare(`INSERT INTO point_ledger (date, type, amount, ref_type, ref_id, note, created_at) VALUES (?,?,?,?,?,?,?)`)
        .run(d, 'bonus', s, 'parent_bonus', Number(info.lastInsertRowid), `bố mẹ thưởng: ${msg.slice(0, 60)}`, now);
    }
  });
  return NextResponse.json({ ok: true });
}
