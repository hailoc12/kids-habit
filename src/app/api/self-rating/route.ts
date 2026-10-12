import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { dateStrVN, nowVN } from '@/lib/dates';
import { savePhoto } from '@/lib/photos';
import { currentUser } from '@/lib/auth';
import { currentChildId } from '@/lib/childscope';

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const childId = currentChildId(me);
  const { stars, proudText, proudPhoto } = await req.json();
  const date = dateStrVN();
  const existing = db.prepare(`SELECT date FROM self_ratings WHERE date=? AND child_id=?`).get(date, childId);
  if (existing) return NextResponse.json({ error: 'Hôm nay con đã tự chấm rồi' }, { status: 400 });
  let photoPath: string | null = null;
  if (proudPhoto) photoPath = savePhoto(date, proudPhoto, 'proud');
  db.prepare(`INSERT INTO self_ratings (date, stars, proud_text, proud_photo, created_at, child_id) VALUES (?,?,?,?,?,?)`)
    .run(date, Math.max(0, Math.min(5, stars || 0)), proudText || '', photoPath, nowVN().toISOString(), childId);
  return NextResponse.json({ ok: true });
}
