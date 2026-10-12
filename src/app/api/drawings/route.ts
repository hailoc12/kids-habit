import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { dateStrVN, nowVN } from '@/lib/dates';
import { savePhoto } from '@/lib/photos';
import { currentRole } from '@/lib/auth';

/** GET → danh sách bộ sưu tập + quota giấy vẽ hôm nay */
export async function GET() {
  const role = await currentRole();
  if (!role) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const today = dateStrVN();
  const items = (db.prepare(`SELECT d.*, t.title, t.icon FROM drawings d
    LEFT JOIN daily_instances i ON i.id = d.instance_id
    LEFT JOIN task_templates t ON t.id = i.template_id
    ORDER BY d.created_at DESC LIMIT 200`).all() as any[]).map((r) => ({
    ...r,
    url: `/api/photo?p=${encodeURIComponent(r.image_path)}`,
  }));
  const checkins = (db.prepare(`SELECT COUNT(*) c FROM daily_instances WHERE date=? AND status='done'`).get(today) as any).c;
  const drawn = (db.prepare(`SELECT COUNT(*) c FROM drawings WHERE date=?`).get(today) as any).c;
  return NextResponse.json({ items, today, sheetsAvailable: Math.max(0, checkins - drawn) });
}

/**
 * POST { image, instanceId? } → lưu bức vẽ.
 * Unlock (Premack): số tờ vẽ hôm nay ≤ số việc đã checkin hôm nay.
 */
export async function POST(req: Request) {
  const role = await currentRole();
  if (!role) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { image, instanceId } = await req.json().catch(() => ({ image: null }));
  if (!image) return NextResponse.json({ error: 'thiếu ảnh bức vẽ' }, { status: 400 });
  const today = dateStrVN();
  const checkins = (db.prepare(`SELECT COUNT(*) c FROM daily_instances WHERE date=? AND status='done'`).get(today) as any).c;
  const drawn = (db.prepare(`SELECT COUNT(*) c FROM drawings WHERE date=?`).get(today) as any).c;
  if (drawn >= checkins) {
    return NextResponse.json(
      { error: 'Hôm nay con chưa có tờ giấy vẽ mới — làm thêm một việc nhé! 🐢' },
      { status: 400 }
    );
  }
  const imagePath = savePhoto(today, image, 'draw');
  db.prepare(`INSERT INTO drawings (date, instance_id, image_path, created_at) VALUES (?,?,?,?)`)
    .run(today, instanceId || null, imagePath, nowVN().toISOString());
  return NextResponse.json({ ok: true });
}
