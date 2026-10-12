import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import db, { PHOTOS_DIR, runInTransaction } from '@/lib/db';
import { nowVN, dateStrVN } from '@/lib/dates';
import { currentRole } from '@/lib/auth';
import { currentChildId } from '@/lib/childscope';
import { savePhoto } from '@/lib/photos';
import { safeTitle, isSafeColorbookRel } from '@/lib/colorbook';
import { generateLineArt, generateLineArtFromPhoto, chibiPrompt, isJpegOrPng, geminiConfigured } from '@/lib/gemini';

/** GET → template ĐÃ DUYỆT cho con (child) · thêm hàng chờ pending cho bố (parent)
 *  + lastWish: trạng thái yêu cầu vẽ gần nhất hôm nay (frontend poll khi đang sinh ảnh).
 *  QA 10/10: request dài qua Cloudflare từ browser bị treo (HTTP/3) → sinh ảnh
 *  chuyển sang async: POST trả NGAY, frontend poll GET này — không còn request dài. */
export async function GET() {
  const role = await currentRole();
  if (!role) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const today = dateStrVN();
  const approved = db.prepare(
    `SELECT id, prompt, COALESCE(NULLIF(title,''), prompt) AS title, image_path, created_at FROM colorbook_templates WHERE status='approved' ORDER BY COALESCE(sort, 9999), id DESC LIMIT 60`
  ).all();
  const pending = role === 'parent' || role === 'system_admin'
    ? db.prepare(`SELECT id, prompt, image_path, created_at FROM colorbook_templates WHERE status='pending' AND image_path!='' ORDER BY id DESC LIMIT 60`).all()
    : [];
  // wish gần nhất hôm nay: '' ảnh = đang sinh · có ảnh = done (kèm đường dẫn preview)
  const last = db.prepare(
    `SELECT id, prompt, image_path, status, created_at FROM colorbook_templates WHERE date(created_at)=? ORDER BY id DESC LIMIT 1`
  ).get(today) as any;
  let lastWish: string | null = null;
  let lastWishImage: string | null = null;
  if (last) {
    if (last.image_path === '') lastWish = 'generating';
    else if (last.status === 'pending') { lastWish = 'done'; lastWishImage = last.image_path; }
    else if (last.status === 'rejected' && last.image_path) { lastWish = 'done'; lastWishImage = last.image_path; } // đã quyết định nhưng ảnh còn
  }
  const lastWishId = last?.id ?? null;
  // 10/10 fix: lastWishId tính xong nhưng thiếu trong response — frontend cần id
  // để "discard" khi con chọn VẼ NGAY (không lưu mẫu)
  return NextResponse.json({ templates: approved, pending, lastWish, lastWishImage, lastWishId, configured: await geminiConfigured() });
}

/**
 * POST /api/colorbook
 * { action:'generate', prompt }            → con tả tranh → Gemini line-art → hàng chờ bố duyệt (≤5/ngày)
 * { action:'generate-photo', image }        → con chụp ảnh → Gemini vẽ chibi line-art từ ảnh (async như generate)
 * { action:'review', id, approve:boolean }  → bố duyệt/từ chối (parent-only)
 * { action:'rename', id, title }            → bố đặt lại tên hiển thị, tối đa 60 ký tự (parent-only)
 * { action:'delete', id }                   → bố xóa mẫu đã duyệt/ẩn + file ảnh colorbook (parent-only)
 * { action:'reorder', ids:[...] }           → bố đổi thứ tự mẫu approved, sort = 10,20,30… (parent-only)
 */
export async function POST(req: Request) {
  const role = await currentRole();
  if (!role) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const me = await import('@/lib/auth').then((m) => m.currentUser());
  const childId = me ? currentChildId(me) : null;
  const { action, prompt, id, approve, image, title, ids } = await req.json().catch(() => ({}));
  const now = nowVN();

  if (action === 'generate') {
    const text = String(prompt || '').trim();
    if (!text || text.length < 2) return NextResponse.json({ error: 'Con kể chú ma thuật nghe xem con muốn vẽ gì nhé!' }, { status: 400 });
    // trần 5 tranh chờ/ngày — chống spam và rate-limit
    const todayCount = db.prepare(
      `SELECT COUNT(*) c FROM colorbook_templates WHERE date(created_at)=? AND NOT (status='rejected' AND image_path='')`
    ).get(dateStrVN()) as any;
    if (todayCount.c >= 5) return NextResponse.json({ error: 'Hôm nay vẽ đủ 5 tranh rồi — mai vẽ tiếp nhé! 🎨' }, { status: 429 });
    // ASYNC (fix QA 10/10): insert row trống NGAY LẬP TỨC → trả response trong ~ms,
    // sinh ảnh chạy nền rồi UPDATE. Request dài qua Cloudflare/browser bị treo (HTTP/3).
    const info = db.prepare(`INSERT INTO colorbook_templates (prompt, image_path, status, created_at, child_id) VALUES (?, '', 'pending', ?, ?)`)
      .run(text, now.toISOString(), childId);
    const rowId = info.lastInsertRowid;
    void (async () => {
      try {
        const buf = await generateLineArt(text);
        const rel = savePhoto(dateStrVN(), `data:image/png;base64,${buf.toString('base64')}`, 'colorbook');
        db.prepare(`UPDATE colorbook_templates SET image_path=? WHERE id=?`).run(rel, rowId);
      } catch (e: any) {
        console.error('colorbook generate fail:', e?.message);
        db.prepare(`UPDATE colorbook_templates SET status='rejected', reviewed_at=? WHERE id=? AND image_path=''`)
          .run(new Date().toISOString(), rowId);
      }
    })();
    return NextResponse.json({ ok: true, queued: true });
  }

  if (action === 'generate-photo') {
    // con chụp ảnh → chibi colorbook. Cùng async pattern + trần 5/ngày như generate.
    const imageStr = String(image || '');
    const m = imageStr.match(/^data:image\/(jpeg|png);base64,(.+)$/);
    if (!m) return NextResponse.json({ error: 'Ảnh chưa đúng định dạng — con chụp lại nhé!' }, { status: 400 });
    const buf = Buffer.from(m[2], 'base64');
    // luật project: server KHÔNG tin mime client khai — check magic bytes thật
    if (!isJpegOrPng(buf)) return NextResponse.json({ error: 'Ảnh chưa đúng định dạng — con chụp lại nhé!' }, { status: 400 });
    if (buf.length > 10 * 1024 * 1024) return NextResponse.json({ error: 'Ảnh to quá — con chụp lại gần hơn nhé!' }, { status: 413 });
    const todayCount = db.prepare(
      `SELECT COUNT(*) c FROM colorbook_templates WHERE date(created_at)=? AND NOT (status='rejected' AND image_path='')`
    ).get(dateStrVN()) as any;
    if (todayCount.c >= 5) return NextResponse.json({ error: 'Hôm nay vẽ đủ 5 tranh rồi — mai vẽ tiếp nhé! 🎨' }, { status: 429 });
    // lưu ảnh nguồn vào data/ (riêng tư trẻ em — chỉ Mac Mini nhà, không cloud)
    const srcRel = savePhoto(dateStrVN(), image, 'colorsrc');
    const info = db.prepare(`INSERT INTO colorbook_templates (prompt, image_path, status, created_at, child_id) VALUES (?, '', 'pending', ?, ?)`)
      .run('📷 chibi từ ảnh', now.toISOString(), childId);
    const rowId = info.lastInsertRowid;
    void (async () => {
      try {
        // ảnh nguồn nằm ngay trên Mini (data/ local) → truyền abs path cho gen-image.js
        const art = await generateLineArtFromPhoto(chibiPrompt(), path.join(PHOTOS_DIR, srcRel));
        const rel = savePhoto(dateStrVN(), `data:image/png;base64,${art.toString('base64')}`, 'colorbook');
        db.prepare(`UPDATE colorbook_templates SET image_path=? WHERE id=?`).run(rel, rowId);
      } catch (e: any) {
        console.error('colorbook generate-photo fail:', e?.message);
        db.prepare(`UPDATE colorbook_templates SET status='rejected', reviewed_at=? WHERE id=? AND image_path=''`)
          .run(new Date().toISOString(), rowId);
      }
    })();
    return NextResponse.json({ ok: true, queued: true });
  }

  if (action === 'review') {
    if (role !== 'parent' && role !== 'system_admin') return NextResponse.json({ error: 'chỉ bố mẹ duyệt được' }, { status: 403 });
    const status = approve ? 'approved' : 'rejected';
    db.prepare(`UPDATE colorbook_templates SET status=?, reviewed_at=? WHERE id=? AND status='pending'`)
      .run(status, now.toISOString(), Number(id));
    return NextResponse.json({ ok: true });
  }
  // ===== quản lý mẫu (parent-only): đặt lại tên / xóa / đổi thứ tự =====
  if (action === 'rename' || action === 'delete' || action === 'reorder') {
    if (role !== 'parent' && role !== 'system_admin') return NextResponse.json({ error: 'chỉ bố mẹ quản lý được' }, { status: 403 });

    if (action === 'rename') {
      const name = safeTitle(title);
      if (!name) return NextResponse.json({ error: 'Tên trống — nhập tên cho tranh nhé' }, { status: 400 });
      db.prepare(`UPDATE colorbook_templates SET title=? WHERE id=?`).run(name, Number(id));
      return NextResponse.json({ ok: true });
    }

    if (action === 'delete') {
      const row = db.prepare(`SELECT id, image_path, status FROM colorbook_templates WHERE id=?`).get(Number(id)) as any;
      if (!row) return NextResponse.json({ error: 'Không tìm thấy mẫu' }, { status: 404 });
      if (row.status !== 'approved' && row.status !== 'rejected') {
        return NextResponse.json({ error: 'Chỉ xóa được mẫu đã duyệt hoặc đã ẩn' }, { status: 400 });
      }
      // xóa file ảnh: chỉ khi là ảnh colorbook trong photos dir (date-dir + prefix colorbook)
      // VÀ không còn row nào khác tham chiếu cùng file (ảnh source chụp riêng có prefix khác — không đụng)
      if (row.image_path && isSafeColorbookRel(row.image_path)) {
        const shared = db.prepare(`SELECT COUNT(*) c FROM colorbook_templates WHERE image_path=? AND id!=?`).get(row.image_path, row.id) as any;
        if (shared.c === 0) {
          const full = path.resolve(PHOTOS_DIR, row.image_path);
          if (full.startsWith(PHOTOS_DIR + path.sep)) {
            try { fs.unlinkSync(full); } catch { /* file đã mất = vẫn xóa row */ }
          }
        }
      }
      db.prepare(`DELETE FROM colorbook_templates WHERE id=?`).run(row.id);
      return NextResponse.json({ ok: true });
    }

    // reorder: mảng id approved theo thứ tự mới → sort = 10, 20, 30…
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 60) return NextResponse.json({ error: 'Danh sách thứ tự không hợp lệ' }, { status: 400 });
    runInTransaction(() => {
      ids.forEach((tid: unknown, i: number) => {
        db.prepare(`UPDATE colorbook_templates SET sort=? WHERE id=? AND status='approved'`).run((i + 1) * 10, Number(tid));
      });
    });
    return NextResponse.json({ ok: true });
  }
  if (action === 'save-template') {
    // con bấm "Lưu làm mẫu" → template hiện NGAY trong danh sách của con.
    // (11/10 bố feedback: trước đây giữ pending chờ duyệt → con lưu xong "không thấy
    // lưu". Ảnh con đã xem preview rồi — hàng rào an toàn thật sự nằm ở prompt chặn
    // nội dung + bố có thể xóa/ẩn trong Admin bất cứ lúc nào.)
    const r = db.prepare(`UPDATE colorbook_templates SET status='approved', reviewed_at=? WHERE id=? AND status='pending' AND image_path!=''`)
      .run(now.toISOString(), Number(id));
    return NextResponse.json({ ok: r.changes > 0 });
  }
  if (action === 'discard') {
    // con chọn KHÔNG lưu làm mẫu → vẽ ngay 1 lần: row thành rejected (ảnh vẫn còn trên đĩa cho canvas phiên này)
    db.prepare(`UPDATE colorbook_templates SET status='rejected', reviewed_at=? WHERE id=? AND status='pending' AND image_path!=''`)
      .run(now.toISOString(), Number(id));
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
