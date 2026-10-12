'use client';
// Đàn piano kiểu Synthesia — nốt rơi xuống, con bấm phím đúng lúc (T4 · tính năng FREE, không tốn sao)
// Nguyên tắc cho bé 6 tuổi: bấm SAI không bị phạt — chỉ nghe tiếng nhỏ, nốt vẫn rơi tới khi bấm trúng
import { useCallback, useEffect, useRef, useState } from 'react';
import Shell from '@/components/Shell';
import { SONGS, midiToFreq, type Song } from './songs';

// 1 quãng 8 C4..C5: 8 phím trắng + 5 phím đen
const WHITE_MIDIS = [60, 62, 64, 65, 67, 69, 71, 72];
const BLACK_MIDIS: { midi: number; after: number }[] = [
  { midi: 61, after: 0 }, { midi: 63, after: 1 }, { midi: 66, after: 3 }, { midi: 68, after: 4 }, { midi: 70, after: 5 },
];
const SOLFEGE = ['Đô', 'Rê', 'Mi', 'Fa', 'Sol', 'La', 'Si', 'Đô'];
// mỗi nốt một màu — bé nhìn màu là biết phím nào
const KEY_COLORS: Record<number, string> = {
  60: '#EF4444', 61: '#B91C1C', 62: '#F97316', 63: '#C2410C', 64: '#FACC15',
  65: '#22C55E', 66: '#15803D', 67: '#3B82F6', 68: '#1D4ED8', 69: '#8B5CF6',
  70: '#6D28D9', 71: '#EC4899', 72: '#F87171',
};
// bàn phím máy tính: A S D F G H J K = phím trắng · W E T Y U = phím đen
const KEYBOARD_MAP: Record<string, number> = {
  a: 60, s: 62, d: 64, f: 65, g: 67, h: 69, j: 71, k: 72,
  w: 61, e: 63, t: 66, y: 68, u: 70,
};

// chế độ chơi tự do — không có nốt rơi, chỉ đàn
const FREE_PLAY: Song = { id: 'free', title: 'Chơi tự do', emoji: '🎹', bpm: 60, notes: [] };

type FallingNote = { midi: number; hitTime: number; durSec: number; hit: boolean };

/** vị trí làn của phím theo tỉ lệ ngang (0..1) — nốt rơi trên canvas trùng đúng phím bên dưới */
function keyLane(midi: number): { left: number; width: number } {
  const w = WHITE_MIDIS.indexOf(midi);
  if (w >= 0) return { left: w / 8, width: 1 / 8 };
  const b = BLACK_MIDIS.find((k) => k.midi === midi)!;
  return { left: (b.after + 1) / 8 - 0.36 / 8, width: 0.72 / 8 };
}

/** hình chữ nhật bo góc (tự viết cho chắc — không phụ thuộc ctx.roundRect trên iPad cũ) */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

type Screen = 'select' | 'play' | 'done';

export default function PianoPage() {
  const [screen, setScreen] = useState<Screen>('select');
  const [song, setSong] = useState<Song | null>(null);
  const [runId, setRunId] = useState(0);
  const [pressed, setPressed] = useState<Set<number>>(new Set());
  const [glowKeys, setGlowKeys] = useState<Set<number>>(new Set());
  const [hits, setHits] = useState(0);
  const [autoplay, setAutoplay] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const notesRef = useRef<FallingNote[]>([]);
  const startRef = useRef(0);
  const finishRef = useRef(false);
  const rafRef = useRef(0);
  const lastGlowRef = useRef('');
  const autoplayRef = useRef(false);
  const songRef = useRef<Song | null>(null);
  const screenRef = useRef<Screen>('select');
  useEffect(() => { screenRef.current = screen; }, [screen]);
  useEffect(() => { autoplayRef.current = autoplay; }, [autoplay]);

  /** tiếng đàn piano-ish: fundamental + 2 hài âm octave, bao âm exponential (attack 10ms, decay ~0.9s) — không cần file audio */
  const playNote = useCallback((midi: number, soft: boolean) => {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    if (!ctxRef.current) ctxRef.current = new AC();
    const ac = ctxRef.current;
    if (ac.state === 'suspended') void ac.resume();
    const t = ac.currentTime;
    const peak = soft ? 0.09 : 0.24;
    const master = ac.createGain();
    master.gain.setValueAtTime(0.0001, t);
    master.gain.exponentialRampToValueAtTime(peak, t + 0.01);
    master.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    master.connect(ac.destination);
    const voices: [number, OscillatorType, number, number][] = [
      [1, 'triangle', 1, 0], [2, 'sine', 0.35, 4], [3, 'sine', 0.12, -4],
    ];
    for (const [ratio, type, vol, detune] of voices) {
      const osc = ac.createOscillator();
      osc.type = type;
      osc.frequency.value = midiToFreq(midi) * ratio;
      osc.detune.value = detune;
      const g = ac.createGain();
      g.gain.value = vol;
      osc.connect(g);
      g.connect(master);
      osc.start(t);
      osc.stop(t + 0.95);
    }
  }, []);

  // đóng âm thanh khi rời trang
  useEffect(() => () => { void ctxRef.current?.close().catch(() => {}); }, []);

  /** bấm 1 phím: đúng giờ → nốt nổ + tiếng thường · sai/lạc → tiếng nhỏ, không phạt */
  const pressMidi = useCallback((midi: number) => {
    setPressed((prev) => { const s = new Set(prev); s.add(midi); return s; });
    const inSong = screenRef.current === 'play' && (songRef.current?.notes.length ?? 0) > 0;
    let matched = false;
    if (inSong) {
      const now = performance.now() / 1000 - startRef.current;
      let best: FallingNote | null = null;
      for (const nt of notesRef.current) {
        if (nt.hit || nt.midi !== midi) continue;
        if (Math.abs(nt.hitTime - now) <= 0.5 && (!best || nt.hitTime < best.hitTime)) best = nt;
      }
      if (best) { best.hit = true; matched = true; setHits((h) => h + 1); }
    }
    playNote(midi, inSong && !matched);
  }, [playNote]);

  const releaseMidi = useCallback((midi: number) => {
    setPressed((prev) => {
      if (!prev.has(midi)) return prev;
      const s = new Set(prev); s.delete(midi); return s;
    });
  }, []);

  // bàn phím máy tính (cho bố mẹ / laptop)
  useEffect(() => {
    if (screen !== 'play') return;
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const midi = KEYBOARD_MAP[e.key.toLowerCase()];
      if (midi !== undefined) pressMidi(midi);
    };
    const up = (e: KeyboardEvent) => {
      const midi = KEYBOARD_MAP[e.key.toLowerCase()];
      if (midi !== undefined) releaseMidi(midi);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [screen, pressMidi, releaseMidi]);

  function startSong(s: Song) {
    songRef.current = s;
    setSong(s);
    setRunId((r) => r + 1);
    setScreen('play');
  }
  function backToSelect() {
    songRef.current = null;
    setScreen('select');
  }

  // vòng chơi: dựng lại nốt rơi + vòng lặp vẽ canvas (dpr-aware)
  useEffect(() => {
    if (screen !== 'play') return;
    const s = songRef.current;
    if (!s) return;

    const beat = 60 / s.bpm;
    let t0 = 2.8; // giây chờ trước nốt đầu — nốt hiện ra từ từ trên đầu canvas
    notesRef.current = s.notes.map((nt) => {
      const fn: FallingNote = { midi: nt.midi, hitTime: t0, durSec: nt.beats * beat, hit: false };
      t0 += nt.beats * beat;
      return fn;
    });
    startRef.current = performance.now() / 1000;
    finishRef.current = false;
    lastGlowRef.current = '__reset__';
    setHits(0);
    setGlowKeys(new Set());
    setPressed(new Set());

    const draw = () => {
      const c = canvasRef.current;
      if (!c) return;
      const rect = c.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const px = Math.round(rect.width * dpr);
      const py = Math.round(rect.height * dpr);
      if (c.width !== px || c.height !== py) { c.width = px; c.height = py; }
      const ctx = c.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const W = rect.width;
      const H = rect.height;
      const t = performance.now() / 1000 - startRef.current;
      const lineY = H - 12;
      const speed = H / 2.6; // nốt đi hết canvas trong ~2.6 giây

      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, W, H);
      // vạch làn mờ giữa các phím
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 8; i++) {
        ctx.beginPath();
        ctx.moveTo((i * W) / 8, 0);
        ctx.lineTo((i * W) / 8, H);
        ctx.stroke();
      }
      // vạch đích vàng — nốt chạm vạch là giờ bấm
      ctx.strokeStyle = 'rgba(251,191,36,0.85)';
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 7]);
      ctx.beginPath();
      ctx.moveTo(0, lineY);
      ctx.lineTo(W, lineY);
      ctx.stroke();
      ctx.setLineDash([]);

      const notes = notesRef.current;
      const glow = new Set<number>();
      for (const nt of notes) {
        // chế độ đàn tự chơi: tới vạch là nốt tự kêu
        if (autoplayRef.current && !nt.hit && t >= nt.hitTime) {
          nt.hit = true;
          setHits((h) => h + 1);
          playNote(nt.midi, false);
        }
        if (!nt.hit && Math.abs(nt.hitTime - t) < 0.15) glow.add(nt.midi);

        const lane = keyLane(nt.midi);
        const nh = Math.max(16, nt.durSec * speed - 4);
        const bottom = lineY - (nt.hitTime - t) * speed;
        if (bottom - nh > H + 10 || bottom < -30) continue;
        const near = !nt.hit && nt.hitTime - t < 0.35 && nt.hitTime - t > -0.25;
        if (near) glow.add(nt.midi);
        ctx.globalAlpha = nt.hit ? 0.22 : 1;
        ctx.fillStyle = KEY_COLORS[nt.midi] ?? '#F87171';
        roundRect(ctx, lane.left * W + 3, bottom - nh + 3, lane.width * W - 6, nh - 6, 8);
        ctx.fill();
        if (near) {
          ctx.strokeStyle = 'rgba(255,255,255,0.95)';
          ctx.lineWidth = 3;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      // phím sắp tới giờ thì sáng lên (DOM bên dưới)
      const glowKey = [...glow].sort((a, b) => a - b).join(',');
      if (glowKey !== lastGlowRef.current) {
        lastGlowRef.current = glowKey;
        setGlowKeys(glow);
      }
      // hết bài → chúc mừng
      if (!finishRef.current && notes.length > 0) {
        const last = notes[notes.length - 1];
        if (t > last.hitTime + 1.4) {
          finishRef.current = true;
          setScreen('done');
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [screen, runId, playNote]);

  const keyActive = (midi: number) => pressed.has(midi) || glowKeys.has(midi);

  return (
    <Shell>
      <div className="p-4 pt-6 lg:px-6 lg:pt-8">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-2xl lg:text-4xl font-extrabold text-star-deep">🎹 Đàn Piano</h1>
          {screen === 'play' && (
            <button onClick={backToSelect} className="btn-secondary !py-3 !text-sm">🎵 Bài khác</button>
          )}
        </div>
        <p className="text-sm lg:text-lg text-gray-500 mt-1">Chơi đàn thoải mái nhé con — bài nào cũng miễn phí! 🎶</p>

        {screen === 'select' && (
          <>
            <p className="text-lg font-bold text-star-deep mt-4">Con muốn đàn bài nào?</p>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
              {SONGS.map((s, i) => (
                <button key={s.id} onClick={() => startSong(s)}
                  className="bg-white rounded-3xl border-2 border-star/30 shadow-sm p-4 min-h-[112px] flex flex-col items-center justify-center gap-2 active:scale-95 transition">
                  {i === 0 && <span className="text-xs font-extrabold text-white bg-star rounded-full px-3 py-1">🏁 Dễ nhất</span>}
                  <span className="text-5xl">{s.emoji}</span>
                  <span className="font-extrabold text-star-deep text-center leading-tight">{s.title}</span>
                </button>
              ))}
              <button onClick={() => startSong(FREE_PLAY)}
                className="bg-white rounded-3xl border-2 border-star/30 shadow-sm p-4 min-h-[112px] flex flex-col items-center justify-center gap-2 active:scale-95 transition">
                <span className="text-5xl">🎹</span>
                <span className="font-extrabold text-star-deep text-center leading-tight">Chơi tự do</span>
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-4 text-center">Bố mẹ ơi: gõ bàn phím máy tính (A S D F G H J K) cũng đàn được ạ</p>
          </>
        )}

        {screen === 'play' && song && (
          <>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="font-extrabold text-lg text-star-deep">{song.emoji} {song.title}</span>
              {song.notes.length > 0 && (
                <span className="ml-auto bg-white border-2 border-star/40 rounded-full px-3 py-2 font-bold text-star-deep">
                  🎈 {hits}/{song.notes.length}
                </span>
              )}
              <button
                onClick={() => setAutoplay((v) => !v)}
                aria-pressed={autoplay}
                className={`min-h-11 rounded-2xl px-4 font-bold text-sm border-2 transition active:scale-95 ${autoplay ? 'bg-star text-white border-star' : 'bg-white text-gray-500 border-star/40'}`}>
                {autoplay ? '🤖 Đàn tự chơi' : '😴 Để đàn tự chơi'}
              </button>
            </div>

            {/* canvas nốt rơi — trùng khớp làn phím bên dưới */}
            <div className="mt-3 relative">
              <canvas ref={canvasRef}
                className="w-full h-[36vh] min-h-48 bg-slate-900 rounded-[2rem] shadow-md border-4 border-star/40" />
              {song.notes.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <p className="text-white font-extrabold text-lg bg-black/30 rounded-full px-5 py-3">Bấm phím đàn để nghe nhạc nhé con! 🎵</p>
                </div>
              )}
            </div>

            {/* bàn phím — phím trắng to, phím đen hẹp; bấm nhiều ngón cùng lúc được */}
            <div className="relative mt-2 select-none" style={{ touchAction: 'none' }}>
              <div className="flex gap-[2px] h-40 lg:h-48">
                {WHITE_MIDIS.map((midi, i) => (
                  <button key={midi} aria-label={`phím ${SOLFEGE[i]}`}
                    onPointerDown={(e) => { e.preventDefault(); pressMidi(midi); }}
                    onPointerUp={() => releaseMidi(midi)}
                    onPointerLeave={() => releaseMidi(midi)}
                    onPointerCancel={() => releaseMidi(midi)}
                    className={`flex-1 h-full rounded-b-2xl border-2 border-b-4 border-slate-300 flex items-end justify-center pb-2 transition-colors duration-75 ${keyActive(midi) ? 'text-white border-transparent shadow-inner' : 'bg-white'}`}
                    style={keyActive(midi) ? { background: KEY_COLORS[midi] } : undefined}>
                    <span className={`text-xs font-bold ${keyActive(midi) ? 'text-white' : 'text-slate-400'}`}>{SOLFEGE[i]}</span>
                  </button>
                ))}
              </div>
              {BLACK_MIDIS.map(({ midi, after }) => (
                <button key={midi} aria-label="phím đen"
                  onPointerDown={(e) => { e.preventDefault(); pressMidi(midi); }}
                  onPointerUp={() => releaseMidi(midi)}
                  onPointerLeave={() => releaseMidi(midi)}
                  onPointerCancel={() => releaseMidi(midi)}
                  className={`absolute top-0 h-[60%] rounded-b-xl border-2 border-slate-900 z-10 transition-colors duration-75 ${keyActive(midi) ? 'border-transparent' : 'bg-slate-800'}`}
                  style={{
                    left: `calc(${(after + 1) * 12.5}% - 3.6%)`,
                    width: '7.2%',
                    ...(keyActive(midi) ? { background: KEY_COLORS[midi] } : {}),
                  }} />
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3 text-center">Nốt rơi tới vạch vàng là con bấm phím cùng màu nhé — bấm sai không sao cả! 💛</p>
          </>
        )}

        {screen === 'done' && song && (
          <div className="text-center py-10">
            <p className="text-7xl animate-bounce">🎉</p>
            <h2 className="text-2xl lg:text-3xl font-extrabold text-star-deep mt-4">Tuyệt vời! {song.emoji} {song.title}</h2>
            <p className="text-lg text-gray-500 mt-2">Con bấm đúng {hits}/{song.notes.length} nốt — giỏi lắm! 👏👏</p>
            <div className="flex gap-3 mt-6 justify-center flex-wrap">
              <button className="btn-primary" onClick={() => startSong(song)}>🔁 Chơi lại</button>
              <button className="btn-secondary !py-4" onClick={backToSelect}>🎵 Chọn bài khác</button>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
