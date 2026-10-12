// Gemini image generation — server-only (batch6 T3: colorbook template)
// Đường sinh ảnh: KHÔNG dùng paid API — dùng Gemini WEB (Nano Banana) qua script
// gen-image.js trên Mac Mini (CDP in-page fetch trong tab gemini đã login của
// debug Chrome :9223 — hạ tầng của vibe-gemini-orchestrator/webbridge).
// Fallback: agy CLI (vibe-antigravity-orchestrator, quota Gemini Pro subscription).
// Chạy qua ssh loopback FOREGROUND (bài học LNP: process detach mất quyền LAN).
import { execFile } from 'child_process';
import { appendFile } from 'fs/promises';
import path from 'path';
import fs from 'fs';
import os from 'os';

const LOG = path.join(process.env.KH_DATA_DIR || path.join(process.cwd(), 'data'), 'gemini.log');
const GEN_IMAGE_JS = process.env.KH_GEN_IMAGE_JS || '';
const NODE_BIN = process.env.KH_NODE_BIN || '/opt/homebrew/bin/node';

function log(line: string) {
  appendFile(LOG, `${new Date().toISOString()} ${line}\n`).catch(() => {});
}

/** ép đề xuất của con thành mô tả line-art an toàn, tô được (unit-test được) */
export function sanitizePrompt(raw: string): string {
  return raw.trim().slice(0, 200);
}

/** prompt chibi cố định cho flow "chụp ảnh → tranh tô màu" — contract unit-test:
 *  phải là line-art tô được (nét đen + nền trắng + KHÔNG đổ bóng/màu) cho trẻ 6 tuổi.
 *  TIẾNG VIỆT + khai báo mục đích tư gia (bố 11/10: tránh bị đánh banned-quyền) */
export function chibiPrompt(): string {
  return 'Tranh tô màu cho bé 6 tuổi: biến ảnh này thành nhân vật hoạt hình chibi đáng yêu, '
    + 'đầu to, hình khối đơn giản, viền đen dày rõ, nền trắng tinh, không tô màu, '
    + 'tranh không quá phức tạp, nhiều khoảng trống để bé dễ tô. '
    + 'Mục đích sử dụng hoàn toàn là để cho bé tập tô màu ở nhà, tuyệt đối không phải sản phẩm thương mại hay dùng mục đích public khác.';
}

/** check magic bytes JPEG/PNG — server KHÔNG tin mime client khai (luật project) */
export function isJpegOrPng(buf: Buffer): boolean {
  const jpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const png = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  return jpg || png;
}

// TIẾNG VIỆT + khai báo mục đích tư gia — English prompt bị Gemini chặn/rỗng response
// (evidence 11/10: 2 lần EN fail rỗng )]}' — prompt VN chạy ngay, ảnh 191KB)
const PREFIX = 'Tranh tô màu đen trắng cho bé 6 tuổi: ';
const SUFFIX = '. Nét vẽ hoạt hình dễ thương, đường viền đen dày rõ, nền trắng tinh, không tô màu, hình khối to đơn giản, tranh KHÔNG quá phức tạp, có nhiều khoảng trống để bé 6 tuổi dễ tô màu. Mục đích sử dụng hoàn toàn là để cho bé tập tô màu ở nhà, tuyệt đối không phải sản phẩm thương mại hay dùng mục đích public khác.';

/** chạy 1 lệnh trên Mini qua ssh loopback, foreground, trả stdout */
function sshMini(cmd: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('/usr/bin/ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=5', process.env.KH_SSH_TARGET || '127.0.0.1', cmd], { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error((stderr || err.message).slice(0, 300)));
      else resolve(stdout);
    });
  });
}

/** shell single-quote an toàn (như home.ts) — mọi tham số có khoảng trắng/phải đi qua đây */
function shq(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/** hạ tầng sẵn không — tab gemini login chưa thì báo thân thiện ngay (không treo 120s) */
export async function geminiConfigured(): Promise<boolean> {
  try {
    const out = await sshMini(`curl -s -m 3 http://127.0.0.1:9223/json/list 2>/dev/null | grep -c "gemini.google"`, 8000);
    return Number(out.trim()) > 0;
  } catch { return false; }
}

/** Gemini từ chối vì bản quyền/nhân vật có IP → lỗi riêng, message thân thiện cho con
 *  (11/10: "Bạch Tuyết" bị từ chối im lặng — gen-image.js giờ exit 3 + stderr "REFUSED:") */
function friendlyGenError(e: any): Error {
  const msg = String(e?.message || e);
  if (msg.includes('REFUSED')) {
    return new Error('Nhân vật này có bản quyền nên chú ma thuật không vẽ được — con tả nhân vật khác nhé, ví dụ "một nàng công chúa dễ thương" thay vì tên phim nhé! 🪄');
  }
  return new Error(msg || 'Chú ma thuật đang bận — thử lại nhé!');
}

/** sinh ảnh line-art → Buffer PNG. Gemini web primary, agy fallback. */
export async function generateLineArt(rawPrompt: string): Promise<Buffer> {
  const safe = sanitizePrompt(rawPrompt);
  if (!safe || safe.length < 2) throw new Error('Con kể chú ma thuật nghe xem con muốn vẽ gì nhé!');
  const full = PREFIX + safe + SUFFIX;

  // 1) Gemini web qua gen-image.js (CDP tab đã login) — free, Nano Banana
  try {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-'));
    const out = await sshMini(
      `${shq(NODE_BIN)} ${shq(GEN_IMAGE_JS)} ${shq(full)} ${shq(outDir)} cb`,
      150_000
    );
    const j = JSON.parse(out.trim().split('\n').pop() || '{}');
    const file: string | undefined = j?.files?.[0]?.path;
    if (!file) throw new Error('gen-image trả không có file');
    const b64 = (await sshMini(`base64 -i ${shq(file)}; rm -rf ${shq(outDir)}`, 30_000)).replace(/\s+/g, '');
    const buf = Buffer.from(b64, 'base64');
    if (buf.length < 5000) throw new Error('ảnh quá nhỏ — nghi hỏng');
    log(`OK web prompt="${safe}" bytes=${buf.length}`);
    return buf;
  } catch (e1: any) {
    log(`WEB FAIL: ${String(e1?.message || e1).slice(0, 150)}`);
    // từ chối bản quyền → fallback agy cũng sẽ từ chối — báo ngay, khỏi chờ 8 phút
    if (String(e1?.message || e1).includes('REFUSED')) throw friendlyGenError(e1);
    // 2) Fallback: agy CLI (Antigravity — quota Gemini Pro, cần OAuth login 1 lần trên Mini)
    try {
      const agyPrompt = 'Use the generate_image tool to create: ' + full + ' Report the exact file path of the generated image.';
      const out = await sshMini(
        `export PATH="$HOME/.local/bin:$PATH"; agy -p ${shq(agyPrompt)} --print-timeout 8m`,
        480_000
      );
      const m = out.match(/file:\/\/(\S+?\.(?:jpe?g|png))/i);
      if (!m) throw new Error('agy không trả path ảnh');
      const b64 = (await sshMini(`base64 -i ${shq(m[1])}`, 30_000)).replace(/\s+/g, '');
      const buf = Buffer.from(b64, 'base64');
      if (buf.length < 5000) throw new Error('ảnh agy quá nhỏ');
      log(`OK agy prompt="${safe}" bytes=${buf.length}`);
      return buf;
    } catch (e2: any) {
      log(`AGY FAIL: ${String(e2?.message || e2).slice(0, 150)}`);
      // từ chối bản quyền → KHÔNG fallback mù — báo ngay lý do cụ thể
      if (String(e1?.message || e1).includes('REFUSED') || String(e2?.message || e2).includes('REFUSED')) {
        throw friendlyGenError('REFUSED');
      }
      throw new Error('Chú ma thuật đang bận — bố ơi kiểm tra giúp: tab Gemini trên Chrome Mini cần đăng nhập, hoặc gõ "agy" trên Mini để login!');
    }
  }
}

/**
 * Sinh line-art CÓ ĐIỀU KIỆN bởi ảnh chụp (chibi colorbook) — gen-image.js
 * với arg thứ 4 = đường dẫn ảnh nguồn (trên Mini, data/ là local nên truyền
 * thẳng abs path). Ảnh nguồn do route đã validate magic bytes + savePhoto.
 */
export async function generateLineArtFromPhoto(promptText: string, photoAbsPath: string): Promise<Buffer> {
  try {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cbp-'));
    const out = await sshMini(
      `${shq(NODE_BIN)} ${shq(GEN_IMAGE_JS)} ${shq(promptText)} ${shq(outDir)} cbphoto ${shq(photoAbsPath)}`,
      240_000
    );
    const j = JSON.parse(out.trim().split('\n').pop() || '{}');
    const file: string | undefined = j?.files?.[0]?.path;
    if (!file) throw new Error('gen-image trả không có file');
    const b64 = (await sshMini(`base64 -i ${shq(file)}; rm -rf ${shq(outDir)}`, 30_000)).replace(/\s+/g, '');
    const buf = Buffer.from(b64, 'base64');
    if (buf.length < 5000) throw new Error('ảnh quá nhỏ — nghi hỏng');
    log(`OK photo-chibi bytes=${buf.length}`);
    return buf;
  } catch (e: any) {
    log(`PHOTO-CHIBI FAIL: ${String(e?.message || e).slice(0, 200)}`);
    throw friendlyGenError(e);
  }
}
