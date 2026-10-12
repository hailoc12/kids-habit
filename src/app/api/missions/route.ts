import { NextResponse } from 'next/server';
import db, { runInTransaction } from '@/lib/db';
import { nowVN, dateStrVN } from '@/lib/dates';
import { requireRole, currentUser } from '@/lib/auth';
import { currentChildId } from '@/lib/childscope';
import { savePhoto } from '@/lib/photos';
import { isValidClaimPhoto } from '@/lib/mission';

/**
 * Nhiệm vụ Extra (đọc sách thêm, dọn đồ chơi, giúp mẹ…) → sao nuôi pet / mua vé YouTube.
 * Con claim PHẢI kèm ảnh bằng chứng → BỐ MẸ xác nhận mới có sao (không tự tuyên bố).
 */
export async function GET() {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const childId = currentChildId(me);
  const today = dateStrVN();
  const missions = db.prepare(`SELECT m.* FROM extra_missions m WHERE m.active=1 AND m.family_id=(SELECT family_id FROM users WHERE id=?) ORDER BY m.id`).all(me.id);
  const claimsToday = (db.prepare(`SELECT c.*, m.title, m.icon, m.stars FROM mission_claims c JOIN extra_missions m ON m.id=c.mission_id WHERE c.date=? AND c.child_id=? ORDER BY c.id`).all(today, childId) as any[])
    .map((c) => ({ ...c, photoUrl: c.photo ? `/api/photo?p=${encodeURIComponent(c.photo)}` : null }));
  const pending = (db.prepare(`
    SELECT c.id claim_id, c.date, c.status, c.photo, m.title, m.icon, m.stars
    FROM mission_claims c JOIN extra_missions m ON m.id=c.mission_id
    WHERE c.status='pending' ORDER BY c.created_at DESC LIMIT 20
  `).all() as any[]).map((c) => ({ ...c, photoUrl: c.photo ? `/api/photo?p=${encodeURIComponent(c.photo)}` : null }));
  return NextResponse.json({ missions, claimsToday, pending });
}

export async function POST(req: Request) {
  const { action, missionId, claimId, photo } = await req.json().catch(() => ({}));
  const now = nowVN();

  if (action === 'claim') {
    const me = await currentUser();
    if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const childId = currentChildId(me);
    const m = db.prepare(`SELECT * FROM extra_missions WHERE id=? AND active=1`).get(missionId) as any;
    if (!m) return NextResponse.json({ error: 'không có nhiệm vụ này' }, { status: 400 });
    // ảnh bằng chứng BẮT BUỘC — không còn claim chỉ bằng lời nói
    if (!isValidClaimPhoto(photo)) {
      return NextResponse.json({ error: 'con chụp ảnh minh chứng đã nhé — bố mẹ cần thấy con làm thật!' }, { status: 400 });
    }
    const today = dateStrVN();
    const dup = db.prepare(`SELECT id FROM mission_claims WHERE mission_id=? AND date=? AND child_id=?`).get(m.id, today, childId);
    if (dup) return NextResponse.json({ error: 'nhiệm vụ này hôm nay con đã làm rồi — ngày mai làm tiếp nhé!' }, { status: 400 });
    const photoPath = savePhoto(today, String(photo), 'mission');
    db.prepare(`INSERT INTO mission_claims (mission_id, date, photo, created_at, child_id) VALUES (?,?,?,?,?)`).run(m.id, today, photoPath, now.toISOString(), childId);
    return NextResponse.json({ ok: true });
  }

  if (action === 'approve' || action === 'reject') {
    const role = await requireRole('parent');
    if (!role) return NextResponse.json({ error: 'parent only' }, { status: 403 });
    const claim = db.prepare(`SELECT c.*, m.title, m.stars FROM mission_claims c JOIN extra_missions m ON m.id=c.mission_id WHERE c.id=?`).get(claimId) as any;
    if (!claim || claim.status !== 'pending') return NextResponse.json({ error: 'không tìm thấy yêu cầu' }, { status: 400 });
    if (action === 'approve') {
      runInTransaction(() => {
        db.prepare(`UPDATE mission_claims SET status='approved' WHERE id=?`).run(claim.id);
        db.prepare(`INSERT INTO point_ledger (date, type, amount, ref_type, ref_id, note, created_at, child_id) VALUES (?,?,?,?,?,?,?,?)`)
          .run(claim.date, 'earn', claim.stars, 'mission', claim.id, `nhiệm vụ extra: ${claim.title}`, now.toISOString(), claim.child_id);
      });
    } else {
      db.prepare(`UPDATE mission_claims SET status='rejected' WHERE id=?`).run(claim.id);
    }
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
