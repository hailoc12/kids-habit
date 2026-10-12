'use client';
// Pomodoro Bé: làm việc có ý nghĩa (20/30/40') → quà YouTube (5/10') — có ĐIỂM KẾT THÚC
// Rùa 🐢 chạy trong lúc làm; hết quà không được xem lậu (phải làm vòng mới)
import { useCallback, useEffect, useRef, useState } from 'react';
import Shell from '@/components/Shell';
import VoiceInput from '@/components/VoiceInput';
import { phaseOf, fmtCountdown } from '@/lib/pomodoro';

const WORK_PRESETS = [20, 30, 40];
const REWARD_PRESETS = [5, 10];
const LABEL_SUGGESTIONS = ['📖 Làm bài tập', '✏️ Tập viết', '🎨 Vẽ', '🧩 Xếp hình', '📚 Đọc sách', '🧹 Dọn đồ'];
const YT_SUGGEST = ['Numberblocks', 'Alphablocks', 'peppa pig tiếng việt', 'thơ trẻ em', 'học tiếng anh cho bé'];

function beep(times = 3) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    for (let i = 0; i < times; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880; o.type = 'sine';
      const t0 = ctx.currentTime + i * 0.35;
      g.gain.setValueAtTime(0.001, t0);
      g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3);
      o.start(t0); o.stop(t0 + 0.32);
    }
  } catch { /* im lặng */ }
}

export default function PomodoroPage() {
  const [data, setData] = useState<any>(null);
  const [now, setNow] = useState(Date.now());
  const [workMin, setWorkMin] = useState(30);
  const [rewardMin, setRewardMin] = useState(10);
  const [customWork, setCustomWork] = useState('');
  const [customReward, setCustomReward] = useState('');
  const [label, setLabel] = useState(LABEL_SUGGESTIONS[0]);
  const [err, setErr] = useState('');
  const [videos, setVideos] = useState<any[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [ytResults, setYtResults] = useState<any[] | null>(null); // kết quả /api/yt-search
  const [searching, setSearching] = useState(false);
  const [ytSearch, setYtSearch] = useState(false);
  const [searchText, setSearchText] = useState('');
  const lastPhase = useRef<string>('');

  async function playSearch(q: string) {
    const query = q.trim();
    if (!query) return;
    setYtSearch(false);
    setPlayingId(null);
    setSearching(true);
    setYtResults(null);
    try {
      const res = await fetch(`/api/yt-search?q=${encodeURIComponent(query)}`, { cache: 'no-store' });
      const j = await res.json();
      setYtResults(j.videos || []);
    } catch { setYtResults([]); }
    setSearching(false);
  }

  const load = useCallback(() => {
    fetch('/api/pomodoro').then((r) => r.json()).then(setData);
  }, []);
  useEffect(() => {
    fetch('/api/videos').then((r) => r.json()).then((j) => setVideos(j.videos || [])).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  // batch6: re-poll định kỳ + tab hiện lại — server sweep (idle-expire/TV) có cơ hội chạy
  useEffect(() => {
    const t = setInterval(load, 30_000);
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [load]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const active = data?.active;
  const phase = active ? phaseOf(active, new Date(now)) : 'none';
  // beep khi chuyển pha + dừng video khi hết giờ
  useEffect(() => {
    if (phase !== lastPhase.current) {
      if (['work-done', 'reward-done'].includes(phase)) beep(phase === 'work-done' ? 3 : 5);
      if (phase === 'reward-done') { setPlayingId(null); setYtResults(null); setYtSearch(false); } // gỡ iframe → video dừng ngay
      lastPhase.current = phase;
    }
  }, [phase]);

  async function act(body: any) {
    const res = await fetch('/api/pomodoro', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const j = await res.json();
    if (!j.ok) setErr(j.error || 'Lỗi'); else setErr('');
    load();
    return j;
  }

  async function start() {
    const w = customWork ? Number(customWork) : workMin;
    const r = customReward ? Number(customReward) : rewardMin;
    await act({ action: 'start', label, workMin: w, rewardMin: r });
  }

  // batch6: con bắt đầu xem trong app → neo first_play_at (idle-expire không tắt phiên đang xem)
  const playLogged = useRef(false);
  useEffect(() => {
    if (playingId && active?.reward_started_at && !playLogged.current) {
      playLogged.current = true;
      fetch('/api/pomodoro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'play' }) }).catch(() => {});
    }
  }, [playingId, active]);
  useEffect(() => { if (!active) playLogged.current = false; }, [active]);

  // ---- màn RUNNING ----
  if (active && phase !== 'none') {
    const isWork = phase === 'work';
    const endsAt = new Date(isWork ? active.work_ends_at : active.reward_ends_at || active.work_ends_at).getTime();
    const remain = endsAt - now;
    const totalMs = (isWork ? active.work_min : active.reward_min) * 60000;
    const pct = Math.min(1, Math.max(0, 1 - remain / totalMs));
    const R = 45, C = 2 * Math.PI * R;

    return (
      <Shell>
        <div className="p-4 pt-6 lg:px-6 lg:pt-8 max-w-xl mx-auto text-center">
          <h1 className="text-xl lg:text-3xl font-extrabold text-star-deep">
            {phase === 'reward' || phase === 'reward-done' ? '📺 Quà YouTube' : `🐢 ${active.label}`}
          </h1>

          {phase === 'work' && (
            <>
              <div className="relative w-64 h-64 lg:w-80 lg:h-80 mx-auto mt-6">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r={R} fill="none" stroke="#FEF3C7" strokeWidth="8" />
                  <circle cx="50" cy="50" r={R} fill="none" stroke="#F59E0B" strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={C} strokeDashoffset={C * (1 - pct)} style={{ transition: 'stroke-dashoffset 0.5s linear' }} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-5xl lg:text-6xl">{['🐢', '🐢', '🐌', '🐢', '🐣', '🐢'][Math.floor(now / 1500) % 6]}</span>
                  <span className="text-4xl lg:text-5xl font-extrabold tabular-nums text-ink mt-1">{fmtCountdown(remain)}</span>
                </div>
              </div>
              <p className="text-lg lg:text-xl font-bold text-gray-500 mt-4">Con đang làm {active.work_min} phút — rùa đang chạy về đích!</p>
              <button className="mt-4 text-sm text-gray-300 font-bold underline" onClick={() => act({ action: 'cancel' })}>dừng lại (không bắt buộc)</button>
            </>
          )}

          {phase === 'work-done' && (
            <div className="mt-8">
              <div className="text-8xl mb-4 animate-[wiggle_1s_ease-in-out_infinite]">🐢🏁</div>
              <p className="text-2xl lg:text-3xl font-extrabold text-star-deep">Con làm xong {active.work_min} phút rồi! 🎉🎉🎉</p>
              <p className="text-lg text-gray-500 mt-2">Con xứng đáng nhận quà: <b>{active.reward_min} phút YouTube</b></p>
              <button className="btn-primary w-full mt-6 !text-xl" onClick={() => act({ action: 'claim-reward' })}>
                📺 Nhận quà — bắt đầu {active.reward_min} phút
              </button>
              <p className="text-xs text-gray-400 mt-3">Bấm nút này khi con thật sự mở YouTube nhé — đồng hồ quà chạy từ lúc này.</p>
            </div>
          )}

          {phase === 'reward' && (
            <>
              {/* thanh đếm ngược trên cùng — luôn thấy được cả khi đang xem video */}
              <div className="flex items-center justify-center gap-3 mt-2">
                <span className="text-2xl lg:text-3xl font-extrabold tabular-nums text-blue-700 bg-blue-50 rounded-2xl px-4 py-2">⏱ {fmtCountdown(remain)}</span>
                <span className="text-xs lg:text-sm text-gray-400 font-bold">hết giờ video tự tắt</span>
              </div>

              {/* batch6: TV chủ động (không auto) + kết thúc sớm bất kỳ lúc nào */}
              <div className="grid grid-cols-2 gap-2 mt-3">
                {!active.cast_atv_at && (
                  <button className="btn-secondary !py-3 !text-sm lg:!text-base" onClick={() => act({ action: 'cast-reward' })}>📺 Xem trên TV to</button>
                )}
                <button className={`${active.cast_atv_at ? 'col-span-2' : ''} btn-secondary !py-3 !text-sm lg:!text-base`} onClick={() => act({ action: 'complete' })}>✅ Con xem xong rồi</button>
              </div>

              {playingId ? (
                /* MÀN XEM IN-APP — hết giờ component unmount → iframe gỡ → video DỪNG NGAY */
                <div className="mt-4">
                  <div className="aspect-video w-full rounded-[2rem] overflow-hidden shadow-lg bg-black">
                    <iframe
                      key={playingId}
                      src={`https://www.youtube-nocookie.com/embed/${playingId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
                      title="Video quà của con"
                      className="w-full h-full"
                      allow="autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Video chạy ngay trong app — hết giờ tự TẮT chắc chắn!</p>
                </div>
              ) : ytResults !== null ? (
                /* KẾT QUẢ TÌM KIẾM — grid chọn video */
                <div className="mt-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="font-extrabold text-sm lg:text-base text-blue-800">🔍 Con tìm được {ytResults.length} video</p>
                    <button className="btn-secondary !py-1.5 !px-3 !text-xs shrink-0" onClick={() => { setYtResults(null); setSearchText(''); setYtSearch(true); }}>🔍 tìm khác</button>
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
                  <p className="font-extrabold text-lg lg:text-2xl text-blue-800 mb-2">Chọn video quà của con 🎬</p>
                  {videos.length > 0 && (
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 mb-3">
                      {videos.slice(0, 9).map((v: any) => (
                        <button key={v.id} onClick={() => setPlayingId(v.youtube_id)}
                          className="bg-white rounded-2xl overflow-hidden shadow-sm active:scale-95 transition">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`https://i.ytimg.com/vi/${v.youtube_id}/mqdefault.jpg`} alt={v.title} className="w-full aspect-video object-cover" />
                          <p className="p-2 text-xs lg:text-sm font-bold leading-tight">{v.title}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  <button className="btn-primary w-full block text-center !text-lg" onClick={() => { setSearchText(''); setYtSearch(true); }}>🔍 Tìm trên YouTube (nói được luôn)</button>
                  {videos.length === 0 && (
                    <p className="text-xs text-gray-400 mt-3 text-center">Bố mẹ thêm video vào Kho (Admin → Kho Video) để có gợi ý sẵn.</p>
                  )}
                </div>
              )}
              <p className="text-sm lg:text-base font-bold text-gray-500 mt-4">Hết {active.reward_min} phút video tự TẮT — con không cần tự tắt, hứa với Sao Nhí nhé! ⭐</p>
            </>
          )}

          {phase === 'reward-done' && (
            <div className="mt-8">
              <div className="text-8xl mb-4">🔔⭐</div>
              <p className="text-2xl lg:text-3xl font-extrabold text-star-deep">Hết giờ vui rồi! Con giữ lời hứa giỏi lắm!</p>
              <p className="text-lg text-gray-500 mt-2">Muốn xem tiếp? Làm thêm một vòng nữa nhé — rùa đang chờ con.</p>
              <button className="btn-primary w-full mt-6 !text-lg" onClick={() => act({ action: 'complete' })}>✅ Con đã tắt — kết thúc vòng này</button>
            </div>
          )}
          {err && <p className="text-red-400 mt-3 text-sm font-bold">{err}</p>}
        </div>
      </Shell>
    );
  }

  // ---- màn SETUP ----
  return (
    <Shell>
      <div className="p-4 pt-6 lg:px-6 lg:pt-8 max-w-xl mx-auto">
        <h1 className="text-2xl lg:text-4xl font-extrabold text-star-deep">🐢 Vòng quay chăm chỉ</h1>
        <p className="text-sm lg:text-lg text-gray-500 mt-1 mb-4">Làm một việc có ý nghĩa → nhận quà YouTube. Công bằng chứ!</p>

        <p className="font-bold text-base lg:text-xl mb-2">Con định làm gì?</p>
        <div className="flex gap-2 flex-wrap mb-3">
          {LABEL_SUGGESTIONS.map((l) => (
            <button key={l} onClick={() => setLabel(l)}
              className={`rounded-2xl px-4 py-3 text-sm lg:text-base font-bold ${label === l ? 'bg-star text-white' : 'bg-white text-gray-500'}`}>{l}</button>
          ))}
        </div>

        <p className="font-bold text-base lg:text-xl mb-2 mt-4">Làm bao lâu?</p>
        <div className="flex gap-2 flex-wrap items-center">
          {WORK_PRESETS.map((w) => (
            <button key={w} onClick={() => { setWorkMin(w); setCustomWork(''); }}
              className={`rounded-2xl px-5 py-3 text-lg font-extrabold ${!customWork && workMin === w ? 'bg-star text-white' : 'bg-white text-gray-500'}`}>{w}′</button>
          ))}
          <input type="number" min={5} max={120} placeholder="khác…" value={customWork}
            onChange={(e) => setCustomWork(e.target.value)} className="input !p-2.5 !text-base w-24" />
        </div>

        <p className="font-bold text-base lg:text-xl mb-2 mt-4">Quà YouTube bao lâu?</p>
        <div className="flex gap-2 flex-wrap items-center">
          {REWARD_PRESETS.map((r) => (
            <button key={r} onClick={() => { setRewardMin(r); setCustomReward(''); }}
              className={`rounded-2xl px-5 py-3 text-lg font-extrabold ${!customReward && rewardMin === r ? 'bg-blue-500 text-white' : 'bg-white text-gray-500'}`}>{r}′</button>
          ))}
          <input type="number" min={1} max={data?.maxReward || 10} placeholder="khác…" value={customReward}
            onChange={(e) => setCustomReward(e.target.value)} className="input !p-2.5 !text-base w-24" />
        </div>
        <p className="text-xs text-gray-400 mt-1">Tối đa {data?.maxReward || 10} phút — bố mẹ chỉnh được trong Admin. Quà ngắn hơn nửa thời gian làm.</p>

        <button className="btn-primary w-full mt-6 !text-xl lg:!text-2xl" onClick={start}>🐢 Bắt đầu làm!</button>
        {err && <p className="text-red-400 mt-3 text-sm font-bold">{err}</p>}

        {(data?.history || []).filter((h: any) => h.status === 'completed').length > 0 && (
          <p className="text-center text-star-deep font-bold mt-6">
            🏆 Hôm nay con hoàn thành {data.history.filter((h: any) => h.status === 'completed').length} vòng chăm chỉ!
          </p>
        )}
      </div>

      {/* SHEET tìm kiếm YouTube — voice input + gợi ý nhanh (giống trang Giải trí) */}
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
