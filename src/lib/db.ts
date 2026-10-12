import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.KH_DATA_DIR || path.join(process.cwd(), 'data');
const PHOTOS_DIR = path.join(DATA_DIR, 'photos');
const DB_PATH = path.join(DATA_DIR, 'kids-habit.db');

fs.mkdirSync(PHOTOS_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH, { timeout: 10_000 }); // busy timeout — chống lock khi nhiều worker build/API cùng ghi
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS task_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '⭐',
  section TEXT NOT NULL CHECK(section IN ('sang','toi')),
  grp TEXT NOT NULL DEFAULT 'B' CHECK(grp IN ('A','B')),
  target_from TEXT,
  target_to TEXT,
  parent_note TEXT DEFAULT '',
  subtasks TEXT DEFAULT '[]',
  sort INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  graduated_at TEXT
);
CREATE TABLE IF NOT EXISTS daily_instances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER NOT NULL REFERENCES task_templates(id),
  date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','done','adjusted')),
  checked_at TEXT,
  on_time INTEGER,
  photo_path TEXT,
  note TEXT,
  child_id INTEGER,
  UNIQUE(template_id, date, child_id)
);
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','accepted')),
  reviewer TEXT,
  note_to_child TEXT,
  accepted_at TEXT,
  child_id INTEGER,
  UNIQUE(date, child_id)
);
CREATE TABLE IF NOT EXISTS adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  review_date TEXT NOT NULL,
  instance_id INTEGER NOT NULL,
  reason TEXT NOT NULL,
  note TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS point_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('earn','spend','bonus')),
  amount INTEGER NOT NULL,
  ref_type TEXT,
  ref_id INTEGER,
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS wishlist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  photo_path TEXT,
  star_cost INTEGER,
  status TEXT DEFAULT 'proposed' CHECK(status IN ('proposed','active','redeemed','hidden')),
  created_by TEXT DEFAULT 'child',
  created_at TEXT NOT NULL,
  redeemed_at TEXT,
  redemption_photo TEXT
);
CREATE TABLE IF NOT EXISTS gifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('outing','book','small')),
  title TEXT NOT NULL,
  photo_path TEXT,
  area TEXT DEFAULT '',
  cost_note TEXT DEFAULT '',
  note TEXT DEFAULT '',
  active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS gift_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gift_id INTEGER REFERENCES gifts(id),
  gifted_at TEXT NOT NULL,
  letter_text TEXT,
  photo_path TEXT
);
CREATE TABLE IF NOT EXISTS self_ratings (
  date TEXT PRIMARY KEY,
  stars INTEGER NOT NULL,
  proud_text TEXT,
  proud_photo TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reading_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  cover_photo TEXT,
  enjoyed INTEGER DEFAULT 1,
  minutes INTEGER,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  icon TEXT DEFAULT '📅'
);
CREATE TABLE IF NOT EXISTS feature_ideas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  detail TEXT DEFAULT '',
  status TEXT DEFAULT 'proposed' CHECK(status IN ('proposed','planned','shipped','closed')),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS feedback_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  situation TEXT UNIQUE NOT NULL,
  template TEXT NOT NULL,
  active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS drawings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  instance_id INTEGER,
  image_path TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS shop_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK(kind IN ('pet','food','ytticket')),
  code TEXT DEFAULT '',
  title TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '⭐',
  price INTEGER NOT NULL DEFAULT 0,
  payload TEXT DEFAULT '{}',
  active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS pets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type_code TEXT NOT NULL,
  type_emoji TEXT NOT NULL,
  born_at TEXT NOT NULL,
  hatched_at TEXT,
  last_fed_at TEXT NOT NULL,
  last_play_at TEXT NOT NULL,
  retired INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS extra_missions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '⭐',
  stars INTEGER NOT NULL DEFAULT 2,
  active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS mission_claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mission_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS timetable (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  weekday INTEGER NOT NULL CHECK(weekday BETWEEN 2 AND 8), -- 2=T2 … 7=CN
  period INTEGER NOT NULL CHECK(period BETWEEN 1 AND 5),
  subject TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '📘',
  note TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🧠',
  summary TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Tư duy',
  intro TEXT NOT NULL DEFAULT '',
  example TEXT NOT NULL DEFAULT '',
  try_it TEXT NOT NULL DEFAULT '',
  sort INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS lesson_reads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(lesson_id, date)
);
CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  author TEXT DEFAULT '',
  file TEXT NOT NULL UNIQUE,
  size_mb REAL DEFAULT 0,
  active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS book_progress (
  book_id INTEGER PRIMARY KEY,
  cfi TEXT,
  pct REAL DEFAULT 0,
  minutes REAL DEFAULT 0,
  finished_at TEXT,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS families (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  share_code TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
  created_at TEXT NOT NULL
);
-- Bạn bè chéo gia đình: child↔child, parent hai bên consent (strategy-friends.md)
CREATE TABLE IF NOT EXISTS friendships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  child_a INTEGER NOT NULL REFERENCES users(id),   -- con của family gửi mời
  child_b INTEGER NOT NULL REFERENCES users(id),   -- con của family nhận mời
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','blocked')),
  requested_by_family INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(child_a, child_b)
);
-- Lớp học thêm (strategy-classes.md): weekly + khoảng ngày, xung đột checklist dồn giờ
CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL,
  child_id INTEGER,
  title TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🎓',
  weekday INTEGER NOT NULL CHECK(weekday BETWEEN 2 AND 8), -- 2=T2 … 8=CN
  start_hhmm TEXT NOT NULL,
  end_hhmm TEXT NOT NULL,
  starts_on TEXT,                -- NULL = đã bắt đầu
  ends_on TEXT,                  -- NULL = vô hạn; inclusive (ngày học cuối)
  active INTEGER DEFAULT 1
);

-- OKR gia đình (strategy-okr.md): 5 tầm + lồng nhau (parent_id) + update có ảnh làm bằng chứng
CREATE TABLE IF NOT EXISTS okrs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL,
  child_id INTEGER,                  -- NULL = OKR gia đình chung; số = OKR cá nhân của con
  horizon TEXT NOT NULL CHECK(horizon IN ('month','year','5y','10y','20y')),
  parent_id INTEGER REFERENCES okrs(id),
  title TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🧭',
  strategy TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
  created_by INTEGER,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS okr_krs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  okr_id INTEGER NOT NULL REFERENCES okrs(id),
  title TEXT NOT NULL,
  unit TEXT DEFAULT '',
  start_value REAL DEFAULT 0,
  target_value REAL NOT NULL,
  current_value REAL DEFAULT 0,
  sort INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS okr_updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kr_id INTEGER NOT NULL REFERENCES okr_krs(id),
  value REAL NOT NULL,
  photo_path TEXT,
  note TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL
);

-- Tin nhắn mẫu giữa bạn (WHITELIST server-side — chat tự do vẫn cấm, xem strategy-friends)
CREATE TABLE IF NOT EXISTS friend_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_child INTEGER NOT NULL REFERENCES users(id),
  to_child INTEGER NOT NULL REFERENCES users(id),
  text TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar TEXT NOT NULL DEFAULT '🙂',
  role TEXT NOT NULL CHECK(role IN ('parent','child','system_admin')),
  pin_hash TEXT NOT NULL,
  family_id INTEGER REFERENCES families(id),
  active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS journal (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  audio_path TEXT NOT NULL,
  mime TEXT NOT NULL DEFAULT 'audio/webm',
  seconds REAL DEFAULT 0,
  mood TEXT DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  youtube_id TEXT NOT NULL,
  est_minutes INTEGER,
  note TEXT DEFAULT '',
  active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS parent_bonuses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT UNIQUE NOT NULL,
  stars INTEGER NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  giver TEXT NOT NULL DEFAULT 'bố mẹ',
  seen_at TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS colorbook_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prompt TEXT NOT NULL,
  image_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  child_id INTEGER
);
CREATE TABLE IF NOT EXISTS pomodoro_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  label TEXT NOT NULL,
  work_min INTEGER NOT NULL,
  reward_min INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  work_ends_at TEXT NOT NULL,
  reward_started_at TEXT,
  reward_ends_at TEXT,
  status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running','completed','cancelled'))
);
CREATE INDEX IF NOT EXISTS idx_instances_date ON daily_instances(date);
CREATE INDEX IF NOT EXISTS idx_ledger_date ON point_ledger(date);
`);
// nâng cấp schema cũ (bảng tạo từ phiên trước) — lỗi "duplicate column" bỏ qua
try { db.exec(`ALTER TABLE pomodoro_sessions ADD COLUMN kind TEXT NOT NULL DEFAULT 'pomodoro'`); } catch {}
// batch6: cơ chế thoát phiên + TV chủ động (strategy-batch6 10/10)
try { db.exec(`ALTER TABLE pomodoro_sessions ADD COLUMN first_play_at TEXT`); } catch {}
try { db.exec(`ALTER TABLE pomodoro_sessions ADD COLUMN cast_atv_at TEXT`); } catch {}
try { db.exec(`ALTER TABLE pomodoro_sessions ADD COLUMN tv_off_at TEXT`); } catch {}
try { db.exec(`ALTER TABLE feature_ideas ADD COLUMN kind TEXT NOT NULL DEFAULT 'idea'`); } catch {}
try { db.exec(`ALTER TABLE books ADD COLUMN star_reward INTEGER NOT NULL DEFAULT 0`); } catch {}
try { db.exec(`ALTER TABLE mission_claims ADD COLUMN photo TEXT`); } catch {}
// multi-family: cột scope cho mọi bảng dữ liệu (idempotent — backfill dữ liệu nằm ở scripts/migrate-multifamily.ts)
try { db.exec(`ALTER TABLE users ADD COLUMN family_id INTEGER`); } catch {}
const FAMILY_TABLES = ['task_templates', 'videos', 'books', 'shop_items', 'extra_missions',
  'timetable', 'feedback_templates', 'gifts', 'events', 'feature_ideas', 'app_settings', 'lessons'];
const CHILD_TABLES = ['daily_instances', 'point_ledger', 'mission_claims', 'self_ratings', 'reviews',
  'journal', 'pomodoro_sessions', 'drawings', 'wishlist_items', 'pets', 'gift_events',
  'lesson_reads', 'reading_log', 'book_progress', 'parent_bonuses'];
for (const t of FAMILY_TABLES) { try { db.exec(`ALTER TABLE ${t} ADD COLUMN family_id INTEGER`); } catch {} }
for (const t of CHILD_TABLES) { try { db.exec(`ALTER TABLE ${t} ADD COLUMN child_id INTEGER`); } catch {} }
try { db.exec(`ALTER TABLE families ADD COLUMN share_code TEXT`); } catch {}
// rebuild reviews nếu còn UNIQUE(date) thời kỳ 1-child (chặn duyệt 2 con cùng ngày)
try {
  const ddlR = (db.prepare(`SELECT sql FROM sqlite_master WHERE name='reviews'`).get() as any)?.sql || '';
  if (/UNIQUE\s*\(\s*date\s*\)/i.test(ddlR)) {
    db.exec('PRAGMA foreign_keys=OFF');
    db.exec(`CREATE TABLE reviews_mf (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, status TEXT DEFAULT 'pending' CHECK(status IN ('pending','accepted')), reviewer TEXT, note_to_child TEXT, accepted_at TEXT, child_id INTEGER, UNIQUE(date, child_id))`);
    db.exec(`INSERT INTO reviews_mf SELECT id, date, status, reviewer, note_to_child, accepted_at, child_id FROM reviews`);
    db.exec(`DROP TABLE reviews`);
    db.exec(`ALTER TABLE reviews_mf RENAME TO reviews`);
    db.exec('PRAGMA foreign_keys=ON');
  }
} catch {}
// rebuild daily_instances nếu còn UNIQUE(template_id, date) thời kỳ 1-child (chặn 2 con cùng ngày)
try {
  const ddl = (db.prepare(`SELECT sql FROM sqlite_master WHERE name='daily_instances'`).get() as any)?.sql || '';
  if (/UNIQUE\s*\(\s*template_id\s*,\s*date\s*\)/i.test(ddl) && !/UNIQUE\s*\(\s*template_id\s*,\s*date\s*,\s*child_id\s*\)/i.test(ddl)) {
    db.exec('PRAGMA foreign_keys=OFF');
    db.exec(`CREATE TABLE daily_instances_mf (id INTEGER PRIMARY KEY AUTOINCREMENT, template_id INTEGER NOT NULL REFERENCES task_templates(id), date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','done','adjusted')), checked_at TEXT, on_time INTEGER, photo_path TEXT, note TEXT, child_id INTEGER, UNIQUE(template_id, date, child_id))`);
    db.exec(`INSERT INTO daily_instances_mf SELECT id, template_id, date, status, checked_at, on_time, photo_path, note, child_id FROM daily_instances`);
    db.exec(`DROP TABLE daily_instances`);
    db.exec(`ALTER TABLE daily_instances_mf RENAME TO daily_instances`);
    db.exec('PRAGMA foreign_keys=ON');
  }
} catch {}
try { db.exec(`ALTER TABLE users ADD COLUMN display_name TEXT`); } catch {}
// quản lý mẫu tranh tô màu AI (rename/sắp thứ tự): title = tên hiển thị (NULL/empty → fallback prompt), sort = thứ tự bố mẹ kéo
try { db.exec(`ALTER TABLE colorbook_templates ADD COLUMN sort INTEGER`); } catch {}
try { db.exec(`ALTER TABLE colorbook_templates ADD COLUMN title TEXT`); } catch {}

/** transaction helper (node:sqlite không có wrapper better-sqlite3) */
export function runInTransaction<T>(fn: () => T): T {
  db.exec('BEGIN');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export default db;
export { DATA_DIR, PHOTOS_DIR, DB_PATH };
