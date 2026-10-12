import { NextResponse } from 'next/server';
import db, { runInTransaction } from '@/lib/db';
import { nowVN, dateStrVN } from '@/lib/dates';
import { currentUser } from '@/lib/auth';
import { currentChildId } from '@/lib/childscope';
import { balance } from '@/lib/service';

/**
 * Mua gói vé YouTube bằng sao (15'/30' — giá do bố mẹ set trong Admin).
 * Vé = pomodoro session kind='ticket': chỉ có pha reward có ĐIỂM KẾT THÚC (guardrail 15.4),
 * hết giờ beep + khóa như pomodoro thường.
 * Trần số vé/ngày: app_settings 'yt_ticket_daily_max' (mặc định 1).
 */
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const childId = currentChildId(me);
  const { itemId } = await req.json().catch(() => ({}));
  const item = db.prepare(`SELECT * FROM shop_items WHERE id=? AND kind='ytticket' AND active=1`).get(itemId) as any;
  if (!item) return NextResponse.json({ error: 'không có gói này' }, { status: 400 });
  const minutes = Number(JSON.parse(item.payload || '{}').minutes || 15);

  const today = dateStrVN();
  const maxRow = db.prepare(`SELECT value FROM app_settings WHERE key='yt_ticket_daily_max'`).get() as any;
  const maxPerDay = Number(maxRow?.value ?? 1) || 1;
  const boughtToday = (db.prepare(`SELECT COUNT(*) c FROM pomodoro_sessions WHERE kind='ticket' AND date=? AND status!='cancelled'`).get(today) as any).c;
  if (boughtToday >= maxPerDay) return NextResponse.json({ error: `Hôm nay con dùng vé rồi — mai mua tiếp nhé! (bố mẹ đặt tối đa ${maxPerDay} vé/ngày)` }, { status: 400 });

  const running = db.prepare(`SELECT id FROM pomodoro_sessions WHERE status='running'`).get();
  if (running) return NextResponse.json({ error: 'Đang có vòng pomodoro/vé chạy — xong vòng này đã!' }, { status: 400 });
  if (balance(childId) < item.price) return NextResponse.json({ error: 'chưa đủ sao — làm nhiệm vụ nhỏ thêm nhé!' }, { status: 400 });

  const now = nowVN();
  const rewardEnds = new Date(now.getTime() + minutes * 60000).toISOString();
  runInTransaction(() => {
    db.prepare(`INSERT INTO point_ledger (date, type, amount, ref_type, ref_id, note, created_at, child_id) VALUES (?,?,?,?,?,?,?,?)`)
      .run(today, 'spend', -item.price, 'ytticket', null, `vé YouTube ${minutes}′`, now.toISOString(), childId);
    db.prepare(
      `INSERT INTO pomodoro_sessions (date, label, work_min, reward_min, started_at, work_ends_at, reward_started_at, reward_ends_at, kind)
       VALUES (?,?,?,?,?,?,?,?,?)`
    ).run(today, `📺 Vé YouTube ${minutes}′`, 0, minutes, now.toISOString(), now.toISOString(), now.toISOString(), rewardEnds, 'ticket');
  });
  return NextResponse.json({ ok: true, minutes });
}
