import { NextResponse } from 'next/server';
import { checkin } from '@/lib/service';
import { savePhoto } from '@/lib/photos';
import { dateStrVN } from '@/lib/dates';
import { currentUser } from '@/lib/auth';
import { currentChildId } from '@/lib/childscope';
import db from '@/lib/db';

/**
 * POST /api/checkin
 * { instanceId, photo? }            → tick done (ảnh OPTIONAL — one-tap)
 * { instanceId, photo, mode:'attach' } → gắn ảnh cho việc ĐÃ done
 */
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { instanceId, photo, mode } = await req.json().catch(() => ({}));
  if (!instanceId) return NextResponse.json({ error: 'thiếu instanceId' }, { status: 400 });
  // multi-family: chỉ tick được việc của con nhà mình
  const inst = db.prepare(`SELECT i.id, i.child_id FROM daily_instances i WHERE i.id=?`).get(instanceId) as any;
  const myChild = currentChildId(me);
  if (inst && inst.child_id && inst.child_id !== myChild) {
    return NextResponse.json({ error: 'việc này không phải của con nhà mình' }, { status: 403 });
  }
  try {
    if (mode === 'attach') {
      if (!photo) return NextResponse.json({ error: 'thiếu ảnh' }, { status: 400 });
      const photoPath = savePhoto(dateStrVN(), photo, 'late');
      const { attachPhoto } = await import('@/lib/service');
      attachPhoto(instanceId, photoPath);
      return NextResponse.json({ ok: true });
    }
    const photoPath = photo ? savePhoto(dateStrVN(), photo) : null;
    const { feedback, onTime } = checkin(instanceId, photoPath);
    return NextResponse.json({ ok: true, feedback, onTime });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
