import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { currentChildId } from '@/lib/childscope';
import { getDayForReview } from '@/lib/service';
import db from '@/lib/db';

export async function GET(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  // review = dữ liệu duyệt của BỐ MẸ — child/lech family không được đọc (UAT 05/10 bắt được lỗ hổng)
  if (me.role !== 'parent' && me.role !== 'system_admin') {
    return NextResponse.json({ error: 'parent only' }, { status: 403 });
  }
  const date = new URL(req.url).searchParams.get('date');
  const childId = currentChildId(me);
  const day = getDayForReview(date || new Date().toISOString().slice(0, 10), childId);
  // 14 ngày gần nhất: ngày nào CHƯA duyệt (để bố quay lại duyệt bù quá khứ)
  const pendingDates = childId
    ? db.prepare(`
        WITH RECURSIVE d(x) AS (SELECT date('now','localtime','-13 days') UNION ALL SELECT date(x,'+1 day') FROM d WHERE x < date('now','localtime'))
        SELECT x date FROM d
        WHERE EXISTS (SELECT 1 FROM daily_instances i WHERE i.date = x AND i.child_id = ?1 AND i.status = 'done')
          AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.date = x AND r.child_id = ?1 AND r.status = 'accepted')
        ORDER BY x DESC`).all(childId) as any[]
    : [];
  return NextResponse.json({ ...day, pendingDates });
}
