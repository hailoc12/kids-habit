'use client';
// F01+F02 — Màn Hôm Nay: TIMELINE + đồng hồ to + rùa về đích
// xux/2026-10-02-timeline-clock-turtle — "Bây giờ là mấy giờ? Mình đang ở việc nào? Việc gì sắp tới?"
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Shell from '@/components/Shell';

type Item = {
  instanceId: number; templateId: number; title: string; icon: string;
  section: 'sang' | 'toi'; grp: 'A' | 'B'; target: string; parentNote: string;
  subtasks: { id: string; title: string; icon: string; done: boolean }[];
  status: string; checkedAt: string | null; onTime: boolean | null; photoUrl: string | null;
};

function hhmmToMin(s: string): number {
  const m = s.match(/(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : -1;
}
function greeting(): string {
  const hr = new Date().getHours();
  if (hr < 11) return 'Chào buổi sáng';
  if (hr < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}
const DAY_NAMES = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

/* ───────── Đồng hồ hero: digital to + kim SVG (luyện đọc giờ) ───────── */
function ClockHero({ childName, balance }: { childName: string; balance: number }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
  const hh = String(h).padStart(2, '0'), mm = String(m).padStart(2, '0'), ss = String(s).padStart(2, '0');
  const hourAng = (h % 12) * 30 + m * 0.5;
  const minAng = m * 6;
  const secAng = s * 6;

  return (
    <div className="px-4 pt-4 lg:px-6 lg:pt-6">
      <div className="bg-white rounded-[2rem] px-5 py-4 lg:px-6 lg:py-5 shadow-md flex items-center gap-4 lg:gap-6">
        {/* đồng hồ kim nhỏ gọn — luyện đọc giờ mà không chiếm diện tích */}
        <svg viewBox="0 0 100 100" className="w-16 h-16 lg:w-24 lg:h-24 shrink-0" aria-label="đồng hồ">
          <circle cx="50" cy="50" r="48" fill="#FFFBEB" stroke="#F59E0B" strokeWidth="3" />
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i * 30 * Math.PI) / 180;
            const x1 = 50 + 40 * Math.sin(a), y1 = 50 - 40 * Math.cos(a);
            const x2 = 50 + 44 * Math.sin(a), y2 = 50 - 44 * Math.cos(a);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#B45309" strokeWidth={i % 3 === 0 ? 2.5 : 1.2} />;
          })}
          <text x="50" y="18" textAnchor="middle" fontSize="7" fill="#B45309" fontWeight="bold">12</text>
          <text x="85" y="53" textAnchor="middle" fontSize="7" fill="#B45309" fontWeight="bold">3</text>
          <text x="50" y="90" textAnchor="middle" fontSize="7" fill="#B45309" fontWeight="bold">6</text>
          <text x="15" y="53" textAnchor="middle" fontSize="7" fill="#B45309" fontWeight="bold">9</text>
          <line x1="50" y1="50" x2={50 + 22 * Math.sin((hourAng * Math.PI) / 180)} y2={50 - 22 * Math.cos((hourAng * Math.PI) / 180)} stroke="#1F2937" strokeWidth="4" strokeLinecap="round" />
          <line x1="50" y1="50" x2={50 + 34 * Math.sin((minAng * Math.PI) / 180)} y2={50 - 34 * Math.cos((minAng * Math.PI) / 180)} stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="50" y1="50" x2={50 + 38 * Math.sin((secAng * Math.PI) / 180)} y2={50 - 38 * Math.cos((secAng * Math.PI) / 180)} stroke="#F59E0B" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="50" cy="50" r="3" fill="#B45309" />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-xs lg:text-sm text-gray-400 font-semibold">{DAY_NAMES[now.getDay()]}, ngày {now.getDate()} tháng {now.getMonth() + 1}</p>
          <p className="font-extrabold text-star-deep tabular-nums leading-none text-4xl lg:text-6xl">{hh}<span className="text-star">:</span>{mm}<span className="text-xl lg:text-3xl text-gray-300 ml-0.5">:{ss}</span></p>
          <p className="text-sm lg:text-xl font-bold text-ink mt-1 truncate">{greeting()}, {childName}! <span className="text-star-deep">⭐ {balance}</span></p>
        </div>
        <Link href="/parent" className="lg:hidden text-[10px] text-gray-300 border border-gray-200 rounded-full px-2 py-0.5 self-start shrink-0">bố mẹ</Link>
      </div>
    </div>
  );
}

/* ───────── Đường chạy rùa: tiến 1 bước/việc con TỰ làm — không đua ai, không đua giờ ───────── */
function TurtleTrack({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const finished = total > 0 && done === total;
  return (
    <div className="px-4 lg:px-6 mt-3">
      <div className="bg-gradient-to-r from-emerald-50 to-amber-50 rounded-[2rem] px-5 py-4 shadow-sm relative overflow-hidden">
        <p className="text-sm lg:text-base font-bold text-emerald-800">
          {finished ? '🏆 Rùa về đích rồi! Con làm hết {n} việc hôm nay!'.replace('{n}', String(total)) : `🐢 Con đã đi được ${done}/${total} bước về đích!`}
        </p>
        {/* lane */}
        <div className="relative h-12 mt-1">
          <div className="absolute left-2 right-10 top-1/2 border-t-4 border-dashed border-emerald-300" />
          {/* cỏ mọc hai bên cho vui */}
          <span className="absolute left-6 bottom-0 text-lg opacity-60">🌱</span>
          <span className="absolute left-1/3 bottom-0 text-base opacity-50">🌿</span>
          <span className="absolute right-1/3 bottom-0 text-lg opacity-60">🌱</span>
          <span className="absolute right-16 bottom-0 text-base opacity-50">🌷</span>
          {/* đích */}
          <span className="absolute right-0 top-0 text-4xl">{finished ? '🏁🎉' : '🏁'}</span>
          {/* rùa tiến theo số việc xong — emoji 🐢 mặc định nhìn trái, cần scaleX(-1) để hướng về đích bên phải */}
          <span className="absolute -top-1 text-4xl transition-all duration-700 ease-out select-none" style={{ left: `calc(${pct * 0.88}% + 4px)`, transform: 'scaleX(-1)' }}>
            {finished ? '🐢🏆' : '🐢'}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ───────── Timeline một buổi: time-rail + chip BÂY GIỜ + trạng thái màu ───────── */
function timeState(item: Item, nowMin: number): 'past' | 'current' | 'future' {
  const to = hhmmToMin(item.target.split('–')[1] || '');
  const from = hhmmToMin(item.target.split('–')[0] || '');
  if (to >= 0 && to < nowMin) return 'past';
  if (from >= 0 && from <= nowMin && to >= nowMin) return 'current';
  return 'future';
}

export default function HomePage() {
  const [data, setData] = useState<any>(null);
  const [active, setActive] = useState<Item | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState<string | null>(null);
  const [subDone, setSubDone] = useState<Record<string, boolean>>({});
  const [now, setNow] = useState(new Date());
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000); // cập nhật trạng thái timeline mỗi 15s
    return () => clearInterval(t);
  }, []);

  const loadedDateRef = useRef('');        // ngày của data đang hiển thị
  const lastDayResetRef = useRef(0);       // chống loop nếu client/server lệch ngày

  const load = useCallback(async () => {
    const res = await fetch('/api/today', { cache: 'no-store' });
    if (res.status === 401) { window.location.href = '/login'; return; }
    const j = await res.json();
    loadedDateRef.current = j.date;
    setData(j);
  }, []);
  useEffect(() => { load(); }, [load]);
  const [tonightClasses, setTonightClasses] = useState<any[]>([]);
  useEffect(() => {
    fetch('/api/classes', { cache: 'no-store' }).then((r) => r.json())
      .then((j) => setTonightClasses(j.today || [])).catch(() => {});
  }, []);

  // sang ngày mới mà tab vẫn mở (iPad để qua đêm) → checklist KHÔNG reset trên màn hình
  // cũ dù server đã có ngày mới → so ngày VN client vs ngày đã load, khác thì fetch lại
  useEffect(() => {
    const vnToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    const checkDay = () => {
      if (!loadedDateRef.current || vnToday() === loadedDateRef.current) return;
      if (Date.now() - lastDayResetRef.current < 60_000) return; // server vẫn trả ngày cũ → chờ, đừng spam
      lastDayResetRef.current = Date.now();
      setSubDone({});
      load();
    };
    const t = setInterval(checkDay, 15000);
    document.addEventListener('visibilitychange', checkDay); // iPad thức dậy khỏi sleep
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', checkDay); };
  }, [load]);

  function open(item: Item) {
    if (item.status === 'done' && !item.photoUrl) { attachFlow(item); return; }
    if (item.status === 'done') return;
    setActive(item); setPhoto(null);
  }
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result as string);
    reader.readAsDataURL(f);
  }
  /** One-tap: tick done ngay trên thẻ — OPTIMISTIC: thẻ đổi trạng thái ngay, sai thì load() tự hoàn tác */
  async function quickTick(item: Item) {
    if (item.status === 'done') return;
    // optimistic update: done ngay + rùa nhích ngay
    setData((d: any) => ({
      ...d,
      items: d.items.map((i: Item) =>
        i.instanceId === item.instanceId
          ? { ...i, status: 'done', checkedAt: new Date().toISOString(), onTime: null }
          : i),
    }));
    try {
      const res = await fetch('/api/checkin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId: item.instanceId }),
      });
      const j = await res.json();
      if (j.ok && j.feedback) { setCelebrate(j.feedback); setTimeout(() => setCelebrate(null), 3200); }
    } catch { /* mất mạng — load() sẽ hoàn tác */ }
    load();
  }
  /** gắn ảnh sau cho việc đã done (optional) */
  function attachFlow(item: Item) {
    setActive(item); setPhoto(null);
    setTimeout(() => fileRef.current?.click(), 150);
  }
  async function confirmCheckin() {
    if (!active) return;
    if (photo) {
      // có ảnh: tick kèm ảnh (từ sheet) hoặc gắn ảnh cho việc đã done
      const done = active.status === 'done';
      await fetch('/api/checkin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId: active.instanceId, photo, ...(done ? { mode: 'attach' } : {}) }),
      });
    } else {
      await quickTick(active);
    }
    setActive(null);
    load();
  }

  if (!data) return <Shell><div className="p-10 text-center text-gray-400 text-xl">Đang tải…</div></Shell>;
  const sang = (data.items as Item[]).filter((i) => i.section === 'sang');
  const toi = (data.items as Item[]).filter((i) => i.section === 'toi');
  const doneCount = (data.items as Item[]).filter((i) => i.status === 'done').length;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowLabel = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return (
    <Shell>
      <ClockHero childName={data.childName || 'Bé'} balance={data.balance} />
      <TurtleTrack done={doneCount} total={data.items.length} />

      {/* 🎁 Banner quà bố mẹ — hiện 1 lần, tap để mở và đánh dấu đã xem */}
      {data.gift && (
        <div className="mx-4 lg:mx-6 mt-3 bg-gradient-to-r from-pink-50 to-amber-50 rounded-3xl p-5 lg:p-6 border-2 border-pink-200 shadow-md relative overflow-hidden">
          <span className="absolute -right-2 -top-2 text-7xl opacity-20 rotate-12">🎁</span>
          <p className="font-extrabold text-lg lg:text-2xl text-pink-700">🎁 Bố mẹ có quà tặng con!</p>
          <p className="text-3xl lg:text-4xl font-extrabold text-star-deep my-2">⭐ {data.gift.stars} sao</p>
          <p className="text-base lg:text-lg text-gray-600 leading-relaxed">💌 "{data.gift.message}"</p>
          <p className="text-xs text-gray-400 mt-2">— {data.gift.giver}, ngày {data.gift.date}</p>
          <button className="btn-primary w-full mt-4" onClick={async () => {
            await fetch('/api/bonus', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'seen', id: data.gift.id }) });
            load();
          }}>Cảm ơn bố mẹ! 💛</button>
        </div>
      )}

      {/* 🔥 chuỗi ngày tốt — THÔNG TIN tiến bộ so với chính con (không phải điều kiện đổi thưởng) */}
      {data.dayStreak >= 1 && (
        <div className="mx-4 lg:mx-6 mt-3 bg-gradient-to-r from-orange-50 to-amber-50 rounded-3xl p-4 lg:p-5 border-l-4 border-amber-400 shadow-sm">
          <p className="font-extrabold text-star-deep text-lg lg:text-2xl">
            🔥 Con đã làm tốt <span className="text-amber-500">{data.dayStreak}</span> ngày liên tục!
          </p>
          {(data.dayStreakBadges || []).length > 0 && (
            <p className="text-sm lg:text-base mt-1 font-bold text-amber-600">
              {data.dayStreakBadges.map((m: number) => `🎉 Huy hiệu ${m} ngày`).join('  ')}
            </p>
          )}
        </div>
      )}

      {data.morning && !data.review && !data.gift && (
        <div className="mx-4 lg:mx-6 mt-3 bg-white rounded-3xl p-4 lg:p-5 border-l-4 border-star shadow-sm">
          <p className="font-bold text-star-deep text-lg lg:text-xl">🌙 Ngày {data.morning.date}: con nhận được {data.morning.stars} sao!</p>
          {data.morning.note && <p className="text-sm lg:text-base mt-1 text-gray-600">💬 {data.morning.note}</p>}
        </div>
      )}

      {tonightClasses.length > 0 && (
        <div className="mx-4 lg:mx-6 mt-3 bg-gradient-to-r from-indigo-50 to-white rounded-3xl p-4 border-2 border-indigo-100 flex items-center gap-3">
          <span className="text-4xl">🎓</span>
          <div>
            <p className="font-extrabold text-indigo-800">Tối nay có lớp:</p>
            {tonightClasses.map((c: any) => (
              <p key={c.id} className="text-sm lg:text-base font-bold text-ink">{c.icon} {c.title} · <b className="text-indigo-600">{String(Math.floor(c.start / 60)).padStart(2, '0')}:{String(c.start % 60).padStart(2, '0')}–{String(Math.floor(c.end / 60)).padStart(2, '0')}:{String(c.end % 60).padStart(2, '0')}</b></p>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4 lg:gap-6 lg:px-6 mt-3 items-start">
        <Timeline title="☀️ BUỔI SÁNG" items={sang} nowMin={nowMin} nowLabel={nowLabel} onOpen={open} />
        <Timeline title="🌙 BUỔI TỐI" items={toi} nowMin={nowMin} nowLabel={nowLabel} onOpen={open} />
      </div>

      {!data.selfRating && toi.length > 0 && (
        <div className="m-4 lg:mx-6 lg:mt-6">
          <Link href="/end-of-day" className="btn-primary w-full block text-center">⭐ Kết thúc ngày: con tự chấm sao</Link>
        </div>
      )}

      {active && (
        <div className="fixed inset-0 bg-black/40 flex items-end lg:items-center justify-center z-50" onClick={() => setActive(null)}>
          <div className="bg-white w-full lg:max-w-lg rounded-t-3xl lg:rounded-[2rem] p-5 lg:p-7" onClick={(e) => e.stopPropagation()}>
            <p className="text-xl lg:text-2xl font-bold mb-1">{active.icon} {active.title}</p>
            <p className="text-xs lg:text-sm text-gray-400 mb-4">
              {active.status === 'done' ? 'gắn thêm ảnh cho việc con đã làm' : active.grp === 'A' ? 'việc con thích — chỉ ghi lại làm kỷ niệm' : `khung: ${active.target}`}
            </p>
            {active.status !== 'done' && active.subtasks?.length > 0 && (
              <div className="mb-4 bg-amber-50 rounded-2xl p-4">
                <p className="text-sm lg:text-base font-bold text-star-deep mb-2">Con đang ở bước nào?</p>
                {active.subtasks.map((s: any) => (
                  <label key={s.id} className="flex items-center gap-3 py-2 text-base lg:text-lg">
                    <input type="checkbox" className="w-8 h-8 lg:w-9 lg:h-9 accent-amber-500" checked={!!subDone[s.id]}
                      onChange={(e) => setSubDone({ ...subDone, [s.id]: e.target.checked })} />
                    <span>{s.icon} {s.title}</span>
                  </label>
                ))}
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
            {photo ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt="chụp lại việc con làm" className="w-full h-64 lg:h-80 object-cover rounded-2xl" />
                <button className="btn-primary w-full mt-4 !text-xl lg:!text-2xl !py-5" onClick={confirmCheckin}>Xong!</button>
              </>
            ) : (
              active.status === 'done' ? (
                <button className="btn-secondary w-full !py-5 !text-lg lg:!text-xl" onClick={() => fileRef.current?.click()}>📷 Chụp ảnh thêm vào</button>
              ) : (
                <div className="space-y-2">
                  <button className="btn-primary w-full !text-xl lg:!text-2xl !py-5" onClick={confirmCheckin}>✓ Xong!</button>
                  <button className="btn-secondary w-full !py-4 !text-base lg:!text-lg" onClick={() => fileRef.current?.click()}>📷 Thêm ảnh (con thích thì chụp)</button>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {celebrate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-amber-900/30 backdrop-blur-sm px-6" onClick={() => setCelebrate(null)}>
          <div className="bg-white rounded-[2rem] p-8 lg:p-12 max-w-md text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-8xl lg:text-9xl mb-4 animate-[wiggle_1s_ease-in-out_infinite]">⭐</div>
            <p className="text-xl lg:text-2xl font-bold text-star-deep leading-relaxed">{celebrate}</p>
            <p className="mt-4 text-3xl lg:text-4xl">🎉 🎉 🎉</p>
            {/* Premack hook dạng THÔNG TIN: báo tặng giấy vẽ, KHÔNG mời rời luồng làm việc —
                tránh mất tập trung khỏi nhiệm vụ tiếp theo (feedback bố 10/10) */}
            <p className="mt-4 text-sm lg:text-base font-bold text-gray-500">🎨 Sao Nhí tặng con 1 tờ giấy vẽ mới — vẽ lúc rảnh nhé!</p>
            <button className="btn-primary w-full block mt-5 !text-lg" onClick={() => setCelebrate(null)}>👍 Tiếp tục nào!</button>
          </div>
        </div>
      )}
    </Shell>
  );

  function Timeline({ title, items, nowMin, nowLabel, onOpen }: { title: string; items: Item[]; nowMin: number; nowLabel: string; onOpen: (i: Item) => void }) {
    if (!items.length) return null;
    let nextAssigned = false;
    return (
      <section className="px-4 lg:px-0 pb-2">
        <h2 className="font-extrabold text-gray-500 text-sm lg:text-xl tracking-wide mb-2 lg:mb-3">{title}</h2>
        <div className="relative">
          <div className="space-y-2 lg:space-y-2.5">
            {items.map((item) => {
              const ts = timeState(item, nowMin);
              const isDone = item.status === 'done';
              const isNext = !nextAssigned && !isDone && ts === 'future';
              if (isNext) nextAssigned = true;
              const fromLabel = (item.target.split('–')[0] || '').trim();
              const rowCls = ts === 'past' && !isDone
                ? 'opacity-45 grayscale'           // đã qua khung giờ, chưa làm — mờ
                : ts === 'current' && !isDone
                  ? 'ring-4 ring-star/70 scale-[1.02] bg-white' // đang trong khung — nổi bật
                  : '';
              return (
                <div key={item.instanceId}>
                  <TimelineNowMarker items={items} item={item} nowMin={nowMin} nowLabel={nowLabel} />
                  <button onClick={() => onOpen(item)}
                    className={`card-task w-full text-left flex items-center gap-3 lg:gap-4 lg:p-4 ${isDone ? (item.onTime ? 'done' : 'done late') : ''} ${rowCls}`}>
                    {/* ↓ nội dung thẻ — tap mở chi tiết (sub-task / thêm ảnh) */}
                    <span className="text-xs lg:text-sm font-extrabold text-star-deep tabular-nums w-11 lg:w-14 shrink-0 text-right">{fromLabel}</span>
                    <span className="text-4xl lg:text-5xl">{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-lg lg:text-2xl leading-tight ${isDone ? 'text-gray-400 line-through decoration-star' : ''}`}>{item.title}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {ts === 'current' && !isDone && <span className="text-[10px] lg:text-xs font-extrabold bg-star text-white rounded-full px-2 py-0.5 animate-pulse">ĐANG LÀM</span>}
                        {isNext && <span className="text-[10px] lg:text-xs font-extrabold bg-emerald-500 text-white rounded-full px-2 py-0.5">SẮP TỚI CỦA CON ↓</span>}
                        {ts === 'past' && !isDone && <span className="text-[10px] lg:text-xs font-bold text-gray-400">đã qua khung — vẫn làm được nhé</span>}
                        <span className="text-xs lg:text-base text-gray-400">{item.grp === 'A' ? '📖 việc con thích' : `⏰ ${item.target}`}</span>
                        {(item as any).shifted && <span className="text-[10px] lg:text-xs font-extrabold text-indigo-500 bg-indigo-50 rounded-full px-2 py-0.5">dồn sau lớp 🎓</span>}
                      </div>
                      {isDone && item.checkedAt && (
                        <p className="text-xs lg:text-base mt-0.5 text-star-deep font-semibold">
                          ✓ {new Date(item.checkedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          {item.onTime ? ' · đúng giờ' : ' · trễ một chút'}
                        </p>
                      )}
                    </div>
                    {item.photoUrl && isDone && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.photoUrl} alt="" className="w-14 h-14 lg:w-20 lg:h-20 rounded-xl object-cover border-2 border-star/40" />
                    )}
                    {/* ONE-TAP: ✓ to tick ngay — hoặc 📷 gắn ảnh sau khi done */}
                    {isDone ? (
                      !item.photoUrl ? (
                        <span onClick={(e) => { e.stopPropagation(); attachFlow(item); }}
                          className="shrink-0 w-14 h-14 lg:w-16 lg:h-16 rounded-full bg-white border-2 border-star/40 flex flex-col items-center justify-center text-xl shadow-sm active:scale-90 transition">
                          📷<span className="text-[9px] font-bold text-gray-400">thêm ảnh</span>
                        </span>
                      ) : null
                    ) : (
                      <span onClick={(e) => { e.stopPropagation(); quickTick(item); }}
                        className="shrink-0 w-16 h-16 lg:w-20 lg:h-20 rounded-full bg-star text-white text-4xl font-bold flex items-center justify-center shadow-lg active:scale-90 transition hover:brightness-110 select-none"
                        aria-label={`tick ${item.title}`}>
                        ✓
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  }
}

/** vạch BÂY GIỜ: hiển thị trước việc ĐẦU TIÊN có khung giờ ≥ giờ thật — dạng pill mềm, không thanh ngang */
function TimelineNowMarker({ items, item, nowMin, nowLabel }: { items: Item[]; item: Item; nowMin: number; nowLabel: string }) {
  const isFirstAtOrAfter = (() => {
    for (const it of items) {
      const ts = timeState(it, nowMin);
      if (ts === 'past') continue;
      return it.instanceId === item.instanceId;
    }
    return false;
  })();
  if (!isFirstAtOrAfter) return null;
  return (
    <div className="my-1.5 lg:my-2 flex justify-center">
      <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-orange-100 to-amber-50 border border-orange-200/60 rounded-full px-4 py-1 shadow-sm">
        <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
        <span className="text-[10px] lg:text-xs font-extrabold text-orange-600 tabular-nums">Bây giờ {nowLabel}</span>
      </span>
    </div>
  );
}
