import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { currentRole } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

const JOURNAL_DIR = path.join(process.env.KH_DATA_DIR || path.join(process.cwd(), 'data'), 'journal');

export async function GET(req: Request) {
  const role = await currentRole();
  if (!role) return new NextResponse('unauthorized', { status: 401 });
  const id = new URL(req.url).searchParams.get('id');
  const row = db.prepare(`SELECT * FROM journal WHERE id=?`).get(id) as any;
  if (!row) return new NextResponse('not found', { status: 404 });
  const full = path.resolve(JOURNAL_DIR, row.audio_path);
  if (!full.startsWith(JOURNAL_DIR) || !fs.existsSync(full)) return new NextResponse('file missing', { status: 404 });
  const buf = fs.readFileSync(full);
  return new NextResponse(buf as any, {
    headers: {
      'Content-Type': row.mime || 'audio/webm',
      'Content-Length': String(buf.length),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=86400',
    },
  });
}
