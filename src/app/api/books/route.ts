import { NextResponse } from 'next/server';
import db, { runInTransaction } from '@/lib/db';
import { nowVN, dateStrVN } from '@/lib/dates';
import { currentRole } from '@/lib/auth';





/** GET → thư viện + tiến độ đọc (+ cover thật đã bóc từ epub) */
export async function GET() {
  const role = await currentRole();
  if (!role) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const books = db.prepare(`
    SELECT b.*, p.pct, p.minutes, p.finished_at FROM books b
    LEFT JOIN book_progress p ON p.book_id = b.id
    WHERE b.active=1 ORDER BY p.pct DESC, b.title
  `).all() as any[];
  const { extractCover, hasCover } = await import('@/lib/covers');
  for (const b of books) {
    if (!b.coverUrlChecked) {
      try { extractCover(b.file); } catch {}
    }
    b.coverUrl = hasCover(b.file) ? `/api/books/cover?id=${b.id}` : null;
    delete b.coverUrlChecked;
  }
  const today = dateStrVN();
  const todayReadStars = (db.prepare(
    `SELECT COALESCE(SUM(amount),0) s FROM point_ledger WHERE date=? AND ref_type='reading_min'`
  ).get(today) as any).s;
  const maxRow = db.prepare(`SELECT value FROM app_settings WHERE key='read_stars_daily_max'`).get() as any;
  const maxRead = Number(maxRow?.value ?? 3);
  return NextResponse.json({ books, todayReadStars, maxReadStarsPerDay: maxRead });
}

/**
 * POST /api/books
 * {action:'progress', bookId, cfi?, pct?, minutes?}
 *   - lưu vị trí + phút đọc
 *   - thưởng +1 sao / 10 phút (trần read_stars_daily_max, mặc định 3/ngày)
 *   - pct >= 100 lần đầu → +5 sao hoàn thành cuốn (một lần mỗi cuốn)
 * {action:'file', bookId} không dùng — file qua GET /api/books/file?id=
 */
export async function POST(req: Request) {
  const role = await currentRole();
  if (!role) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { action, bookId, cfi, pct, minutes } = await req.json().catch(() => ({}));
  if (action !== 'progress' || !bookId) return NextResponse.json({ error: 'bad request' }, { status: 400 });

  const book = db.prepare(`SELECT * FROM books WHERE id=?`).get(bookId) as any;
  if (!book) return NextResponse.json({ error: 'không có sách này' }, { status: 400 });
  const prev = db.prepare(`SELECT * FROM book_progress WHERE book_id=?`).get(bookId) as any;
  const now = nowVN().toISOString();
  const today = dateStrVN();

  // phút chỉ tính tăng thêm (client gửi tổng phiên; chống replay gửi lại tổng cũ)
  const addMin = Math.max(0, Math.min(120, Number(minutes) || 0) - (prev?.minutes ?? 0));
  const newPct = Math.max(prev?.pct ?? 0, Math.min(100, Number(pct) || 0));

  let stars = 0;
  let finishedNow = false;
  runInTransaction(() => {
    db.prepare(`INSERT INTO book_progress (book_id, cfi, pct, minutes, updated_at) VALUES (?,?,?,?,?)
                ON CONFLICT(book_id) DO UPDATE SET cfi=excluded.cfi, pct=excluded.pct, minutes=excluded.minutes, updated_at=excluded.updated_at`)
      .run(bookId, cfi || prev?.cfi || '', newPct, (prev?.minutes ?? 0) + addMin, now);

    // thưởng theo % tiến độ MỖI CUỐN — đọc được chừng nào hưởng chừng đó
    // (không cần hết cuốn; hoàn thành cuốn +bonus finish)
    if (newPct > (prev?.pct ?? 0)) {
      const totalStars = book.star_reward || 0; // bố mẹ set riêng từng cuốn (0 = chỉ thưởng phút đọc chung)
      const oldEarned = Math.floor(((prev?.pct ?? 0) / 100) * totalStars);
      const newEarned = Math.floor((newPct / 100) * totalStars);
      const pageStars = newEarned - oldEarned;
      if (pageStars > 0) {
        db.prepare(`INSERT INTO point_ledger (date, type, amount, ref_type, ref_id, note, created_at) VALUES (?,?,?,?,?,?,?)`)
          .run(today, 'earn', pageStars, 'reading_page', bookId, `đọc ${book.title}: ${newPct}%`, now);
        stars += pageStars;
      }
    }
    // hoàn thành cuốn — +5 một lần
    if (newPct >= 100 && prev && !prev.finished_at) {
      db.prepare(`UPDATE book_progress SET finished_at=? WHERE book_id=?`).run(now, bookId);
      db.prepare(`INSERT INTO point_ledger (date, type, amount, ref_type, ref_id, note, created_at) VALUES (?,?,?,?,?,?,?)`)
        .run(today, 'bonus', 5, 'book_done', bookId, `hoàn thành cả cuốn: ${book.title}`, now);
      stars += 5;
      finishedNow = true;
    } else if (!prev && newPct >= 100) {
      db.prepare(`UPDATE book_progress SET finished_at=? WHERE book_id=?`).run(now, bookId);
      db.prepare(`INSERT INTO point_ledger (date, type, amount, ref_type, ref_id, note, created_at) VALUES (?,?,?,?,?,?,?)`)
        .run(today, 'bonus', 5, 'book_done', bookId, `hoàn thành cả cuốn: ${book.title}`, now);
      stars += 5;
      finishedNow = true;
    }
  });
  return NextResponse.json({ ok: true, stars, finishedNow });
}
