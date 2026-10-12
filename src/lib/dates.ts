// Múi giờ gia đình: Asia/Ho_Chi_Minh (UTC+7) — mọi logic giờ chạy theo TZ này
const TZ = 'Asia/Ho_Chi_Minh';

export function nowVN(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
}

export function dateStrVN(d: Date = nowVN()): string {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** phút từ 00:00 của chuỗi "HH:MM" */
export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function minutesOfDayVN(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function fmtTimeVN(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** ngày cách n ngày (định dạng YYYY-MM-DD) */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d + 1);
  return dateStrVN(dt);
}

export function weekdayVN(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const names = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
  return names[new Date(y, m - 1, d).getDay()];
}

/** thứ Hai của tuần chứa `date` */
export function weekStart(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = dt.getDay(); // 0=CN
  const diff = dow === 0 ? -6 : 1 - dow;
  dt.setDate(dt.getDate() + diff);
  return dateStrVN(dt);
}
