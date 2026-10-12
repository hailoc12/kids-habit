// F02 — Sao Nhí Feedback Engine: MÔ TẢ, KHÔNG ĐÁNH GIÁ (Kohn/Dweck/Faber/Siegel)

// Từ cấm — khen đánh giá person thay process (hard rule PRD v2.0)
export const BANNED_PHRASES = [
  'giỏi quá', 'ngoan quá', 'xuất sắc', 'thật tuyệt', 'con giỏi', 'con ngoan',
  'con thông minh', 'bạn giỏi hơn', 'giỏi nhất',
];

export function checkBanned(text: string): string[] {
  const low = text.toLowerCase();
  return BANNED_PHRASES.filter((p) => low.includes(p));
}

export type FeedbackInput = {
  title: string;          // tên việc, vd "tự đánh răng"
  time: string;           // giờ thực HH:MM
  onTime: boolean;
  minutesLate?: number;   // trễ bao nhiêu phút
  minutesEarlier?: number; // sớm hơn hôm qua bao nhiêu phút
  streakDays?: number;    // chuỗi ngày liên tiếp
  firstTime?: boolean;
  groupA?: boolean;       // việc đã thích → chỉ mô tả
};

/** điền placeholder cho template bố mẹ tự viết: {title} {Title} {time} {minutes} {days} {name} */
function fill(tpl: string, input: FeedbackInput): string {
  const t = input.title.charAt(0).toLowerCase() + input.title.slice(1);
  return tpl
    .replaceAll('{title}', t)
    .replaceAll('{Title}', cap(t))
    .replaceAll('{time}', input.time)
    .replaceAll('{minutes}', String(input.minutesLate ?? input.minutesEarlier ?? ''))
    .replaceAll('{days}', String(input.streakDays ?? ''))
    .replaceAll('{name}', (input as any).childName || 'con');
}

export function renderFeedback(input: FeedbackInput, overrides?: Record<string, string>): string {
  const t = input.title.charAt(0).toLowerCase() + input.title.slice(1);
  const ov = overrides || {};
  if (input.groupA) {
    if (ov.group_a) return fill(ov.group_a, input);
    return `Con ${t} lúc ${input.time}. ⭐`;
  }
  if (!input.onTime) {
    if (ov.late) return fill(ov.late, input);
    // Connect and Redirect (Siegel): ghi nhận cảm xúc → khích lệ hướng tới
    const late = input.minutesLate ? ` (${input.minutesLate} phút)` : '';
    return `Hôm nay ${t} hơi khó nhỉ${late}. Con vẫn TỰ làm rồi đấy. Mai mình thử sớm hơn 5 phút nha! 💪`;
  }
  if (input.streakDays && input.streakDays >= 3) {
    if (ov.streak) return fill(ov.streak, input);
    return `Con ${t} lúc ${input.time} — ${input.streakDays} ngày liền rồi nhé!`;
  }
  if (input.minutesEarlier && input.minutesEarlier >= 2) {
    if (ov.earlier) return fill(ov.earlier, input);
    return `${cap(t)} lúc ${input.time} — sớm hơn ${input.minutesEarlier} phút so với hôm qua. Con thấy chưa!`;
  }
  if (input.firstTime) {
    if (ov.first_time) return fill(ov.first_time, input);
    return `${(input as any).childName || 'Bé'} TỰ ${t} lúc ${input.time}. Con làm được rồi!`;
  }
  if (ov.on_time) return fill(ov.on_time, input);
  return `${cap(t)} lúc ${input.time}. Con tự làm lấy đấy nhé.`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Template lời nhắn cho parent duyệt ngày (hiện sáng hôm sau)
export function morningSummary(childName: string, stars: number, note: string): string {
  const base = `Chào ${childName}! Ngày hôm qua con nhận được ${stars} sao.`;
  return note ? `${base} ${note}` : base;
}
