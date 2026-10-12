'use client';
// F03 — Parent Review: duyệt ngày <60s (+ duyệt nhiệm vụ Extra + 🎁 thưởng sao cuối ngày)
import { useCallback, useEffect, useState } from 'react';

const BONUS_PACKS = [
  { stars: 3, label: 'Ngày bình thường', emoji: '🌤' },
  { stars: 5, label: 'Ngày tốt', emoji: '🌟' },
  { stars: 10, label: 'Ngày xuất sắc', emoji: '🏆' },
];
const WISH_TEMPLATES = [
  'Hôm nay con tự làm rất nhiều việc — bố mẹ tự hào về con!',
  'Con tự sắp xếp việc của mình gọn gàng hơn mỗi ngày — tiếp tục nhé con!',
  'Con giữ lời hứa với Sao Nhí — điều đó quý lắm!',
];

export default function ReviewPage() {
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const todayStr = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  const dateLabel = (d: string) => {
    const names = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
    const [y, m, dd] = d.split('-').map(Number);
    return `${names[new Date(y, m - 1, dd).getDay()]} ${dd}/${m}`;
  };
  const shiftDate = (n: number) => {
    const [y, m, dd] = date.split('-').map(Number);
    const next = new Date(y, m - 1, dd + n);
    setDate(next.toLocaleDateString('en-CA'));
  };
  const [data, setData] = useState<any>(null);
  const [adjust, setAdjust] = useState<Record<number, boolean>>({});
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [pending, setPending] = useState<any[]>([]);
  const [bonus, setBonus] = useState<any>(null);
  const [bonusStars, setBonusStars] = useState(5);
  const [bonusMsg, setBonusMsg] = useState('');
  const [msg2, setMsg2] = useState('');

  const loadMissions = useCallback(() => {
    fetch('/api/missions').then((r) => r.json()).then((j) => setPending(j.pending || []));
  }, []);
  useEffect(() => { loadMissions(); }, [loadMissions]);
  async function decide(claimId: number, action: 'approve' | 'reject') {
    await fetch('/api/missions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, claimId }),
    });
    loadMissions();
  }

  const loadBonus = useCallback((d: string) => {
    fetch(`/api/bonus?date=${d}`).then((r) => r.json()).then((j) => {
      setBonus(j.todayBonus);
      if (j.todayBonus) { setBonusStars(j.todayBonus.stars); setBonusMsg(j.todayBonus.message); }
    });
  }, []);

  const load = useCallback(async (d: string) => {
    const res = await fetch(`/api/review?date=${d}`);
    if (res.status === 403) { window.location.href = '/parent'; return; }
    setData(await res.json());
    setAdjust({}); setNote('');
    loadBonus(d);
  }, [loadBonus]);
  useEffect(() => { load(date); }, [date, load]);

  async function accept() {
    const adjustments = Object.entries(adjust).filter(([, v]) => v).map(([k]) => ({ instanceId: Number(k), reason: 'parent-adjust' }));
    const res = await fetch('/api/review/accept', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, adjustments, noteToChild: note }),
    });
    const j = await res.json();
    setMsg(j.ok ? `Đã duyệt — Bé nhận ${j.stars} sao. Con sẽ thấy sáng mai.` : `Lỗi: ${j.error}`);
    load(date);
  }

  if (!data) return <div className="p-10 text-center text-gray-400">Đang tải…</div>;
  const accepted = data.review?.status === 'accepted';

  return (
    <div className="max-w-2xl lg:max-w-5xl mx-auto p-4 pb-32 lg:px-8">
      <h1 className="text-xl font-extrabold">🔍 Duyệt ngày của Bé</h1>
      <input type="date" className="input my-3 hidden" value={date} onChange={(e) => setDate(e.target.value)} id="review-date-input" />
      {/* ── Thanh điều hướng ngày TO — duyệt hôm nay & quay lại duyệt quá khứ ── */}
      <div className="my-3 bg-white rounded-3xl p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <button className="w-12 h-12 lg:w-14 lg:h-14 rounded-2xl bg-amber-50 text-2xl font-extrabold text-star-deep active:scale-90 transition"
            onClick={() => shiftDate(-1)} aria-label="ngày trước">‹</button>
          <div className="flex-1 text-center min-w-0">
            <p className="text-base lg:text-xl font-extrabold truncate">{dateLabel(date)}</p>
            {date === todayStr() ? <p className="text-[11px] font-bold text-emerald-600">hôm nay</p> : null}
          </div>
          <button className="w-12 h-12 lg:w-14 lg:h-14 rounded-2xl bg-amber-50 text-2xl font-extrabold text-star-deep active:scale-90 transition disabled:opacity-30"
            disabled={date >= todayStr()} onClick={() => shiftDate(1)} aria-label="ngày sau">›</button>
          <button className="w-12 h-12 lg:w-14 lg:h-14 rounded-2xl bg-white border border-amber-200 text-xl active:scale-90 transition"
            onClick={() => document.getElementById('review-date-input')?.click()} aria-label="chọn ngày">📅</button>
        </div>
        {(data.pendingDates?.length || 0) > 0 && (
          <div className="mt-2.5 pt-2.5 border-t border-amber-50">
            <p className="text-[11px] font-extrabold text-gray-400 mb-1.5">⏳ Ngày con làm việc nhưng CHƯA duyệt (bấm để duyệt bù):</p>
            <div className="flex gap-2 flex-wrap">
              {data.pendingDates.map((p: any) => (
                <button key={p.date} onClick={() => setDate(p.date)}
                  className={`text-sm font-extrabold rounded-2xl px-3.5 py-2 active:scale-95 transition ${p.date === date ? 'bg-star text-white' : 'bg-amber-50 text-star-deep'}`}>
                  {dateLabel(p.date).replace('Thứ ', 'T')}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {accepted && <p className="bg-green-50 text-green-700 rounded-2xl p-3 text-sm font-bold">Đã duyệt bởi {data.review.reviewer} lúc {(data.review.accepted_at || '').slice(11, 16)}</p>}
      {msg && <p className="bg-amber-50 text-star-deep rounded-2xl p-3 text-sm font-bold my-2">{msg}</p>}

      <div className="space-y-2 my-4 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0">
        {data.items.map((item: any) => (
          <div key={item.instanceId} className={`bg-white rounded-2xl p-3 flex gap-3 items-center shadow-sm ${item.status !== 'done' ? 'opacity-50' : ''}`}>
            {item.photoUrl ? (// eslint-disable-next-line @next/next/no-img-element
              <img src={item.photoUrl} alt="" className="w-16 h-16 rounded-xl object-cover cursor-pointer" onClick={() => window.open(item.photoUrl, '_blank')} />) : (
              item.status === 'done' && <span className="text-xs text-gray-300 w-16 text-center">— chưa có ảnh</span>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">{item.icon} {item.title} <span className="text-[10px] text-gray-400">{item.grp === 'A' ? 'nhóm A' : 'nhóm B'}</span></p>
              <p className="text-xs text-gray-500">
                {item.status !== 'done' ? 'chưa làm' : `${(item.checkedAt || '').slice(11, 16)} · ${item.onTime ? '✅ đúng giờ (+2)' : '🕐 trễ (+1)'}`}
              </p>
            </div>
            {item.status === 'done' && !accepted && (
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" className="w-5 h-5" checked={!!adjust[item.instanceId]}
                  onChange={(e) => setAdjust({ ...adjust, [item.instanceId]: e.target.checked })} />
                điều chỉnh
              </label>
            )}
          </div>
        ))}
      </div>

      {data.selfRating && (
        <div className="bg-amber-50 rounded-2xl p-4 mb-4">
          <p className="font-bold text-sm">⭐ Bé tự chấm: {data.selfRating.stars}/5</p>
          {data.selfRating.proud_text && <p className="text-sm mt-1">"{data.selfRating.proud_text}"</p>}
        </div>
      )}

      {pending.length > 0 && (
        <div className="mb-4">
          <h2 className="font-bold mb-2 text-sm">🆘 Nhiệm vụ Extra con gửi kèm ảnh ({pending.length})</h2>
          <div className="space-y-2">
            {pending.map((c: any) => (
              <div key={c.claim_id} className="bg-blue-50 rounded-2xl p-3 flex items-center gap-3">
                {c.photoUrl ? (// eslint-disable-next-line @next/next/no-img-element
                  <img src={c.photoUrl} alt="ảnh minh chứng" className="w-16 h-16 rounded-xl object-cover cursor-pointer border border-blue-200"
                    onClick={() => window.open(c.photoUrl, '_blank')} />) : (
                  <span className="text-2xl">{c.icon}</span>
                )}
                <div className="flex-1"><p className="font-bold text-sm">{c.title}</p>
                  <p className="text-[11px] text-gray-400">{c.date} · +{c.stars} sao vào túi con{c.photoUrl ? ' · bấm ảnh để xem to' : ' · ⚠️ không có ảnh'}</p></div>
                <button className="text-xs font-bold bg-green-500 text-white rounded-full px-3 py-1.5" onClick={() => decide(c.claim_id, 'approve')}>duyệt</button>
                <button className="text-xs font-bold bg-gray-300 rounded-full px-3 py-1.5" onClick={() => decide(c.claim_id, 'reject')}>chưa</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!accepted && (
        <>
          <textarea className="input h-20" placeholder="Lời nhắn cho con (hiện sáng mai — mô tả điều con làm được)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn-primary w-full mt-3" onClick={accept}>Duyệt ngày</button>
        </>
      )}

      {/* 🎁 Bố mẹ thưởng sao cuối ngày */}
      <div className="mt-8 bg-gradient-to-r from-pink-50 to-amber-50 rounded-3xl p-4 border-2 border-pink-200">
        <p className="font-extrabold text-pink-700">🎁 Bố mẹ thưởng sao — đánh giá ngày của con</p>
        {bonus?.seen_at ? (
          <p className="text-sm mt-2 text-gray-500">Đã tặng <b>⭐{bonus.stars}</b> — con đã xem lời chúc rồi.<br />💌 "{bonus.message}"</p>
        ) : (
          <>
            <div className="flex gap-2 flex-wrap mt-3">
              {BONUS_PACKS.map((p) => (
                <button key={p.stars} onClick={() => setBonusStars(p.stars)}
                  className={`rounded-2xl px-4 py-2 text-sm font-bold ${bonusStars === p.stars ? 'bg-star text-white' : 'bg-white text-gray-500'}`}>
                  {p.emoji} ⭐{p.stars} · {p.label}
                </button>
              ))}
              <input type="number" min={1} max={50} value={bonusStars} onChange={(e) => setBonusStars(Number(e.target.value))}
                className="input !p-2 !text-sm w-20" aria-label="sao tùy chỉnh" />
            </div>
            <textarea className="input h-20 mt-2" value={bonusMsg} onChange={(e) => setBonusMsg(e.target.value)}
              placeholder="Lời chúc cho con — mô tả điều con làm được hôm nay (VD: 'Con tự tắm và tự sắp cặp cả tuần nay…')" />
            <div className="flex gap-2 flex-wrap mt-1">
              {WISH_TEMPLATES.map((t, i) => (
                <button key={i} className="text-[11px] bg-white rounded-full px-3 py-1 text-gray-500 border border-pink-100"
                  onClick={() => setBonusMsg(t)}>dùng mẫu: "{t.slice(0, 24)}…"</button>
              ))}
            </div>
            {msg2 && <p className="text-sm mt-2 font-bold text-pink-700">{msg2}</p>}
            <button className="btn-primary w-full mt-3 !text-lg" onClick={async () => {
              const res = await fetch('/api/bonus', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'give', date, stars: bonusStars, message: bonusMsg }),
              });
              const j = await res.json();
              setMsg2(j.ok ? `✓ Đã tặng ⭐${bonusStars} — Bé sẽ thấy banner quà khi mở app (hiện 1 lần)` : `✗ ${j.error}`);
              if (j.ok) loadBonus(date);
              setTimeout(() => setMsg2(''), 5000);
            }}>{bonus ? 'Sửa thưởng hôm nay' : `🎁 Tặng ⭐${bonusStars} + lời chúc`}</button>
            <p className="text-[11px] text-gray-400 mt-2">Chỉ 1 thưởng/ngày — con chưa xem thì sửa được. Lời chúc nên mô tả hành vi cụ thể (hệ thống chặn "giỏi quá" kiểu đánh giá).</p>
          </>
        )}
      </div>

      <div className="mt-8 text-sm">
        <a className="text-star-deep font-bold" href="/admin">⚙️ Admin: checklist, kho quà, wishlist…</a>
      </div>
    </div>
  );
}
