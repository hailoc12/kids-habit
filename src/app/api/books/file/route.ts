import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { currentRole } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

const BOOKS_DIR = process.env.KH_BOOKS_DIR || path.join(process.cwd(), 'books');

/** GET /api/books/file?id= → stream epub (chỉ session gia đình) */
export async function GET(req: Request) {
  const role = await currentRole();
  if (!role) return new NextResponse('unauthorized', { status: 401 });
  const id = new URL(req.url).searchParams.get('id');
  const book = db.prepare(`SELECT * FROM books WHERE id=? AND active=1`).get(id) as any;
  if (!book) return new NextResponse('not found', { status: 404 });
  const full = path.resolve(BOOKS_DIR, book.file);
  if (!full.startsWith(BOOKS_DIR) || !fs.existsSync(full)) return new NextResponse('file missing', { status: 404 });
  const buf = fs.readFileSync(full);
  return new NextResponse(buf as any, {
    headers: {
      'Content-Type': 'application/epub+zip',
      'Content-Length': String(buf.length),
      'Cache-Control': 'private, max-age=86400',
    },
  });
}
