'use client';
// F10 — Admin CMS: menu grid nút TO giống mode child (dễ bấm trên iPad) → vào tab
import { useCallback, useEffect, useState } from 'react';
import { SettingsTab, SaoNhiTab, ShopMissionsTab, TimetableTab, LessonsTab, VideosTab, UsersTab, StarsBooksTab, ColorbookTab } from '@/components/AdminExtras';

const TABS = ['Checklist', 'Thời khóa biểu', 'Bài học', 'Kho Video', 'Tranh Tô Màu AI', 'Sao Nhí', 'Cửa hàng & Nhiệm vụ', 'Thành viên', 'Tặng sao & Sách', 'Cài đặt', 'Kho Quà Bí Mật', 'Wishlist', 'Tốt nghiệp', 'Sự kiện', 'Ý tưởng con'] as const;

// menu grid: icon to + nhãn — bố mẹ bấm 1 phát là tới
const MENU: { label: string; tabs: { t: typeof TABS[number]; icon: string }[] }[] = [
  { label: 'Hằng ngày', tabs: [
    { t: 'Checklist', icon: '✅' }, { t: 'Thời khóa biểu', icon: '📅' } ] },
  { label: 'Nội dung', tabs: [
    { t: 'Bài học', icon: '🧠' }, { t: 'Kho Video', icon: '🎬' }, { t: 'Tranh Tô Màu AI', icon: '🪄' }, { t: 'Sao Nhí', icon: '⭐' } ] },
  { label: 'Kinh tế sao', tabs: [
    { t: 'Cửa hàng & Nhiệm vụ', icon: '🛒' }, { t: 'Wishlist', icon: '🎯' }, { t: 'Tốt nghiệp', icon: '🎓' }, { t: 'Cài đặt', icon: '⚙️' } ] },
  { label: 'Gia đình', tabs: [
    { t: 'Thành viên', icon: '👨‍👩‍👧' }, { t: 'Kho Quà Bí Mật', icon: '🎁' }, { t: 'Sự kiện', icon: '🎪' }, { t: 'Ý tưởng con', icon: '💡' } ] },
];

export default function AdminPage() {
  const [tab, setTab] = useState<typeof TABS[number] | null>(null);
  return (
    <div className="min-h-dvh bg-amber-50/40 lg:flex">
      {/* ── SIDEBAR TRÁI (iPad landscape) — giống giao diện của con ── */}
      <aside className="hidden lg:flex flex-col w-72 shrink-0 h-dvh sticky top-0 bg-amber-50/95 backdrop-blur border-r border-amber-100 p-3 overflow-y-auto z-30">
        <div className="flex items-center gap-2 px-3 py-4 select-none">
          <span className="text-4xl">⚙️</span>
          <div>
            <span className="block text-2xl font-extrabold text-star-deep leading-none">Admin</span>
            <a href="/review" className="text-xs text-blue-500 font-bold underline">🔍 Duyệt ngày</a>
          </div>
        </div>
        <nav className="flex flex-col gap-1 mt-1">
          {MENU.map((g) => (
            <div key={g.label} className="mb-1.5">
              <p className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-gray-300 mb-1">{g.label}</p>
              {g.tabs.map(({ t, icon }) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-lg font-bold transition active:scale-95 ${tab === t ? 'bg-star text-white shadow-md' : 'bg-white text-gray-500 hover:bg-amber-100'}`}>
                  <span className="text-2xl w-8 text-center">{icon}</span>
                  <span className="text-left leading-tight">{t}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex-1 min-w-0">
      <div className="max-w-3xl lg:max-w-5xl mx-auto p-4 pb-20 lg:px-8">
        {tab === null ? (
          /* ── MOBILE: MENU GRID nút to (lg đã có sidebar trái) ── */
          <div className="lg:hidden">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-extrabold text-star-deep">⚙️ Admin</h1>
              <a href="/review" className="text-sm font-bold text-blue-500 underline">🔍 Duyệt ngày</a>
            </div>
            {MENU.map((g) => (
              <div key={g.label} className="mb-4">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-gray-300 mb-1.5 px-1">{g.label}</p>
                <div className="grid grid-cols-2 gap-2.5">
                  {g.tabs.map(({ t, icon }) => (
                    <button key={t} onClick={() => setTab(t)}
                      className="bg-white rounded-[1.75rem] p-4 shadow-sm active:scale-95 transition flex flex-col items-center gap-1.5">
                      <span className="text-4xl">{icon}</span>
                      <span className="text-sm font-extrabold text-ink text-center leading-tight">{t}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ── NỘI DUNG TAB ── */
          <div>
            <button onClick={() => setTab(null)}
              className="btn-secondary !py-3 !px-5 !text-base mb-4 inline-flex items-center gap-2 lg:hidden">
              <span className="text-xl">☰</span> Menu
            </button>
            <h2 className="text-2xl font-extrabold text-ink mb-4">{tab}</h2>
            {tab === 'Checklist' && <TemplatesTab />}
            {tab === 'Thời khóa biểu' && <TimetableTab />}
            {tab === 'Bài học' && <LessonsTab />}
            {tab === 'Kho Video' && <VideosTab />}
            {tab === 'Tranh Tô Màu AI' && <ColorbookTab />}
            {tab === 'Sao Nhí' && <SaoNhiTab />}
            {tab === 'Cửa hàng & Nhiệm vụ' && <ShopMissionsTab />}
            {tab === 'Thành viên' && <UsersTab />}
            {tab === 'Tặng sao & Sách' && <StarsBooksTab />}
            {tab === 'Cài đặt' && <SettingsTab />}
            {tab === 'Kho Quà Bí Mật' && <GiftsTab />}
            {tab === 'Wishlist' && <WishlistTab />}
            {tab === 'Tốt nghiệp' && <GraduationTab />}
            {tab === 'Sự kiện' && <EventsTab />}
            {tab === 'Ý tưởng con' && <IdeasTab />}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

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

function TemplatesTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState<any>(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => { api('templates').then((j) => setRows(j.rows)).catch((e) => setErr(e.message)); }, []);
  useEffect(() => { load(); }, [load]);

  async function save(data: any, isNew: boolean) {
    try {
      await api('templates', isNew ? 'create' : 'update', { ...data, subtasks: data.subtasks || [] });
      setForm(null);
      load();
    } catch (e: any) { setErr(e.message); }
  }

  return (
    <div>
      {err && <p className="text-red-500 text-sm mb-2">{err}</p>}
      <p className="text-xs text-gray-400 mb-3">Nhóm B = thói quen đang xây (có sao). Nhóm A = việc con đã thích (không sao).</p>
      <div className="space-y-2 mb-4">
        {rows.map((r) => <TemplateRow key={r.id} row={r} onSave={save} onDelete={async () => { await api('templates', 'delete', { id: r.id }); load(); }} />)}
      </div>
      {form ? (
        <TemplateForm init={form} onSave={(d) => save(d, true)} onCancel={() => setForm(null)} />
      ) : (
        <button className="btn-primary w-full !py-3 !text-sm" onClick={() => setForm({ icon: '⭐', section: 'sang', grp: 'B', target_from: '06:00', target_to: '06:55', sort: 99, active: 1 })}>➕ Thêm việc mới</button>
      )}
    </div>
  );
}

function TemplateRow({ row, onSave, onDelete }: { row: any; onSave: (d: any, isNew: boolean) => void; onDelete: () => void }) {
  const [edit, setEdit] = useState(false);
  if (!edit) return (
    <div className="bg-white rounded-2xl p-3 flex items-center gap-3 shadow-sm border border-gray-100">
      <span className="text-3xl w-10 text-center">{row.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm truncate">{row.title}</p>
        <p className="text-[11px] text-gray-400">
          {row.section === 'sang' ? '☀️' : '🌙'} · nhóm {row.grp} · {row.target_from}–{row.target_to}
          {row.graduated_at ? ' · 🎓' : ''} {!row.active ? ' · ẩn' : ''}
        </p>
      </div>
      <button className="text-xs font-bold text-blue-600 bg-blue-50 rounded-full px-3 py-1.5" onClick={() => setEdit(true)}>sửa</button>
      <button className="text-xs text-red-400 bg-red-50 rounded-full px-3 py-1.5" onClick={onDelete}>xóa</button>
    </div>
  );
  return <div className="mb-2"><TemplateForm init={row} onSave={(d) => { onSave({ ...d, id: row.id }, false); setEdit(false); }} onCancel={() => setEdit(false)} /></div>;
}

function TemplateForm({ init, onSave, onCancel }: { init: any; onSave: (d: any) => void; onCancel?: () => void }) {
  const [f, setF] = useState({ ...init, subtasks: Array.isArray(init.subtasks) ? init.subtasks : [] });

  function setSub(i: number, k: string, v: string) {
    const subs = [...f.subtasks];
    subs[i] = { ...subs[i], [k]: v };
    setF({ ...f, subtasks: subs });
  }

  const inputCls = 'input !p-2.5 !text-sm w-full';
  const label = (text: string) => <label className="text-[11px] font-bold text-gray-500 block mb-1">{text}</label>;

  return (
    <div className="bg-blue-50/60 border-2 border-blue-100 rounded-3xl p-4 lg:p-5 space-y-3">
      <p className="font-extrabold text-sm text-blue-800">{init.id ? '✏️ Sửa việc' : '➕ Thêm việc mới'}</p>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_80px_1fr] gap-3">
        <div>{label('Tên việc')}{<input className={inputCls} value={f.title || ''} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="vd: Tự đánh răng" />}</div>
        <div>{label('Icon')}{<input className={inputCls + ' text-center text-xl'} value={f.icon || ''} onChange={(e) => setF({ ...f, icon: e.target.value })} placeholder="🦷" />}</div>
        <div>{label('Thứ tự')}
          <input type="number" className={inputCls + ' text-center'} value={f.sort ?? 99} onChange={(e) => setF({ ...f, sort: Number(e.target.value) })} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div>{label('Khung')}
          <select className={inputCls} value={f.section} onChange={(e) => setF({ ...f, section: e.target.value })}>
            <option value="sang">☀️ Sáng</option><option value="toi">🌙 Tối</option>
          </select></div>
        <div>{label('Nhóm')}
          <select className={inputCls} value={f.grp} onChange={(e) => setF({ ...f, grp: e.target.value })}>
            <option value="B">B — đang xây</option><option value="A">A — đã thích</option>
          </select></div>
        <div>{label('Từ (HH:MM)')}
          <input type="time" className={inputCls} value={f.target_from || ''} onChange={(e) => setF({ ...f, target_from: e.target.value })} /></div>
        <div>{label('Đến (HH:MM)')}
          <input type="time" className={inputCls} value={f.target_to || ''} onChange={(e) => setF({ ...f, target_to: e.target.value })} /></div>
      </div>

      <div>{label('Việc bố mẹ hỗ trợ (hiện nhỏ dưới thẻ con)')}
        <input className={inputCls} value={f.parent_note || ''} onChange={(e) => setF({ ...f, parent_note: e.target.value })} placeholder="vd: bố check camera 6h40" /></div>

      {/* Sub-checklist editor — dạy con tư duy quy trình */}
      <div className="bg-amber-50 rounded-2xl p-3">
        <div className="flex justify-between items-center mb-2">
          <p className="text-xs font-bold text-star-deep">🧩 Các bước (tùy chọn — dạy quy trình)</p>
          <button className="text-[11px] font-bold text-blue-600 bg-white rounded-full px-3 py-1" onClick={() => setF({ ...f, subtasks: [...f.subtasks, { id: `s${Date.now() % 100000}`, icon: '✅', title: '' }] })}>+ thêm bước</button>
        </div>
        {f.subtasks.length === 0 && <p className="text-[11px] text-gray-400">Chưa có bước nhỏ — thêm nếu việc này có quy trình (vd: khối tự học).</p>}
        {f.subtasks.map((s: any, i: number) => (
          <div key={s.id} className="flex gap-1.5 items-center mb-1.5">
            <input className="input !p-1.5 !text-sm w-12 text-center" value={s.icon || ''} onChange={(e) => setSub(i, 'icon', e.target.value)} placeholder="✔️" />
            <input className="input !p-1.5 !text-sm flex-1" value={s.title || ''} onChange={(e) => setSub(i, 'title', e.target.value)} placeholder="Tên bước…" />
            <button className="text-red-400 text-sm px-2" onClick={() => setF({ ...f, subtasks: f.subtasks.filter((_: any, j: number) => j !== i) })}>✕</button>
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-1">
        <button className="btn-primary !py-2.5 !text-sm flex-1" onClick={() => onSave({ ...f, subtasks: f.subtasks.filter((s: any) => s.title) })}>💾 Lưu</button>
        {onCancel && <button className="btn-secondary !py-2.5 !text-sm" onClick={onCancel}>Hủy</button>}
      </div>
    </div>
  );
}

function GiftsTab() {
  const [data, setData] = useState<any>(null);
  const [form, setForm] = useState<any>({ type: 'outing', title: '', area: '', cost_note: '', note: '', active: 1 });
  const [letter, setLetter] = useState('');
  const load = useCallback(() => { fetch('/api/gift').then((r) => r.json()).then(setData); }, []);
  useEffect(() => { load(); }, [load]);

  async function addGift() {
    await api('gifts', 'create', form);
    setForm({ type: 'outing', title: '', area: '', cost_note: '', note: '', active: 1 });
    load();
  }
  async function giftIt(giftId: number) {
    const res = await fetch('/api/gift', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ giftId, doneCount: '?' }),
    });
    const j = await res.json();
    if (j.letter) setLetter(j.letter);
    load();
  }

  return (
    <div>
      <p className="text-xs text-gray-400 mb-2">🎁 Hộp Bí Mật = thưởng BẤT NGỜ (vô hại theo Lepper 1973) — không báo trước cho con. Ưu tiên đi chơi + sách.</p>
      {letter && <pre className="bg-amber-50 rounded-2xl p-4 text-sm whitespace-pre-wrap mb-3 border-l-4 border-star">{letter}</pre>}
      <div className="space-y-2 mb-6">
        {(data?.gifts || []).map((g: any) => (
          <div key={g.id} className="bg-white rounded-2xl p-3 flex items-center gap-2 shadow-sm">
            <span className="text-2xl">{g.type === 'outing' ? '🎪' : g.type === 'book' ? '📚' : '🎁'}</span>
            <div className="flex-1"><p className="font-bold text-sm">{g.title}</p>
              <p className="text-[11px] text-gray-400">{g.area} {g.cost_note ? `· ${g.cost_note}` : ''}</p></div>
            <button className="text-xs font-bold bg-star text-white rounded-full px-3 py-1.5" onClick={() => giftIt(g.id)}>trao bí mật</button>
            <button className="text-xs text-red-400" onClick={async () => { await api('gifts', 'delete', { id: g.id }); load(); }}>xóa</button>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl p-3 space-y-2 shadow-sm">
        <p className="font-bold text-sm">➕ Thêm vào kho</p>
        <select className="input !p-2 !text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          <option value="outing">Đi chơi (trải nghiệm)</option><option value="book">Sách</option><option value="small">Quà nhỏ</option>
        </select>
        <input className="input !p-2 !text-sm" placeholder="Tên (vd: Bảo tàng Dân tộc học / Chú Vịt Xám)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <input className="input !p-2 !text-sm" placeholder="Khu vực" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
        <input className="input !p-2 !text-sm" placeholder="Chi phí tham khảo" value={form.cost_note} onChange={(e) => setForm({ ...form, cost_note: e.target.value })} />
        <button className="btn-primary !py-2 !text-sm w-full" onClick={addGift} disabled={!form.title}>Thêm</button>
      </div>
      {(data?.events || []).length > 0 && (
        <p className="text-[11px] text-gray-400 mt-4">Đã trao {data.events.length} lần bí mật gần đây.</p>
      )}
    </div>
  );
}

function WishlistTab() {
  const [data, setData] = useState<any>(null);
  const load = useCallback(() => { fetch('/api/wishlist').then((r) => r.json()).then(setData); }, []);
  useEffect(() => { load(); }, [load]);
  async function act(id: number, action: string, starCost?: number, photo?: string) {
    await fetch('/api/wishlist/action', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action, starCost, photo }),
    });
    load();
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400">Gợi ý giá: nhỏ 15–30 (1–2 ngày) · vừa 80–150 (3–7 ngày) · lớn 400–800 (3–5 tuần).</p>
      {(data?.items || []).filter((i: any) => i.status !== 'redeemed').map((i: any) => (
        <div key={i.id} className="bg-white rounded-2xl p-3 shadow-sm">
          <div className="flex items-center gap-2">
            {i.photoUrl && (// eslint-disable-next-line @next/next/no-img-element
              <img src={i.photoUrl} alt="" className="w-12 h-12 rounded-xl object-cover" />)}
            <div className="flex-1"><p className="font-bold text-sm">{i.title}</p>
              <p className="text-[11px] text-gray-400">{i.status === 'proposed' ? 'chờ định giá' : `${i.star_cost} sao`}</p></div>
          </div>
          <div className="flex gap-2 mt-2 items-center">
            <input type="number" className="input !p-1.5 !text-sm w-24" defaultValue={i.star_cost || 30} id={`cost-${i.id}`} />
            <button className="text-xs font-bold text-blue-600" onClick={() => act(i.id, 'price', Number((document.getElementById(`cost-${i.id}`) as HTMLInputElement).value))}>định giá</button>
            {i.status === 'active' && data.balance >= i.star_cost && (
              <button className="text-xs font-bold bg-green-500 text-white rounded-full px-3 py-1" onClick={() => {
                if (confirm('Xác nhận đã trao thưởng cho con?')) act(i.id, 'redeem');
              }}>trao thưởng</button>
            )}
            <button className="text-xs text-gray-400" onClick={() => act(i.id, 'hide')}>ẩn</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function GraduationTab() {
  const [data, setData] = useState<any>(null);
  const load = useCallback(() => { fetch('/api/admin?entity=graduation').then((r) => r.json()).then(setData); }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <div>
      <p className="text-xs text-gray-400 mb-3">🎓 Tốt nghiệp = việc đã vững → không còn sao (giàn giáo tự tháo). Đề xuất khi ≥80% đúng giờ 4 tuần.</p>
      {(data?.candidates || []).length === 0 && <p className="bg-white rounded-2xl p-4 text-sm text-gray-400">Chưa có việc đủ điều kiện — bình thường nhé, thói quen cần ~2 tháng.</p>}
      <div className="space-y-2">
        {(data?.candidates || []).map((c: any) => (
          <div key={c.templateId} className="bg-white rounded-2xl p-3 flex items-center shadow-sm">
            <div className="flex-1"><p className="font-bold text-sm">{c.title}</p>
              <p className="text-[11px] text-gray-400">{Math.round(c.onTimeRate * 100)}% đúng giờ trong {c.days} ngày</p></div>
            <button className="text-xs font-bold bg-star text-white rounded-full px-3 py-1.5" onClick={async () => {
              await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entity: 'graduate', data: { id: c.templateId } }) });
              load();
            }}>tốt nghiệp 🎓</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function EventsTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ date: new Date().toLocaleDateString('en-CA'), title: '', icon: '🎪' });
  const load = useCallback(() => { api('events').then((j) => setRows(j.rows)); }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <div>
      <div className="space-y-2 mb-4">
        {rows.map((r) => (
          <div key={r.id} className="bg-white rounded-2xl p-3 flex items-center gap-2 shadow-sm text-sm">
            <span className="text-xl">{r.icon}</span><p className="flex-1">{r.date}: {r.title}</p>
            <button className="text-xs text-red-400" onClick={async () => { await api('events', 'delete', { id: r.id }); load(); }}>xóa</button>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl p-3 space-y-2 shadow-sm">
        <input type="date" className="input !p-2 !text-sm" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        <input className="input !p-2 !text-sm" placeholder="Sự kiện (vd: sinh nhật bạn Na)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <input className="input !p-2 !text-sm" placeholder="Icon" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
        <button className="btn-primary !py-2 !text-sm w-full" onClick={async () => { await api('events', 'create', form); setForm({ ...form, title: '' }); load(); }} disabled={!form.title}>Thêm sự kiện</button>
      </div>
    </div>
  );
}

function IdeasTab() {
  const [items, setItems] = useState<any[]>([]);
  const load = useCallback(() => { fetch('/api/ideas').then((r) => r.json()).then((j) => setItems(j.items)); }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400">💡 Ý tưởng con đề xuất — con là co-founder. Cập nhật trạng thái để con thấy.</p>
      {items.map((i) => (
        <div key={i.id} className="bg-white rounded-2xl p-3 shadow-sm">
          <p className="font-bold text-sm">{i.title}</p>
          {i.detail && <p className="text-xs text-gray-500">{i.detail}</p>}
          <div className="flex gap-1 mt-2">
            {['proposed', 'planned', 'shipped', 'closed'].map((s) => (
              <button key={s} className={`text-[11px] font-bold rounded-full px-2 py-1 ${i.status === s ? 'bg-star text-white' : 'bg-gray-100 text-gray-500'}`}
                onClick={async () => { await api('ideas', 'update', { id: i.id, status: s }); load(); }}>{s}</button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
