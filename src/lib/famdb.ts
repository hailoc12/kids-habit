// Scoped data layer — ENFORCEMENT tập trung chống lộ dữ liệu chéo gia đình (strategy multifamily)
// Quy tắc: bảng CHILD/FAMILY chỉ được query kèm scope tương ứng. Dev/test mode: assertion chặn
// query chạm bảng scoped mà thiếu token scope (family_id/child_id) trong SQL — không tin memory người code.
export const FAMILY_TABLES = ['task_templates', 'videos', 'books', 'shop_items', 'extra_missions',
  'timetable', 'feedback_templates', 'gifts', 'events', 'feature_ideas', 'app_settings', 'lessons'];
export const CHILD_TABLES = ['daily_instances', 'point_ledger', 'mission_claims', 'self_ratings', 'reviews',
  'journal', 'pomodoro_sessions', 'drawings', 'wishlist_items', 'pets', 'gift_events',
  'lesson_reads', 'reading_log', 'book_progress', 'parent_bonuses'];

const SCOPED = new Set([...FAMILY_TABLES, ...CHILD_TABLES]);

/** Query có chạm bảng scoped không? (tên bảng xuất hiện như từ riêng — không phải tiền tố cột) */
export function touchesScopedTable(sql: string): string | null {
  for (const t of SCOPED) {
    const re = new RegExp(`(^|[\\s,(])${t}(\\s|$|,|\\))`, 'i');
    if (re.test(sql)) return t;
  }
  return null;
}

/** Bảng này đòi scope nào? */
export function requiredScope(table: string): 'family_id' | 'child_id' | null {
  if (FAMILY_TABLES.includes(table)) return 'family_id';
  if (CHILD_TABLES.includes(table)) return 'child_id';
  return null;
}

/**
 * Assertion (chạy ở test + NODE_ENV=development): query chạm bảng scoped PHẢI chứa
 * token scope trong SQL (WHERE/INSERT cột family_id/child_id). Thiếu → throw.
 * Đây là lưới an toàn trong giai đoạn chuyển 149 điểm gọi — route quên scope sẽ nổ ở test, không lặng lẽ lộ.
 */
export function assertScoped(sql: string): void {
  if (process.env.NODE_ENV === 'production') return; // prod: chỉ test suite và probe chạy assertion
  const table = touchesScopedTable(sql);
  if (!table) return;
  const need = requiredScope(table);
  if (need === 'family_id' && !/family_id/i.test(sql)) {
    throw new Error(`[famdb] query chạm ${table} thiếu family_id — dùng helper scoped hoặc thêm WHERE family_id=?`);
  }
  if (need === 'child_id' && !/child_id/i.test(sql)) {
    throw new Error(`[famdb] query chạm ${table} thiếu child_id — dùng helper scoped hoặc thêm WHERE child_id=?`);
  }
}
