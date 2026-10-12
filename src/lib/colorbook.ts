/** Logic thuần cho quản lý mẫu tranh tô màu AI — unit test được (contract guardrails) */

/** tên hiển thị bố mẹ đặt cho mẫu: trim, gộp khoảng trắng, tối đa 60 ký tự. '' = không hợp lệ */
export function safeTitle(raw: unknown): string {
  const s = String(raw ?? '').replace(/\s+/g, ' ').trim();
  return s.slice(0, 60);
}

/** đổi thứ tự trong danh sách id: kéo id lên/xuống 1 bậc. Trả về mảng MỚI hoặc null nếu không di chuyển được (đầu/cuối, id không có trong list) */
export function moveId(ids: number[], id: number, dir: -1 | 1): number[] | null {
  const i = ids.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return null;
  const out = ids.slice();
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

/** rel path ảnh colorbook an toàn để xóa: nằm TRONG photos dir, bắt đầu bằng thư mục ngày YYYY-MM-DD, tên file có 'colorbook' (chống xóa nhầm ảnh check-in/nhiệm vụ) */
export function isSafeColorbookRel(rel: string): boolean {
  return /^\d{4}-\d{2}-\d{2}\/colorbook-[a-z0-9-]+\.(png|jpg|webp)$/i.test(rel);
}
