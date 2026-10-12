// Nạp danh mục sách từ books/catalog.json (tùy chọn — tự chuẩn bị epub của gia đình bạn)
// Không có catalog → bỏ qua, thư viện vẫn dùng được (upload .epub qua Admin → Tặng sao & Sách)
import fs from 'fs';
import path from 'path';
import db from '../src/lib/db';

const CATALOG = path.join(process.env.KH_BOOKS_DIR || path.join(process.cwd(), 'books'), 'catalog.json');
if (!fs.existsSync(CATALOG)) {
  console.log('• Không tìm thấy books/catalog.json — bỏ qua seed sách (upload epub qua Admin nếu cần)');
} else {
  const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8')) as any[];
  const count = (db.prepare(`SELECT COUNT(*) c FROM books`).get() as any).c;
  if (count === 0) {
    const ins = db.prepare(`INSERT OR IGNORE INTO books (title, author, file, size_mb) VALUES (?,?,?,?)`);
    for (const b of catalog) ins.run(b.title, b.author, b.file, b.size_mb);
    console.log(`✓ Seed ${catalog.length} cuốn vào thư viện`);
  } else console.log('• books đã có, bỏ qua');
}
