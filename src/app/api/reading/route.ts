import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { dateStrVN, nowVN } from '@/lib/dates';
import { savePhoto } from '@/lib/photos';
import { currentRole } from '@/lib/auth';

export async function GET() {
  const rows = db.prepare(`SELECT * FROM reading_log ORDER BY date DESC, id DESC LIMIT 100`).all();
  return NextResponse.json({ items: rows.map((r: any) => ({ ...r, coverUrl: r.cover_photo ? `/api/photo?p=${encodeURIComponent(r.cover_photo)}` : null })) });
}

export async function POST(req: Request) {
  const role = await currentRole();
  if (!role) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { title, coverPhoto, enjoyed, minutes } = await req.json();
  if (!title) return NextResponse.json({ error: 'thiếu tên sách' }, { status: 400 });
  const date = dateStrVN();
  const cover = coverPhoto ? savePhoto(date, coverPhoto, 'book') : null;
  db.prepare(`INSERT INTO reading_log (date, title, cover_photo, enjoyed, minutes, created_at) VALUES (?,?,?,?,?,?)`)
    .run(date, title, cover, enjoyed ? 1 : 0, minutes || null, nowVN().toISOString());
  return NextResponse.json({ ok: true });
}
