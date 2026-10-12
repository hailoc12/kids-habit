'use client';
// 🎬 Giải trí — mua gói YouTube bằng sao, hết giờ TỰ TẮT
// YouTube CHẠY NGAY TRONG APP (iframe embed listType=search) — KHÔNG mở tab mới,
// hết giờ unmount iframe là video tắt chắc chắn (không thể "quên tắt")
import { useCallback, useEffect, useRef, useState } from 'react';
import Shell from '@/components/Shell';
import VoiceInput from '@/components/VoiceInput';
import { fmtCountdown } from '@/lib/pomodoro';

const YT_SUGGEST = ['Numberblocks', 'Alphablocks', 'peppa pig tiếng việt', 'thơ trẻ em', 'học tiếng anh cho bé'];

export default function FunPage() {
  const [data, setData] = useState<any>(null);          // /api/pomodoro (active + today)
  const [videos, setVideos] = useState<any[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [ytResults, setYtResults] = useState<any[] | null>(null); // kết quả /api/yt-search
  const [searching, setSearching] = useState(false);
  const [ytSearch, setYtSearch] = useState(false);      // sheet tìm kiếm
  const [searchText, setSearchText] = useState('');
  const [msg, setMsg] = useState('');
  const [ended, setEnded] = useState(false);
  const [libraryOnly, setLibraryOnly] = useState(false);
  const lastState = useRef('');

  const load = useCallback(() => {
    fetch('/api/pomodoro', { cache: 'no-store' }).then((r) => r.json()).then(setData);
    fetch('/api/today', { cache: 'no-store' }).then((r) => r.json()).then((j) => setBalance(j.balance));
  }, []);
  useEffect(() => { load(); }, [load]);
  // batch6: re-poll định kỳ + khi tab hiện lại — server sweep idle-expire/TV mới có cơ hội chạy,
  // chống tab mở quên/qua đêm giữ state stale (rule CLAUDE.md #2)
  useEffect(() => {
    const t = setInterval(load, 30_000);
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [load]);
  useEffect(() => {
    fetch('/api/videos', { cache: 'no-store' }).then((r) => r.json()).then((j) => {
      setVideos(j.videos || []);
      setLibraryOnly(j.libraryOnly === true);
    }).catch(() => {});
  }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const active = data?.active;
  const ticket = active && active.kind === 'ticket' ? active : null;
  const running = ticket && ticket.reward_started_at && now < new Date(ticket.reward_ends_at).getTime();

  // hết giờ → dừng video + beep + complete (một lần)
  // iframe unmount = YouTube tắt CHẮC CHẮN — không thể "quên tắt"
  useEffect(() => {
    if (ticket && !running && lastState.current !== 'ended') {
      lastState.current = 'ended';
      setPlayingId(null);
      setYtResults(null);
      setYtSearch(false);
      setEnded(true);
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        for (let i = 0; i < 5; i++) {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination); o.frequency.value = 880;
          const t0 = ctx.currentTime + i * 0.35;
          g.gain.setValueAtTime(0.001, t0);
          g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.05);
          g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3);
          o.start(t0); o.stop(t0 + 0.32);
        }
      } catch {}
    }
    if (running) lastState.current = 'running';
  }, [running, ticket]);

  function startYtSearch() {
    setSearchText('');
    setYtResults(null);
    setYtSearch(true);
  }
  // tìm qua server proxy (YouTube đã bỏ embed listType=search) → grid kết quả → chọn video ID
  async function playSearch(q: string) {
    const query = q.trim();
    if (!query) return;
    setYtSearch(false);
    setSearching(true);
    setYtResults(null);
    try {
      const res = await fetch(`/api/yt-search?q=${encodeURIComponent(query)}`, { cache: 'no-store' });
      const j = await res.json();
      setYtResults(j.videos || []);
      if (!j.videos?.length) setMsg('Không tìm thấy video nào — con thử từ khác nhé!');
    } catch { setMsg('Tìm không được — thử lại nhé!'); }
    setSearching(false);
    setTimeout(() => setMsg(''), 3500);
  }

  // batch6: con bắt đầu xem trong app → neo first_play_at (idle-expire không tắt phiên đang xem)
  const playLogged = useRef(false);
  useEffect(() => {
    if (playingId && ticket && !playLogged.current) {
      playLogged.current = true;
      fetch('/api/pomodoro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'play' }) }).catch(() => {});
    }
  }, [playingId, ticket]);
  useEffect(() => { if (!ticket) playLogged.current = false; }, [ticket]);

  async function castTV() {
    const res = await fetch('/api/pomodoro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cast-reward' }) });
    const j = await res.json();
    setMsg(j.ok ? '📺 Đã mở trên TV to!' : (j.error || 'Không mở được TV'));
    setTimeout(() => setMsg(''), 4000);
    load();
  }
  async function endNow() {
    await fetch('/api/pomodoro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'complete' }) });
    setPlayingId(null); setEnded(false); lastState.current = ''; load();
  }

  async function buy(item: any) {
    const res = await fetch('/api/shop', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: item.id }),
    });
    const j = await res.json();
    if (j.ok) { setMsg(''); setEnded(false); load(); }
    else { setMsg(j.error); setTimeout(() => setMsg(''), 4000); }
  }

  const remain = ticket ? new Date(ticket.reward_ends_at).getTime() - now : 0;
  const [packList, setPackList] = useState<any[] | null>(null);
  useEffect(() => {
    fetch('/api/pets', { cache: 'no-store' }).then((r) => r.json())
      .then((j) => setPackList((j.shop || []).filter((s: any) => s.kind === 'ytticket'))).catch(() => {});
  }, [balance]);

  return (
    <Shell>
      <div className="p-4 pt-6 lg:px-6 lg:pt-8">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-2xl lg:text-4xl font-extrabold text-star-deep">🎬 Giải trí</h1>
          {balance !== null && <span className="bg-white rounded-2xl px-4 py-2 shadow-sm font-extrabold text-star-deep text-lg lg:text-2xl">⭐ {balance}</span>}
        </div>
        {msg && <p className="bg-amber-50 text-star-deep rounded-2xl p-3 font-bold text-sm mt-3">{msg}</p>}

        {/* ĐANG CÓ VÉ — trình xem iframe, hết giờ TỰ TẮT */}
        {running && ticket && (
          <>
            <div className="flex items-center justify-center gap-3 mt-4">
              <span className="text-2xl lg:text-3xl font-extrabold tabular-nums text-blue-700 bg-blue-50 rounded-2xl px-4 py-2">⏱ {fmtCountdown(remain)}</span>
              <span className="text-xs lg:text-sm text-gray-400 font-bold">hết giờ video tự tắt</span>
            </div>
            {/* batch6: 2 cửa ra mới — xem trên TV (chủ động, không auto) + kết thúc sớm bất kỳ lúc nào */}
            <div className="grid grid-cols-2 gap-2 mt-3">
              {!ticket.cast_atv_at && (
                <button className="btn-secondary !py-3 !text-sm lg:!text-base" onClick={castTV}>📺 Xem trên TV to</button>
              )}
              <button className={`${ticket.cast_atv_at ? 'col-span-2' : ''} btn-secondary !py-3 !text-sm lg:!text-base`} onClick={endNow}>✅ Con xem xong rồi</button>
            </div>
            {ticket.cast_atv_at && <p className="text-xs text-gray-400 font-bold text-center mt-1">📺 Đang xem trên TV — hết giờ / bấm Kết thúc là TV tự tắt</p>}
            {playingId ? (
              <div className="mt-4 aspect-video w-full rounded-[2rem] overflow-hidden shadow-lg bg-black">
                <iframe key={playingId}
                  src={`https://www.youtube-nocookie.com/embed/${playingId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
                  title="Video giải trí" className="w-full h-full"
                  allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
              </div>
            ) : ytResults !== null ? (
              /* KẾT QUẢ TÌM KIẾM — grid chọn video, embed theo ID (chắc chắn chạy) */
              <div className="mt-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="font-extrabold text-sm lg:text-base text-blue-800">🔍 Con tìm được {ytResults.length} video</p>
                  <button className="btn-secondary !py-1.5 !px-3 !text-xs shrink-0" onClick={() => { setYtResults(null); startYtSearch(); }}>🔍 tìm khác</button>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                  {ytResults.map((v: any) => (
                    <button key={v.id} onClick={() => setPlayingId(v.id)}
                      className="bg-white rounded-2xl overflow-hidden shadow-sm active:scale-95 transition">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`} alt={v.title} className="w-full aspect-video object-cover" />
                      <p className="p-2 text-xs lg:text-sm font-bold leading-tight line-clamp-2">{v.title}</p>
                      <p className="px-2 pb-2 text-[10px] text-gray-400 font-bold">{v.length}</p>
                    </button>
                  ))}
                </div>
                {ytResults.length === 0 && (
                  <p className="bg-white rounded-2xl p-4 text-sm text-gray-400">Không thấy video nào — thử từ khác nhé con!</p>
                )}
              </div>
            ) : searching ? (
              <div className="mt-4 bg-white rounded-[2rem] p-8 text-center shadow-sm">
                <div className="text-5xl mb-2 animate-bounce">🔍</div>
                <p className="font-bold text-gray-400">Đang tìm…</p>
              </div>
            ) : (
              <div className="mt-4">
                <p className="font-extrabold text-lg lg:text-2xl text-blue-800 mb-2">Xem gì hôm nay? 🎬</p>
                {videos.length > 0 && (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
                    {videos.slice(0, 12).map((v: any) => (
                      <button key={v.id} onClick={() => setPlayingId(v.youtube_id)}
                        className="bg-white rounded-2xl overflow-hidden shadow-sm active:scale-95 transition">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`https://i.ytimg.com/vi/${v.youtube_id}/mqdefault.jpg`} alt={v.title} className="w-full aspect-video object-cover" />
                        <p className="p-2 text-xs lg:text-sm font-bold leading-tight">{v.title}</p>
                      </button>
                    ))}
                  </div>
                )}
                <button className="btn-primary w-full block text-center !text-lg" onClick={startYtSearch}>🔍 Tìm trên YouTube (nói được luôn)</button>
                {videos.length === 0 && (
                  <p className="bg-white rounded-2xl p-4 text-sm text-gray-400 mt-3">Hoặc chờ bố mẹ thêm video vào Kho gợi ý (Admin → Kho Video)</p>
                )}
              </div>
            )}
            <p className="text-sm lg:text-base font-bold text-gray-500 mt-4">Hết vé video tự TẮT — con không cần tự tắt! ⭐</p>
          </>
        )}

        {/* HẾT GIỜ */}
        {ended && !running && (
          <div className="mt-6 bg-white rounded-[2rem] p-8 text-center shadow-md">
            <div className="text-7xl mb-3">🔔⭐</div>
            <p className="text-xl lg:text-2xl font-extrabold text-star-deep">Hết giờ giải trí rồi! Con giữ lời hứa giỏi lắm!</p>
            <button className="btn-primary w-full mt-5" onClick={async () => {
              await fetch('/api/pomodoro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'complete' }) });
              setEnded(false); lastState.current = ''; load();
            }}>✅ Con đã tắt — kết thúc</button>
          </div>
        )}

        {/* MUA GÓI */}
        {!running && !ended && (
          <div className="mt-4">
            <p className="font-extrabold text-lg lg:text-2xl text-gray-500 mb-1">Mua gói xem bằng sao ⭐</p>
            <p className="text-xs lg:text-sm text-gray-400 mb-3">Mua vé bằng sao — hết giờ tự tắt. Chọn video từ Kho hoặc mở YouTube tự do (tùy cài đặt).</p>
            {packList === null ? <p className="text-gray-400">Đang tải…</p> : packList.length === 0 ? (
              <p className="bg-white rounded-2xl p-4 text-sm text-gray-400">Chưa có gói nào — bố mẹ thêm trong Admin → Cửa hàng.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 lg:gap-3">
                {packList.map((t: any) => {
                  const mins = JSON.parse(t.payload || '{}').minutes || 15;
                  const can = (balance ?? 0) >= t.price;
                  return (
                    <button key={t.id} disabled={!can} onClick={() => { if (confirm(`Đổi ${t.price} sao lấy ${mins} phút xem video?`)) buy(t); }}
                      className={`rounded-3xl p-4 lg:p-6 shadow-sm text-center transition ${can ? 'bg-white active:scale-95' : 'bg-gray-50 opacity-50'}`}>
                      <span className="text-4xl lg:text-5xl">{t.emoji}</span>
                      <p className="font-extrabold text-lg lg:text-2xl mt-2">{mins} phút</p>
                      <p className={`font-extrabold text-sm lg:text-base mt-1 ${can ? 'text-star-deep' : 'text-gray-400'}`}>
                        {can ? `${t.price} ⭐` : `cần ${t.price - (balance ?? 0)} ⭐ nữa`}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
            {data?.active && data.active.kind !== 'ticket' && (
              <p className="text-xs text-gray-400 mt-3">⚠️ Đang có vòng Chăm Chỉ chạy — xong vòng đó đã rồi mua vé nhé!</p>
            )}
          </div>
        )}
      </div>

      {/* SHEET tìm kiếm YouTube — voice input (con chưa gõ tốt) + gợi ý nhanh */}
      {ytSearch && (
        <div className="fixed inset-0 bg-black/40 flex items-end lg:items-center justify-center z-50" onClick={() => setYtSearch(false)}>
          <div className="bg-white w-full lg:max-w-lg rounded-t-3xl lg:rounded-[2rem] p-5" onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-extrabold mb-1">🔍 Con muốn xem gì?</p>
            <p className="text-xs text-gray-400 mb-3">Gõ hoặc bấm 🎤 để nói — video chạy ngay trong app, hết giờ tự tắt.</p>
            <VoiceInput value={searchText} onChange={setSearchText} placeholder="VD: Numberblocks, Peppa Pig…" autoFocus />
            <div className="flex gap-2 flex-wrap mt-3">
              {YT_SUGGEST.map((s) => (
                <button key={s} onClick={() => playSearch(s)}
                  className="bg-amber-50 rounded-full px-3 py-1.5 text-xs font-bold text-star-deep active:scale-95 transition">{s}</button>
              ))}
            </div>
            <button className="btn-primary w-full mt-4 !text-base" disabled={!searchText.trim()} onClick={() => playSearch(searchText)}>
              ▶️ Xem ngay
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
}
