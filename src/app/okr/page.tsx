'use client';
// 🧭 OKR Gia Đình — mơ ước xa → kế hoạch gần, mỗi bước có ảnh + con số tự nhìn thấy
// Guardrail (strategy-okr): KHÔNG sao/thưởng, "đi được X/Y" không chữ "chưa đạt",
// child chỉ thấy OKR mình + gia đình (chống so sánh anh em), tab mặc định Tháng.
import { useCallback, useEffect, useRef, useState } from 'react';
import Shell from '@/components/Shell';
import VoiceInput from '@/components/VoiceInput';

const HORIZONS = [
  { key: 'month', label: 'Mục tiêu tháng', icon: '📅', hint: 'tháng này con làm gì?' },
  { key: 'year', label: 'Mục tiêu năm', icon: '🎯', hint: 'năm nay con muốn đạt gì?' },
  { key: '5y', label: 'Kế hoạch 5 năm', icon: '🌱', hint: 'khi con 11 tuổi' },
  { key: '10y', label: 'Kế hoạch 10 năm', icon: '🌳', hint: 'khi con 16 tuổi' },
  { key: '20y', label: 'Mơ ước lớn', icon: '🌟', hint: 'khi con 26 tuổi — mơ tự do!' },
] as const;

export default function OkrPage() {
  const [data, setData] = useState<any>(null);
  const [horizon, setHorizon] = useState<string>('month');
  const [creating, setCreating] = useState(false);
  const [updatingKr, setUpdatingKr] = useState<any>(null);
  const [viewChild, setViewChild] = useState<number | 'family' | null>(null); // parent: lọc xem
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    fetch('/api/okr', { cache: 'no-store' }).then((r) => r.json()).then(setData).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  async function act(body: any, okMsg?: string) {
    try {
      const res = await fetch('/api/okr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await res.json();
      if (j.ok) { if (okMsg) setMsg(okMsg); setCreating(false); setUpdatingKr(null); load(); }
      else setMsg(j.error || 'lỗi');
    } catch {
      // server/tunnel trả HTML (500/502) hoặc mất kết nối — không được im lặng (QT9)
      setMsg('Không kết nối được máy chủ — kiểm tra mạng rồi thử lại nhé');
      console.error('api/okr act failed', body?.action);
    }
    setTimeout(() => setMsg(''), 3500);
  }

  if (!data) return <Shell><div className="p-10 text-center text-gray-400 text-xl">Đang tải…</div></Shell>;
  const okrs: any[] = ((data.okrs || []) as any[]).filter((o: any) =>
    o.horizon === horizon &&
    (viewChild === null ? true : viewChild === 'family' ? o.child_id === null : o.child_id === viewChild));
  const childOkrs = okrs.filter((o) => o.child_id !== null);
  const familyOkrs = okrs.filter((o) => o.child_id === null);
  const childOptions = Array.from(new Map((data.okrs || []).filter((o: any) => o.child_id !== null && o.horizon !== horizon)
    .concat((data.okrs || []).filter((o: any) => o.horizon !== horizon))
    .map((o: any) => [o.id, o])).values()); // OKR các tầm khác để gắn vào
  const children = Array.from(new Map((data.okrs || []).filter((o: any) => o.child_id).map((o: any) => [o.child_id, { id: o.child_id, name: o.owner_name, avatar: o.owner_avatar }])).values());

  return (
    <Shell>
      <div className="p-4 pt-6 lg:px-6 lg:pt-8">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-2xl lg:text-4xl font-extrabold text-star-deep">🧭 Vươn xa</h1>
          <button className="btn-primary !py-2.5 !px-5" onClick={() => setCreating(true)}>➕ Mục tiêu mới</button>
        </div>
        {msg && <p className="bg-amber-50 text-star-deep rounded-2xl p-3 font-bold text-sm mt-3">{msg}</p>}

        {/* parent: chọn xem ai (KHÔNG xếp các con cạnh nhau — chọn 1 lần 1 người) */}
        {data.isParent && children.length > 0 && (
          <div className="flex gap-2 flex-wrap mt-3">
            {[{ id: null, label: 'Tất cả' }, { id: 'family', label: '👨‍👩‍👧 Gia đình' },
              ...children.map((c: any) => ({ id: c.id, label: `${c.avatar} ${c.name}` }))]
              .map((f: any) => (
                <button key={String(f.id)} onClick={() => setViewChild(f.id)}
                  className={`text-xs font-extrabold rounded-full px-3 py-1.5 ${viewChild === f.id ? 'bg-star text-white' : 'bg-white text-gray-500'}`}>{f.label}</button>
              ))}
          </div>
        )}

        {/* tabs 5 tầm */}
        <div className="flex gap-2 overflow-x-auto py-3 -mx-1 px-1">
          {HORIZONS.map((h) => (
            <button key={h.key} onClick={() => setHorizon(h.key)}
              className={`shrink-0 rounded-3xl px-4 py-3 flex flex-col items-center gap-0.5 transition ${horizon === h.key ? 'bg-star text-white shadow-md' : 'bg-white text-gray-500'}`}>
              <span className="text-3xl">{h.icon}</span>
              <span className="text-[11px] lg:text-sm font-extrabold whitespace-nowrap">{h.label}</span>
            </button>
          ))}
        </div>
        <p className="text-sm text-gray-400 font-bold mb-3">{HORIZONS.find((h) => h.key === horizon)?.hint}</p>

        {okrs.length === 0 && (
          <div className="bg-white rounded-[2rem] p-8 text-center shadow-sm">
            <div className="text-6xl mb-2">🧭</div>
            <p className="text-lg font-extrabold text-star-deep">Chưa có mục tiêu {HORIZONS.find((h) => h.key === horizon)?.label.toLowerCase()} nào</p>
            <p className="text-sm text-gray-400 mt-1">Bấm ➕ Mục tiêu mới để bắt đầu hành trình nhé!</p>
          </div>
        )}

        <div className="space-y-4">
          {[...childOkrs, ...familyOkrs].map((o: any) => <OkrCard key={o.id} o={o} all={(data.okrs || [])} isParent={data.isParent}
            onEdit={() => act({ action: 'update-okr', id: o.id })} onDelete={() => { if (confirm('Cất OKR này đi? (album hành trình vẫn giữ')) act({ action: 'delete-okr', id: o.id }); }}
            onUpdateKr={(kr: any) => setUpdatingKr(kr)} onAddKr={(title: string, unit: string, target: number) => act({ action: 'add-kr', okrId: o.id, title, unit, target })}
            onGoto={(id: number) => { const t = (data.okrs || []).find((x: any) => x.id === id); if (t) setHorizon(t.horizon); }} />)}
        </div>
      </div>

      {creating && <CreateSheet onClose={() => setCreating(false)} isParent={data.isParent} parents={childOptions}
        horizon={horizon} horizonLabel={HORIZONS.find((h) => h.key === horizon)?.label || ''}
        onCreate={(payload: any) => act({ action: 'create-okr', ...payload }, 'Đã tạo mục tiêu mới! 🎉')} />}
      {updatingKr && <UpdateSheet kr={updatingKr} onClose={() => setUpdatingKr(null)}
        onSave={(value: number, photo: string | null, note: string) => act({ action: 'update', krId: updatingKr.id, value, photo, note }, 'Đã ghi tiến bộ mới! 📸')} />}
    </Shell>
  );
}

/* ───────── Card OKR: objective + strategy + KR bars + album ảnh ───────── */
function OkrCard({ o, all, isParent, onDelete, onUpdateKr, onAddKr, onGoto }: any) {
  const [addKr, setAddKr] = useState(false);
  const [krTitle, setKrTitle] = useState(''); const [krUnit, setKrUnit] = useState(''); const [krTarget, setKrTarget] = useState('');
  const children = all.filter((x: any) => x.parent_id === o.id);
  const overall = o.krs.length ? Math.round(o.krs.reduce((s: number, k: any) => s + Math.min(1, Math.max(0, (k.current_value - k.start_value) / Math.max(1e-9, k.target_value - k.start_value))), 0) / o.krs.length * 100) : null;
  return (
    <div className="bg-white rounded-[2rem] p-4 lg:p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="text-5xl">{o.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="font-extrabold text-lg lg:text-2xl leading-tight">{o.title}</p>
          <p className="text-[11px] font-bold text-gray-400 mt-0.5">
            {o.child_id ? `${o.owner_avatar} mục tiêu của ${o.owner_name}` : '👨‍👩‍👧 mục tiêu cả nhà'}
            {children.length > 0 && ` · chứa ${children.length} mục tiêu nhỏ`}
          </p>
        </div>
        {isParent && <button className="text-xs text-gray-300 font-bold" onClick={onDelete}>cất đi</button>}
      </div>
      {o.strategy && (
        <p className="mt-2 bg-amber-50 rounded-2xl p-3 text-sm text-star-deep font-semibold whitespace-pre-wrap">🗺️ {o.strategy}</p>
      )}

      {/* KR bars — "đi được X/Y", không chữ chưa đạt */}
      {o.krs.length > 0 && (
        <div className="mt-3 space-y-2.5">
          {o.krs.map((k: any) => {
            const pct = Math.min(100, Math.round((k.current_value - k.start_value) / Math.max(1e-9, k.target_value - k.start_value) * 100));
            return (
              <div key={k.id} className="bg-amber-50/60 rounded-2xl p-3">
                <div className="flex items-center gap-2">
                  <p className="flex-1 font-bold text-sm min-w-0 truncate">{k.title}</p>
                  <span className="text-xs font-extrabold text-star-deep whitespace-nowrap">
                    đi được {k.current_value}/{k.target_value} {k.unit}
                  </span>
                </div>
                <div className="h-4 bg-white rounded-full overflow-hidden shadow-inner mt-1.5 relative">
                  <div className="h-full bg-gradient-to-r from-amber-300 to-star rounded-full transition-all" style={{ width: `${Math.max(3, pct)}%` }} />
                  {pct >= 100 && <span className="absolute inset-0 flex items-center justify-center text-xs font-extrabold text-white">🎉 XONG!</span>}
                </div>
                {/* album hành trình */}
                {k.updates?.length > 0 && (
                  <div className="flex gap-1.5 mt-2 overflow-x-auto">
                    {k.updates.map((u: any) => (
                      <div key={u.id} className="shrink-0 text-center">
                        {u.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={u.photoUrl} alt="" className="w-14 h-14 rounded-xl object-cover border-2 border-star/30" />
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-white flex items-center justify-center text-xs font-extrabold text-star-deep">{u.value}</div>
                        )}
                        <p className="text-[9px] text-gray-400 font-bold mt-0.5">{(u.created_at || '').slice(5, 10)}</p>
                      </div>
                    ))}
                  </div>
                )}
                <button className="mt-2 text-xs font-extrabold text-blue-600" onClick={() => onUpdateKr(k)}>📷 Cập nhật tiến bộ</button>
              </div>
            );
          })}
        </div>
      )}

      {/* OKR con lồng trong */}
      {children.length > 0 && (
        <div className="mt-3 flex gap-2 flex-wrap">
          {children.map((c: any) => (
            <button key={c.id} onClick={() => onGoto(c.id)}
              className="bg-amber-50 rounded-2xl px-3 py-2 text-xs font-extrabold text-star-deep active:scale-95 transition">
              {c.icon} {c.title} ↗
            </button>
          ))}
        </div>
      )}

      {/* thêm KR */}
      {addKr ? (
        <div className="mt-3 space-y-2 bg-blue-50/50 rounded-2xl p-3">
          <VoiceInput value={krTitle} onChange={setKrTitle} placeholder="Kết quả đo được (vd: đọc hết 20 cuốn sách)" />
          <div className="flex gap-2">
            <input className="input !py-2 !text-sm flex-1" placeholder="đơn vị (vd: cuốn)" value={krUnit} onChange={(e) => setKrUnit(e.target.value)} />
            <input className="input !py-2 !text-sm w-24" placeholder="mục tiêu" inputMode="decimal" value={krTarget} onChange={(e) => setKrTarget(e.target.value)} />
            <button className="btn-primary !py-2 !text-sm" onClick={() => { onAddKr(krTitle, krUnit, Number(krTarget)); setAddKr(false); setKrTitle(''); setKrUnit(''); setKrTarget(''); }}>➕</button>
          </div>
        </div>
      ) : (
        <button className="mt-2 text-xs font-bold text-gray-400 underline" onClick={() => setAddKr(true)}>+ thêm kết quả đo (KR)</button>
      )}
    </div>
  );
}

/* ───────── Sheet tạo OKR ───────── */
function CreateSheet({ onClose, isParent, parents, horizon, horizonLabel, onCreate }: any) {
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('🧭');
  const [strategy, setStrategy] = useState('');
  const [scope, setScope] = useState('child');
  const [parentId, setParentId] = useState('');
  const [krs, setKrs] = useState<any[]>([{ title: '', unit: '', target: '' }]);
  const can = title.trim() && krs.some((k) => k.title && Number.isFinite(Number(k.target)));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end lg:items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white w-full lg:max-w-lg rounded-t-3xl lg:rounded-[2rem] p-5 max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <p className="text-lg font-extrabold">➕ {horizonLabel} mới</p>
        <div className="mt-3 space-y-2.5">
          <div className="flex gap-2">
            <input className="input !py-2 !text-xl w-16 text-center" value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={4} />
            <VoiceInput value={title} onChange={setTitle} placeholder="Mục tiêu là gì? (nói được luôn)" autoFocus />
          </div>
          <VoiceInput value={strategy} onChange={setStrategy} multiline placeholder="🗺️ Chiến lược: làm thế nào để đạt? (nói)" />
          {isParent && (
            <div className="flex gap-2">
              {['child', 'family'].map((s) => (
                <button key={s} onClick={() => setScope(s)}
                  className={`flex-1 rounded-2xl py-2.5 text-sm font-extrabold ${scope === s ? 'bg-star text-white' : 'bg-amber-50 text-gray-500'}`}>
                  {s === 'child' ? '👧 Của con' : '👨‍👩‍👧 Cả nhà'}
                </button>
              ))}
            </div>
          )}
          {parents.length > 0 && (
            <select className="input !py-2 !text-sm" value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">— không gắn vào mục tiêu lớn hơn —</option>
              {parents.map((p: any) => <option key={p.id} value={p.id}>{p.icon} {p.title}</option>)}
            </select>
          )}
          <p className="text-xs font-extrabold text-gray-400 pt-1">Kết quả đo được (KR) — đo thế nào là tới:</p>
          {krs.map((k, i) => (
            <div key={i} className="flex gap-2">
              <input className="input !py-2 !text-sm flex-1" placeholder="vd: đọc hết sách" value={k.title}
                onChange={(e) => setKrs(krs.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} />
              <input className="input !py-2 !text-sm w-16" placeholder="đơn vị" value={k.unit}
                onChange={(e) => setKrs(krs.map((x, j) => j === i ? { ...x, unit: e.target.value } : x))} />
              <input className="input !py-2 !text-sm w-20" placeholder="mục tiêu" inputMode="decimal" value={k.target}
                onChange={(e) => setKrs(krs.map((x, j) => j === i ? { ...x, target: e.target.value } : x))} />
            </div>
          ))}
          <button className="text-xs font-bold text-blue-600 underline" onClick={() => setKrs([...krs, { title: '', unit: '', target: '' }])}>+ thêm KR</button>
        </div>
        <button className={`btn-primary w-full mt-4 !text-base ${can ? '' : 'opacity-40'}`} disabled={!can}
          onClick={() => onCreate({ horizon, title, icon, strategy, parentId: parentId || null, scope,
            krs: krs.filter((k) => k.title && Number.isFinite(Number(k.target))).map((k) => ({ title: k.title, unit: k.unit, target: Number(k.target), start: 0 })) })}>
          🚀 Tạo mục tiêu
        </button>
        {!can && (
          <p className="text-xs font-bold text-amber-600 text-center mt-2">
            Cần: (1) tên mục tiêu, (2) KR có tên + ô "mục tiêu" là SỐ (vd 21 — đơn vị như "ngày" ghi ô riêng)
          </p>
        )}
      </div>
    </div>
  );
}

/* ───────── Sheet Update KR: chỉ số mới + ảnh bằng chứng ───────── */
function UpdateSheet({ kr, onClose, onSave }: any) {
  const [value, setValue] = useState(String(kr.current_value ?? ''));
  const [photo, setPhoto] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setPhoto(r.result as string);
    r.readAsDataURL(f);
    e.target.value = '';
  }
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end lg:items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white w-full lg:max-w-md rounded-t-3xl lg:rounded-[2rem] p-5" onClick={(e) => e.stopPropagation()}>
        <p className="text-lg font-extrabold">📷 Cập nhật tiến bộ</p>
        <p className="text-xs text-gray-400 mb-3">{kr.title} — hiện đi được {kr.current_value}/{kr.target_value} {kr.unit}</p>
        <div className="flex items-center gap-2">
          <input className="input !py-3 !text-2xl text-center w-32" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
          <span className="font-extrabold text-gray-400">{kr.unit}</span>
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
        {photo ? (
          <div className="mt-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="bằng chứng" className="w-full h-48 object-cover rounded-2xl" />
            <button className="text-xs text-blue-600 font-bold mt-1" onClick={() => fileRef.current?.click()}>chụp lại</button>
          </div>
        ) : (
          <button className="btn-secondary w-full mt-3 !py-3" onClick={() => fileRef.current?.click()}>📷 Chụp ảnh kỷ niệm bước này</button>
        )}
        <VoiceInput value={note} onChange={setNote} placeholder="Ghi chú (nói được) — hôm nay con đã…" />
        <button className="btn-primary w-full mt-3 !text-base" disabled={!Number.isFinite(Number(value))}
          onClick={() => onSave(Number(value), photo, note)}>💾 Lưu tiến bộ</button>
      </div>
    </div>
  );
}
