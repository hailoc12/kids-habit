// Pomodoro Bé — logic thuần (unit-test được)
// Cấu trúc Premack: việc có ý nghĩa (20/30/40') → YouTube (5/10', có điểm KẾT THÚC)

export type PomodoroPhase = 'work' | 'work-done' | 'reward' | 'reward-done' | 'none';

export function validatePomodoro(workMin: number, rewardMin: number, maxReward: number): string | null {
  if (!Number.isFinite(workMin) || workMin < 5 || workMin > 120) return 'Thời gian làm từ 5–120 phút nhé';
  if (!Number.isFinite(rewardMin) || rewardMin < 1) return 'Quà YouTube tối thiểu 1 phút';
  if (rewardMin > maxReward) return `Quà YouTube tối đa ${maxReward} phút`;
  if (rewardMin > workMin / 2) return 'Quà YouTube phải ngắn hơn một nửa thời gian làm — công bằng chứ!';
  return null;
}

/** trạng thái phiên tính từ timestamps (chống sai khi tab background/reload) */
export function phaseOf(s: {
  status: string;
  work_ends_at: string;
  reward_started_at: string | null;
  reward_ends_at: string | null;
}, now: Date): PomodoroPhase {
  if (s.status !== 'running') return 'none';
  if (!s.reward_started_at) {
    return now.getTime() >= new Date(s.work_ends_at).getTime() ? 'work-done' : 'work';
  }
  if (!s.reward_ends_at) return 'reward'; // defensive
  return now.getTime() >= new Date(s.reward_ends_at).getTime() ? 'reward-done' : 'reward';
}

export function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60), sec = total % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// ---- Batch6 (strategy 10/10): cơ chế thoát cho phiên — idle-expire + TV-off insurance ----

export const IDLE_EXPIRE_MIN = 30;   // có quyền 30' không tham gia → coi như hết quyền (đề bài F2a)
export const TV_OFF_GRACE_MIN = 10;  // hết reward mà TV đã cast + grace này vẫn chưa tắt → server tự tắt (L1)

/**
 * Idle-expire — phiên "có quyền" nhưng 30' không hoạt động thì tự đóng.
 * Neo theo kind: ticket = lúc mua vé (reward_started_at), pomodoro = work xong chưa claim
 * (work_ends_at), đã claim nhưng chưa từng xem (reward_started_at).
 * CHỈ tính khi CHƯA từng play (first_play_at NULL) — đã xem thì countdown gốc quyết định.
 */
export function idleExpired(s: {
  status: string;
  kind: string;
  work_ends_at: string;
  reward_started_at: string | null;
  first_play_at: string | null;
}, now: Date): boolean {
  if (s.status !== 'running' || s.first_play_at) return false;
  const anchor = s.reward_started_at || s.work_ends_at; // "có quyền" từ lúc này
  return now.getTime() >= new Date(anchor).getTime() + IDLE_EXPIRE_MIN * 60000;
}

/**
 * L1 TV-off insurance — TV đã cast cho phiên, hết reward + grace mà phiên vẫn running
 * (con đóng app/quên) → server phải tự tắt TV. Độc lập với việc ai còn bấm nút không.
 */
export function tvOverdue(s: {
  status: string;
  cast_atv_at: string | null;
  tv_off_at: string | null;
  reward_ends_at: string | null;
}, now: Date): boolean {
  if (!s.cast_atv_at || s.tv_off_at) return false;
  if (!s.reward_ends_at) return false; // chưa có quà thì chưa cast được (cast-reward yêu cầu phase reward)
  return now.getTime() >= new Date(s.reward_ends_at).getTime() + TV_OFF_GRACE_MIN * 60000;
}
