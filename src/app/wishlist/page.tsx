'use client';
// F04 — Wishlist: "Mục tiêu của con" (autonomy — không phải cửa hàng đổi thưởng)
import { useCallback, useEffect, useRef, useState } from 'react';
import Shell from '@/components/Shell';
import VoiceInput from '@/components/VoiceInput';

export default function WishlistPage() {
  const [data, setData] = useState<any>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/wishlist');
    setData(await res.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setPhoto(r.result as string);
    r.readAsDataURL(f);
  }

  async function propose() {
    if (!title) return;
    await fetch('/api/wishlist', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, photo }),
    });
    setAdding(false); setTitle(''); setPhoto(null);
    load();
  }

  if (!data) return <Shell><div className="p-10 text-center text-gray-400">Đang tải…</div></Shell>;
  const active = data.items.filter((i: any) => i.status === 'active');
  const proposed = data.items.filter((i: any) => i.status === 'proposed');
  const redeemed = data.items.filter((i: any) => i.status === 'redeemed');

  return (
    <Shell>
      <div className="p-4 pt-6">
        <h1 className="text-2xl font-extrabold text-star-deep">🎯 Mục tiêu của con</h1>
        <p className="text-sm text-gray-500 mb-4">Con có {data.balance} sao ⭐</p>

        {active.length === 0 && proposed.length === 0 && (
          <div className="bg-white rounded-3xl p-6 text-center text-gray-400">
            Chưa có mục tiêu nào — con muốn đạt được điều gì?
          </div>
        )}

        <div className="space-y-3 mb-4">
          {active.map((i: any) => {
            const pct = Math.min(100, Math.round((data.balance / i.star_cost) * 100));
            const enough = data.balance >= i.star_cost;
            return (
              <div key={i.id} className="bg-white rounded-3xl p-4 shadow-sm">
                <div className="flex gap-3 items-center">
                  {i.photoUrl && (// eslint-disable-next-line @next/next/no-img-element
                    <img src={i.photoUrl} alt="" className="w-16 h-16 rounded-2xl object-cover" />)}
                  <div className="flex-1">
                    <p className="font-bold text-lg leading-tight">{i.title}</p>
                    <p className="text-xs text-gray-400">{i.star_cost} sao {enough ? '' : `· còn thiếu ${i.star_cost - data.balance} sao`}</p>
                  </div>
                  {enough && <span className="text-xs font-bold bg-star text-white rounded-full px-3 py-1 animate-pulse">Con đạt rồi!</span>}
                </div>
                <div className="mt-3 h-4 bg-amber-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-300 to-star rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[11px] text-gray-400 mt-1 text-right">{data.balance}/{i.star_cost}</p>
              </div>
            );
          })}
        </div>

        {proposed.length > 0 && (
          <>
            <p className="text-sm font-bold text-gray-400 mb-2">Chờ bố mẹ định giá</p>
            <div className="space-y-2 mb-4">
              {proposed.map((i: any) => (
                <div key={i.id} className="bg-white/60 rounded-2xl p-3 flex items-center gap-3 opacity-70">
                  {i.photoUrl && (// eslint-disable-next-line @next/next/no-img-element
                    <img src={i.photoUrl} alt="" className="w-12 h-12 rounded-xl object-cover grayscale" />)}
                  <p className="font-semibold">{i.title}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {redeemed.length > 0 && (
          <>
            <p className="text-sm font-bold text-gray-400 mb-2">🏆 Kho Kỷ niệm</p>
            <div className="space-y-2">
              {redeemed.map((i: any) => (
                <div key={i.id} className="bg-white rounded-2xl p-3 flex items-center gap-3">
                  {i.redemptionPhotoUrl && (// eslint-disable-next-line @next/next/no-img-element
                    <img src={i.redemptionPhotoUrl} alt="" className="w-12 h-12 rounded-xl object-cover" />)}
                  <div>
                    <p className="font-semibold">{i.title}</p>
                    <p className="text-xs text-gray-400">{(i.redeemed_at || '').slice(0, 10)}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <button className="btn-secondary w-full mt-6" onClick={() => setAdding(true)}>➕ Con muốn đạt thêm điều gì</button>
      </div>

      {adding && (
        <div className="fixed inset-0 bg-black/40 flex items-end" onClick={() => setAdding(false)}>
          <div className="bg-white w-full rounded-t-3xl p-5" onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-bold mb-3">Mục tiêu mới của con</p>
            <div className="mb-3"><VoiceInput value={title} onChange={setTitle} placeholder="Con muốn có / làm gì? (hoặc bấm 🎤 nói)" /></div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="" className="w-full h-40 object-cover rounded-2xl mb-3" />
            ) : (
              <button className="btn-secondary w-full mb-3" onClick={() => fileRef.current?.click()}>📷 Chụp ảnh món con muốn</button>
            )}
            <button className="btn-primary w-full" onClick={propose} disabled={!title}>Gửi cho bố mẹ xem</button>
          </div>
        </div>
      )}
    </Shell>
  );
}
