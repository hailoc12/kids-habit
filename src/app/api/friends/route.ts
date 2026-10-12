import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { nowVN, dateStrVN, weekStart } from '@/lib/dates';
import { currentUser } from '@/lib/auth';

/**
 * Bạn bè chéo gia đình (strategy-friends.md) — CỬA SỔ CHIA SẺ DUY NHẤT xuyên tường isolation.
 * Child chỉ ĐỌC snapshot aggregate; mọi thay đổi quan hệ (send/accept/unfriend/block) parent-only.
 * Fallback tạm: `child_id IS NULL` = hàng của 3L (gia đình duy nhất thời kỳ chuyển đổi) —
 * Nước 3 multi-family sẽ gắn child_id mọi điểm ghi và bỏ fallback này.
 */

const PARENT_ROLES = ['parent', 'system_admin'];

/** WHITELIST tin nhắn mẫu giữa bạn — server chỉ chấp nhận ĐÚNG câu này (chat tự do cấm, strategy-friends) */
const NOTE_WHITELIST = [
  'Cảm ơn bạn! 💛',
  'Cố lên nhé! 💪',
  'Hôm nay bạn được nhiều sao quá! ⭐',
  'Mình cũng làm được rồi! 🎉',
  'Chúc bạn ngày vui! 🌈',
];

function isParent(role: string) { return PARENT_ROLES.includes(role); }

function myChild(familyId: number | null): any | null {
  if (!familyId) return null;
  return db.prepare(`SELECT id, name, avatar, display_name FROM users WHERE family_id=? AND role='child' AND active=1 ORDER BY id LIMIT 1`).get(familyId) as any;
}

function ensureShareCode(familyId: number): string {
  const f = db.prepare(`SELECT share_code FROM families WHERE id=?`).get(familyId) as any;
  if (f?.share_code) return f.share_code;
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // bỏ ký tự dễ nhầm I1O0
  for (let tries = 0; tries < 10; tries++) {
    let code = '';
    for (let i = 0; i < 6; i++) code += abc[Math.floor(Math.random() * abc.length)];
    try {
      db.prepare(`UPDATE families SET share_code=? WHERE id=?`).run(code, familyId);
      return code;
    } catch { /* trùng hiếm → thử lại */ }
  }
  throw new Error('không sinh được share_code');
}

/**
 * Tự chữa giai đoạn chuyển đổi: khi hệ thống còn ĐÚNG 1 family, các dòng ghi trước
 * multi-family còn child_id NULL → gán cho child của family đó. Đa family rồi thì
 * Nước 3 gắn child_id ở mọi điểm ghi — hàm này no-op an toàn.
 */
function backfillLegacy(childId: number) {
  try {
    if ((db.prepare(`SELECT COUNT(*) c FROM families`).get() as any).c !== 1) return;
    const T = ['point_ledger', 'daily_instances', 'mission_claims', 'self_ratings', 'reviews', 'journal',
      'pomodoro_sessions', 'drawings', 'wishlist_items', 'pets', 'gift_events', 'lesson_reads',
      'reading_log', 'book_progress', 'parent_bonuses'];
    for (const t of T) db.prepare(`UPDATE ${t} SET child_id=? WHERE child_id IS NULL`).run(childId);
  } catch { /* im lặng — aggregate chỉ thiếu số, không sai } */ }
}

/** aggregate 1 bạn — CHỈ COUNT/SUM, không bao giờ SELECT nội dung */
function snapshotFor(childId: number): any {
  const today = dateStrVN();
  const week = weekStart(today);
  const child = db.prepare(`SELECT u.id, u.avatar, u.display_name, f.name family_name
    FROM users u JOIN families f ON f.id=u.family_id WHERE u.id=? AND u.active=1`).get(childId) as any;
  if (!child) return null;
  const stars = (where: string, ...args: any[]) =>
    (db.prepare(`SELECT COALESCE(SUM(amount),0) s FROM point_ledger WHERE ${where} AND child_id=?`).get(...args, childId) as any).s;
  const todayRows = db.prepare(`SELECT COUNT(*) n, COALESCE(SUM(status='done'),0) d FROM daily_instances WHERE date=? AND child_id=?`)
    .get(today, childId) as any;
  // streak: ngày liên tiếp (hôm nay chưa có sao vẫn tính từ hôm qua) có tổng sao dương
  const dates = new Set((db.prepare(`SELECT date FROM point_ledger WHERE date>=date('now','localtime','-30 days') AND child_id=? GROUP BY date HAVING SUM(amount)>0`)
    .all(childId) as any[]).map((r) => r.date));
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const ds = dateStrVN(new Date(nowVN().getTime() - i * 86400000));
    if (dates.has(ds)) streak++;
    else if (i === 0) continue;
    else break;
  }
  const starsWeek = stars('date>=?', week);
  const badges: string[] = [];
  if (starsWeek >= 20) badges.push('⭐ Siêng năng');
  if (todayRows.d >= todayRows.n && todayRows.n > 0) badges.push('🎯 Hoàn thành ngày');
  const booksWeek = (db.prepare(`SELECT COUNT(*) c FROM reading_log WHERE date>=? AND child_id=?`).get(week, childId) as any).c;
  if (booksWeek >= 2) badges.push('📚 Mọt sách');
  return {
    childId,
    name: child.display_name || `Bé ${child.avatar} nhà ${child.family_name}`,
    avatar: child.avatar,
    starsToday: stars('date=?', today),
    starsWeek,
    doneToday: todayRows.d, totalToday: todayRows.n,
    streak, badges,
  };
}

function friendRows(childId: number) {
  // 2 placeholder → 2 tham số (node:sqlite không tự lặp — thiếu là rỗng âm thầm!)
  return db.prepare(`SELECT * FROM friendships WHERE status!='blocked' AND (child_a=? OR child_b=?)`).all(childId, childId) as any[];
}
function partnerId(row: any, childId: number) { return row.child_a === childId ? row.child_b : row.child_a; }

// rate limit gửi sai code (in-memory, mỗi process)
const wrongCode = new Map<number, { n: number; ts: number }>();

export async function GET() {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  if (me.role === 'child') {
    backfillLegacy(me.id);
    const friendIds = friendRows(me.id).filter((r) => r.status === 'accepted')
      .map((r) => partnerId(r, me.id));
    const friends = friendIds.map((id) => snapshotFor(id)).filter(Boolean);
    // tin mẫu gần đây 2 chiều với các bạn (chỉ text trong whitelist)
    const notes = (db.prepare(`SELECT n.id, n.from_child, n.to_child, n.text, n.created_at
      FROM friend_notes n WHERE n.from_child=? OR n.to_child=? ORDER BY n.id DESC LIMIT 20`)
      .all(me.id, me.id) as any[])
      .filter((n) => friendIds.includes(n.from_child) || friendIds.includes(n.to_child))
      .map((n) => ({ id: n.id, fromMe: n.from_child === me.id, peerId: n.from_child === me.id ? n.to_child : n.from_child, text: n.text, at: n.created_at }));
    return NextResponse.json({ friends, notes, noteOptions: NOTE_WHITELIST });
  }
  // parent/system_admin
  const child = myChild(me.familyId);
  const shareCode = me.familyId ? ensureShareCode(me.familyId) : null;
  if (!child) return NextResponse.json({ shareCode, child: null, incoming: [], outgoing: [], friends: [] });
  const rows = friendRows(child.id);
  const famOf = (uid: number) => (db.prepare(`SELECT family_id FROM users WHERE id=?`).get(uid) as any)?.family_id;
  const incoming = rows.filter((r) => r.status === 'pending' && r.requested_by_family !== me.familyId)
    .map((r) => ({ id: r.id, fromChild: partnerId(r, child.id) }));
  const outgoing = rows.filter((r) => r.status === 'pending' && r.requested_by_family === me.familyId)
    .map((r) => ({ id: r.id, toChild: partnerId(r, child.id) }));
  const friends = rows.filter((r) => r.status === 'accepted')
    .map((r) => ({ id: r.id, snapshot: snapshotFor(partnerId(r, child.id)), familyId: famOf(partnerId(r, child.id)) }))
    .filter((f) => f.snapshot);
  return NextResponse.json({ shareCode, child: { id: child.id, name: child.display_name || child.name }, incoming, outgoing, friends });
}

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { action: _a, code: _c, id: _i, name: _n } = await req.json().catch(() => ({}));
  // send-note: duy nhất action child được dùng (tin mẫu whitelist) — check riêng bên dưới
  if (!isParent(me.role) && _a !== 'send-note') {
    return NextResponse.json({ error: 'chỉ bố mẹ mới quản lý kết bạn được' }, { status: 403 });
  }
  const { action, code, id, name } = { action: _a, code: _c, id: _i, name: _n };
  const now = nowVN().toISOString();
  const child = myChild(me.familyId);
  if (!child && action !== 'send-note') return NextResponse.json({ error: 'gia đình chưa có tài khoản con' }, { status: 400 });

  if (action === 'send-request') {
    const c = String(code || '').trim().toUpperCase();
    const wl = wrongCode.get(me.familyId ?? 0);
    if (wl && wl.n >= 5 && Date.now() - wl.ts < 60_000) return NextResponse.json({ error: 'thử lại sau 1 phút nhé' }, { status: 429 });
    const target = db.prepare(`SELECT * FROM families WHERE share_code=? AND status='active'`).get(c) as any;
    if (!target || target.id === me.familyId) {
      const cur = wrongCode.get(me.familyId ?? 0);
      wrongCode.set(me.familyId ?? 0, { n: (cur?.n || 0) + 1, ts: Date.now() });
      return NextResponse.json({ error: 'không tìm thấy gia đình với mã này' }, { status: 400 });
    }
    const tChild = myChild(target.id);
    if (!tChild) return NextResponse.json({ error: 'gia đình đó chưa có tài khoản con' }, { status: 400 });
    const a = Math.min(child.id, tChild.id), b = Math.max(child.id, tChild.id);
    const dup = db.prepare(`SELECT * FROM friendships WHERE child_a=? AND child_b=?`).get(a, b) as any;
    if (dup) return NextResponse.json({ error: dup.status === 'accepted' ? 'hai bạn đã là bạn rồi' : 'lời mời đang chờ duyệt' }, { status: 400 });
    db.prepare(`INSERT INTO friendships (child_a, child_b, status, requested_by_family, created_at, updated_at) VALUES (?,?,?,?,?,?)`)
      .run(a, b, 'pending', me.familyId, now, now);
    return NextResponse.json({ ok: true });
  }
  if (action === 'accept' || action === 'reject') {
    const fr = db.prepare(`SELECT * FROM friendships WHERE id=?`).get(id) as any;
    if (!fr || fr.status !== 'pending') return NextResponse.json({ error: 'không tìm thấy lời mời' }, { status: 404 });
    // bên nhận = family của child KHÔNG thuộc bên gửi (child_a/b xếp theo id, không theo vai)
    const famOf = (uid: number) => (db.prepare(`SELECT family_id FROM users WHERE id=?`).get(uid) as any)?.family_id;
    const famA = famOf(fr.child_a), famB = famOf(fr.child_b);
    const recipientFam = fr.requested_by_family === famA ? famB : famA;
    if (recipientFam !== me.familyId) return NextResponse.json({ error: 'lời mời này không phải của gia đình mình' }, { status: 403 });
    if (action === 'accept') db.prepare(`UPDATE friendships SET status='accepted', updated_at=? WHERE id=?`).run(now, id);
    else db.prepare(`DELETE FROM friendships WHERE id=?`).run(id);
    return NextResponse.json({ ok: true });
  }
  if (action === 'unfriend') {
    const fr = db.prepare(`SELECT * FROM friendships WHERE id=?`).get(id) as any;
    if (!fr || fr.status !== 'accepted') return NextResponse.json({ error: 'không tìm thấy' }, { status: 404 });
    if (![fr.child_a, fr.child_b].map((x) => (db.prepare(`SELECT family_id FROM users WHERE id=?`).get(x) as any)?.family_id).includes(me.familyId)) {
      return NextResponse.json({ error: 'không phải bạn của gia đình mình' }, { status: 403 });
    }
    db.prepare(`DELETE FROM friendships WHERE id=?`).run(id); // two-way door — kết lại được
    return NextResponse.json({ ok: true });
  }
  if (action === 'block') {
    const fr = db.prepare(`SELECT * FROM friendships WHERE id=?`).get(id) as any;
    if (!fr) return NextResponse.json({ error: 'không tìm thấy' }, { status: 404 });
    db.prepare(`UPDATE friendships SET status='blocked', updated_at=? WHERE id=?`).run(now, id);
    return NextResponse.json({ ok: true });
  }
  if (action === 'set-display') {
    db.prepare(`UPDATE users SET display_name=? WHERE id=?`).run(String(name || '').slice(0, 30) || null, child.id);
    return NextResponse.json({ ok: true });
  }
  if (action === 'send-note') {
    // CHILD được dùng — nhưng chỉ câu trong whitelist, và chỉ gửi cho bạn đã accepted
    const child = me.role === 'child'
      ? { id: me.id }
      : null;
    const senderId = child ? child.id : (myChild(me.familyId)?.id ?? null);
    if (!senderId) return NextResponse.json({ error: 'không xác định được người gửi' }, { status: 400 });
    const text = String(name ?? '');
    if (!NOTE_WHITELIST.includes(text)) return NextResponse.json({ error: 'chỉ chọn câu mẫu có sẵn nhé' }, { status: 400 });
    const isFriend = friendRows(senderId).some((r) => r.status === 'accepted' && partnerId(r, senderId) === Number(code));
    if (!isFriend) return NextResponse.json({ error: 'chỉ gửi được cho bạn của con' }, { status: 403 });
    db.prepare(`INSERT INTO friend_notes (from_child, to_child, text, created_at) VALUES (?,?,?,?)`)
      .run(senderId, Number(code), text, now);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
