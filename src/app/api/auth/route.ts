import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { currentUser, verifyPin, createSession, destroySession, hashPin, SESSION_COOKIE } from '@/lib/auth';
import { nowVN } from '@/lib/dates';
import { randomBytes } from 'crypto';

/**
 * GET /api/auth → user hiện tại (401 nếu chưa đăng nhập).
 * KHÔNG trả danh sách user toàn hệ thống nữa (multi-family — lộ tên trẻ nhà khác);
 * màn chọn người render từ localStorage máy đó.
 */
export async function GET() {
  const me = await currentUser();
  if (!me) return NextResponse.json({ me: null }, { status: 401 });
  return NextResponse.json({ me });
}

/** sinh share_code 6 ký tự không nhầm lẫn */
function newShareCode(): string {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let i = 0; i < 20; i++) {
    let c = '';
    for (let j = 0; j < 6; j++) c += abc[Math.floor(Math.random() * abc.length)];
    if (!db.prepare(`SELECT 1 FROM families WHERE share_code=?`).get(c)) return c;
  }
  return randomBytes(4).toString('hex').toUpperCase();
}

/** seed nội dung mặc định cho family mới — BẢN SAO từ template chuẩn (3L), không tham chiếu */
function seedFamily(familyId: number) {
  const src = 1; // family template chuẩn 3L
  db.prepare(`INSERT INTO task_templates (title, icon, section, grp, target_from, target_to, parent_note, subtasks, sort, active, family_id)
    SELECT title, icon, section, grp, target_from, target_to, parent_note, subtasks, sort, active, ? FROM task_templates WHERE family_id=? AND active=1`).run(familyId, src);
  db.prepare(`INSERT INTO shop_items (kind, code, title, emoji, price, payload, active, family_id)
    SELECT kind, code, title, emoji, price, payload, active, ? FROM shop_items WHERE family_id=? AND active=1`).run(familyId, src);
  db.prepare(`INSERT INTO extra_missions (title, icon, stars, active)
    SELECT title, icon, stars, active FROM extra_missions WHERE family_id=? AND active=1`).run(src);
  db.prepare(`UPDATE extra_missions SET family_id=? WHERE family_id IS NULL`).run(familyId);
}

/**
 * POST /api/auth
 * {action:'login', username, pin, remember}
 * {action:'logout'}
 * {action:'register', familyName, parentName, username, pin(≥6 số), childName, childPin?} — tạo family mới
 */
export async function POST(req: Request) {
  const { action, username, pin, remember, familyName, parentName, childName, childPin } = await req.json().catch(() => ({}));

  if (action === 'logout') {
    const store = await import('next/headers').then((m) => m.cookies());
    const token = (await store).get(SESSION_COOKIE)?.value;
    if (token) destroySession(token);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', maxAge: 0 });
    return res;
  }

  if (action === 'register') {
    const u = String(username || '').toLowerCase().replace(/\s+/g, '');
    if (!familyName || !parentName || !childName) return NextResponse.json({ error: 'điền đủ tên gia đình, bố/mẹ và bé nhé' }, { status: 400 });
    if (!/^[a-z0-9_]{3,20}$/.test(u)) return NextResponse.json({ error: 'tên đăng nhập: 3-20 ký tự a-z, số, _' }, { status: 400 });
    if (!/^\d{6,8}$/.test(String(pin || ''))) return NextResponse.json({ error: 'PIN của bố mẹ: 6-8 chữ số' }, { status: 400 });
    if (!/^\d{4,8}$/.test(String(childPin || ''))) return NextResponse.json({ error: 'PIN của bé: 4-8 chữ số' }, { status: 400 });
    if (db.prepare(`SELECT 1 FROM users WHERE username=?`).get(u)) return NextResponse.json({ error: 'tên đăng nhập đã có người dùng' }, { status: 400 });
    const now = nowVN().toISOString();
    try {
      const famInfo = db.prepare(`INSERT INTO families (name, share_code, created_at) VALUES (?,?,?)`)
        .run(String(familyName).slice(0, 40), newShareCode(), now);
      const familyId = Number(famInfo.lastInsertRowid);
      db.prepare(`INSERT INTO users (username, name, avatar, role, pin_hash, family_id, created_at) VALUES (?,?,?,?,?,?,?)`)
        .run(u, String(parentName).slice(0, 30), '👨‍👩‍👧', 'parent', hashPin(String(pin)), familyId, now);
      db.prepare(`INSERT INTO users (username, name, avatar, role, pin_hash, family_id, created_at) VALUES (?,?,?,?,?,?,?)`)
        .run(`${u}_be`, String(childName).slice(0, 30), '🧒', 'child', hashPin(String(childPin)), familyId, now);
      seedFamily(familyId);
      // đăng nhập luôn tài khoản bố mẹ vừa tạo
      const user = verifyPin(u, String(pin));
      if (user) {
        const { token, maxAge } = createSession(user.id, false);
        const res = NextResponse.json({ ok: true, me: user, familyId });
        res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', maxAge });
        return res;
      }
      return NextResponse.json({ ok: true, familyId });
    } catch (e: any) {
      return NextResponse.json({ error: e.message?.includes('UNIQUE') ? 'tên đăng nhập đã có người dùng' : 'lỗi tạo gia đình, thử lại' }, { status: 400 });
    }
  }

  const user = verifyPin(String(username || ''), String(pin || ''));
  if (!user) return NextResponse.json({ error: 'Sai mã PIN rồi — thử lại nhé!' }, { status: 401 });
  const { token, maxAge } = createSession(user.id, !!remember);
  const res = NextResponse.json({ ok: true, me: user });
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', maxAge });
  return res;
}
