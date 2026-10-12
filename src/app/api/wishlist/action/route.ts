import { NextResponse } from 'next/server';
import db, { runInTransaction } from '@/lib/db';
import { nowVN } from '@/lib/dates';
import { savePhoto } from '@/lib/photos';
import { balance } from '@/lib/service';
import { requireRole } from '@/lib/auth';
import { currentChildId } from '@/lib/childscope';

/**
 * PATCH semantics qua POST (form đơn giản):
 * { id, action: 'price'|'hide'|'activate', starCost? } — parent
 * { id, action: 'redeem', photo? } — parent confirm trao thưởng
 */
export async function POST(req: Request) {
  const role = await requireRole('parent');
  if (!role) return NextResponse.json({ error: 'parent only' }, { status: 403 });
  const { id, action, starCost, photo } = await req.json();
  const item = db.prepare(`SELECT * FROM wishlist_items WHERE id=?`).get(id) as any;
  if (!item) return NextResponse.json({ error: 'not found' }, { status: 404 });

  if (action === 'price') {
    db.prepare(`UPDATE wishlist_items SET star_cost=?, status='active' WHERE id=?`).run(starCost, id);
    return NextResponse.json({ ok: true });
  }
  if (action === 'hide') { db.prepare(`UPDATE wishlist_items SET status='hidden' WHERE id=?`).run(id); return NextResponse.json({ ok: true }); }
  if (action === 'activate') { db.prepare(`UPDATE wishlist_items SET status='active' WHERE id=?`).run(id); return NextResponse.json({ ok: true }); }
  if (action === 'redeem') {
    if (item.status !== 'active' || !item.star_cost) return NextResponse.json({ error: 'món chưa định giá' }, { status: 400 });
    if (balance(currentChildId(role)) < item.star_cost) return NextResponse.json({ error: 'chưa đủ sao' }, { status: 400 });
    const redemptionPhoto = photo ? savePhoto(nowVN().toISOString().slice(0, 10), photo, 'redeem') : null;
    const tx = () => {
      db.prepare(`UPDATE wishlist_items SET status='redeemed', redeemed_at=?, redemption_photo=? WHERE id=?`)
        .run(nowVN().toISOString(), redemptionPhoto, id);
      db.prepare(`INSERT INTO point_ledger (date, type, amount, ref_type, ref_id, note, created_at, child_id) VALUES (?,?,?,?,?,?,?,?)`)
        .run(nowVN().toISOString().slice(0, 10), 'spend', -item.star_cost, 'redemption', id, `đổi: ${item.title}`, nowVN().toISOString(), currentChildId(role));
    };
    runInTransaction(tx);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
