import { cookies } from 'next/headers';
import { IncomingMessage } from 'http';
import crypto from 'crypto';
import db from './db';
import { nowVN } from './dates';

export type Role = 'child' | 'parent' | 'system_admin';
export type SessionUser = { id: number; name: string; avatar: string; role: Role; username: string; familyId: number | null };

export const SESSION_COOKIE = 'kh_session';
const SALT = process.env.KH_AUTH_SALT || 'kids-habit-dev-salt-change-in-production';

export function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(SALT + pin).digest('hex');
}

export function verifyPin(username: string, pin: string): SessionUser | null {
  const u = db.prepare(`SELECT * FROM users WHERE username=? AND active=1`).get(username) as any;
  if (!u) return null;
  if (u.pin_hash !== hashPin(String(pin))) return null;
  return { id: u.id, name: u.name, avatar: u.avatar, role: u.role, username: u.username, familyId: u.family_id ?? null };
}

export function createSession(userId: number, remember: boolean): { token: string; maxAge: number } {
  const token = crypto.randomBytes(32).toString('hex');
  const days = remember ? 365 : 0.5;
  const expires = new Date(nowVN().getTime() + days * 86400000).toISOString();
  db.prepare(`INSERT INTO auth_sessions (token, user_id, expires_at, created_at) VALUES (?,?,?,?)`)
    .run(token, userId, expires, nowVN().toISOString());
  // dọn session quá hạn
  db.prepare(`DELETE FROM auth_sessions WHERE expires_at < ?`).run(nowVN().toISOString());
  return { token, maxAge: Math.round(days * 86400) };
}

export function destroySession(token: string) {
  db.prepare(`DELETE FROM auth_sessions WHERE token=?`).run(token);
}

function userFromToken(token: string | undefined): SessionUser | null {
  if (!token) return null;
  const row = db.prepare(`
    SELECT u.* FROM auth_sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token=? AND s.expires_at > ? AND u.active=1
  `).get(token, nowVN().toISOString()) as any;
  if (!row) return null;
  return { id: row.id, name: row.name, avatar: row.avatar, role: row.role, username: row.username, familyId: row.family_id ?? null };
}

function tokenFromCookieHeader(header: string): string | undefined {
  const m = header.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : undefined;
}

/** Route Handler helper (App Router) */
export async function currentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return userFromToken(store.get(SESSION_COOKIE)?.value);
}

/** Back-compat: role-only check */
export async function currentRole(): Promise<Role | null> {
  return (await currentUser())?.role ?? null;
}

export async function requireRole(need: Role | Role[]): Promise<SessionUser | null> {
  const u = await currentUser();
  if (!u) return null;
  if (u.role === 'system_admin') return u; // system_admin bao trùm parent (multi-family Nước 1)
  if (Array.isArray(need) ? need.includes(u.role) : u.role === need) return u;
  return null;
}

/** Middleware/route dùng cho request thô */
export function userFromRequest(req: IncomingMessage): SessionUser | null {
  return userFromToken(tokenFromCookieHeader(req.headers.cookie || ''));
}

// legacy (đã thay bằng users table) — giữ để cũ không build lỗi
export function getParentPin(): string { return ''; }
export function roleFromRequest(_req: IncomingMessage): Role | null { return null; }
export const COOKIE_NAME = SESSION_COOKIE;
