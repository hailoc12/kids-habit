import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { nowVN, dateStrVN } from '@/lib/dates';
import { currentRole } from '@/lib/auth';
import { runInTransaction } from '@/lib/db';

/** GET → danh sách bài học + trạng thái đã đọc + tiến độ */
export async function GET() {
  const role = await currentRole();
  if (!role) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const lessons = db.prepare(`SELECT * FROM lessons WHERE active=1 ORDER BY sort, id`).all();
  const reads = db.prepare(`SELECT lesson_id, MAX(date) d FROM lesson_reads GROUP BY lesson_id`).all() as any[];
  const readMap = Object.fromEntries(reads.map((r) => [r.lesson_id, r.d]));
  return NextResponse.json({
    lessons: lessons.map((l: any) => ({ ...l, readAt: readMap[l.id] || null })),
    progress: { read: reads.length, total: lessons.length },
  });
}

/** POST { lessonId } → đánh dấu đã đọc; bài ĐẦU TIÊN đọc xong +2 sao (khởi động nội dung mới) */
export async function POST(req: Request) {
  const role = await currentRole();
  if (!role) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { lessonId } = await req.json().catch(() => ({}));
  const lesson = db.prepare(`SELECT * FROM lessons WHERE id=? AND active=1`).get(lessonId) as any;
  if (!lesson) return NextResponse.json({ error: 'không có bài này' }, { status: 400 });
  const everRead = db.prepare(`SELECT id FROM lesson_reads WHERE lesson_id=? LIMIT 1`).get(lessonId);
  const today = dateStrVN();
  const todayRead = db.prepare(`SELECT id FROM lesson_reads WHERE lesson_id=? AND date=?`).get(lessonId, today);
  if (!todayRead) {
    runInTransaction(() => {
      db.prepare(`INSERT INTO lesson_reads (lesson_id, date, created_at) VALUES (?,?,?)`)
        .run(lessonId, today, nowVN().toISOString());
      if (!everRead) {
        db.prepare(`INSERT INTO point_ledger (date, type, amount, ref_type, ref_id, note, created_at) VALUES (?,?,?,?,?,?,?)`)
          .run(today, 'earn', 2, 'lesson', lessonId, `học tư duy mới: ${lesson.title}`, nowVN().toISOString());
      }
    });
  }
  return NextResponse.json({ ok: true, firstTime: !everRead, stars: everRead ? 0 : 2 });
}
