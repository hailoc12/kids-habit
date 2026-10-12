// Service layer — logic dùng chung cho API routes
import db, { runInTransaction } from './db';
import { nowVN, dateStrVN, minutesOfDayVN, minutesOf, fmtTimeVN, addDays } from './dates';
import { renderFeedback, FeedbackInput } from './feedback';
import { pointsForInstance, softStreak, POINTS } from './scoring';
import { SETTINGS, feedbackOverrides } from './settings';

export type TodayItem = {
  instanceId: number;
  templateId: number;
  title: string;
  icon: string;
  section: 'sang' | 'toi';
  grp: 'A' | 'B';
  target: string;
  parentNote: string;
  subtasks: { id: string; title: string; icon: string; done: boolean }[];
  status: 'pending' | 'done' | 'adjusted';
  checkedAt: string | null;
  onTime: boolean | null;
  photoUrl: string | null;
};

/** tạo instances cho 1 ngày từ template active (idempotent) */
export function ensureInstances(date: string, childId?: number | null) {
  // multi-family: template của đúng family con đó + instance gắn child_id
  const templates = childId
    ? db.prepare(`SELECT t.id FROM task_templates t WHERE t.active=1 AND t.family_id=(SELECT family_id FROM users WHERE id=?)`).all(childId) as { id: number }[]
    : db.prepare(`SELECT id FROM task_templates WHERE active=1 AND family_id=(SELECT MIN(id) FROM families)`).all() as { id: number }[];
  const ins = db.prepare(
    `INSERT OR IGNORE INTO daily_instances (template_id, date, child_id) VALUES (?, ?, ?)`
  );
  for (const t of templates) ins.run(t.id, date, childId ?? null);
}

export function getToday(date: string, childId?: number | null): TodayItem[] {
  ensureInstances(date, childId);
  const rows = db.prepare(`
    SELECT i.id instanceId, i.status, i.checked_at, i.on_time, i.photo_path,
           t.id templateId, t.title, t.icon, t.section, t.grp, t.target_from, t.target_to,
           t.parent_note, t.subtasks, t.sort
    FROM daily_instances i JOIN task_templates t ON t.id = i.template_id
    WHERE i.date = ? AND (i.child_id=? OR (? IS NULL AND i.child_id IS NULL)) ORDER BY t.sort, i.id
  `).all(date, childId ?? null, childId ?? null) as any[];
  // khung giờ hiệu dụng: dồn sau lớp học (strategy-classes) — MỘT nguồn cho UI + on_time
  const hasTime = (r: any) => r.target_from && r.target_to;
  const eff = effectiveWindows(
    rows.filter(hasTime).map((r) => ({
      from: minutesOf(r.target_from),
      to: minutesOf(r.target_to),
    })), date, childId);
  const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  let k = 0;
  return rows.map((r) => {
    let target = r.target_from && r.target_to ? `${r.target_from}–${r.target_to}` : '';
    let shifted = false;
    if (hasTime(r)) {
      const w = eff[k++];
      target = `${fmt(w.from)}–${fmt(w.to)}`;
      shifted = w.shifted;
    }
    return {
      instanceId: r.instanceId,
      templateId: r.templateId,
      title: r.title,
      icon: r.icon,
      section: r.section,
      grp: r.grp,
      target,
      shifted, // bị dồn sau lớp học — UI hiện nhãn nhẹ
      parentNote: r.parent_note || '',
      subtasks: JSON.parse(r.subtasks || '[]'),
      status: r.status,
      checkedAt: r.checked_at,
      onTime: r.on_time === null ? null : !!r.on_time,
      photoUrl: r.photo_path ? `/api/photo?p=${encodeURIComponent(r.photo_path)}` : null,
    };
  });
}

/** checkin: ảnh OPTIONAL, tính on_time, render feedback Sao Nhí */
export function checkin(instanceId: number, photoPath: string | null): { feedback: string; onTime: boolean } {
  const inst = db.prepare(`SELECT * FROM daily_instances WHERE id=?`).get(instanceId) as any;
  if (!inst) throw new Error('instance not found');
  if (inst.status === 'done') throw new Error('việc này con đã làm rồi');
  const tpl = db.prepare(`SELECT * FROM task_templates WHERE id=?`).get(inst.template_id) as any;
  const now = nowVN();
  // deadline theo khung hiệu dụng (dồn sau lớp); tick TRƯỚC giờ lớp bắt đầu → so khung gốc
  // (con làm sớm càng được cộng đúng giờ — strategy-classes)
  let deadlineMin: number | null = tpl.target_to ? minutesOf(tpl.target_to) : null;
  if (tpl.target_from && tpl.target_to) {
    const [w] = effectiveWindows([{ from: minutesOf(tpl.target_from), to: minutesOf(tpl.target_to) }], inst.date, inst.child_id);
    const cls = classesOnDate(inst.date, inst.child_id);
    const overlap = cls.find((c) => minutesOf(tpl.target_from) < c.end && minutesOf(tpl.target_to) > c.start);
    const nowMin = minutesOfDayVN(now);
    deadlineMin = overlap && nowMin >= overlap.start ? w.to : minutesOf(tpl.target_to);
  }
  const onTime = deadlineMin != null ? minutesOfDayVN(now) <= deadlineMin : true;
  const minutesLate = deadlineMin != null ? Math.max(0, minutesOfDayVN(now) - deadlineMin) : 0;

  // lịch sử cùng việc: hôm qua + chuỗi
  const yesterday = db.prepare(
    `SELECT checked_at FROM daily_instances i JOIN task_templates t ON t.id=i.template_id
     WHERE i.template_id=? AND i.status='done' AND i.date<? ORDER BY i.date DESC LIMIT 1`
  ).get(inst.template_id, inst.date) as any;
  let minutesEarlier: number | undefined;
  if (yesterday?.checked_at) {
    const yd = new Date(yesterday.checked_at);
    const diff = minutesOfDayVN(yd) - minutesOfDayVN(now);
    if (diff >= 2) minutesEarlier = diff;
  }
  const streakRows = db.prepare(
    `SELECT date FROM daily_instances WHERE template_id=? AND status='done' AND date<? ORDER BY date DESC LIMIT 30`
  ).all(inst.template_id, inst.date) as { date: string }[];
  const streakDays = countConsecutive(streakRows.map((r) => r.date), addDays(inst.date, -1));

  db.prepare(
    `UPDATE daily_instances SET status='done', checked_at=?, on_time=?, photo_path=COALESCE(?, photo_path) WHERE id=?`
  ).run(now.toISOString(), onTime ? 1 : 0, photoPath, instanceId);

  const input: FeedbackInput = {
    title: tpl.title.replace(/^[^\p{L}\p{N}]+/u, ''),
    time: fmtTimeVN(now),
    onTime,
    minutesLate: minutesLate || undefined,
    minutesEarlier,
    streakDays,
    firstTime: !yesterday,
    groupA: tpl.grp === 'A',
    childName: SETTINGS.childName(),
  } as FeedbackInput & { childName: string };
  return { feedback: renderFeedback(input, feedbackOverrides()), onTime };
}

/** gắn ảnh cho việc đã done (ảnh optional — chụp sau) */
export function attachPhoto(instanceId: number, photoPath: string) {
  const r = db.prepare(`UPDATE daily_instances SET photo_path=? WHERE id=? AND status='done'`).run(photoPath, instanceId);
  if (r.changes === 0) throw new Error('việc chưa done hoặc không tồn tại');
}

function countConsecutive(dates: string[], startFrom: string): number {
  const set = new Set(dates);
  let n = 0;
  let cursor = startFrom;
  let skipped = 0;
  while (n + skipped < 400) {
    if (set.has(cursor)) { n++; skipped = 0; }
    else { skipped++; if (skipped >= 2) break; } // streak mềm: bỏ qua 1 ngày trống
    cursor = addDays(cursor, -1);
  }
  return n;
}

/** tổng kết ngày để review (parent) */
export function getDayForReview(date: string, childId?: number | null) {
  const items = getToday(date, childId);
  const c = (col: string, table: string, extra: string) =>
    childId ? db.prepare(`SELECT * FROM ${table} WHERE ${col}=? AND child_id=? ${extra}`).get(date, childId) as any
      : db.prepare(`SELECT * FROM ${table} WHERE ${col}=? ${extra}`).get(date) as any;
  const selfRating = c('date', 'self_ratings', '');
  const review = c('date', 'reviews', '');
  const adjustments = childId
    ? db.prepare(`SELECT a.* FROM adjustments a JOIN daily_instances i ON i.id=a.instance_id WHERE a.review_date=? AND i.child_id=?`).all(date, childId) as any[]
    : db.prepare(`SELECT * FROM adjustments WHERE review_date=?`).all(date) as any[];
  return { items, selfRating: selfRating || null, review: review || null, adjustments };
}

/** duyệt ngày → ghi ledger (append-only) */
export function acceptReview(date: string, reviewer: string, adjustments: { instanceId: number; reason: string }[], noteToChild: string, childId?: number | null) {
  const existing = childId
    ? db.prepare(`SELECT * FROM reviews WHERE date=? AND child_id=?`).get(date, childId) as any
    : db.prepare(`SELECT * FROM reviews WHERE date=?`).get(date) as any;
  if (existing?.status === 'accepted') throw new Error('day already accepted');
  const nowIso = nowVN().toISOString();

  const insertAdj = db.prepare(`INSERT INTO adjustments (review_date, instance_id, reason) VALUES (?,?,?)`);
  const adjustedIds = new Set<number>();
  for (const a of adjustments) { insertAdj.run(date, a.instanceId, a.reason); adjustedIds.add(a.instanceId); }

  const tx = runInTransaction(() => {
    db.prepare(`INSERT INTO reviews (date, status, reviewer, note_to_child, accepted_at, child_id) VALUES (?,?,?,?,?,?)
                ON CONFLICT(date, child_id) DO UPDATE SET status='accepted', reviewer=?, note_to_child=?, accepted_at=?`)
      .run(date, 'accepted', reviewer, noteToChild, nowIso, childId ?? null, reviewer, noteToChild, nowIso);

    const earn = db.prepare(`INSERT INTO point_ledger (date, type, amount, ref_type, ref_id, note, created_at, child_id) VALUES (?,?,?,?,?,?,?,?)`);
    let total = 0;
    const onTimePts = SETTINGS.pointsOnTime();
    const latePts = SETTINGS.pointsLate();
    for (const item of getToday(date, childId)) {
      if (item.status !== 'done') continue;
      if (adjustedIds.has(item.instanceId)) {
        earn.run(date, 'earn', 0, 'review', item.instanceId, 'điều chỉnh: 0 sao', nowIso, childId ?? null);
        continue;
      }
      const pts = item.grp === 'A' ? 0 : (item.onTime ? onTimePts : latePts);
      if (pts > 0) { earn.run(date, 'earn', pts, 'review', item.instanceId, `${item.title} (${item.onTime ? 'đúng giờ' : 'trễ'})`, nowIso, childId ?? null); total += pts; }
    }
    // tự chấm sao kèm điều tự hào
    const sr = childId ? db.prepare(`SELECT * FROM self_ratings WHERE date=? AND child_id=?`).get(date, childId) as any : db.prepare(`SELECT * FROM self_ratings WHERE date=?`).get(date) as any;
    const selfPts = SETTINGS.pointsSelfRating();
    if (sr && (sr.proud_text || sr.proud_photo) && selfPts > 0) {
      earn.run(date, 'earn', selfPts, 'self_rating', null, 'tự chấm sao + điều tự hào', nowIso, childId ?? null);
      total += selfPts;
    }
    // streak bonus theo mốc cấu hình — mỗi mốc chỉ thưởng 1 lần
    const goodDays = goodDaysBefore(date);
    const streak = softStreak(goodDays, date);
    const milestone = SETTINGS.streakMilestone();
    const milestones = Math.floor(streak / milestone);
    const already = db.prepare(`SELECT COUNT(*) c FROM point_ledger WHERE type='bonus' AND note LIKE 'chuỗi %' AND date<=?`).get(date) as any;
    if (milestones > already.c) {
      const bonus = SETTINGS.pointsStreakBonus();
      earn.run(date, 'bonus', bonus, 'streak', null, `chuỗi ${streak} ngày`, nowIso, childId ?? null);
      total += bonus;
    }
    return total;
  });
  return tx;
}

/** các "ngày tốt" (≥10 việc nhóm B done) trước `date` */
export function goodDaysBefore(date: string, childId?: number | null): string[] {
  const rows = db.prepare(`
    SELECT i.date, SUM(CASE WHEN t.grp='B' AND i.status='done' THEN 1 ELSE 0 END) b_done
    FROM daily_instances i JOIN task_templates t ON t.id=i.template_id
    WHERE i.date < ? AND (i.child_id=? OR (? IS NULL AND i.child_id IS NULL)) GROUP BY i.date HAVING b_done >= 10 ORDER BY i.date DESC LIMIT 60
  `).all(date, childId ?? null, childId ?? null) as any[];
  return rows.map((r) => r.date);
}

export function balance(childId?: number | null): number {
  // multi-family: số dư theo TỪNG CON (null = tổng legacy cho công cụ nội bộ)
  const r = childId == null
    ? db.prepare(`SELECT COALESCE(SUM(amount),0) s FROM point_ledger`).get() as any
    : db.prepare(`SELECT COALESCE(SUM(amount),0) s FROM point_ledger WHERE child_id=?`).get(childId) as any;
  return r.s;
}

/** gợi ý tốt nghiệp các việc nhóm B (fading) — ngưỡng cấu hình được trong Admin */
export function graduationCandidates(today: string) {
  const tpls = db.prepare(`SELECT * FROM task_templates WHERE grp='B' AND active=1`).all() as any[];
  const windowDays = SETTINGS.graduationDays();
  const threshold = SETTINGS.graduationRate();
  const hist = db.prepare(`
    SELECT template_id, date, status, on_time FROM daily_instances WHERE date >= ? ORDER BY date
  `).all(addDays(today, -windowDays)) as any[];
  const out: { templateId: number; title: string; onTimeRate: number; days: number }[] = [];
  for (const t of tpls) {
    const h = hist.filter((x) => x.template_id === t.id);
    const done = h.filter((x) => x.status === 'done');
    if (done.length < 10) continue;
    const rate = done.filter((x) => x.on_time).length / done.length;
    if (rate >= threshold) out.push({ templateId: t.id, title: t.title, onTimeRate: rate, days: done.length });
  }
  return out;
}

/* ───────── Lớp học thêm & khung giờ hiệu dụng (strategy-classes.md) ───────── */

export interface ClassBlock { id: number; title: string; icon: string; start: number; end: number; weekday: number }

/** lớp học của con này trong NGÀY đó (weekly + còn hạn, inclusive) */
export function classesOnDate(date: string, childId?: number | null): ClassBlock[] {
  const [y, m, d] = date.split('-').map(Number);
  const wd = new Date(y, m - 1, d).getDay(); // 0=CN
  const weekday = wd === 0 ? 8 : wd + 1;     // 2=T2 … 8=CN
  const rows = db.prepare(`SELECT * FROM classes WHERE active=1 AND weekday=?`).all(weekday) as any[];
  const mm = (t: string) => { const [h, i] = t.split(':').map(Number); return h * 60 + i; };
  return rows
    .filter((c) => (!c.starts_on || c.starts_on <= date) && (!c.ends_on || date <= c.ends_on))
    .filter((c) => c.child_id == null || c.child_id === childId)
    .map((c) => ({ id: c.id, title: c.title, icon: c.icon, start: mm(c.start_hhmm), end: mm(c.end_hhmm), weekday }));
}

/** chế độ xử xung đột: auto_shift (mặc định) | parallel */
export function conflictMode(): 'auto_shift' | 'parallel' {
  const r = db.prepare(`SELECT value FROM app_settings WHERE key='class_conflict_mode'`).get() as any;
  return r?.value === 'parallel' ? 'parallel' : 'auto_shift';
}

/** dồn 1 khung qua các khối cứng (lớp + khung đã đặt) — chuỗi đầy đủ, giữ độ dài */
function pushPast(start: number, end: number, blocks: { s: number; e: number }[]): { s: number; e: number } {
  let s = start, e = end, moved = true;
  while (moved) {
    moved = false;
    for (const b of blocks) {
      if (s < b.e && e > b.s) { const dur = Math.max(0, e - s); s = b.e; e = s + dur; moved = true; }
    }
  }
  return { s, e };
}

/**
 * Khung giờ hiệu dụng của danh sách việc trong ngày (strategy-classes):
 * auto_shift → dồn chuỗi sau lớp (sort theo start, không việc nào chồng nhau/on lớp);
 * parallel → giữ nguyên. Trả theo THỨ TỰ ĐẦU VÀO.
 */
export function effectiveWindows(items: { from: number; to: number }[], date: string, childId?: number | null): { from: number; to: number; shifted: boolean }[] {
  const idx = items.map((it, i) => i);
  if (conflictMode() === 'parallel') return items.map((it) => ({ from: it.from, to: it.to, shifted: false }));
  const classes = classesOnDate(date, childId);
  if (classes.length === 0) return items.map((it) => ({ from: it.from, to: it.to, shifted: false }));
  const blocks = classes.map((c) => ({ s: c.start, e: c.end })).sort((a, b) => a.s - b.s);
  const placed: { s: number; e: number }[] = [];
  const sorted = idx.slice().sort((a, b) => items[a].from - items[b].from);
  const out: { from: number; to: number; shifted: boolean }[] = new Array(items.length);
  for (const i of sorted) {
    const w = pushPast(items[i].from, items[i].to, [...blocks, ...placed]);
    placed.push(w);
    out[i] = { from: w.s, to: w.e, shifted: w.s !== items[i].from };
  }
  return out;
}
