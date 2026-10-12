import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PHOTOS_DIR } from './db';

/** lưu ảnh base64 → trả về relative path (lưu DB) */
export function savePhoto(date: string, dataUrl: string, prefix = 'ph'): string {
  const m = dataUrl.match(/^data:image\/(jpeg|png|webp);base64,(.+)$/);
  if (!m) throw new Error('invalid image');
  const ext = m[1] === 'png' ? 'png' : m[1] === 'webp' ? 'webp' : 'jpg';
  const dir = path.join(PHOTOS_DIR, date);
  fs.mkdirSync(dir, { recursive: true });
  const name = `${prefix}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  fs.writeFileSync(path.join(dir, name), Buffer.from(m[2], 'base64'));
  return `${date}/${name}`;
}

/** đọc ảnh an toàn — chỉ trong PHOTOS_DIR */
export function readPhoto(rel: string): Buffer {
  const full = path.resolve(PHOTOS_DIR, rel);
  if (!full.startsWith(PHOTOS_DIR)) throw new Error('path traversal');
  return fs.readFileSync(full);
}
