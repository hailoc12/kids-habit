import { SessionUser } from './auth';
import db from './db';

/**
 * Child "chủ dữ liệu" của phiên hiện tại: child login → chính mình;
 * parent/system_admin → child đầu tiên của family (tạm 1 child/gia đình —
 * multi-child đầy đủ thuộc Nước 3 plan multi-family).
 */
export function currentChildId(me: SessionUser): number | null {
  if (me.role === 'child') return me.id;
  if (!me.familyId) return null;
  const c = db.prepare(`SELECT id FROM users WHERE family_id=? AND role='child' AND active=1 ORDER BY id LIMIT 1`)
    .get(me.familyId) as any;
  return c?.id ?? null;
}
