// F03 — điểm & streak mềm & tốt nghiệp (fading)
// Nguyên tắc: sao = THÔNG TIN tiến bộ, KHÔNG phải điều kiện kiểm soát (SDT)

export const POINTS = {
  onTimeB: 2,
  lateB: 1,
  groupA: 0,
  selfRating: 1,
  streakBonus: 5,
} as const;

export function pointsForInstance(grp: 'A' | 'B', onTime: boolean): number {
  if (grp === 'A') return POINTS.groupA;
  return onTime ? POINTS.onTimeB : POINTS.lateB;
}

/**
 * Streak mềm (Lally 2010: miss 1 ngày không phá habit):
 * - input: mảng ngày liên tiếp gần nhất có "ngày tốt" (≥10 việc nhóm B done) — mới nhất trước
 * - miss đúng 1 ngày → giữ streak; miss ≥2 ngày liên tiếp → reset
 */
export function softStreak(goodDays: string[], today: string): number {
  // goodDays: các ngày tốt đã xảy ra, tính lùi từ today-1
  const set = new Set(goodDays);
  let streak = 0;
  let cursor = addDaysStr(today, -1);
  let skipped = 0;
  for (let i = 0; i < 365; i++) {
    if (set.has(cursor)) {
      streak++;
      skipped = 0;
    } else {
      skipped++;
      if (skipped >= 2) break; // 2 ngày trống liên tiếp → đứt
    }
    cursor = addDaysStr(cursor, -1);
  }
  return streak;
}

function addDaysStr(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

/**
 * Huy hiệu mốc chuỗi ngày tốt (batch6 T2) — [3,7,30]: con đạt mốc nào thì có huy hiệu đó.
 * Streak là THÔNG TIN tiến bộ ("con đã làm tốt N ngày!") — không gắn thưởng cứng (viên gạch 02/10).
 */
export const STREAK_BADGE_MILESTONES = [3, 7, 30];
export function streakBadges(streak: number): number[] {
  return STREAK_BADGE_MILESTONES.filter((m) => streak >= m);
}

/**
 * Tốt nghiệp (fading): việc nhóm B đủ điều kiện chuyển nhóm A
 * — ≥80% các ngày có checkin đúng giờ trong 4 tuần liên tiếp gần nhất
 */
export function graduationEligible(
  history: { date: string; done: boolean; onTime: boolean }[],
  today: string,
  windowDays = 28,
  threshold = 0.8
): boolean {
  const from = addDaysStr(today, -windowDays);
  const recent = history.filter((h) => h.date >= from && h.date <= today);
  if (recent.length < 10) return false; // đủ dữ liệu mới xét
  const onTimeCount = recent.filter((h) => h.done && h.onTime).length;
  return onTimeCount / recent.length >= threshold;
}
