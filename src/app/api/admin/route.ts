import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireRole, hashPin } from '@/lib/auth';
import { currentChildId } from '@/lib/childscope';
import { checkBanned } from '@/lib/feedback';
import { nowVN } from '@/lib/dates';
import { graduationCandidates } from '@/lib/service';
import { dateStrVN } from '@/lib/dates';
import { setSetting } from '@/lib/settings';

/**
 * Admin generic CRUD — parent only. Whitelist chặt bảng + cột.
 * GET  /api/admin?entity=templates|gifts|events|ideas|feedback|settings|graduation
 * POST /api/admin { entity, op: create|update|delete|upsert, data }
 */
const SCHEMAS: Record<string, { table: string; cols: string[]; num?: string[]; json?: string[] }> = {
  templates: {
    table: 'task_templates',
    cols: ['title', 'icon', 'section', 'grp', 'target_from', 'target_to', 'parent_note', 'subtasks', 'sort', 'active', 'graduated_at', 'family_id'],
    num: ['sort', 'active'], json: ['subtasks'],
  },
  gifts: { table: 'gifts', cols: ['type', 'title', 'area', 'cost_note', 'note', 'active', 'family_id'], num: ['active'] },
  events: { table: 'events', cols: ['date', 'title', 'icon', 'family_id'] },
  ideas: { table: 'feature_ideas', cols: ['title', 'detail', 'status', 'family_id'] },
  feedback: { table: 'feedback_templates', cols: ['situation', 'template', 'active', 'family_id'], num: ['active'] },
  shop: { table: 'shop_items', cols: ['kind', 'code', 'title', 'emoji', 'price', 'payload', 'active', 'family_id'], num: ['price', 'active'] },
  missions: { table: 'extra_missions', cols: ['title', 'icon', 'stars', 'active', 'family_id'], num: ['stars', 'active'] },
  timetable: { table: 'timetable', cols: ['weekday', 'period', 'subject', 'icon', 'note', 'family_id'], num: ['weekday', 'period'] },
  lessons: { table: 'lessons', cols: ['slug', 'title', 'icon', 'summary', 'category', 'intro', 'example', 'try_it', 'sort', 'active', 'family_id'], num: ['sort', 'active'] },
  videos: { table: 'videos', cols: ['title', 'youtube_id', 'est_minutes', 'note', 'active', 'family_id'], num: ['est_minutes', 'active'] },
};

export async function GET(req: Request) {
  const role = await requireRole('parent');
  if (!role) return NextResponse.json({ error: 'parent only' }, { status: 403 });
  const entity = new URL(req.url).searchParams.get('entity');
  if (entity === 'graduation') return NextResponse.json({ candidates: graduationCandidates(dateStrVN()) });
  if (entity === 'settings') {
    const rows = db.prepare(`SELECT key, value FROM app_settings`).all();
    return NextResponse.json({ rows });
  }
  const s = SCHEMAS[entity || ''];
  if (!s) return NextResponse.json({ error: 'unknown entity' }, { status: 400 });
  const rows = db.prepare(`SELECT * FROM ${s.table} WHERE family_id=? ORDER BY id`).all(role.familyId ?? 1);
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  const role = await requireRole('parent');
  if (!role) return NextResponse.json({ error: 'parent only' }, { status: 403 });
  const { entity, op, data } = await req.json();
  if (entity === 'graduate') {
    db.prepare(`UPDATE task_templates SET grp='A', graduated_at=? WHERE id=? AND grp='B'`).run(nowVN().toISOString(), data.id);
    return NextResponse.json({ ok: true });
  }
  if (entity === 'settings') {
    // op=upsert {key, value} — whitelist key
    const ALLOWED = ['child_name', 'points_on_time', 'points_late', 'points_self_rating',
      'points_streak_bonus', 'streak_milestone', 'graduation_rate', 'graduation_days',
      'pomodoro_max_reward', 'yt_ticket_daily_max', 'read_stars_daily_max', 'yt_library_only'];
    if (op !== 'upsert' || !ALLOWED.includes(data.key)) return NextResponse.json({ error: 'invalid setting' }, { status: 400 });
    setSetting(data.key, String(data.value));
    return NextResponse.json({ ok: true });
  }

  // Tặng sao trực tiếp (không cần Bé xem banner)
  if (entity === 'gift-stars') {
    const s = Number(data.stars);
    if (!Number.isFinite(s) || s < 1 || s > 200) return NextResponse.json({ error: '1-200 sao' }, { status: 400 });
    db.prepare(`INSERT INTO point_ledger (date, type, amount, ref_type, ref_id, note, created_at, child_id) VALUES (?,?,?,?,?,?,?,?)`)
      .run(dateStrVN(), 'bonus', s, 'parent_gift', null, String(data.note || 'bố mẹ tặng').slice(0, 200), nowVN().toISOString(), currentChildId(role));
    return NextResponse.json({ ok: true });
  }

  // Upload ebook epub → books/ + insert catalog
  if (entity === 'upload-book') {
    const fs = await import('fs');
    const path = await import('path');
    const crypto = (await import('crypto')).default;

    const BOOKS_DIR = process.env.KH_BOOKS_DIR || path.join(process.cwd(), 'books');
    const m = String(data.dataUrl || '').match(/^data:application\/epub\+zip;base64,(.+)$/)
      || String(data.dataUrl || '').match(/^data:application\/octet-stream;base64,(.+)$/)
      || String(data.dataUrl || '').match(/^data:;base64,(.+)$/);
    if (!m) return NextResponse.json({ error: 'file không hợp lệ (cần .epub)' }, { status: 400 });
    const buf = Buffer.from(m[1], 'base64');
    if (buf.length > 80 * 1e6) return NextResponse.json({ error: 'quá 80MB' }, { status: 400 });
    // kiểm tra magic number PK (zip/epub) — chặn cả MOBI/Topaz đổi tên .epub (lỗi "10 Vạn Câu Hỏi")
    if (buf[0] !== 0x50 || buf[1] !== 0x4B) {
      const hint = buf.subarray(60, 68).toString('latin1').includes('BOOKMOBI') ? ' (file MOBI — cần convert bằng Calibre trước)' : '';
      return NextResponse.json({ error: `không phải file EPUB (zip)${hint}` }, { status: 400 });
    }
    // tên file an toàn
    const rawName = String(data.filename || 'sach-moi.epub').replace(/\.epub$/i, '').replace(/[\/\\?%*:|"<>]/g, '_').slice(0, 80);
    const safeName = `${rawName}.epub`;
    const dst = path.join(BOOKS_DIR, safeName);
    fs.writeFileSync(dst, buf);
    const title = rawName.replace(/[_-]/g, ' ').trim();
    const author = '';
    try {
      db.prepare(`INSERT INTO books (title, author, file, size_mb) VALUES (?,?,?,?)`)
        .run(title, author, safeName, Math.round(buf.length / 1e6 * 10) / 10);
    } catch (e: any) {
      if (!String(e.message).includes('UNIQUE')) throw e;
      // trùng tên file → ghi đè file nhưng không insert
    }
    return NextResponse.json({ ok: true, title, size_mb: Math.round(buf.length / 1e6 * 10) / 10 });
  }

  // Set giá sao thưởng từng cuốn sách
  if (entity === 'books-price') {
    const v = Number(data.star_reward);
    if (!Number.isFinite(v) || v < 0 || v > 200) return NextResponse.json({ error: '0-200 sao' }, { status: 400 });
    db.prepare(`UPDATE books SET star_reward=? WHERE id=?`).run(v, data.id); // books: family-scope ở Nước 3-full
    return NextResponse.json({ ok: true });
  }

  // Quản lý thành viên gia đình — PIN luôn băm sha256, không lưu thô
  if (entity === 'users') {
    if (op === 'create') {
      if (!data.username || !data.name || !data.pin) return NextResponse.json({ error: 'thiếu thông tin' }, { status: 400 });
      if (!/^\d{4,8}$/.test(String(data.pin))) return NextResponse.json({ error: 'PIN 4-8 chữ số' }, { status: 400 });
      if (!['parent', 'child'].includes(data.role)) return NextResponse.json({ error: 'role phải là parent/child' }, { status: 400 });
      try {
        db.prepare(`INSERT INTO users (username, name, avatar, role, pin_hash, family_id, created_at) VALUES (?,?,?,?,?,?,?)`)
          .run(String(data.username).toLowerCase().replace(/\s+/g, ''), String(data.name).slice(0, 30),
            String(data.avatar || '🙂').slice(0, 4), data.role, hashPin(String(data.pin)), role.familyId ?? 1, nowVN().toISOString());
        return NextResponse.json({ ok: true });
      } catch (e: any) {
        return NextResponse.json({ error: e.message.includes('UNIQUE') ? 'Tên đăng nhập đã có' : e.message }, { status: 400 });
      }
    }
    if (op === 'update') {
      if (data.pin) {
        if (!/^\d{4,8}$/.test(String(data.pin))) return NextResponse.json({ error: 'PIN 4-8 chữ số' }, { status: 400 });
        db.prepare(`UPDATE users SET pin_hash=? WHERE id=?`).run(hashPin(String(data.pin)), data.id);
        // đổi PIN → thu hồi mọi session của user đó (buộc đăng nhập lại)
        db.prepare(`DELETE FROM auth_sessions WHERE user_id=?`).run(data.id);
      }
      if (data.name || data.avatar || data.active !== undefined) {
        db.prepare(`UPDATE users SET name=COALESCE(?,name), avatar=COALESCE(?,avatar), active=COALESCE(?,active) WHERE id=?`)
          .run(data.name || null, data.avatar || null, data.active ?? null, data.id);
      }
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'unknown op' }, { status: 400 });
  }
  const s = SCHEMAS[entity];
  if (!s) return NextResponse.json({ error: 'unknown entity' }, { status: 400 });

  // cấm từ đánh giá trong title/template (guardrail F02)
  const text = [data.title, data.template, data.note].filter(Boolean).join(' ');
  const banned = checkBanned(text);
  if (banned.length) return NextResponse.json({ error: `Từ khen đánh giá không dùng: ${banned.join(', ')} — hãy mô tả hành vi thay vì đánh giá` }, { status: 400 });

  const clean: Record<string, unknown> = {};
  for (const c of s.cols) if (data[c] !== undefined) clean[c] = data[c];
  // multi-family: tạo mới luôn gắn family của người thao tác
  if (op === 'create' && s.cols.includes('family_id') && clean.family_id === undefined) clean.family_id = role.familyId ?? 1;
  for (const n of s.num || []) if (clean[n] !== undefined) clean[n] = Number(clean[n]);
  for (const j of s.json || []) if (typeof clean[j] === 'object') clean[j] = JSON.stringify(clean[j]);

  if (op === 'create') {
    const cols = Object.keys(clean);
    const q = `INSERT INTO ${s.table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`;
    const info = db.prepare(q).run(...(cols.map((c) => clean[c]) as any[]));
    return NextResponse.json({ ok: true, id: info.lastInsertRowid });
  }
  if (op === 'update') {
    const cols = Object.keys(clean).filter((c) => c !== 'id' && c !== 'family_id');
    const q = `UPDATE ${s.table} SET ${cols.map((c) => `${c}=?`).join(',')} WHERE id=? AND family_id=?`;
    db.prepare(q).run(...(cols.map((c) => clean[c]) as any[]), data.id, role.familyId ?? 1);
    return NextResponse.json({ ok: true });
  }
  if (op === 'delete') {
    db.prepare(`DELETE FROM ${s.table} WHERE id=? AND family_id=?`).run(data.id, role.familyId ?? 1);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'unknown op' }, { status: 400 });
}
