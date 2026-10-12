import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { currentRole } from '@/lib/auth';
import { getHlsDir } from '@/lib/camera';
import { camParam } from '@/lib/cam-param';

/** GET /api/cam/segment/<tên>.ts — chỉ chấp nhận tên file chữ/số + .ts
 *  (chống path traversal), đọc từ thư mục HLS local trên Mini. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ seg: string }> },
) {
  const role = await currentRole();
  if (!role) return new NextResponse('unauthorized', { status: 401 });

  const { seg } = await params;
  const cam = camParam(req);
  if (!/^[0-9A-Za-z]+\.ts$/.test(seg)) return new NextResponse('bad segment', { status: 400 });

  const file = path.join(getHlsDir(cam), seg);
  // belt & suspenders: resolve xong phải vẫn nằm trong HLS dir
  if (!file.startsWith(getHlsDir(cam) + path.sep)) return new NextResponse('bad segment', { status: 400 });

  let buf: Buffer;
  try {
    buf = fs.readFileSync(file);
  } catch {
    return new NextResponse('segment gone (playlist cũ)', { status: 404 });
  }
  return new NextResponse(buf as any, {
    headers: {
      'Content-Type': 'video/mp2t',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
