// Home Automation — wrapper atvremote (pyatv) chạy trên Mac Mini nhà
// Strategy: docs/strategy-home-automation.md — soundbar AirPlay verified, ATV chờ pair
import { execFile } from 'child_process';
import { appendFile } from 'fs/promises';
import path from 'path';

const ATVREMOTE = process.env.KH_ATVREMOTE || 'atvremote';
const SOUNDBAR_IP = process.env.KH_SOUNDBAR_IP || '';
const LOG_PATH = path.join(process.env.KH_DATA_DIR || path.join(process.cwd(), 'data'), 'home-automation.log');

export function logHome(line: string) {
  appendFile(LOG_PATH, `${new Date().toISOString()} ${line}\n`).catch(() => {});
}

/** chạy atvremote với timeout — trả stdout hoặc throw lỗi gọn.
 *  QUA SSH LOOPBACK: macOS Local Network Privacy chặn LaunchAgent process truy cập LAN
 *  trực tiếp (OSError 65 No route to host — debug 06/10 bằng LaunchAgent test thật);
 *  phiên ssh có quyền mạng local nên lệnh chạy OK từ đó. */
export function atv(ip: string, args: string[], timeoutMs = 15_000): Promise<string> {
  const cmd = `${ATVREMOTE} -s ${ip} ${args.map((a) => `'${a.replace(/'/g, `'\\''`)}'`).join(' ')}`;
  return new Promise((resolve, reject) => {
    execFile('/usr/bin/ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=5', process.env.KH_SSH_TARGET || '127.0.0.1', cmd], { timeout: timeoutMs }, (err, stdout, stderr) => {
      const out = (stdout || '').trim();
      if (err) {
        const detail = (stderr || '').trim().split('\n').slice(-4).join(' | ') || err.message;
        logHome(`FAIL ${ip} ${args.join(' ')} → code=${err.code} ${detail}`);
        reject(new Error(detail.slice(0, 300)));
      } else {
        logHome(`OK ${ip} ${args.join(' ')}`);
        resolve(out);
      }
    });
  });
}

export const soundbar = {
  ip: SOUNDBAR_IP,
  volumeUp: () => atv(SOUNDBAR_IP, ['volume_up']),
  volumeDown: () => atv(SOUNDBAR_IP, ['volume_down']),
  /** phát 1 file audio (wav/mp3) từ server ra soundbar qua AirPlay */
  playFile: (absPath: string) => atv(SOUNDBAR_IP, [`stream_file=${absPath}`], 60_000 * 30),
  stop: () => atv(SOUNDBAR_IP, ['stop']).catch(() => ''), // stop có thể không hỗ trợ — im lặng
  info: () => atv(SOUNDBAR_IP, ['device_info']),
};

/** Apple TV "Living Room" — đã ghép đôi Companion 06/10 (credentials lưu trên Mini) */
const APPLETV_IP = process.env.KH_APPLETV_IP || '';
const ATV_CREDS_FILE = path.join(process.env.KH_DATA_DIR || path.join(process.cwd(), 'data'), 'atv-companion-creds');

function atvCreds(): string | null {
  try {
    const fs = require('fs') as typeof import('fs');
    const c = fs.readFileSync(ATV_CREDS_FILE, 'utf8').trim();
    return c || null;
  } catch { return null; }
}

export const appletv = {
  ip: APPLETV_IP,
  paired: () => !!atvCreds(),
  cmd: (args: string[]) => {
    const creds = atvCreds();
    if (!creds) return Promise.reject(new Error('Apple TV chưa ghép đôi'));
    return atv(APPLETV_IP, ['--companion-credentials', creds, ...args]);
  },
  info: () => appletv.cmd(['device_info']),
  turnOn: () => appletv.cmd(['turn_on']),
  turnOff: () => appletv.cmd(['turn_off']),
  home: () => appletv.cmd(['home']),
  /** mở app theo bundle id — vd com.google.ios.youtube */
  launchApp: (bundleId: string) => appletv.cmd([`launch_app=${bundleId}`]),
  playPause: () => appletv.cmd(['play_pause']),
  /** luồng pomodoro quà: thức dậy + mở YouTube — KHÔNG đợi (fire-and-forget) */
  pomodoroStart: (bundle = 'com.google.ios.youtube') => {
    appletv.turnOn().then(() => appletv.launchApp(bundle)).catch((e) => logHome(`pomodoroStart FAIL: ${e}`));
  },
  /** hết quà: về home + ngủ — timer cứng độc lập app đã có L2 */
  pomodoroEnd: () => {
    appletv.home().then(() => appletv.turnOff()).catch((e) => logHome(`pomodoroEnd FAIL: ${e}`));
  },
};

/** Cửa sổ an toàn: KHÔNG lệnh audio/TV sau 20h30 (Bé ngủ 21h30) — strategy defenses */
export function inSafeWindow(now = new Date()): boolean {
  const h = now.getHours() + now.getMinutes() / 60; // giờ máy Mini = giờ VN nhà
  return h >= 6 && h < 20.5;
}
