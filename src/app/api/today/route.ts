import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { currentChildId } from '@/lib/childscope';
import { getToday, balance, goodDaysBefore } from '@/lib/service';
import { softStreak, streakBadges } from '@/lib/scoring';
import { dateStrVN } from '@/lib/dates';
import { SETTINGS } from '@/lib/settings';
import db from '@/lib/db';

export async function GET(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const date = url.searchParams.get('date') || dateStrVN();
  const childId = currentChildId(me);
  const items = getToday(date, childId);
  const childName = childId ? (db.prepare(`SELECT name FROM users WHERE id=?`).get(childId) as any)?.name || SETTINGS.childName() : SETTINGS.childName();
  const review = db.prepare(`SELECT status, note_to_child FROM reviews WHERE date=?`).get(date) as any;
  // morning banner: kết quả duyệt hôm qua
  const yesterday = db.prepare(`SELECT date, status, note_to_child FROM reviews WHERE date<? AND status='accepted' ORDER BY date DESC LIMIT 1`).get(date) as any;
  let morning: { date: string; stars: number; note: string } | null = null;
  if (yesterday) {
    const s = db.prepare(`SELECT COALESCE(SUM(amount),0) s FROM point_ledger WHERE date=?`).get(yesterday.date) as any;
    morning = { date: yesterday.date, stars: s.s, note: yesterday.note_to_child || '' };
  }
  const sr = db.prepare(`SELECT stars, proud_text FROM self_ratings WHERE date=? AND child_id=?`).get(date, childId) as any;
  // 🎁 banner quà bố mẹ: thưởng hôm nay chưa xem, hoặc hôm qua chưa xem (con ngủ sớm)
  const gift = db.prepare(`SELECT * FROM parent_bonuses WHERE seen_at IS NULL AND date<=? ORDER BY date DESC LIMIT 1`).get(date) as any;
  // 🔥 streak ngày tốt (batch6 T2) — thông tin tiến bộ cho con; bố tắt được nếu thành áp lực
  const dayStreak = SETTINGS.streakDisplay() ? softStreak(goodDaysBefore(date, childId), date) : 0;
  return NextResponse.json({ date, childName, items, review: review || null, morning, selfRating: sr || null, gift: gift || null, balance: balance(childId), dayStreak, dayStreakBadges: streakBadges(dayStreak) });
}
