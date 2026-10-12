import { NextResponse } from 'next/server';
import fs from 'fs';
import { currentRole } from '@/lib/auth';
import { getSnapshotPath, snapshot, logCam } from '@/lib/camera';
import { camParam } from '@/lib/cam-param';

/** GET /api/cam/snapshot → JPEG 1 frame từ camera.
 *  Ảnh cũ hơn 5s thì chụp mới (rtsp grab ~1-3s), còn lại dùng ngay. */
export async function GET(req: Request) {
  const role = await currentRole();
  if (!role) return new NextResponse('unauthorized', { status: 401 });

  const cam = camParam(req);
  const jpg = getSnapshotPath(cam);
  let fresh = false;
  try {
    fresh = Date.now() - fs.statSync(jpg).mtimeMs < 5_000;
  } catch { fresh = false; }

  if (!fresh) {
    try {
      await snapshot(cam);
    } catch (e) {
      // camera không trả lời — nếu vẫn còn ảnh cũ thì đưa ảnh cũ (tốt hơn trống)
      logCam(`SNAPSHOT FAIL: ${e instanceof Error ? e.message : e}`);
    }
  }

  let buf: Buffer;
  try {
    buf = fs.readFileSync(jpg);
  } catch {
    return new NextResponse('camera không trả lời', { status: 502 });
  }
  return new NextResponse(buf as any, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
