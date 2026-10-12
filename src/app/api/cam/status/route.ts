import { NextResponse } from 'next/server';
import { currentRole } from '@/lib/auth';
import { startIfIdle } from '@/lib/camera';
import { camParam } from '@/lib/cam-param';

/** GET /api/cam/status?cam=0|1 → { live, reason, cam, hlsBase }
 *  Đăng nhập mới xem được (camera trong nhà — privacy tối cao).
 *  Gọi ensureStream() với ngân sách chờ ~3s: request không treo nếu ssh chậm. */
export async function GET(req: Request) {
  const role = await currentRole();
  if (!role) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const cam = camParam(req);
  const status = await startIfIdle(cam);
  return NextResponse.json({ ...status, cam, hlsBase: `/api/cam/playlist?cam=${cam}` });
}
