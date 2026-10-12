import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { currentRole } from '@/lib/auth';
import { getHlsDir } from '@/lib/camera';
import { camParam } from '@/lib/cam-param';

/** GET /api/cam/playlist → index.m3u8, segment URI rewrite về /api/cam/segment/<tên>
 *  (client không đọc được file .ts trực tiếp — mọi byte video phải qua route có auth).
 *  Server chạy trên Mini → đọc fs local, không cần ssh. */
export async function GET(req: Request) {
  const role = await currentRole();
  if (!role) return new NextResponse('unauthorized', { status: 401 });

  const cam = camParam(req);
  const file = path.join(getHlsDir(cam), 'index.m3u8');
  let raw: string;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return new NextResponse('stream not started', { status: 404 });
  }
  if (!raw.includes('#EXTM3U')) return new NextResponse('playlist not ready', { status: 404 });

  const body = raw
    .split('\n')
    .map((line) => {
      const t = line.trim();
      if (!t || t.startsWith('#')) return line; // tag/dòng trống giữ nguyên
      return `/api/cam/segment/${encodeURIComponent(t)}?cam=${cam}`; // tên segment → route có auth
    })
    .join('\n');

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/vnd.apple.mpegurl',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
