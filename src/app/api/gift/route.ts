import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { nowVN, dateStrVN } from '@/lib/dates';
import { savePhoto } from '@/lib/photos';

// F09 — Hộp Bí Mật (parent)
export async function GET() {
  const gifts = db.prepare(`SELECT * FROM gifts WHERE active=1 ORDER BY type, title`).all();
  const events = db.prepare(`SELECT g.*, gi.title gift_title FROM gift_events g JOIN gifts gi ON gi.id=g.gift_id ORDER BY g.gifted_at DESC LIMIT 20`).all();
  return NextResponse.json({
    gifts,
    events: events.map((e: any) => ({ ...e, photoUrl: e.photo_path ? `/api/photo?p=${encodeURIComponent(e.photo_path)}` : null })),
  });
}

export async function POST(req: Request) {
  const role = await requireRole('parent');
  if (!role) return NextResponse.json({ error: 'parent only' }, { status: 403 });
  const { giftId, doneCount, photo } = await req.json();
  const gift = db.prepare(`SELECT * FROM gifts WHERE id=?`).get(giftId) as any;
  if (!gift) return NextResponse.json({ error: 'gift not found' }, { status: 404 });
  // thư Sao Nhí — mô tả, bất ngờ, không điều kiện
  const letter = `Thư của Sao Nhí ⭐\nTuần này con đã TỰ làm ${doneCount ?? 'nhiều'} việc. Bố mẹ có một món bất ngờ dành riêng cho con: ${gift.title}. ${gift.type === 'outing' ? 'Cả nhà sẽ cùng đi nhé!' : 'Món này là của riêng con!'}\nYêu con.`;
  const photoPath = photo ? savePhoto(dateStrVN(), photo, 'gift') : null;
  db.prepare(`INSERT INTO gift_events (gift_id, gifted_at, letter_text, photo_path) VALUES (?,?,?,?)`)
    .run(giftId, nowVN().toISOString(), letter, photoPath);
  return NextResponse.json({ ok: true, letter });
}
