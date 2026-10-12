import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { dateStrVN, nowVN } from '@/lib/dates';
import { savePhoto } from '@/lib/photos';
import { balance } from '@/lib/service';
import { currentRole, requireRole, currentUser } from '@/lib/auth';
import { currentChildId } from '@/lib/childscope';

export async function GET() {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const childId = currentChildId(me);
  const rows = db.prepare(`SELECT * FROM wishlist_items WHERE status!='hidden' AND (child_id=? OR child_id IS NULL) ORDER BY created_at DESC`).all(childId);
  return NextResponse.json({
    items: rows.map((r: any) => ({
      ...r,
      photoUrl: r.photo_path ? `/api/photo?p=${encodeURIComponent(r.photo_path)}` : null,
      redemptionPhotoUrl: r.redemption_photo ? `/api/photo?p=${encodeURIComponent(r.redemption_photo)}` : null,
    })),
    balance: balance(childId),
  });
}

// Bé đề xuất món (child)
export async function POST(req: Request) {
  const role = await currentRole();
  const me = await currentUser();
  if (!role) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { title, photo } = await req.json();
  if (!title) return NextResponse.json({ error: 'thiếu tên món' }, { status: 400 });
  const photoPath = photo ? savePhoto(dateStrVN(), photo, 'wish') : null;
  const info = db.prepare(`INSERT INTO wishlist_items (title, photo_path, status, created_by, created_at) VALUES (?,?,?,?,?)`)
    .run(title, photoPath, 'proposed', 'child', nowVN().toISOString());
  return NextResponse.json({ ok: true, id: info.lastInsertRowid });
}
