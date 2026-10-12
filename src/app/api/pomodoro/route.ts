import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { nowVN, dateStrVN } from '@/lib/dates';
import { currentRole } from '@/lib/auth';
import { appletv, inSafeWindow, logHome } from '@/lib/home';
import { validatePomodoro, idleExpired, tvOverdue } from '@/lib/pomodoro';
import { getSetting } from '@/lib/settings';

/** quét 1 phiên đang chạy: tắt TV quá hạn (L1) + đóng phiên idle 30' — mọi đường đọc trạng thái đều qua đây */
function sweepActive(now: Date) {
  const active = db.prepare(`SELECT * FROM pomodoro_sessions WHERE status='running' ORDER BY id DESC LIMIT 1`).get() as any;
  if (!active) return null;
  // L1: TV đã cast + hết reward + grace → tắt TV dù ai có bấm gì không (app chết/ởng bỏ tab vẫn an toàn)
  if (tvOverdue(active, now)) {
    if (appletv.paired()) {
      logHome(`L1 insurance → TV home + sleep (phiên #${active.id} quá grace)`);
      appletv.pomodoroEnd();
    }
    const t = now.toISOString();
    db.prepare(`UPDATE pomodoro_sessions SET tv_off_at=? WHERE id=?`).run(t, active.id);
    active.tv_off_at = t;
  }
  // idle-expire: có quyền 30' không tham gia → đóng, coi như hết quyền
  if (idleExpired(active, now)) {
    if (active.cast_atv_at && !active.tv_off_at && appletv.paired()) {
      logHome(`idle-expire → TV home + sleep (phiên #${active.id})`);
      appletv.pomodoroEnd();
      db.prepare(`UPDATE pomodoro_sessions SET tv_off_at=? WHERE id=?`).run(now.toISOString(), active.id);
    }
    logHome(`idle-expire → đóng phiên #${active.id} (kind=${active.kind}, 30' không tham gia)`);
    db.prepare(`UPDATE pomodoro_sessions SET status='completed' WHERE id=?`).run(active.id);
    return null;
  }
  return active;
}

/** quét tới khi ổn định — có thể có nhiều phiên stale xếp chồng (vd phiên kẹt từ hôm trước) */
function sweepAll(now: Date) {
  let last = sweepActive(now);
  for (let i = 0; i < 10 && last === null; i++) last = sweepActive(now);
  return last;
}

/** GET → phiên đang chạy (sau sweep) + lịch sử hôm nay */
export async function GET() {
  const role = await currentRole();
  if (!role) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const now = nowVN();
  const active = sweepAll(now) || db.prepare(`SELECT * FROM pomodoro_sessions WHERE status='running' ORDER BY id DESC LIMIT 1`).get() || null;
  const today = dateStrVN();
  const history = db.prepare(`SELECT * FROM pomodoro_sessions WHERE date=? ORDER BY id DESC LIMIT 20`).all(today);
  const maxReward = Number(getSetting('pomodoro_max_reward', '10'));
  return NextResponse.json({ active, history, maxReward, now: now.toISOString() });
}

/**
 * POST /api/pomodoro
 * { action:'start', label, workMin, rewardMin }
 * { action:'claim-reward' }            → bắt đầu đếm quà (khi con thật sự mở YouTube) — KHÔNG tự đụng TV
 * { action:'cast-reward' }             → LỆNH CHỦ ĐỘNG mở YouTube trên Apple TV (batch6: thay auto-hook)
 * { action:'play' }                    → con bắt đầu xem video trong app (chống idle-expire tắt nhầm)
 * { action:'complete' }                → đóng phiên (tự nguyện sớm hoặc hết quà); TV đang cast thì tắt TV
 * { action:'cancel' }
 */
export async function POST(req: Request) {
  const role = await currentRole();
  if (!role) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { action, label, workMin, rewardMin } = await req.json().catch(() => ({}));
  const now = nowVN();

  if (action === 'start') {
    const maxReward = Number(getSetting('pomodoro_max_reward', '10'));
    const err = validatePomodoro(Number(workMin), Number(rewardMin), maxReward);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    // chỉ 1 phiên chạy cùng lúc
    db.prepare(`UPDATE pomodoro_sessions SET status='cancelled' WHERE status='running'`).run();
    const started = now.toISOString();
    const workEnds = new Date(now.getTime() + Number(workMin) * 60000).toISOString();
    const info = db.prepare(
      `INSERT INTO pomodoro_sessions (date, label, work_min, reward_min, started_at, work_ends_at) VALUES (?,?,?,?,?,?)`
    ).run(dateStrVN(), String(label || 'Việc của con'), Number(workMin), Number(rewardMin), started, workEnds);
    return NextResponse.json({ ok: true, id: info.lastInsertRowid });
  }

  const active = (sweepAll(now) || db.prepare(`SELECT * FROM pomodoro_sessions WHERE status='running' ORDER BY id DESC LIMIT 1`).get()) as any;
  if (!active) return NextResponse.json({ error: 'chưa có phiên nào đang chạy' }, { status: 400 });

  if (action === 'claim-reward') {
    if (active.reward_started_at) return NextResponse.json({ error: 'quà đã bắt đầu rồi' }, { status: 400 });
    if (now.getTime() < new Date(active.work_ends_at).getTime())
      return NextResponse.json({ error: 'chưa hết giờ làm — cố lên!' }, { status: 400 });
    const rewardEnds = new Date(now.getTime() + active.reward_min * 60000).toISOString();
    db.prepare(`UPDATE pomodoro_sessions SET reward_started_at=?, reward_ends_at=? WHERE id=?`)
      .run(now.toISOString(), rewardEnds, active.id);
    // batch6: KHÔNG còn auto-connect Apple TV ở đây — con/bố bấm "Xem trên TV" mới đụng TV
    return NextResponse.json({ ok: true });
  }
  if (action === 'cast-reward') {
    // lệnh CHỦ ĐỘNG duy nhất mà child token được gọi TV — chỉ hợp lệ khi đang có quà + cửa sổ an toàn
    if (!active.reward_started_at || !active.reward_ends_at || now.getTime() >= new Date(active.reward_ends_at).getTime())
      return NextResponse.json({ error: 'đang không có quà YouTube đang chạy' }, { status: 400 });
    if (active.cast_atv_at) return NextResponse.json({ ok: true, already: true }); // idempotent
    if (!appletv.paired()) return NextResponse.json({ error: 'Apple TV chưa ghép đôi — xem trong app nhé!' }, { status: 400 });
    if (!inSafeWindow()) return NextResponse.json({ error: 'Đêm rồi — TV nghỉ rồi, mai xem nhé!' }, { status: 400 });
    logHome(`cast-reward (chủ động) → TV wake + YouTube (phiên #${active.id})`);
    appletv.pomodoroStart();
    db.prepare(`UPDATE pomodoro_sessions SET cast_atv_at=? WHERE id=?`).run(now.toISOString(), active.id);
    return NextResponse.json({ ok: true });
  }
  if (action === 'play') {
    // con bắt đầu xem video trong app — neo first_play_at để idle-expire không tắt phiên đang xem
    if (!active.first_play_at) {
      db.prepare(`UPDATE pomodoro_sessions SET first_play_at=? WHERE id=?`).run(now.toISOString(), active.id);
    }
    return NextResponse.json({ ok: true });
  }
  if (action === 'complete') {
    db.prepare(`UPDATE pomodoro_sessions SET status='completed' WHERE id=?`).run(active.id);
    // chỉ tắt TV nếu phiên này THẬT SỰ đã cast TV (bỏ auto-hook — không đụng TV không liên quan)
    if (active.cast_atv_at && !active.tv_off_at && appletv.paired()) {
      logHome(`complete → TV home + sleep (phiên #${active.id} có cast)`);
      appletv.pomodoroEnd();
      db.prepare(`UPDATE pomodoro_sessions SET tv_off_at=? WHERE id=?`).run(now.toISOString(), active.id);
    }
    return NextResponse.json({ ok: true });
  }
  if (action === 'cancel') {
    db.prepare(`UPDATE pomodoro_sessions SET status='cancelled' WHERE id=?`).run(active.id);
    if (active.cast_atv_at && !active.tv_off_at && appletv.paired()) {
      logHome(`cancel → TV home + sleep (phiên #${active.id} có cast)`);
      appletv.pomodoroEnd();
      db.prepare(`UPDATE pomodoro_sessions SET tv_off_at=? WHERE id=?`).run(now.toISOString(), active.id);
    }
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
