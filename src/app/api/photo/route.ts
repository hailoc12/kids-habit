import { NextResponse } from 'next/server';
import { readPhoto } from '@/lib/photos';
import { currentRole } from '@/lib/auth';

export async function GET(req: Request) {
  const role = await currentRole();
  if (!role) return new NextResponse('unauthorized', { status: 401 });
  const p = new URL(req.url).searchParams.get('p') || '';
  try {
    const buf = readPhoto(p);
    const ext = p.split('.').pop();
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    return new NextResponse(buf as any, { headers: { 'Content-Type': mime, 'Cache-Control': 'private, max-age=86400' } });
  } catch {
    return new NextResponse('not found', { status: 404 });
  }
}
