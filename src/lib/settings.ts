// App settings — bố mẹ customize mọi nội dung qua Admin (KV table, có cache)
import db from './db';

const cache = new Map<string, string>();

export function getSetting(key: string, fallback: string): string {
  if (cache.has(key)) return cache.get(key)!;
  const row = db.prepare(`SELECT value FROM app_settings WHERE key=?`).get(key) as any;
  const v = row ? String(row.value) : fallback;
  cache.set(key, v);
  return v;
}

export function setSetting(key: string, value: string) {
  db.prepare(`INSERT INTO app_settings (key, value) VALUES (?,?)
              ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(key, value);
  cache.set(key, value);
}

export const SETTINGS = {
  childName: () => getSetting('child_name', 'Bé'),
  pointsOnTime: () => Number(getSetting('points_on_time', '2')),
  pointsLate: () => Number(getSetting('points_late', '1')),
  pointsSelfRating: () => Number(getSetting('points_self_rating', '1')),
  pointsStreakBonus: () => Number(getSetting('points_streak_bonus', '5')),
  streakMilestone: () => Number(getSetting('streak_milestone', '5')),
  graduationRate: () => Number(getSetting('graduation_rate', '0.8')),
  graduationDays: () => Number(getSetting('graduation_days', '28')),
  /** batch6 T2: tắt hiển thị streak cho con nếu thành áp lực (defense) — mặc định bật */
  streakDisplay: () => getSetting('streak_display', '1') === '1',
} as const;

/** PIN: DB settings ưu tiên, fallback env (đổi PIN trong Admin không cần sửa plist) */
export function getEffectivePin(envPin: string): string {
  return getSetting('parent_pin', envPin);
}

/** feedback template override từ DB (situation → template có {placeholders}) */
export function feedbackOverrides(): Record<string, string> {
  try {
    const rows = db.prepare(`SELECT situation, template FROM feedback_templates WHERE active=1`).all() as any[];
    return Object.fromEntries(rows.map((r) => [r.situation, r.template]));
  } catch {
    return {};
  }
}

export const ALL_SETTINGS_KEYS = [
  'child_name', 'parent_pin', 'points_on_time', 'points_late', 'points_self_rating',
  'points_streak_bonus', 'streak_milestone', 'graduation_rate', 'graduation_days',
  'pomodoro_max_reward', 'yt_ticket_daily_max', 'streak_display',
] as const;
