import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { currentRole } from '@/lib/auth';
import fs from 'fs';
import { coverFile } from '@/lib/covers';

/** GET /api/books/cover?id= → ảnh cover jpeg đã bóc từ epub */
export async function GET(req: Request) {
  const role = await currentRole();
  if (!role) return new NextResponse('unauthorized', { status: 401 });
  const id = new URL(req.url).searchParams.get('id');
  const book = db.prepare(`SELECT file FROM books WHERE id=? AND active=1`).get(id) as any;
  if (!book) return new NextResponse('not found', { status: 404 });
  const full = coverFile(book.file);
  if (!fs.existsSync(full)) return new NextResponse('no cover', { status: 404 });
  const buf = fs.readFileSync(full);
  return new NextResponse(buf as any, {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=604800' },
  });
}
