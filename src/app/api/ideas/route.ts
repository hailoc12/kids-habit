import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { nowVN } from '@/lib/dates';
import { currentRole, requireRole } from '@/lib/auth';

// F11 — Feature wishlist của Bé (con là co-founder)
export async function GET() {
  const rows = db.prepare(`SELECT * FROM feature_ideas ORDER BY created_at DESC`).all();
  return NextResponse.json({ items: rows });
}

export async function POST(req: Request) {
  const role = await currentRole();
  if (!role) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { title, detail, kind } = await req.json();
  if (!title) return NextResponse.json({ error: 'thiếu nội dung' }, { status: 400 });
  const KINDS = ['idea', 'bug', 'improve', 'thanks'];
  try {
    db.prepare(`INSERT INTO feature_ideas (title, detail, kind, status, created_at) VALUES (?,?,?,?,?)`)
      .run(title, detail || '', KINDS.includes(kind) ? kind : 'idea', 'proposed', nowVN().toISOString());
  } catch {
    // schema cũ chưa có cột kind
    db.prepare(`INSERT INTO feature_ideas (title, detail, status, created_at) VALUES (?,?,?,?)`)
      .run(title, detail || '', 'proposed', nowVN().toISOString());
  }
  return NextResponse.json({ ok: true });
}
