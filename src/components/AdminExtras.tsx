'use client';
// Admin v2 — tab Cài đặt (customize toàn bộ) + tab Sao Nhí (lời khen mẫu)
import { useCallback, useEffect, useState } from 'react';

async function api(entity: string, op?: string, data?: any) {
  const res = await fetch(op ? '/api/admin' : `/api/admin?entity=${encodeURIComponent(entity)}`, {
    method: op ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: op ? JSON.stringify({ entity, op, data }) : undefined,
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error || 'error');
  return j;
}

/* ============ CÀI ĐẶT — customize toàn bộ hành vi app ============ */
const SETTING_DEFS: { key: string; label: string; hint?: string; type?: 'text' | 'number' | 'pin' }[] = [
  { key: 'child_name', label: 'Tên con', hint: 'Hiện ở lời chào, thư Sao Nhí…' },
  { key: 'parent_pin', label: 'Mã PIN bố mẹ', hint: '4-8 chữ số — đổi ngay có hiệu lực', type: 'pin' },
  { key: 'points_on_time', label: 'Sao khi đúng giờ (nhóm B)', type: 'number' },
  { key: 'points_late', label: 'Sao khi trễ giờ (vẫn làm)', type: 'number' },
  { key: 'points_self_rating', label: 'Thưởng tự chấm sao cuối ngày', type: 'number' },
  { key: 'points_streak_bonus', label: 'Thưởng mốc chuỗi ngày tốt', type: 'number' },
  { key: 'streak_milestone', label: 'Chuỗi bao nhiêu ngày = 1 mốc', type: 'number' },
  { key: 'graduation_rate', label: 'Ngưỡng tốt nghiệp (0-1)', hint: '0.8 = 80% đúng giờ', type: 'number' },
  { key: 'graduation_days', label: 'Cửa sổ xét tốt nghiệp (ngày)', hint: '28 = 4 tuần', type: 'number' },
  { key: 'pomodoro_max_reward', label: 'Quà YouTube tối đa (phút)', hint: 'Trần thời gian quà pomodoro', type: 'number' },
  { key: 'yt_ticket_daily_max', label: 'Vé YouTube mua / ngày (tối đa)', hint: 'Gói 15-30′ đổi bằng sao — khuyến nghị 1', type: 'number' },
  { key: 'yt_library_only', label: 'Chỉ xem video trong Kho (bật/tắt)', hint: 'BẬT = chỉ video bố mẹ duyệt; TẮT (mặc định) = YouTube mở tự do + Kho là gợi ý mở rộng', type: 'text' },
  { key: 'streak_display', label: 'Hiện chuỗi ngày tốt 🔥 cho con (1/0)', hint: 'Đặt 0 nếu thấy con bị áp lực mất chuỗi — streak chỉ là thông tin tiến bộ', type: 'text' },
];

export function SettingsTab() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const load = useCallback(async () => {
    const j = await api('settings');
    setValues(Object.fromEntries(j.rows.map((r: any) => [r.key, r.value])));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save(key: string) {
    try {
      await api('settings', 'upsert', { key, value: values[key] });
      setMsg(`✓ Đã lưu ${key}`);
      setTimeout(() => setMsg(''), 2500);
    } catch (e: any) { setMsg(`✗ ${e.message}`); }
  }

  return (
    <div>
      <p className="text-xs text-gray-400 mb-3">Mọi thay đổi có hiệu lực ngay — không cần deploy. Để trống = dùng giá trị mặc định.</p>
      {msg && <p className="bg-amber-50 text-star-deep rounded-xl p-2 text-sm font-bold mb-2">{msg}</p>}
      <div className="space-y-2">
        {SETTING_DEFS.map((d) => (
          <div key={d.key} className="bg-white rounded-2xl p-3 shadow-sm flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">{d.label}</p>
              {d.hint && <p className="text-[11px] text-gray-400">{d.hint}</p>}
            </div>
            <input
              type={d.type === 'pin' ? 'password' : d.type === 'number' ? 'number' : 'text'}
              step={d.key === 'graduation_rate' ? '0.05' : '1'}
              className="input !p-2 !text-sm w-28 text-center"
              value={values[d.key] ?? ''}
              placeholder="mặc định"
              onChange={(e) => setValues({ ...values, [d.key]: e.target.value })}
            />
            <button className="text-xs font-bold text-blue-600 whitespace-nowrap" onClick={() => save(d.key)}>lưu</button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============ CỬA HÀNG & NHIỆM VỤ EXTRA (pet + food + vé YouTube + missions + duyệt claim) ============ */
export function ShopMissionsTab() {
  const [shop, setShop] = useState<any[]>([]);
  const [missions, setMissions] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const s = await api('shop'); setShop(s.rows);
    const m = await api('missions'); setMissions(m.rows);
    const c = await fetch('/api/missions').then((r) => r.json());
    setClaims(c.pending || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function decide(claimId: number, action: 'approve' | 'reject') {
    await fetch('/api/missions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, claimId }),
    });
    setMsg(action === 'approve' ? '✓ Đã cộng sao cho con' : '✓ Đã từ chối (con sẽ không nhận được sao nhiệm vụ này)');
    load();
    setTimeout(() => setMsg(''), 3000);
  }

  const KIND_LABEL: Record<string, string> = { pet: 'Pet', food: 'Đồ ăn', ytticket: 'Vé YouTube' };

  return (
    <div>
      {msg && <p className="bg-amber-50 text-star-deep rounded-xl p-2 text-sm font-bold mb-2">{msg}</p>}

      {/* nhiệm vụ chờ duyệt — quan trọng nhất, đặt trên */}
      <p className="font-bold text-sm mb-2">🆘 Nhiệm vụ con báo "làm rồi" — chờ bố mẹ duyệt</p>
      {claims.length === 0 && <p className="bg-white rounded-2xl p-3 text-sm text-gray-400 mb-4">Không có yêu cầu nào chờ duyệt.</p>}
      <div className="space-y-2 mb-6">
        {claims.map((c: any) => (
          <div key={c.claim_id} className="bg-amber-50 rounded-2xl p-3 flex items-center gap-3">
            <span className="text-2xl">{c.icon}</span>
            <div className="flex-1"><p className="font-bold text-sm">{c.title}</p>
              <p className="text-[11px] text-gray-400">{c.date} · +{c.stars}⭐</p></div>
            <button className="text-xs font-bold bg-green-500 text-white rounded-full px-3 py-1.5" onClick={() => decide(c.claim_id, 'approve')}>duyệt +{c.stars}⭐</button>
            <button className="text-xs font-bold bg-gray-300 rounded-full px-3 py-1.5" onClick={() => decide(c.claim_id, 'reject')}>chưa</button>
          </div>
        ))}
      </div>

      <p className="font-bold text-sm mb-2">⭐ Nhiệm vụ Extra (sao nuôi pet / mua vé)</p>
      <div className="space-y-2 mb-4">
        {missions.map((m: any) => (
          <div key={m.id} className="bg-white rounded-2xl p-3 flex items-center gap-2 shadow-sm">
            <span className="text-xl">{m.icon}</span>
            <div className="flex-1"><p className="font-bold text-sm">{m.title}</p>
              <p className="text-[11px] text-gray-400">+{m.stars} sao {m.active ? '' : '· ẩn'}</p></div>
            <input type="number" defaultValue={m.stars} id={`ms-${m.id}`} className="input !p-1.5 !text-sm w-16" />
            <button className="text-xs text-blue-600 font-bold" onClick={async () => {
              await api('missions', 'update', { id: m.id, stars: Number((document.getElementById(`ms-${m.id}`) as HTMLInputElement).value) }); load();
            }}>sửa</button>
            <button className="text-xs text-gray-400" onClick={async () => { await api('missions', 'delete', { id: m.id }); load(); }}>xóa</button>
          </div>
        ))}
        <AddRow placeholder="Nhiệm vụ mới (vd: Giúp mẹ rửa rau)" onAdd={async (title) => {
          await api('missions', 'create', { title, icon: '⭐', stars: 2 });
          load();
        }} />
      </div>

      <p className="font-bold text-sm mb-2">🛒 Cửa hàng (pet / đồ ăn / vé YouTube)</p>
      <div className="space-y-2 mb-4">
        {shop.map((s: any) => (
          <div key={s.id} className="bg-white rounded-2xl p-3 flex items-center gap-2 shadow-sm">
            <span className="text-2xl">{s.emoji}</span>
            <div className="flex-1"><p className="font-bold text-sm">{s.title} <span className="text-[10px] text-gray-400">({KIND_LABEL[s.kind]})</span></p>
              <p className="text-[11px] text-gray-400">{s.price} sao {s.payload && s.kind === 'ytticket' ? `· ${JSON.parse(s.payload).minutes} phút` : ''}</p></div>
            <input type="number" defaultValue={s.price} id={`sp-${s.id}`} className="input !p-2 !text-sm w-20 text-center rounded-xl" />
            <button className="text-xs text-blue-600 font-bold bg-blue-50 rounded-full px-3 py-1.5 whitespace-nowrap" onClick={async () => {
              await api('shop', 'update', { id: s.id, price: Number((document.getElementById(`sp-${s.id}`) as HTMLInputElement).value) }); load();
            }}>💾 Lưu giá</button>
            <button className="text-xs text-gray-400" onClick={async () => { await api('shop', 'delete', { id: s.id }); load(); }}>xóa</button>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-gray-400">Vé YouTube: tối đa 1 vé/ngày (app_settings <code>yt_ticket_daily_max</code> — thêm key này trong tab Cài đặt để đổi). Giá vé = số sao trừ thẳng túi con.</p>
    </div>
  );
}

function AddRow({ placeholder, onAdd }: { placeholder: string; onAdd: (title: string) => Promise<void> }) {
  const [v, setV] = useState('');
  return (
    <div className="flex gap-2">
      <input className="input !p-2 !text-sm flex-1" value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} />
      <button className="btn-secondary !py-2 !text-sm" onClick={async () => { if (v) { await onAdd(v); setV(''); } }}>thêm</button>
    </div>
  );
}

/* ============ BÀI HỌC TƯ DUY — bố mẹ soạn/sửa nội dung ============ */
export function LessonsTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [msg, setMsg] = useState('');
  const load = useCallback(() => { api('lessons').then((j) => setRows(j.rows)).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);

  const FIELDS: [keyof any, string, string][] = [
    ['title', 'Tên bài', 'VD: Danh sách việc cần làm'],
    ['icon', 'Icon (emoji)', '🧠'],
    ['category', 'Chủ đề', 'Tư duy / Thói quen / Cảm xúc…'],
    ['summary', 'Tóm tắt 1 câu', 'Hiện ở thẻ bài'],
    ['intro', '🤔 Đây là gì?', 'Giải thích đơn giản cho bé 6 tuổi'],
    ['example', '🏠 Ví dụ ngay ở nhà mình', 'Liên hệ checklist/app đời thật'],
    ['try_it', '🚀 Thử ngay!', '1 thử thách nhỏ làm được ngay'],
  ];

  async function save() {
    try {
      const data = { ...editing };
      if (!data.slug && data.title) data.slug = 'bai-' + Date.now() % 100000;
      if (editing.id) await api('lessons', 'update', data);
      else await api('lessons', 'create', { ...data, sort: rows.length + 1 });
      setMsg('✓ Đã lưu bài học');
      setEditing(null);
      load();
    } catch (e: any) { setMsg(`✗ ${e.message}`); }
    setTimeout(() => setMsg(''), 3000);
  }

  return (
    <div>
      <p className="text-xs text-gray-400 mb-2">Bài đọc lần ĐẦU tự động +2 sao cho con. Nội dung viết ngắn, giọng kể, liên hệ đời thật của con.</p>
      {msg && <p className="bg-amber-50 text-star-deep rounded-xl p-2 text-sm font-bold mb-2">{msg}</p>}
      <div className="space-y-2 mb-3">
        {rows.map((l: any) => (
          <div key={l.id} className="bg-white rounded-2xl p-3 flex items-center gap-3 shadow-sm">
            <span className="text-2xl">{l.icon}</span>
            <div className="flex-1 min-w-0"><p className="font-bold text-sm truncate">{l.title}</p>
              <p className="text-[11px] text-gray-400 truncate">{l.summary}</p></div>
            <button className="text-xs text-blue-600 font-bold" onClick={() => setEditing(l)}>sửa</button>
            <button className="text-xs text-red-400" onClick={async () => { await api('lessons', 'delete', { id: l.id }); load(); }}>xóa</button>
          </div>
        ))}
      </div>
      {editing ? (
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
          <p className="font-bold text-sm">{editing.id ? 'Sửa bài' : '➕ Bài học mới'}</p>
          {FIELDS.map(([k, label, ph]) => k === 'intro' || k === 'example' || k === 'try_it' ? (
            <label key={String(k)} className="text-xs font-bold flex flex-col gap-1">{label}
              <textarea className="input !p-2 !text-sm h-20" value={editing[k] || ''} placeholder={ph}
                onChange={(e) => setEditing({ ...editing, [k]: e.target.value })} /></label>
          ) : (
            <label key={String(k)} className="text-xs font-bold flex flex-col gap-1">{label}
              <input className="input !p-2 !text-sm" value={editing[k] || ''} placeholder={ph}
                onChange={(e) => setEditing({ ...editing, [k]: e.target.value })} /></label>
          ))}
          <div className="flex gap-2 pt-1">
            <button className="btn-primary !py-2 !text-sm flex-1" onClick={save}>Lưu bài</button>
            <button className="btn-secondary !py-2 !text-sm" onClick={() => setEditing(null)}>Hủy</button>
          </div>
        </div>
      ) : (
        <button className="btn-secondary w-full !py-3" onClick={() => setEditing({})}>➕ Thêm bài học mới</button>
      )}
    </div>
  );
}

/* ============ KHO VIDEO — bố mẹ dán link YouTube (ID tự tách) ============ */
export function VideosTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [msg, setMsg] = useState('');
  const load = useCallback(() => { api('videos').then((j) => setRows(j.rows)).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);

  /** tách video ID từ link đủ hoặc ID trần */
  function extractId(input: string): string | null {
    const s = input.trim();
    const m = s.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([A-Za-z0-9_-]{11})/) || s.match(/^([A-Za-z0-9_-]{11})$/);
    return m ? m[1] : null;
  }

  async function add() {
    const ytId = extractId(url);
    if (!ytId) { setMsg('✗ Link không nhận dạng được — dán link youtube.com/watch?v=… hoặc youtu.be/…'); setTimeout(() => setMsg(''), 3500); return; }
    try {
      await api('videos', 'create', { title: title || 'Video', youtube_id: ytId, active: 1 });
      setTitle(''); setUrl('');
      setMsg('✓ Đã thêm vào Kho video');
      load();
    } catch (e: any) { setMsg(`✗ ${e.message}`); }
    setTimeout(() => setMsg(''), 3500);
  }

  return (
    <div>
      <p className="text-xs text-gray-400 mb-2">Chỉ video trong Kho mới được phát trong giờ quà — Bé không lướt feed. Lưu ý: một số video chủ kênh chặn embed thì không chạy trong app (dùng video khác).</p>
      {msg && <p className="bg-amber-50 text-star-deep rounded-xl p-2 text-sm font-bold mb-2">{msg}</p>}
      <div className="space-y-2 mb-4">
        {rows.map((v: any) => (
          <div key={v.id} className="bg-white rounded-2xl p-3 flex items-center gap-2 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://i.ytimg.com/vi/${v.youtube_id}/mqdefault.jpg`} alt="" className="w-20 rounded-lg" />
            <div className="flex-1 min-w-0"><p className="font-bold text-sm truncate">{v.title}</p>
              <p className="text-[11px] text-gray-400">{v.youtube_id} {v.active ? '' : '· ẩn'}</p></div>
            <button className="text-xs text-gray-400" onClick={async () => { await api('videos', 'update', { id: v.id, active: v.active ? 0 : 1 }); load(); }}>{v.active ? 'ẩn' : 'bật'}</button>
            <button className="text-xs text-red-400" onClick={async () => { await api('videos', 'delete', { id: v.id }); load(); }}>xóa</button>
          </div>
        ))}
        {rows.length === 0 && <p className="bg-white rounded-2xl p-4 text-sm text-gray-400">Chưa có video — dán link đầu tiên bên dưới.</p>}
      </div>
      <div className="bg-white rounded-2xl p-3 space-y-2 shadow-sm">
        <input className="input !p-2 !text-sm" placeholder="Tên video (vd: Baby Shark)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="input !p-2 !text-sm" placeholder="Dán link YouTube (vd: https://youtu.be/…)" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button className="btn-primary !py-2 !text-sm w-full" onClick={add}>➕ Thêm video</button>
      </div>
    </div>
  );
}

/* ============ THÀNH VIÊN — quản lý tài khoản gia đình (nền multi-user) ============ */
export function UsersTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ avatar: '🙂', role: 'child' });
  const [msg, setMsg] = useState('');
  const load = useCallback(() => {
    fetch('/api/auth', { cache: 'no-store' }).then((r) => r.json()).then((j) => setUsers(j.users || [])).catch(() => {});
    // users list từ auth GET
    function setUsers(u: any[]) { setRows(u); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function act(body: any) {
    const res = await fetch('/api/admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity: 'users', ...body }),
    });
    const j = await res.json();
    setMsg(j.ok ? '✓ Đã lưu' : `✗ ${j.error}`);
    load();
    setTimeout(() => setMsg(''), 3500);
    return j;
  }

  return (
    <div>
      <p className="text-xs text-gray-400 mb-2">Mỗi thành viên 1 tài khoản (username + PIN 4-8 số). Sau này mỗi user có thể có trang quản lý riêng — nền đã sẵn.</p>
      {msg && <p className="bg-amber-50 text-star-deep rounded-xl p-2 text-sm font-bold mb-2">{msg}</p>}
      <div className="space-y-2 mb-4">
        {rows.map((u: any) => (
          <div key={u.id} className="bg-white rounded-2xl p-3 flex items-center gap-3 shadow-sm">
            <span className="text-3xl">{u.avatar}</span>
            <div className="flex-1"><p className="font-bold text-sm">{u.name} <span className="text-[10px] text-gray-400">@{u.username}</span></p>
              <p className="text-[11px] text-gray-400">{['parent','system_admin'].includes(u.role) ? 'bố mẹ' : 'trẻ'} · đổi PIN sẽ đăng xuất mọi máy của người này</p></div>
            <input type="password" inputMode="numeric" maxLength={8} placeholder="PIN mới" id={`pin-${u.id}`} className="input !p-2 !text-sm w-24" />
            <button className="text-xs text-blue-600 font-bold" onClick={() => {
              const v = (document.getElementById(`pin-${u.id}`) as HTMLInputElement).value;
              if (v) act({ op: 'update', data: { id: u.id, pin: v } });
            }}>đổi PIN</button>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl p-3 space-y-2 shadow-sm">
        <p className="font-bold text-sm">➕ Thêm thành viên</p>
        <div className="grid grid-cols-2 gap-2">
          <input className="input !p-2 !text-sm" placeholder="Tên (vd: Mei)" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input !p-2 !text-sm" placeholder="Tên đăng nhập (vd: mei)" value={form.username || ''} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <input className="input !p-2 !text-sm" placeholder="Avatar (emoji)" value={form.avatar || ''} onChange={(e) => setForm({ ...form, avatar: e.target.value })} />
          <select className="input !p-2 !text-sm" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="child">Trẻ</option><option value="parent">Bố mẹ</option>
          </select>
          <input type="password" inputMode="numeric" maxLength={8} className="input !p-2 !text-sm" placeholder="PIN (4-8 số)" value={form.pin || ''} onChange={(e) => setForm({ ...form, pin: e.target.value })} />
        </div>
        <button className="btn-primary !py-2 !text-sm w-full" onClick={async () => {
          const j = await act({ op: 'create', data: form });
          if (j.ok) setForm({ avatar: '🙂', role: 'child' });
        }}>Thêm</button>
      </div>
    </div>
  );
}

/* ============ TẶNG SAO + UPLOAD EPUB ============ */
export function StarsBooksTab() {
  const [giftStars, setGiftStars] = useState(10);
  const [giftNote, setGiftNote] = useState('');
  const [msg, setMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const [books, setBooks] = useState<any[]>([]);

  const loadBooks = useCallback(() => {
    fetch('/api/books', { cache: 'no-store' }).then((r) => r.json()).then((j) => setBooks(j.books || [])).catch(() => {});
  }, []);
  useEffect(() => { loadBooks(); }, [loadBooks]);

  async function gift() {
    const res = await fetch('/api/admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity: 'gift-stars', op: 'give', data: { stars: giftStars, note: giftNote } }),
    });
    const j = await res.json();
    setMsg(j.ok ? `✓ Đã tặng ${giftStars} sao` : `✗ ${j.error}`);
    setTimeout(() => setMsg(''), 3500);
  }

  async function uploadEpub(file: File) {
    setUploading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const res = await fetch('/api/admin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity: 'upload-book', op: 'create',
          data: { filename: file.name, dataUrl: reader.result },
        }),
      });
      const j = await res.json();
      setUploading(false);
      setMsg(j.ok ? `✓ Đã thêm "${file.name}" vào kho sách (${j.size_mb}MB)` : `✗ ${j.error}`);
      loadBooks();
      setTimeout(() => setMsg(''), 4000);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div>
      {msg && <p className="bg-amber-50 text-star-deep rounded-xl p-2 text-sm font-bold mb-3">{msg}</p>}

      {/* tặng sao */}
      <div className="bg-gradient-to-r from-pink-50 to-amber-50 rounded-3xl p-4 border-2 border-pink-200 mb-6">
        <p className="font-extrabold text-pink-700">🎁 Tặng sao cho Bé</p>
        <div className="flex gap-2 flex-wrap items-center mt-3">
          {[5, 10, 20, 50].map((s) => (
            <button key={s} onClick={() => setGiftStars(s)}
              className={`rounded-2xl px-4 py-2 text-sm font-bold ${giftStars === s ? 'bg-star text-white' : 'bg-white text-gray-500'}`}>⭐{s}</button>
          ))}
          <input type="number" min={1} max={200} value={giftStars} onChange={(e) => setGiftStars(Number(e.target.value))}
            className="input !p-2 !text-sm w-20" aria-label="sao tùy chọn" />
        </div>
        <input className="input !p-2 !text-sm mt-2" value={giftNote} onChange={(e) => setGiftNote(e.target.value)}
          placeholder="Lời nhắn (vd: Con khai trương app — bố mẹ tặng!)" maxLength={200} />
        <button className="btn-primary w-full mt-3 !text-lg" onClick={gift}>🎁 Tặng ⭐{giftStars}</button>
        <p className="text-[11px] text-gray-400 mt-2">Sao tặng vào ngay túi con — không cần con xem banner (khác thưởng cuối ngày).</p>
      </div>

      {/* upload epub */}
      <div className="bg-white rounded-3xl p-4 shadow-sm">
        <p className="font-extrabold text-sm mb-2">📚 Thêm sách EPUB vào kho</p>
        <input type="file" accept=".epub" className="input !p-2 !text-sm" onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && f.size > 80 * 1e6) { setMsg('✗ File quá lớn (tối đa 80MB)'); return; }
          if (f) uploadEpub(f);
        }} />
        {uploading && <p className="text-sm text-gray-400 mt-2">⏳ Đang tải lên…</p>}
        <p className="text-[11px] text-gray-400 mt-2">File .epub (tối đa 80MB) — cover tự bóc khi Bé mở lần đầu. Kho hiện có {books.length} cuốn.</p>
      </div>

      {/* set giá sao từng cuốn */}
      <div className="mt-4">
        <p className="font-extrabold text-sm mb-1">⭐ Giá sao thưởng từng cuốn</p>
        <p className="text-xs text-gray-400 mb-2">Đọc tới đâu hưởng tới đó (tỉ lệ % tiến độ) — không cần đọc hết cuốn. Đặt 0 = chỉ thưởng phút đọc chung (tối đa 3⭐/ngày).</p>
        <div className="space-y-1.5 max-h-96 overflow-y-auto">
          {books.map((b: any) => (
            <div key={b.id} className="bg-white rounded-2xl p-2.5 flex items-center gap-2 shadow-sm">
              <span className="text-lg">{b.finished_at ? '🏆' : '📖'}</span>
              <span className="flex-1 text-xs font-bold truncate">{b.title}</span>
              <input type="number" min={0} max={200} defaultValue={b.star_reward || 0}
                id={`bstar-${b.id}`} className="input !p-1.5 !text-sm w-16 text-center" placeholder="0" />
              <span className="text-[10px] text-gray-400 font-bold">⭐</span>
              <button className="text-xs text-blue-600 font-bold" onClick={async () => {
                const v = Number((document.getElementById(`bstar-${b.id}`) as HTMLInputElement).value);
                await fetch('/api/admin', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ entity: 'books-price', op: 'update', data: { id: b.id, star_reward: v } }),
                });
                setMsg(`✓ "${b.title.slice(0, 25)}…" → ${v}⭐`);
                loadBooks();
                setTimeout(() => setMsg(''), 3000);
              }}>lưu</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============ THỜI KHÓA BIỂU — bố mẹ chỉnh từng ô ============ */
const WD = ['', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
export function TimetableTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [maxPeriod, setMaxPeriod] = useState(4);
  const load = useCallback(() => {
    api('timetable').then((j) => {
      setRows(j.rows);
      setMaxPeriod(Math.max(4, ...j.rows.map((r: any) => r.period)));
    }).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const cell = (weekday: number, period: number) => rows.find((r) => r.weekday === weekday && r.period === period);

  async function saveCell(weekday: number, period: number) {
    const subject = (document.getElementById(`tt-${weekday}-${period}`) as HTMLInputElement)?.value.trim();
    const existing = cell(weekday, period);
    try {
      if (!subject && existing) {
        await api('timetable', 'delete', { id: existing.id });
      } else if (subject && existing) {
        await api('timetable', 'update', { id: existing.id, subject });
      } else if (subject) {
        await api('timetable', 'create', { weekday, period, subject, icon: iconFor(subject) });
      }
      setMsg('✓ Đã lưu');
      load();
    } catch (e: any) { setMsg(`✗ ${e.message}`); }
    setTimeout(() => setMsg(''), 2500);
  }

  return (
    <div>
      <p className="text-xs text-gray-400 mb-2">Sửa tên môn rồi bấm "lưu" ở ô đó. Xoá trắng = xoá ô. Thứ 7/Chủ nhật thêm dòng nếu cần (T7 con học block nhẹ).</p>
      {msg && <p className="bg-amber-50 text-star-deep rounded-xl p-2 text-sm font-bold mb-2">{msg}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="p-1 text-gray-400 text-xs">Tiết</th>
              {[2, 3, 4, 5, 6, 7, 8].map((d) => <th key={d} className="p-1">{WD[d]}</th>)}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: maxPeriod }, (_, i) => i + 1).map((p) => (
              <tr key={p}>
                <td className="p-1 text-center text-xs font-bold text-gray-400">{p}</td>
                {[2, 3, 4, 5, 6, 7, 8].map((d) => {
                  const c = cell(d, p);
                  return (
                    <td key={d} className="p-0.5">
                      <div className="flex gap-0.5 items-center">
                        <input id={`tt-${d}-${p}`} defaultValue={c?.subject || ''} className="input !p-2 !text-xs w-28 rounded-xl border-2 border-gray-200 focus:border-star outline-none" placeholder="—" />
                        <button className="text-[10px] font-bold text-blue-600 bg-blue-50 rounded-full px-2 py-1" onClick={() => saveCell(d, p)}>💾</button>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function iconFor(subject: string): string {
  const s = subject.toLowerCase();
  if (s.includes('toán')) return '➕';
  if (s.includes('việt') || s.includes('tv')) return '📖';
  if (s.includes('mĩ') || s.includes('mỹ')) return '🎨';
  if (s.includes('anh')) return '🔤';
  if (s.includes('thể') || s.includes('td')) return '🏃';
  if (s.includes('âm')) return '🎵';
  if (s.includes('đạo')) return '💛';
  if (s.includes('trải nghiệm') || s.includes('tnxh')) return '🌱';
  return '📘';
}

/* ============ SAO NHÍ — lời khen mẫu (mô tả, không đánh giá) ============ */
const SITUATIONS: { key: string; label: string; example: string }[] = [
  { key: 'first_time', label: 'Lần đầu tự làm được', example: '{name} TỰ {title} lúc {time}. Con làm được rồi!' },
  { key: 'on_time', label: 'Đúng giờ (bình thường)', example: '{Title} lúc {time}. Con tự làm lấy đấy nhé.' },
  { key: 'earlier', label: 'Sớm hơn hôm qua', example: '{Title} lúc {time} — sớm hơn {minutes} phút so với hôm qua. Con thấy chưa!' },
  { key: 'streak', label: 'Chuỗi nhiều ngày liền', example: 'Con {title} lúc {time} — {days} ngày liền rồi nhé!' },
  { key: 'late', label: 'Trễ giờ (động viên)', example: 'Hôm nay {title} hơi khó nhỉ ({minutes} phút). Con vẫn TỰ làm rồi đấy. Mai mình thử sớm hơn 5 phút nha! 💪' },
  { key: 'group_a', label: 'Việc đã thích (nhóm A)', example: 'Con {title} lúc {time}. ⭐' },
];

export function SaoNhiTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const load = useCallback(() => { api('feedback').then((j) => setRows(j.rows)).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);

  async function save(situation: string, template: string) {
    try {
      const existing = rows.find((r) => r.situation === situation);
      if (existing) await api('feedback', 'update', { id: existing.id, template });
      else await api('feedback', 'create', { situation, template, active: 1 });
      setMsg(`✓ Đã lưu "${situation}"`);
      load();
    } catch (e: any) { setMsg(`✗ ${e.message}`); }
    setTimeout(() => setMsg(''), 3000);
  }
  async function remove(situation: string) {
    const existing = rows.find((r) => r.situation === situation);
    if (existing) await api('feedback', 'delete', { id: existing.id });
    setMsg(`↩ Đã trở về lời mặc định cho "${situation}"`);
    load();
    setTimeout(() => setMsg(''), 3000);
  }

  return (
    <div>
      <p className="text-xs text-gray-400 mb-2">
        Đây là lời Sao Nhí nói với con — <b>viết kiểu mô tả, không đánh giá</b> ("Con TỰ làm lúc 6h38" ✓, "Con giỏi quá" ✗ — hệ thống tự chặn từ đánh giá).
        Biến: {'{title}'} {'{Title}'} {'{time}'} {'{minutes}'} {'{days}'} {'{name}'}
      </p>
      {msg && <p className="bg-amber-50 text-star-deep rounded-xl p-2 text-sm font-bold mb-2">{msg}</p>}
      <div className="space-y-3">
        {SITUATIONS.map((s) => {
          const row = rows.find((r) => r.situation === s.key);
          return (
            <div key={s.key} className="bg-white rounded-2xl p-3 shadow-sm">
              <div className="flex justify-between items-center mb-1">
                <p className="font-bold text-sm">{s.label} <span className="text-[10px] text-gray-400">{s.key}</span></p>
                {row && <button className="text-[11px] text-gray-400" onClick={() => remove(s.key)}>↩ về mặc định</button>}
              </div>
              <textarea className="input !p-2.5 !text-sm h-20 w-full rounded-xl border-2 border-gray-200 focus:border-star" defaultValue={row?.template || ''}
                placeholder={s.example} id={`fb-${s.key}`} />
              <div className="flex items-center gap-2 mt-1">
                <button className="text-xs font-bold text-blue-600 bg-blue-50 rounded-full px-3 py-1.5 whitespace-nowrap" onClick={() => save(s.key, (document.getElementById(`fb-${s.key}`) as HTMLTextAreaElement).value)}>💾 Lưu</button>
                <span className="text-[10px] text-gray-400">{row ? 'đang dùng lời riêng' : 'đang dùng lời mặc định'}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** batch6 T3 — duyệt tranh tô màu AI (Gemini sinh theo mô tả của con, chưa duyệt không xuống tay con)
 *  + quản lý mẫu đã duyệt: đặt tên lại / xóa / đổi thứ tự (gọi thẳng /api/colorbook —
 *  /api/admin không có entity colorbook trong whitelist) */
export function ColorbookTab() {
  const [pending, setPending] = useState<any[]>([]);
  const [approved, setApproved] = useState<any[]>([]);
  const [configured, setConfigured] = useState(true);
  const [msg, setMsg] = useState('');
  const load = useCallback(() => {
    fetch('/api/colorbook', { cache: 'no-store' }).then((r) => r.json())
      .then((j: any) => { setPending(j.pending || []); setApproved(j.templates || []); setConfigured(j.configured !== false); }).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  async function post(body: any): Promise<boolean> {
    const res = await fetch('/api/colorbook', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const j = await res.json();
    if (!res.ok) { setMsg(`✗ ${j.error || 'Lỗi'}`); setTimeout(() => setMsg(''), 3500); return false; }
    return true;
  }

  async function review(id: number, approve: boolean) {
    if (await post({ action: 'review', id, approve })) {
      setMsg(approve ? '✓ Đã duyệt — tranh hiện cho con' : '✓ Đã ẩn khỏi app');
      load();
      setTimeout(() => setMsg(''), 3000);
    }
  }

  // iOS PWA standalone VÔ HIỆU prompt()/confirm() (bố 11/10: bấm không thấy gì)
  // → đổi sang UI inline: ô nhập tên hiện ngay dưới tranh, xóa = bấm 2 lần
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editVal, setEditVal] = useState('');
  const [confirmDelId, setConfirmDelId] = useState<number | null>(null);

  async function saveRename(id: number) {
    const v = editVal.trim();
    if (!v) { setEditingId(null); return; }
    if (await post({ action: 'rename', id, title: v })) {
      setMsg('✓ Đã đổi tên');
      setEditingId(null);
      load();
      setTimeout(() => setMsg(''), 3000);
    }
  }

  async function remove(id: number) {
    if (confirmDelId !== id) { // lần 1: chỉ chuyển sang trạng thái "xóa thật?"
      setConfirmDelId(id);
      setTimeout(() => setConfirmDelId((c) => (c === id ? null : c)), 4000);
      return;
    }
    setConfirmDelId(null);
    if (await post({ action: 'delete', id })) {
      setMsg('✓ Đã xóa mẫu');
      load();
      setTimeout(() => setMsg(''), 3000);
    }
  }

  /** kéo lên/xuống 1 bậc: hoán đổi với hàng kề trong danh sách id rồi gửi cả thứ tự mới */
  async function move(id: number, dir: -1 | 1) {
    const ids = approved.map((t) => t.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    if (await post({ action: 'reorder', ids })) load();
  }

  return (
    <div>
      {!configured && (
        <p className="bg-red-50 text-red-700 rounded-2xl p-3 font-bold text-sm mb-3">
          ⚠️ Chưa cài khóa Gemini — set env KH_GEMINI_API_KEY trên Mac Mini rồi restart service.
        </p>
      )}
      {msg && <p className="bg-green-50 text-green-700 rounded-2xl p-2 font-bold text-sm mb-3">{msg}</p>}
      <h3 className="font-extrabold text-ink mt-2 mb-2">⏳ Chờ duyệt ({pending.length})</h3>
      {pending.length === 0 && <p className="text-sm text-gray-400 mb-4">Không có tranh nào chờ duyệt.</p>}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {pending.map((t) => (
          <div key={t.id} className="bg-white rounded-2xl p-2 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/photo?p=${encodeURIComponent(t.image_path)}`} alt={t.prompt} className="w-full rounded-xl bg-gray-50 aspect-[3/4] object-contain" />
            <p className="text-xs font-bold text-gray-600 mt-1 truncate">"{t.prompt}"</p>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button className="btn-primary !py-2 !text-xs" onClick={() => review(t.id, true)}>✓ Duyệt</button>
              <button className="btn-secondary !py-2 !text-xs" onClick={() => review(t.id, false)}>✗ Ẩn</button>
            </div>
          </div>
        ))}
      </div>
      <h3 className="font-extrabold text-ink mb-1">🖼️ Đang hiện cho con ({approved.length})</h3>
      <p className="text-[11px] text-gray-400 mb-2">⬆️⬇️ đổi thứ tự hiện ở Xưởng vẽ · ✏️ đặt lại tên · 🗑 xóa hẳn (kèm ảnh)</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {approved.map((t, idx) => (
          <div key={t.id} className="bg-white rounded-2xl p-2 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/photo?p=${encodeURIComponent(t.image_path)}`} alt={t.title || t.prompt} className="w-full rounded-xl bg-gray-50 aspect-[3/4] object-contain" />
            <div className="flex items-center gap-1 mt-1">
              <button aria-label="cho lên trên" disabled={idx === 0} onClick={() => move(t.id, -1)}
                className={`w-9 h-9 rounded-xl text-base font-bold ${idx === 0 ? 'text-gray-200' : 'text-gray-500 bg-gray-100 active:bg-gray-200'}`}>⬆️</button>
              <button aria-label="cho xuống dưới" disabled={idx === approved.length - 1} onClick={() => move(t.id, 1)}
                className={`w-9 h-9 rounded-xl text-base font-bold ${idx === approved.length - 1 ? 'text-gray-200' : 'text-gray-500 bg-gray-100 active:bg-gray-200'}`}>⬇️</button>
              <button aria-label="đổi tên" onClick={() => { setEditingId(t.id); setEditVal(t.title || ''); setConfirmDelId(null); }}
                className="w-9 h-9 rounded-xl text-base font-bold text-blue-600 bg-blue-50 active:bg-blue-100">✏️</button>
              <button aria-label="xóa mẫu" onClick={() => remove(t.id)}
                className={`w-9 h-9 rounded-xl text-base font-bold ${confirmDelId === t.id ? 'bg-red-500 text-white animate-pulse' : 'text-red-500 bg-red-50 active:bg-red-100'}`}>{confirmDelId === t.id ? '❗' : '🗑'}</button>
            </div>
            <p className="text-[11px] font-bold text-gray-600 mt-1 truncate">{idx + 1}. {t.title || t.prompt}</p>
            {confirmDelId === t.id && (
              <button className="w-full mt-1 bg-red-500 text-white rounded-xl py-2 text-xs font-bold" onClick={() => remove(t.id)}>Xóa thật? Bấm lần nữa</button>
            )}
            {editingId === t.id ? (
              <div className="flex gap-1 mt-1">
                <input autoFocus className="input !p-1.5 !text-xs flex-1 min-w-0" value={editVal} maxLength={60}
                  onChange={(e) => setEditVal(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveRename(t.id); }} />
                <button className="text-xs font-bold text-blue-600 whitespace-nowrap" onClick={() => saveRename(t.id)}>lưu</button>
              </div>
            ) : (t.title && t.prompt && t.title !== t.prompt && <p className="text-[10px] text-gray-400 truncate">mô tả gốc: "{t.prompt}"</p>)}
          </div>
        ))}
        {approved.length === 0 && <p className="text-sm text-gray-400">Chưa có mẫu nào đang hiện.</p>}
      </div>
    </div>
  );
}
