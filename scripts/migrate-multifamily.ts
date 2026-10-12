// Migration multi-family (chạy 1 lần, idempotent):
// 1. backup DB  2. rebuild users (thêm family_id + role system_admin)
// 3. tạo family "3L Family" + backfill mọi dữ liệu sẵn có về family/child gốc
// Chạy: npx tsx scripts/migrate-multifamily.ts [--db <path>]
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';

const DB_PATH = process.argv.includes('--db')
  ? process.argv[process.argv.indexOf('--db') + 1]
  : path.join(process.cwd(), 'data', 'kids-habit.db');

if (!fs.existsSync(DB_PATH)) { console.error('DB không tồn tại:', DB_PATH); process.exit(1); }

// 1. BACKUP — không backup thì không chạy
const backup = `${DB_PATH}.backup-multifamily-${Date.now()}`;
fs.copyFileSync(DB_PATH, backup);
console.log('✓ backup →', backup);

const db = new DatabaseSync(DB_PATH, { timeout: 10_000 });
db.exec('PRAGMA foreign_keys = OFF');
db.exec('BEGIN');

try {
  // 2. families + family gốc
  db.exec(`CREATE TABLE IF NOT EXISTS families (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
    created_at TEXT NOT NULL)`);
  let fam = db.prepare(`SELECT id FROM families WHERE name='3L Family'`).get() as any;
  if (!fam) {
    const now = new Date().toISOString();
    const info = db.prepare(`INSERT INTO families (name, created_at) VALUES (?,?)`).run('3L Family', now);
    fam = { id: Number(info.lastInsertRowid) };
    console.log('✓ tạo family 3L Family id =', fam.id);
  } else console.log('• family 3L đã có id =', fam.id);

  // 3. rebuild users: family_id + role system_admin (CHECK cũ không cho ALTER)
  const needRebuild = !(db.prepare(`PRAGMA table_info(users)`).all() as any[]).some((c) => c.name === 'family_id')
    || /CHECK\s*\(\s*role[^s]*'system_admin'/i.test(
      (db.prepare(`SELECT sql FROM sqlite_master WHERE name='users'`).get() as any)?.sql || '') === false;
  if (needRebuild) {
    db.exec(`CREATE TABLE users_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      avatar TEXT NOT NULL DEFAULT '🙂',
      role TEXT NOT NULL CHECK(role IN ('parent','child','system_admin')),
      pin_hash TEXT NOT NULL,
      family_id INTEGER REFERENCES families(id),
      active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL)`);
    db.exec(`INSERT INTO users_new (id, username, name, avatar, role, pin_hash, family_id, active, created_at)
             SELECT id, username, name, avatar, role, pin_hash, ${fam.id}, active, created_at FROM users`);
    db.exec(`DROP TABLE users`);
    db.exec(`ALTER TABLE users_new RENAME TO users`);
    console.log('✓ rebuild users với family_id + role system_admin');
  } else {
    db.prepare(`UPDATE users SET family_id=? WHERE family_id IS NULL`).run(fam.id);
  }

  // bố/mẹ gốc = system_admin
  db.prepare(`UPDATE users SET role='system_admin' WHERE role='parent' AND family_id=?`).run(fam.id);
  console.log('✓ parent 3L → system_admin:', (db.prepare(`SELECT username FROM users WHERE role='system_admin'`).all() as any[]).map((u) => u.username).join(', '));

  // 4. cột scope (idempotent — db.ts cũng tự thêm, đây chống chạy lệch)
  const FAMILY_TABLES = ['task_templates', 'videos', 'books', 'shop_items', 'extra_missions',
    'timetable', 'feedback_templates', 'gifts', 'events', 'feature_ideas', 'app_settings', 'lessons'];
  const CHILD_TABLES = ['daily_instances', 'point_ledger', 'mission_claims', 'self_ratings', 'reviews',
    'journal', 'pomodoro_sessions', 'drawings', 'wishlist_items', 'pets', 'gift_events',
    'lesson_reads', 'reading_log', 'book_progress', 'parent_bonuses'];
  for (const t of FAMILY_TABLES) { try { db.exec(`ALTER TABLE ${t} ADD COLUMN family_id INTEGER`); } catch {} }
  for (const t of CHILD_TABLES) { try { db.exec(`ALTER TABLE ${t} ADD COLUMN child_id INTEGER`); } catch {} }

  // 5. backfill: child gốc = user child đầu tiên của family
  const child = db.prepare(`SELECT id, username FROM users WHERE role='child' AND family_id=? ORDER BY id LIMIT 1`).get(fam.id) as any;
  if (child) {
    for (const t of CHILD_TABLES) {
      const r = db.prepare(`UPDATE ${t} SET child_id=? WHERE child_id IS NULL`).run(child.id);
      if (r.changes > 0) console.log(`  ✓ ${t}: +child_id cho ${r.changes} dòng`);
    }
  }
  for (const t of FAMILY_TABLES) {
    const r = db.prepare(`UPDATE ${t} SET family_id=? WHERE family_id IS NULL`).run(fam.id);
    if (r.changes > 0) console.log(`  ✓ ${t}: +family_id cho ${r.changes} dòng`);
  }

  db.exec('COMMIT');
  db.exec('PRAGMA foreign_keys = ON');

  // 6. VERIFY — Bé nguyên vẹn + không dòng mồ côi scope
  const orphanChild = CHILD_TABLES.map((t) => ({ t, n: (db.prepare(`SELECT COUNT(*) c FROM ${t} WHERE child_id IS NULL`).get() as any).c })).filter((x) => x.n > 0);
  const orphanFam = FAMILY_TABLES.map((t) => ({ t, n: (db.prepare(`SELECT COUNT(*) c FROM ${t} WHERE family_id IS NULL`).get() as any).c })).filter((x) => x.n > 0);
  const kid = db.prepare(`SELECT id, username, role, family_id FROM users WHERE username='kid'`).get();
  console.log('\n=== VERIFY ===');
  console.log('kid:', JSON.stringify(kid));
  console.log('dòng thiếu child_id:', JSON.stringify(orphanChild));
  console.log('dòng thiếu family_id:', JSON.stringify(orphanFam));
  console.log('families:', JSON.stringify(db.prepare(`SELECT * FROM families`).all()));
  if (orphanChild.length || orphanFam.length) { console.error('⚠ còn dòng mồ côi — kiểm tra!'); process.exit(2); }
  console.log('\n✓ MIGRATION OK');
} catch (e) {
  db.exec('ROLLBACK');
  console.error('✗ ROLLBACK:', e);
  process.exit(1);
}
