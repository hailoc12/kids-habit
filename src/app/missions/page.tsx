'use client';
// Nhiệm vụ bổ sung (feature riêng, tách khỏi trang thú cưng)
// Claim PHẢI kèm ảnh bằng chứng → bố mẹ duyệt ở /review mới có sao
import { useCallback, useEffect, useRef, useState } from 'react';
import Shell from '@/components/Shell';

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: '⏳ chờ bố mẹ duyệt', cls: 'bg-blue-50 text-blue-600' },
  approved: { label: '✅ bố mẹ duyệt rồi — sao vào túi!', cls: 'bg-green-50 text-green-700' },
  rejected: { label: 'chưa đạt — làm lại nhé con', cls: 'bg-amber-50 text-amber-700' },
};

export default function MissionsPage() {
  const [data, setData] = useState<any>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [active, setActive] = useState<any>(null);   // nhiệm vụ đang chụp ảnh
  const [photo, setPhoto] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    fetch('/api/missions', { cache: 'no-store' }).then((r) => r.json()).then(setData).catch(() => {});
    fetch('/api/today', { cache: 'no-store' }).then((r) => r.json()).then((j) => setBalance(j.balance)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result as string);
    reader.readAsDataURL(f);
    e.target.value = '';
  }

  function startClaim(m: any) {
    setActive(m); setPhoto(null);
    setTimeout(() => fileRef.current?.click(), 150);
  }

  async function confirmClaim() {
    if (!active) return;
    const res = await fetch('/api/missions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'claim', missionId: active.id, photo }),
    });
    const j = await res.json();
    if (j.ok) { setMsg(`Đã gửi cho bố mẹ — kèm ảnh con làm thật! Bố mẹ duyệt là có ${active.stars} sao ⭐`); setActive(null); }
    else { setMsg(j.error); }
    load();
    setTimeout(() => setMsg(''), 4000);
  }

  if (!data) return <Shell><div className="p-10 text-center text-gray-400 text-xl">Đang tải…</div></Shell>;
  const claimedToday = new Map<number, any>((data.claimsToday || []).map((c: any) => [c.mission_id, c]));

  return (
    <Shell>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
      <div className="p-4 pt-6 lg:px-6 lg:pt-8">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-2xl lg:text-4xl font-extrabold text-star-deep">💪 Nhiệm vụ bổ sung</h1>
          {balance !== null && <span className="bg-white rounded-2xl px-4 py-2 shadow-sm font-extrabold text-star-deep text-lg lg:text-2xl">⭐ {balance}</span>}
        </div>
        <p className="text-sm text-gray-400 font-semibold mt-1">Làm việc thật → <b>chụp ảnh minh chứng</b> → bố mẹ duyệt → sao vào túi. Nói thật nhé — bố mẹ biết mà! 💛</p>
        {msg && <p className="bg-amber-50 text-star-deep rounded-2xl p-3 font-bold text-sm mt-3">{msg}</p>}

        <div className="space-y-2 mt-4">
          {(data.missions || []).map((m: any) => {
            const claim = claimedToday.get(m.id);
            const st = claim ? STATUS[claim.status] : null;
            return (
              <div key={m.id} className={`bg-white rounded-2xl p-3 flex items-center gap-3 shadow-sm ${claim ? '' : 'active:scale-95 transition'}`}>
                <span className="text-3xl">{m.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm lg:text-base">{m.title}</p>
                  {st ? (
                    <span className={`inline-block text-[11px] font-bold rounded-full px-2 py-0.5 mt-1 ${st.cls}`}>{st.label}</span>
                  ) : (
                    <p className="text-xs text-gray-400">làm xong → chụp ảnh báo bố mẹ</p>
                  )}
                </div>
                {claim?.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={claim.photoUrl} alt="ảnh con làm" className="w-14 h-14 rounded-xl object-cover border-2 border-star/40"
                    onClick={() => window.open(claim.photoUrl, '_blank')} />
                ) : !claim ? (
                  <button className="btn-primary !py-2 !px-4 !text-sm whitespace-nowrap" onClick={() => startClaim(m)}>📸 +{m.stars}⭐</button>
                ) : null}
              </div>
            );
          })}
          {(data.missions || []).length === 0 && (
            <p className="bg-white rounded-2xl p-4 text-sm text-gray-400">Chưa có nhiệm vụ nào — bố mẹ thêm trong Admin → Nhiệm vụ.</p>
          )}
        </div>
      </div>

      {/* SHEET chụp ảnh minh chứng — BẮT BUỘC có ảnh mới gửi được */}
      {active && (
        <div className="fixed inset-0 bg-black/40 flex items-end lg:items-center justify-center z-50" onClick={() => setActive(null)}>
          <div className="bg-white w-full lg:max-w-lg rounded-t-3xl lg:rounded-[2rem] p-5" onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-extrabold mb-1">{active.icon} {active.title}</p>
            <p className="text-xs text-gray-400 mb-3">Chụp ảnh con đang làm việc này — bố mẹ sẽ nhìn thấy trước khi duyệt sao.</p>
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="xem lại ảnh" className="w-full h-64 lg:h-80 object-cover rounded-2xl" />
            ) : (
              <button className="w-full h-64 lg:h-80 rounded-2xl bg-amber-50 border-2 border-dashed border-amber-200 flex flex-col items-center justify-center gap-2" onClick={() => fileRef.current?.click()}>
                <span className="text-5xl">📷</span>
                <span className="font-bold text-star-deep">Bấm để chụp ảnh minh chứng</span>
              </button>
            )}
            <div className="flex gap-2 mt-3">
              {photo && <button className="btn-secondary flex-1" onClick={() => fileRef.current?.click()}>🔄 chụp lại</button>}
              <button className="btn-primary flex-1 !text-base" disabled={!photo} onClick={confirmClaim}>
                {photo ? `🚀 Gửi bố mẹ (+${active.stars}⭐)` : ' cần ảnh mới gửi được '}
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
