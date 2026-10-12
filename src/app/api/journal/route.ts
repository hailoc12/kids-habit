import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { nowVN, dateStrVN } from '@/lib/dates';
import { currentRole } from '@/lib/auth';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { detectAudio } from '@/lib/audio';

const JOURNAL_DIR = path.join(process.env.KH_DATA_DIR || path.join(process.cwd(), 'data'), 'journal');
fs.mkdirSync(JOURNAL_DIR, { recursive: true });

/** GET → các bài nhật ký (mới trước) */
export async function GET() {
  const role = await currentRole();
  if (!role) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const items = (db.prepare(`SELECT * FROM journal ORDER BY created_at DESC LIMIT 300`).all() as any[]).map((r) => ({
    ...r,
    url: `/api/journal/file?id=${r.id}`,
  }));
  return NextResponse.json({ items });
}

/** POST { audio: dataURL, mime, seconds, mood } — tối đa 2 phút/bài */
export async function POST(req: Request) {
  const role = await currentRole();
  if (!role) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { audio, seconds, mood } = await req.json().catch(() => ({}));
  if (Number(seconds) > 125) return NextResponse.json({ error: 'Bài dài tối đa 2 phút nhé — kể ngắn mà hay!' }, { status: 400 });
  // iOS Safari hay gửi type rỗng/octet-stream → nhận dataURL generic, nhận dạng THẬT bằng magic bytes
  const dataMatch = String(audio || '').match(/^data:[^,]*;base64,(.+)$/s);
  if (!dataMatch) return NextResponse.json({ error: 'không có âm thanh' }, { status: 400 });
  const buf = Buffer.from(dataMatch[1], 'base64');
  const detected = detectAudio(buf);
  if (!detected) return NextResponse.json({ error: 'định dạng âm thanh không hợp lệ — thử ghi lại nhé' }, { status: 400 });
  const m = detected.mime;
  const ext = detected.ext;
  const today = dateStrVN();
  const name = `j-${today}-${crypto.randomUUID().slice(0, 6)}.${ext}`;
  fs.writeFileSync(path.join(JOURNAL_DIR, name), buf);
  const info = db.prepare(`INSERT INTO journal (date, audio_path, mime, seconds, mood, created_at) VALUES (?,?,?,?,?,?)`)
    .run(today, name, m, Number(seconds) || 0, String(mood || '').slice(0, 8), nowVN().toISOString());
  return NextResponse.json({ ok: true, id: Number(info.lastInsertRowid) });
}

/** DELETE ?id= — con xoá bài của mình */
export async function DELETE(req: Request) {
  const role = await currentRole();
  if (!role) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id');
  const row = db.prepare(`SELECT * FROM journal WHERE id=?`).get(id) as any;
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
  db.prepare(`DELETE FROM journal WHERE id=?`).run(id);
  try { fs.unlinkSync(path.join(JOURNAL_DIR, row.audio_path)); } catch {}
  return NextResponse.json({ ok: true });
}
