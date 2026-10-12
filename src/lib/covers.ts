// Trích cover thật từ EPUB (zip) — cache ra data/book-covers/
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { unzipSync, strFromU8 } from 'fflate';

const BOOKS_DIR = process.env.KH_BOOKS_DIR || path.join(process.cwd(), 'books');
const COVERS_DIR = path.join(process.env.KH_DATA_DIR || path.join(process.cwd(), 'data'), 'book-covers');

export function coverFile(epubFile: string): string {
  const key = crypto.createHash('md5').update(epubFile).digest('hex').slice(0, 12);
  return path.join(COVERS_DIR, `${key}.jpg`);
}

export function hasCover(epubFile: string): boolean {
  return fs.existsSync(coverFile(epubFile));
}

/** bóc cover từ epub — trả về true nếu thành công; fail im lặng (grid dùng fallback emoji) */
export function extractCover(epubFile: string): boolean {
  if (hasCover(epubFile)) return true;
  try {
    fs.mkdirSync(COVERS_DIR, { recursive: true });
    const buf = fs.readFileSync(path.join(BOOKS_DIR, epubFile));
    const files = unzipSync(new Uint8Array(buf));
    const names = Object.keys(files);

    // 1) đọc container.xml → OPF
    let opfName = names.find((n) => n.endsWith('META-INF/container.xml'));
    let coverHref: string | null = null;
    if (opfName) {
      const opfXml = strFromU8(files[opfName]);
      const m = opfXml.match(/full-path="([^"]+\.opf)"/);
      if (m) {
        const opfPath = m[1];
        const opfFile = files[opfPath] || files[names.find((n) => n.endsWith(path.basename(opfPath))) || ''];
        if (opfFile) {
          const xml = strFromU8(opfFile);
          const base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
          // properties="cover-image" (EPUB3) hoặc <meta name="cover" content="id"> (EPUB2)
          const p3 = xml.match(/<item[^>]+properties="[^"]*cover-image[^"]*"[^>]+href="([^"]+)"/)
            || xml.match(/<item[^>]+href="([^"]+)"[^>]+properties="[^"]*cover-image[^"]*"/);
          const p2id = xml.match(/<meta[^>]+name="cover"[^>]+content="([^"]+)"/);
          let href = p3?.[1] || null;
          if (!href && p2id) {
            const re = new RegExp(`<item[^>]+id="${p2id[1]}"[^>]+href="([^"]+)"`);
            href = xml.match(re)?.[1] || null;
          }
          if (href) coverHref = decodeURIComponent(base + href);
        }
      }
    }
    // 2) fallback: file ảnh có "cover" trong tên
    if (!coverHref) {
      coverHref = names.find((n) => /cover/i.test(n) && /\.(jpe?g|png)$/i.test(n)) || null;
    }
    // 3) fallback cuối: ảnh lớn nhất
    if (!coverHref) {
      let best = '', size = 0;
      for (const n of names) {
        if (/\.(jpe?g|png)$/i.test(n) && files[n].length > size) { size = files[n].length; best = n; }
      }
      coverHref = best || null;
    }
    if (!coverHref || !files[coverHref]) return false;

    fs.writeFileSync(coverFile(epubFile), Buffer.from(files[coverHref]));
    return true;
  } catch {
    return false;
  }
}
