'use client';
// Nuôi thú cưng — sân khấu pet animate (CSS keyframes, không standing-yên)
// Guardrails: pet không chết/khóc dằn vặt · ngủ 21h–6h · kêu cứu = nhẹ nhàng dẫn nhiệm vụ Extra
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Shell from '@/components/Shell';

export default function PetsPage() {
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [store, setStore] = useState(false);
  const [feedFor, setFeedFor] = useState<any>(null);      // cho ăn từ nút dưới pet
  const [feedItem, setFeedItem] = useState<any>(null);    // cho ăn từ cửa hàng: đã chọn món, chọn pet
  const [buyPet, setBuyPet] = useState<any>(null);
  const [petName, setPetName] = useState('');
  const [hearts, setHearts] = useState(0);

  const load = useCallback(() => {
    fetch('/api/pets').then((r) => r.json()).then(setData);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function act(body: any) {
    const res = await fetch('/api/pets', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const j = await res.json();
    if (!j.ok) setMsg(j.error || 'Lỗi'); else { setMsg(''); setHearts((h) => h + 1); }
    load();
    setTimeout(() => setMsg(''), 3500);
    return j;
  }
  async function buyTicket(item: any) {
    const res = await fetch('/api/shop', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId: item.id }),
    });
    const j = await res.json();
    if (j.ok) window.location.href = '/pomodoro';
    else { setMsg(j.error); setTimeout(() => setMsg(''), 3500); }
  }

  if (!data) return <Shell><div className="p-10 text-center text-gray-400 text-xl">Đang tải…</div></Shell>;
  const shopPets = (data.shop || []).filter((s: any) => s.kind === 'pet');
  const foods = (data.shop || []).filter((s: any) => s.kind === 'food');
  const tickets = (data.shop || []).filter((s: any) => s.kind === 'ytticket');

  return (
    <Shell>
      <div className="p-4 pt-6 lg:px-6 lg:pt-8">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-2xl lg:text-4xl font-extrabold text-star-deep">🐣 Nhà thú cưng</h1>
          <span className="bg-white rounded-2xl px-4 py-2 shadow-sm font-extrabold text-star-deep text-lg lg:text-2xl">⭐ {data.balance}</span>
        </div>
        {msg && <p className="bg-amber-50 text-star-deep rounded-2xl p-3 text-sm lg:text-base font-bold mt-3">{msg}</p>}

        {/* SÂN KHẤU — bầu trời + cỏ, pet animate */}
        <div className="mt-4 rounded-[2rem] overflow-hidden shadow-md bg-gradient-to-b from-sky-100 to-emerald-50 relative min-h-64 lg:min-h-80">
          <div className="absolute top-3 right-5 text-4xl animate-[float_6s_ease-in-out_infinite]">☀️</div>
          <div className="absolute top-8 left-8 text-3xl opacity-80 animate-[float_8s_ease-in-out_infinite]">☁️</div>
          <div className="absolute top-4 left-1/2 text-2xl opacity-60 animate-[float_7s_ease-in-out_1s_infinite]">☁️</div>
          <div className="absolute bottom-0 inset-x-0 h-14 bg-emerald-200/70" />
          {hearts > 0 && (
            <div key={hearts} className="absolute inset-0 pointer-events-none">
              <span className="absolute left-1/4 top-1/3 text-3xl animate-[float_1.5s_ease-out_forwards]">💛</span>
              <span className="absolute left-1/2 top-1/4 text-2xl animate-[float_1.8s_ease-out_forwards]">💛</span>
              <span className="absolute right-1/4 top-1/3 text-3xl animate-[float_1.6s_ease-out_.2s_forwards]">✨</span>
            </div>
          )}
          {data.pets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <span className="text-6xl animate-[wiggle_2s_ease-in-out_infinite]">🥚</span>
              <p className="text-lg font-bold text-gray-500">Chưa có bạn nào — vào Cửa hàng nhận nuôi bạn đầu tiên nhé!</p>
            </div>
          ) : (
            <div className="flex flex-wrap items-end justify-center gap-6 lg:gap-12 pt-14 pb-8 px-4">
              {data.pets.map((p: any, i: number) => (
                <div key={p.id} className="flex flex-col items-center w-40 lg:w-52">
                  {/* pet animate: bob + hop ngẫu nhiên theo delay riêng */}
                  <button onClick={() => p.eggReady ? act({ action: 'hatch', petId: p.id }) : act({ action: 'play', petId: p.id })}
                    className="select-none active:scale-90 transition"
                    style={{ transform: `scale(${stageScale(p.stats.stage)})` }}>
                    <span className={`block text-6xl lg:text-7xl ${p.stats.sleeping ? 'grayscale' : ''}
                      ${p.stats.stage === 'egg' ? 'animate-[wiggle_3s_ease-in-out_infinite]'
                        : i % 2 === 0 ? 'animate-[bob_2.2s_ease-in-out_infinite]' : 'animate-[hop_2.8s_ease-in-out_infinite]'}`}
                      style={{ animationDelay: `${i * 0.4}s` }}>
                      {p.stats.stage === 'egg' ? '🥚' : p.type_emoji}
                    </span>
                    {p.stats.stage === 'egg' && p.eggReady && <span className="absolute -mt-10 text-2xl animate-bounce">✨</span>}
                    {p.stats.sleeping && <span className="text-xl">💤</span>}
                  </button>
                  {p.stats.mood !== 'ok' && !p.stats.sleeping && p.stats.stage !== 'egg' && (
                    <span className="text-xl animate-pulse">{p.stats.mood === 'bored' ? '😢' : '🍽'}</span>
                  )}
                  <p className="font-extrabold text-base lg:text-lg mt-1">{p.name}</p>
                  {/* thanh trạng thái */}
                  <div className="w-full mt-1 space-y-1">
                    <Bar label="🍚" v={p.stats.hunger} color="bg-amber-400" />
                    <Bar label="😊" v={p.stats.happiness} color="bg-emerald-400" />
                  </div>
                  <p className="text-[10px] lg:text-xs text-gray-500 font-semibold text-center mt-1 leading-tight min-h-8">{p.speech}</p>
                  <div className="flex gap-1 mt-1">
                    {p.stats.stage !== 'egg' && (
                      <>
                        <button className="text-xs font-bold bg-white rounded-full px-3 py-1.5 shadow-sm" onClick={() => setFeedFor(p)}>🍚 cho ăn</button>
                        <button className="text-xs font-bold bg-white rounded-full px-3 py-1.5 shadow-sm disabled:opacity-40"
                          disabled={!p.canPlay} onClick={() => act({ action: 'play', petId: p.id })}>🎾 chơi</button>
                      </>
                    )}
                    <button className="text-xs font-bold bg-white rounded-full px-3 py-1.5 shadow-sm" onClick={() => {
                      const n = prompt('Đặt tên cho bạn này:', p.name);
                      if (n) act({ action: 'rename', petId: p.id, name: n });
                    }}>✏️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* nhiệm vụ extra nổi bật khi pet cần giúp */}
        {data.pets.some((p: any) => p.stats.mood === 'hungry' || p.stats.mood === 'need-help') && (
          <Link href="/missions" className="btn-primary w-full mt-4 !text-lg animate-pulse block text-center">
            🆘 Bạn nhỏ cần giúp — làm nhiệm vụ kiếm sao!
          </Link>
        )}

        <div className="grid grid-cols-2 gap-2 mt-4">
          <button className="btn-secondary !py-4" onClick={() => setStore(true)}>🛒 Cửa hàng</button>
          <Link href="/missions" className="btn-secondary !py-4 block text-center">💪 Nhiệm vụ bổ sung</Link>
        </div>

        {/* vé YouTube trong cửa hàng — hiển thị cả ở đây cho tiện */}
        {tickets.length > 0 && (
          <div className="mt-4 bg-blue-50 rounded-3xl p-4">
            <p className="font-extrabold text-blue-800 mb-2">📺 Vé YouTube (đổi bằng sao)</p>
            <div className="flex gap-2 flex-wrap">
              {tickets.map((t: any) => (
                <button key={t.id} onClick={() => { if (confirm(`Đổi ${t.price} sao lấy ${JSON.parse(t.payload||'{}').minutes}′ YouTube?`)) buyTicket(t); }}
                  className="bg-white rounded-2xl px-4 py-3 shadow-sm font-bold text-blue-700">
                  {t.emoji} {t.title} · {t.price}⭐
                </button>
              ))}
            </div>
            <p className="text-[11px] text-blue-400 mt-1">Vé chạy đồng hồ đếm ngược — hết giờ tự nhắc, không xem tiếp được.</p>
          </div>
        )}
      </div>

      {/* STORE */}
      {store && (
        <Sheet onClose={() => setStore(false)} title="🛒 Cửa hàng">
          <p className="text-sm text-gray-400 mb-2">Sao của con: <b className="text-star-deep">⭐ {data.balance}</b></p>
          <p className="font-bold text-sm mb-1">Pet bạn mới</p>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
            {shopPets.map((s: any) => {
              const owned = data.pets.some((p: any) => p.type_code === s.code);
              return (
                <button key={s.id} disabled={owned} onClick={() => { setBuyPet(s); setPetName(''); }}
                  className={`bg-white rounded-2xl p-3 shadow-sm text-left ${owned ? 'opacity-40' : 'active:scale-95 transition'}`}>
                  <span className="text-4xl">{s.emoji}</span>
                  <p className="font-bold text-sm">{s.title}</p>
                  <p className="text-xs text-star-deep font-bold">{owned ? 'con có rồi' : `${s.price}⭐`}</p>
                </button>
              );
            })}
          </div>
          <p className="font-bold text-sm mb-1">Đồ ăn — bấm để cho bạn nào ăn ngay</p>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {foods.map((f: any) => (
              <button key={f.id} onClick={() => { setFeedItem(f); setStore(false); }}
                className="bg-white rounded-2xl p-2 text-center shadow-sm active:scale-95 transition">
                <span className="text-3xl">{f.emoji}</span>
                <p className="text-[11px] font-bold">{f.title}</p>
                <p className="text-xs text-star-deep font-extrabold">{f.price}⭐</p>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-gray-400">Bấm món ăn → chọn bạn nhỏ muốn cho ăn. Vé YouTube mua ở khung xanh phía trên.</p>
        </Sheet>
      )}

      {/* ĐẶT TÊN PET MỚI */}
      {buyPet && (
        <Sheet onClose={() => setBuyPet(null)} title={`${buyPet.emoji} Đón ${buyPet.title} về nhà`}>
          <p className="text-sm text-gray-500 mb-3">Giá {buyPet.price} sao — con sẽ là người chăm bạn này!</p>
          <input className="input mb-3" value={petName} onChange={(e) => setPetName(e.target.value)} placeholder="Đặt tên cho bạn này…" maxLength={20} />
          <button className="btn-primary w-full" onClick={async () => {
            const j = await act({ action: 'buy-pet', itemId: buyPet.id, name: petName || buyPet.title });
            if (j.ok) setBuyPet(null);
          }}>Nhận nuôi</button>
        </Sheet>
      )}

      {/* CHỌN ĐỒ ĂN */}
      {feedFor && (
        <Sheet onClose={() => setFeedFor(null)} title={`🍚 Cho ${feedFor.name} ăn`}>
          <div className="grid grid-cols-4 gap-2">
            {foods.map((f: any) => (
              <button key={f.id} onClick={async () => {
                const j = await act({ action: 'feed', petId: feedFor.id, itemId: f.id });
                if (j.ok) setFeedFor(null);
              }} className="bg-white rounded-2xl p-3 text-center shadow-sm active:scale-95 transition">
                <span className="text-4xl">{f.emoji}</span>
                <p className="text-[11px] font-bold">{f.title}</p>
                <p className="text-xs text-star-deep font-extrabold">{f.price}⭐</p>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 mt-3">Chưa đủ sao? Làm nhiệm vụ nhỏ là có ngay!</p>
        </Sheet>
      )}

      {/* TỪ CỬA HÀNG: đã chọn món ăn → chọn bạn nhỏ cho ăn */}
      {feedItem && (
        <Sheet onClose={() => setFeedItem(null)} title={`${feedItem.emoji} Cho ai ăn ${feedItem.title}?`}>
          <div className="grid grid-cols-2 gap-2">
            {data.pets.filter((p: any) => p.stats.stage !== 'egg').map((p: any) => (
              <button key={p.id} onClick={async () => {
                const j = await act({ action: 'feed', petId: p.id, itemId: feedItem.id });
                if (j.ok) setFeedItem(null);
              }} className="bg-white rounded-2xl p-3 flex items-center gap-2 shadow-sm active:scale-95 transition">
                <span className="text-4xl">{p.type_emoji}</span>
                <div className="text-left"><p className="font-bold text-sm">{p.name}</p>
                  <p className="text-[11px] text-gray-400">🍚 {Math.round(p.stats.hunger)}% · 😊 {Math.round(p.stats.happiness)}%</p></div>
              </button>
            ))}
            {data.pets.filter((p: any) => p.stats.stage !== 'egg').length === 0 && (
              <p className="text-sm text-gray-400 col-span-2">Chưa có bạn nhỏ nào — nhận nuôi ở trên đã nhé!</p>
            )}
          </div>
          <p className="text-[11px] text-gray-400 mt-3">{feedItem.price} sao sẽ trừ khi cho ăn. Chưa đủ sao? Vào 💪 Nhiệm vụ bổ sung!</p>
        </Sheet>
      )}
    </Shell>
  );
}

function Bar({ label, v, color }: { label: string; v: number; color: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[11px]">{label}</span>
      <div className="flex-1 h-2.5 bg-white rounded-full overflow-hidden shadow-inner">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${Math.round(v)}%` }} />
      </div>
    </div>
  );
}

function stageScale(stage: string): number {
  return { egg: 1, baby: 0.85, teen: 1, grown: 1.25 }[stage] || 1;
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end lg:items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white w-full lg:max-w-lg rounded-t-3xl lg:rounded-[2rem] p-5 max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <p className="text-lg lg:text-xl font-extrabold mb-3">{title}</p>
        {children}
      </div>
    </div>
  );
}
