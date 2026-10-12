// Camera nhà (JOOAN W8-U, 2 LENS: ch00_0 + ch01_0) — xem HLS qua ffmpeg trên Mac Mini
// RTSP chỉ đạt từ Mini (LAN) → ffmpeg chạy qua ssh loopback FOREGROUND (Node giữ child).
// Bài học LNP 10/10: nohup-detached bị macOS Local Network Privacy chặn
// "No route to host" — foreground trong phiên ssh sống thì được (pattern atvremote).
// File HLS/playlist đọc fs local (data/ như src/lib/db.ts). Riêng tư: mọi route
// /api/cam/* phải check currentRole() — camera trong nhà không lộ ra ngoài.
import { execFile } from 'child_process';
import { appendFile } from 'fs/promises';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = process.env.KH_DATA_DIR || path.join(process.cwd(), 'data');
export const HLS_ROOT = process.env.KH_HLS_DIR || path.join(DATA_DIR, 'hls');
const LOG_PATH = path.join(DATA_DIR, 'camera.log');

/** 2 lens của camera JOOAN — cam 0 chính (khu học), cam 1 phụ */
export const CAM_IDS = [0, 1] as const;
export type CamId = (typeof CAM_IDS)[number];

export function logCam(line: string) {
  appendFile(LOG_PATH, `${new Date().toISOString()} ${line}\n`).catch(() => {});
}

/** shell single-quote như home.ts */
function shq(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/** chạy lệnh trên Mini qua ssh loopback — mirror home.ts (LNP an toàn) */
function ssh(cmd: string, timeoutMs = 15_000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('/usr/bin/ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=5', process.env.KH_SSH_TARGET || '127.0.0.1', cmd], { timeout: timeoutMs }, (err, stdout, stderr) => {
      if (err) {
        const detail = (stderr || '').trim().split('\n').slice(-3).join(' | ').slice(0, 200) || err.message;
        reject(new Error(detail));
      } else {
        resolve((stdout || '').trim());
      }
    });
  });
}

/** URL RTSP của lens N: ch0N_0. Env override: KH_RTSP_URL (cam0) / KH_RTSP_URL_2 (cam1). */
function rtspUrl(cam: CamId): string {
  if (cam === 0 && process.env.KH_RTSP_URL) return process.env.KH_RTSP_URL;
  if (cam === 1 && process.env.KH_RTSP_URL_2) return process.env.KH_RTSP_URL_2;
  const user = process.env.KH_CAMERA_USER;
  const pass = process.env.KH_CAMERA_PASS;
  const ip = process.env.KH_CAMERA_IP;
  if (!user || !pass || !ip) throw new Error('Cấu hình camera thiếu env: KH_CAMERA_USER / KH_CAMERA_PASS / KH_CAMERA_IP (xem .env.example)');
  return `rtsp://${user}:${encodeURIComponent(pass)}@${ip}/live/ch0${cam}_0`;
}

/** đường dẫn ffmpeg bên Mini: env KH_FFMPEG, không thì tìm trong PATH, fallback homebrew */
const FFMPEG_RESOLVE = `"$(command -v ffmpeg || echo ${shq(process.env.KH_FFMPEG || '/opt/homebrew/bin/ffmpeg')})"`;

/** segment .ts coi là "còn sống" nếu mới hơn 8s (hls_time 2s × list 5 = trễ tối đa ~10s) */
const SEGMENT_FRESH_S = 8;

/** pgrep marker per-cam: dir name chứa "kids-habit-hls-cam<N>-..." — [/] chống tự khớp */
function pgrepPat(cam: CamId): string {
  return `kids-habit-hls-cam${cam}[^ ]*[/]index[.]m3u8`;
}

/** tên thư mục HLS per cam — sinh MỘT lần, persist dir-cam<N>.txt.
 *  Tên PHẢI chứa "cam<N>" để pgrep pattern khớp đúng process của lens đó
 *  (bài học 10/10: reuse dir legacy không chứa cam id → pgrep lạcprocess, spawn trùng). */
function streamDirName(cam: CamId): string {
  const f = path.join(HLS_ROOT, `dir-cam${cam}.txt`);
  try {
    const d = fs.readFileSync(f, 'utf8').trim();
    if (/^kids-habit-hls-cam\d-[0-9A-Za-z]{6,12}$/.test(d)) return d;
  } catch { /* chưa có */ }
  const d = `kids-habit-hls-cam${cam}-${crypto.randomBytes(4).toString('hex')}`;
  fs.mkdirSync(HLS_ROOT, { recursive: true });
  fs.writeFileSync(f, d);
  return d;
}

/** thư mục HLS của lens N (đọc fs LOCAL — server chạy trên cùng Mini với ffmpeg) */
export function getHlsDir(cam: CamId = 0): string {
  return path.join(HLS_ROOT, streamDirName(cam));
}

/** ảnh chụp nhanh JPEG per lens (fallback khi HLS chưa lên) */
export function getSnapshotPath(cam: CamId = 0): string {
  return path.join(HLS_ROOT, cam === 0 ? 'snapshot.jpg' : `snapshot-cam${cam}.jpg`);
}

async function ffmpegAlive(cam: CamId): Promise<boolean> {
  const out = await ssh(`pgrep -f ${shq(pgrepPat(cam))} | head -3`);
  return out.length > 0;
}

// ---- per-cam state: throttle + ssh child giữ ffmpeg foreground ----
const spawnBusy = new Map<CamId, Promise<void>>();
const lastSpawnAt = new Map<CamId, number>();
const streamChildren = new Map<CamId, ReturnType<typeof execFile>>();

/** dẹp ffmpeg cũ của lens N (nếu còn) trước khi spawn mới */
async function killStaleFfmpeg(cam: CamId): Promise<void> {
  try { await ssh(`pkill -f ${shq(pgrepPat(cam))} 2>/dev/null; true`, 5_000); } catch { /* ok */ }
}

/** bật ffmpeg HLS cho lens N nếu chưa chạy — FOREGROUND trong phiên ssh do Node giữ */
export async function ensureStream(cam: CamId = 0): Promise<void> {
  const busy = spawnBusy.get(cam);
  if (busy) return busy;
  const child = streamChildren.get(cam);
  if (child && child.exitCode === null) return;
  const last = lastSpawnAt.get(cam) || 0;
  if (Date.now() - last < 10_000) return;
  const p = (async () => {
    try {
      if (await ffmpegAlive(cam)) return;
      await killStaleFfmpeg(cam);
      const dir = getHlsDir(cam);
      fs.mkdirSync(dir, { recursive: true });
      const cmd = `${FFMPEG_RESOLVE} -rtsp_transport tcp -i ${shq(rtspUrl(cam))} -c:v copy -f hls -hls_time 2 -hls_list_size 5 -hls_flags delete_segments+append_list+omit_endlist -g 30 -loglevel warning -y ${shq(path.join(dir, 'index.m3u8'))}`;
      const c = execFile(
        '/usr/bin/ssh',
        ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=5', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=3', process.env.KH_SSH_TARGET || '127.0.0.1', cmd],
        { timeout: 0, maxBuffer: 1024 },
        (err, _out, stderr) => {
          const tail = (stderr || '').trim().split('\n').slice(-3).join(' | ').slice(0, 300);
          logCam(`cam${cam} stream exited code=${err ? (err as any).code ?? 'err' : 0}${tail ? ` :: ${tail}` : ''}`);
          streamChildren.delete(cam);
        }
      );
      streamChildren.set(cam, c);
      lastSpawnAt.set(cam, Date.now());
      logCam(`cam${cam} SPAWN hls (ssh foreground) dir=${dir}`);
    } catch (e) {
      logCam(`cam${cam} SPAWN FAIL: ${e instanceof Error ? e.message : e}`);
    } finally {
      spawnBusy.delete(cam);
    }
  })();
  spawnBusy.set(cam, p);
  return p;
}

/** trạng thái lens N: ffmpeg sống VÀ segment .ts mới nhất < 8s */
export async function streamStatus(cam: CamId = 0): Promise<{ live: boolean; reason: string }> {
  try {
    const dir = getHlsDir(cam);
    const cmd = `if pgrep -f ${shq(pgrepPat(cam))} >/dev/null 2>&1; then N=$(ls -t ${shq(dir)}/*.ts 2>/dev/null | head -1); if [ -n "$N" ]; then echo "alive $(( $(date +%s) - $(stat -f %m "$N") ))"; else echo "starting"; fi; else echo "dead"; fi`;
    const out = await ssh(cmd, 8_000);
    if (out === 'dead') return { live: false, reason: 'no-process' };
    if (out === 'starting') return { live: false, reason: 'starting' };
    const m = out.match(/^alive (\d+)$/);
    if (m) {
      const age = Number(m[1]);
      return age <= SEGMENT_FRESH_S ? { live: true, reason: 'ok' } : { live: false, reason: `stale-segments (${age}s)` };
    }
    return { live: false, reason: `unknown: ${out.slice(0, 60)}` };
  } catch (e) {
    return { live: false, reason: `ssh: ${e instanceof Error ? e.message.slice(0, 80) : e}` };
  }
}

/** chụp 1 frame JPEG của lens N (fallback khi stream chưa lên / chết) */
export async function snapshot(cam: CamId = 0): Promise<string> {
  const jpg = getSnapshotPath(cam);
  const cmd = `${FFMPEG_RESOLVE} -rtsp_transport tcp -i ${shq(rtspUrl(cam))} -frames:v 1 -q:v 5 -y ${shq(jpg)}`;
  await ssh(cmd, 20_000);
  return jpg;
}

/** tiện cho route status: đảm bảo stream + trả trạng thái (không đợi spawn xong) */
export async function startIfIdle(cam: CamId = 0): Promise<{ live: boolean; reason: string }> {
  const budget = ensureStream(cam).catch(() => {});
  await Promise.race([budget, new Promise((r) => setTimeout(r, 3_000))]);
  return streamStatus(cam);
}
