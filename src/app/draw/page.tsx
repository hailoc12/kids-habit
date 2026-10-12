'use client';
// Xưởng vẽ của Bé — Premack: mỗi lần checkin, Sao Nhí tặng 1 tờ giấy vẽ mới
// xux/2026-10-02-draw-hook · batch6 T3: brush marker/sáp/nước + palette màu nước + template AI (bố duyệt)
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Shell from '@/components/Shell';
import VoiceInput from '@/components/VoiceInput';

const COLORS = ['#EF4444', '#F97316', '#FACC15', '#22C55E', '#3B82F6', '#8B5CF6',
  '#EC4899', '#A16207', '#000000', '#FFFFFF', '#94A3B8', '#06B6D4'];
// 🎨 palette màu nước (batch6) — sắc nhạt, pha lẫn nhau khi chồng nét
const WATERCOLORS = ['#FCA5A5', '#FDBA74', '#FDE68A', '#A7F3D0', '#A5D8FF', '#C4B5FD',
  '#F9A8D4', '#D6BC8F', '#7DD3FC', '#FBCFE8', '#BBF7D0', '#E9D5FF'];
const SIZES = [6, 14, 26];

type BrushKind = 'pencil' | 'marker' | 'crayon' | 'water';
const BRUSHES: { kind: BrushKind; emoji: string; label: string }[] = [
  { kind: 'pencil', emoji: '✏️', label: 'Bút chì' },
  { kind: 'marker', emoji: '🖊️', label: 'Marker' },
  { kind: 'crayon', emoji: '🖍️', label: 'Sáp màu' },
  { kind: 'water', emoji: '💧', label: 'Màu nước' },
];

type Stroke = { color: string; size: number; brush: BrushKind; points: [number, number][] };

/** 6 mẫu tô màu — nét đơn giản vẽ bằng path 2D */
function drawTemplate(ctx: CanvasRenderingContext2D, name: string, w: number, h: number) {
  ctx.save();
  ctx.strokeStyle = '#1F2937';
  ctx.lineWidth = Math.max(3, w / 160);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const cx = w / 2, cy = h / 2, s = Math.min(w, h) * 0.36;
  ctx.beginPath();
  if (name === 'star') {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? s : s * 0.42;
      const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
  } else if (name === 'turtle') {
    ctx.ellipse(cx, cy, s, s * 0.68, 0, 0, Math.PI * 2);
    ctx.moveTo(cx + s * 0.9, cy - s * 0.4);
    ctx.arc(cx + s * 0.95, cy - s * 0.5, s * 0.22, 0, Math.PI * 2);
    ctx.moveTo(cx - s * 0.8, cy + s * 0.55); ctx.lineTo(cx - s * 0.95, cy + s * 0.95);
    ctx.moveTo(cx + s * 0.8, cy + s * 0.55); ctx.lineTo(cx + s * 0.95, cy + s * 0.95);
    ctx.moveTo(cx - s * 0.5, cy + s * 0.6); ctx.lineTo(cx - s * 0.55, cy + s * 0.9);
    ctx.moveTo(cx + s * 0.5, cy + s * 0.6); ctx.lineTo(cx + s * 0.55, cy + s * 0.9);
  } else if (name === 'butterfly') {
    ctx.ellipse(cx - s * 0.45, cy - s * 0.25, s * 0.5, s * 0.65, -0.4, 0, Math.PI * 2);
    ctx.moveTo(cx + s * 0.55, cy - s * 0.35);
    ctx.ellipse(cx + s * 0.5, cy - s * 0.3, s * 0.42, s * 0.55, 0.4, 0, Math.PI * 2);
    ctx.moveTo(cx - s * 0.35, cy + s * 0.45);
    ctx.ellipse(cx - s * 0.4, cy + s * 0.5, s * 0.38, s * 0.48, 0.35, 0, Math.PI * 2);
    ctx.moveTo(cx + s * 0.4, cy + s * 0.45);
    ctx.ellipse(cx + s * 0.42, cy + s * 0.5, s * 0.35, s * 0.42, -0.35, 0, Math.PI * 2);
    ctx.moveTo(cx, cy - s * 0.5); ctx.ellipse(cx, cy, s * 0.12, s * 0.55, 0, 0, Math.PI * 2);
  } else if (name === 'fish') {
    ctx.ellipse(cx - s * 0.1, cy, s * 0.75, s * 0.5, 0, 0, Math.PI * 2);
    ctx.moveTo(cx + s * 0.6, cy);
    ctx.lineTo(cx + s, cy - s * 0.42);
    ctx.lineTo(cx + s, cy + s * 0.42);
    ctx.closePath();
    ctx.moveTo(cx - s * 0.25, cy - s * 0.35); ctx.arc(cx - s * 0.3, cy - s * 0.38, s * 0.07, 0, Math.PI * 2);
  } else if (name === 'flower') {
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      ctx.moveTo(cx + s * 0.35 * Math.cos(a), cy + s * 0.35 * Math.sin(a));
      ctx.ellipse(cx + s * 0.5 * Math.cos(a), cy + s * 0.5 * Math.sin(a), s * 0.3, s * 0.18, a, 0, Math.PI * 2);
    }
    ctx.moveTo(cx + s * 0.2, cy);
    ctx.arc(cx, cy, s * 0.22, 0, Math.PI * 2);
  } else { // house
    ctx.rect(cx - s * 0.7, cy, s * 1.4, s * 0.75);
    ctx.moveTo(cx - s * 0.85, cy);
    ctx.lineTo(cx, cy - s * 0.7);
    ctx.lineTo(cx + s * 0.85, cy);
    ctx.closePath();
    ctx.moveTo(cx - s * 0.2, cy + s * 0.75); ctx.rect(cx - s * 0.2, cy + s * 0.25, s * 0.4, s * 0.5);
  }
  ctx.stroke();
  ctx.restore();
}

const TEMPLATES: { key: string; label: string; emoji: string }[] = [
  { key: 'blank', label: 'Giấy trắng', emoji: '📄' },
  { key: 'star', label: 'Ngôi sao', emoji: '⭐' },
  { key: 'turtle', label: 'Chú rùa', emoji: '🐢' },
  { key: 'butterfly', label: 'Bươm bướm', emoji: '🦋' },
  { key: 'fish', label: 'Cá bơi', emoji: '🐠' },
  { key: 'flower', label: 'Bông hoa', emoji: '🌸' },
  { key: 'house', label: 'Ngôi nhà', emoji: '🏠' },
];

export default function DrawPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wishPhotoRef = useRef<HTMLInputElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const drawingRef = useRef(false);
  const imgCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [brush, setBrush] = useState<BrushKind>('pencil');
  const [palette, setPalette] = useState<'vivid' | 'water'>('vivid');
  const [template, setTemplate] = useState('blank');
  const [aiTemplates, setAiTemplates] = useState<{ id: number; prompt: string; title: string; image_path: string }[]>([]);
  const [wishOpen, setWishOpen] = useState(false);
  const [wishText, setWishText] = useState('');
  const [wishPhoto, setWishPhoto] = useState<string | null>(null); // dataURL ảnh con chụp (đã thu nhỏ)
  const [wishing, setWishing] = useState(false);
  const [wishResult, setWishResult] = useState<'done' | 'fail' | null>(null);
  const [wishErr, setWishErr] = useState('');
  const [quota, setQuota] = useState<{ sheetsAvailable: number; today: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState('');

  const loadQuota = useCallback(() => {
    fetch('/api/drawings').then((r) => r.json()).then((j) => setQuota({ sheetsAvailable: j.sheetsAvailable, today: j.today }));
  }, []);
  useEffect(() => { loadQuota(); }, [loadQuota]);
  // template AI đã được bố duyệt (batch6 T3)
  const loadAi = useCallback(() => {
    fetch('/api/colorbook', { cache: 'no-store' }).then((r) => r.json()).then((j) => setAiTemplates(j.templates || [])).catch(() => {});
  }, []);
  useEffect(() => { loadAi(); }, [loadAi]);

  const redraw = useCallback((tpl: string) => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    const ctx = c.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, rect.width, rect.height);
    if (tpl.startsWith('ai:')) {
      // template từ ảnh Gemini — vẽ contain giữa canvas
      const path = tpl.slice(3);
      let img = imgCache.current.get(path);
      if (!img) {
        img = new Image();
        img.onload = () => redraw(tpl);
        img.src = `/api/photo?p=${encodeURIComponent(path)}`;
        imgCache.current.set(path, img);
      } else if (img.complete && img.naturalWidth > 0) {
        const scale = Math.min(rect.width / img.naturalWidth, rect.height / img.naturalHeight);
        const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
        ctx.drawImage(img, (rect.width - dw) / 2, (rect.height - dh) / 2, dw, dh);
      }
    } else if (tpl !== 'blank') {
      drawTemplate(ctx, tpl, rect.width, rect.height);
    }
    for (const st of strokesRef.current) paintStroke(ctx, st, rect.width, rect.height);
  }, []);
  // fullscreen toggle → canvas đổi kích thước → vẽ lại (tọa độ nét đã chuẩn hóa theo tỉ lệ)
  const [full, setFull] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => redraw(template), 80);
    return () => clearTimeout(t);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [full]);

  useEffect(() => { redraw(template); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [template]);

  /** nét vẽ lưu TỌA ĐỘ CHUẨN HÓA [0..1] × kích thước canvas — chuyển fullscreen
   *  (canvas to ra) nét vẽ vẫn đúng vị trí, độ dày scale theo chiều rộng */
  function paintStroke(ctx: CanvasRenderingContext2D, st: Stroke, w: number, h: number) {
    if (st.points.length < 2) return;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = st.color;
    const sw = st.size * w; // size lưu dạng tỉ lệ theo chiều rộng (size / width lúc vẽ)
    if (st.brush === 'water') {
      // 💧 màu nước: nét rộng, trong suốt, mép mềm — chồng nét là loang màu
      ctx.globalAlpha = 0.22;
      ctx.lineWidth = sw * 2.4;
      ctx.shadowColor = st.color;
      ctx.shadowBlur = sw * 0.9;
    } else if (st.brush === 'marker') {
      // 🖊 marker: đậm, mượt, phủ đặc
      ctx.globalAlpha = 0.95;
      ctx.lineWidth = sw * 1.6;
    } else if (st.brush === 'crayon') {
      // 🖍 sáp: hơi nhiễu, nét khô — vẽ 2 lớp lệch nhẹ
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = sw * 1.3;
    } else {
      ctx.globalAlpha = 1;
      ctx.lineWidth = sw;
    }
    const pass = st.brush === 'crayon' ? 2 : 1;
    const j = sw * 0.012; // lệch lớp sáp — cũng theo tỉ lệ
    for (let p = 0; p < pass; p++) {
      ctx.beginPath();
      const jx = p === 0 ? 0 : j, jy = p === 0 ? 0 : -j;
      ctx.moveTo(st.points[0][0] * w + jx, st.points[0][1] * h + jy);
      for (let i = 1; i < st.points.length; i++) ctx.lineTo(st.points[i][0] * w + jx, st.points[i][1] * h + jy);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** tọa độ chuẩn hóa [0..1] — bất biến với kích thước canvas */
  function pos(e: React.PointerEvent): [number, number] {
    const r = canvasRef.current!.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  }
  function down(e: React.PointerEvent) {
    if (!quota || quota.sheetsAvailable <= 0) return;
    drawingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    strokesRef.current.push({ color, size: size / canvasRef.current!.getBoundingClientRect().width, brush, points: [pos(e)] });
  }
  function move(e: React.PointerEvent) {
    if (!drawingRef.current) return;
    const st = strokesRef.current[strokesRef.current.length - 1];
    st.points.push(pos(e));
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    const ctx = c.getContext('2d')!;
    paintStroke(ctx, st, r.width, r.height);
  }
  function up() { drawingRef.current = false; }

  function undo() {
    strokesRef.current.pop();
    redraw(template);
  }
  function clearAll() {
    strokesRef.current = [];
    redraw(template);
  }

  async function save() {
    const c = canvasRef.current!;
    const image = c.toDataURL('image/png');
    const res = await fetch('/api/drawings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image }),
    });
    const j = await res.json();
    if (j.ok) {
      setSaved(true);
      strokesRef.current = [];
      redraw(template);
      loadQuota();
      setTimeout(() => setSaved(false), 2500);
    } else setMsg(j.error || 'Lỗi lưu');
  }

  /** 🪄 con tả tranh → Gemini vẽ line-art (BACKGROUND TASK) → chờ bố duyệt.
   *  Kiến trúc async (fix QA 10/10): POST enqueue trả NGAY, frontend poll GET
   *  /api/colorbook theo lastWish — request dài qua Cloudflare/browser bị treo (HTTP/3). */
  async function makeWish() {
    const text = wishText.trim();
    if (!text || wishing) return;
    setWishing(true);
    setWishResult(null);
    try {
      const res = await fetch('/api/colorbook', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', prompt: text }),
      });
      const j = await res.json();
      if (!j.ok) {
        setWishResult('fail');
        setWishErr(j.error || 'Thử lại nhé con!');
        setWishing(false);
        return;
      }
      // enqueue OK → poll background task (mỗi 4s, tối đa 4 phút)
      pollWish();
    } catch {
      setWishResult('fail');
      setWishErr('Mạng chập chờn — thử lại nhé!');
      setWishing(false);
    }
  }

  const wishPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [wishImage, setWishImage] = useState<string | null>(null);
  const [wishId, setWishId] = useState<number | null>(null);
  function stopWishPoll() {
    if (wishPollRef.current) { clearInterval(wishPollRef.current); wishPollRef.current = null; }
  }
  useEffect(() => stopWishPoll, []);
  function pollWish() {
    stopWishPoll();
    const startedAt = Date.now();
    wishPollRef.current = setInterval(async () => {
      try {
        const r = await fetch('/api/colorbook', { cache: 'no-store' });
        const j = await r.json();
        if (j.lastWish === 'done' && j.lastWishImage) {
          stopWishPoll();
          setWishResult('done');
          setWishImage(j.lastWishImage);
          setWishId(j.lastWishId ?? null);
          setWishing(false);
        } else if (j.lastWish === 'failed') {
          stopWishPoll();
          setWishResult('fail');
          setWishErr('Chú ma thuật chưa vẽ được — con thử lại nhé!');
          setWishing(false);
        } else if (Date.now() - startedAt > 4 * 60_000) {
          stopWishPoll();
          setWishResult('fail');
          setWishErr('Chú ma thuật vẽ lâu quá — chút nữa con thử lại nhé!');
          setWishing(false);
        }
      } catch { /* poll lỗi nhẹ — thử lượt sau */ }
    }, 4_000);
  }

  /** con chọn VẼ NGAY: paste lên canvas (không lưu template) — row đánh dấu rejected */
  async function drawNowFromWish() {
    if (!wishImage) return closeWish();
    if (wishId) {
      fetch('/api/colorbook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'discard', id: wishId }) }).catch(() => {});
    }
    setTemplate(`ai:${wishImage}`);
    closeWish();
  }
  /** con chọn LƯU MẪU: template hiện NGAY trong danh sách (11/10 — trước đây pending
   *  chờ duyệt nên con "không thấy nó lưu"). Bố vẫn xóa/đổi tên được trong Admin. */
  async function saveAsTemplate() {
    if (wishId) {
      await fetch('/api/colorbook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save-template', id: wishId }) }).catch(() => {});
    }
    loadAi();
    closeWish();
    setMsg('💾 Đã lưu vào danh sách mẫu — con chọn để vẽ lúc nào cũng được!');
    setTimeout(() => setMsg(''), 5000);
  }

  /** 📷 con chụp ảnh → thu nhỏ về tối đa 1280px (ảnh iPad gốc vài MB sẽ nghẽn
   *  payload + gen) → dataURL jpeg. Pattern như checkin trang chủ. */
  async function onWishPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // cho phép chọn lại cùng 1 file
    if (!file) return;
    try {
      const raw = await new Promise<string>((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result as string);
        fr.onerror = rej;
        fr.readAsDataURL(file);
      });
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = raw;
      });
      const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
      if (scale >= 1 && raw.length < 900_000) { setWishPhoto(raw); return; } // ảnh nhỏ rồi
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * scale));
      c.height = Math.max(1, Math.round(img.height * scale));
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      setWishPhoto(c.toDataURL('image/jpeg', 0.85));
    } catch {
      setWishErr('Không đọc được ảnh — con chụp lại nhé!');
    }
  }

  /** 🪄 biến ảnh con chụp thành tranh chibi — cùng poll flow như wishes thường */
  async function makeWishFromPhoto() {
    if (!wishPhoto || wishing) return;
    setWishing(true);
    setWishResult(null);
    try {
      const res = await fetch('/api/colorbook', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate-photo', image: wishPhoto }),
      });
      const j = await res.json();
      if (!j.ok) {
        setWishResult('fail');
        setWishErr(j.error || 'Thử lại nhé con!');
        setWishing(false);
        return;
      }
      pollWish();
    } catch {
      setWishResult('fail');
      setWishErr('Mạng chập chờn — thử lại nhé!');
      setWishing(false);
    }
  }

  function closeWish() {
    stopWishPoll();
    setWishOpen(false);
    setWishText('');
    setWishPhoto(null);
    setWishResult(null);
    setWishErr('');
    setWishing(false);
    setWishImage(null);
    setWishId(null);
  }

  const locked = quota !== null && quota.sheetsAvailable <= 0;
  const paletteColors = palette === 'water' ? WATERCOLORS : COLORS;

  return (
    <Shell>
      <div className="p-4 pt-6 lg:px-6 lg:pt-8">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-2xl lg:text-4xl font-extrabold text-star-deep">🎨 Xưởng vẽ</h1>
          <Link href="/gallery" className="btn-secondary !py-2 !text-sm">🖼️ Bộ sưu tập của con</Link>
        </div>
        <p className="text-sm lg:text-lg text-gray-500 mt-1">
          {quota === null ? 'Đang tải…' : locked
            ? '🐢 Hôm nay con chưa có tờ giấy vẽ mới — tự làm thêm một việc nhé, Sao Nhí sẽ tặng ngay!'
            : `Con đang có ${quota.sheetsAvailable} tờ giấy vẽ mới!`}
        </p>

        {/* mẫu tô màu — vector sẵn có */}
        <div className="flex gap-2 flex-wrap mt-3">
          {TEMPLATES.map((t) => (
            <button key={t.key} onClick={() => setTemplate(t.key)} disabled={locked}
              className={`rounded-2xl px-3 py-2 text-sm font-bold transition ${template === t.key ? 'bg-star text-white' : 'bg-white text-gray-500'} ${locked ? 'opacity-40' : ''}`}>
              {t.emoji} {t.label}
            </button>
          ))}
          {/* tranh ma thuật (batch6) — Gemini sinh, bố đã duyệt; tên hiển thị do bố đặt (title), fallback prompt */}
          {aiTemplates.map((t) => (
            <button key={`ai-${t.id}`} onClick={() => setTemplate(`ai:${t.image_path}`)} disabled={locked}
              className={`rounded-2xl px-3 py-2 text-sm font-bold transition ${template === `ai:${t.image_path}` ? 'bg-star text-white' : 'bg-white text-gray-500'} ${locked ? 'opacity-40' : ''}`}>
              🪄 {(t.title || t.prompt).length > 14 ? (t.title || t.prompt).slice(0, 14) + '…' : (t.title || t.prompt)}
            </button>
          ))}
          <button onClick={() => setWishOpen(true)}
            className="rounded-2xl px-3 py-2 text-sm font-bold bg-gradient-to-r from-fuchsia-100 to-amber-100 text-fuchsia-700 border-2 border-fuchsia-200">
            ✨ Tranh mới
          </button>
        </div>

        {/* canvas — thường HOẶC fullscreen (bố 11/10: phóng to cho bé vẽ dễ) */}
        <div className={full ? 'fixed inset-0 z-[60] bg-amber-50 flex flex-col p-2' : 'mt-3 relative'}>
          {full && (
            <div className="flex items-center gap-2 px-2 py-1">
              <span className="font-extrabold text-star-deep">🎨 Đang vẽ to</span>
              <div className="ml-auto flex gap-2">
                <button className="btn-secondary !py-2.5 !text-sm" onClick={undo} disabled={locked}>↩ Xoá nét</button>
                <button className="btn-secondary !py-2.5 !text-sm" onClick={clearAll} disabled={locked}>🧹 Xoá hết</button>
                <button className="btn-secondary !py-2.5 !text-sm" onClick={() => setFull(false)}>✅ Thu nhỏ</button>
              </div>
            </div>
          )}
          <canvas
            key="draw-canvas"
            ref={canvasRef}
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
            className={
              full
                ? 'flex-1 w-full bg-white rounded-2xl border-4 border-star/40 touch-none'
                : `w-full h-[52vh] lg:h-[62vh] bg-white rounded-[2rem] shadow-md border-4 ${locked ? 'border-gray-200 opacity-50' : 'border-star/40'} touch-none`
            }
          />
          {locked && !full && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Link href="/" className="btn-primary">🐢 Về làm việc để nhận giấy vẽ</Link>
            </div>
          )}
          {!full && (
            <button
              onClick={() => setFull(true)}
              aria-label="vẽ toàn màn hình"
              className="absolute right-3 top-3 w-11 h-11 rounded-2xl bg-white/95 shadow-md border-2 border-star/30 text-xl flex items-center justify-center">
              🔍
            </button>
          )}
        </div>

        {/* cọ vẽ (batch6) */}
        <div className="flex items-center gap-2 flex-wrap mt-3">
          {BRUSHES.map((b) => (
            <button key={b.kind} onClick={() => setBrush(b.kind)} disabled={locked}
              className={`h-11 lg:h-14 px-4 rounded-2xl text-lg font-bold transition ${brush === b.kind ? 'bg-star text-white' : 'bg-white text-gray-500'} ${locked ? 'opacity-40' : ''}`}>
              {b.emoji} {b.label}
            </button>
          ))}
        </div>

        {/* bảng màu — có 2 palette: tươi / màu nước */}
        <div className="flex items-center gap-2 flex-wrap mt-3">
          {paletteColors.map((c) => (
            <button key={c} onClick={() => setColor(c)} disabled={locked} aria-label={`màu ${c}`}
              className={`w-11 h-11 lg:w-14 lg:h-14 rounded-full border-4 transition ${color === c ? 'scale-110 border-ink' : 'border-white'} shadow`}
              style={{ background: c }} />
          ))}
          <button onClick={() => {
            setPalette(palette === 'vivid' ? 'water' : 'vivid');
            setColor(palette === 'vivid' ? WATERCOLORS[0] : COLORS[0]);
          }} disabled={locked}
            className={`h-11 lg:h-14 px-4 rounded-2xl text-sm font-bold ${palette === 'water' ? 'bg-sky-200 text-sky-800' : 'bg-white text-gray-500'}`}>
            {palette === 'water' ? '💧 màu nước' : '🌈 màu tươi'}
          </button>
          <span className="mx-2 w-px h-8 bg-gray-200" />
          {SIZES.map((s) => (
            <button key={s} onClick={() => setSize(s)} disabled={locked}
              className={`w-11 h-11 lg:w-14 lg:h-14 rounded-2xl flex items-center justify-center ${size === s ? 'bg-star text-white' : 'bg-white text-gray-400'}`}>
              <span className="rounded-full bg-current" style={{ width: s, height: s }} />
            </button>
          ))}
        </div>

        <div className="flex gap-2 mt-3 flex-wrap">
          <button className="btn-secondary !py-2.5 !text-sm" onClick={undo} disabled={locked}>↩ Xoá nét</button>
          <button className="btn-secondary !py-2.5 !text-sm" onClick={clearAll} disabled={locked}>🧹 Vẽ lại từ đầu</button>
          <button className="btn-primary flex-1 !py-3" onClick={save} disabled={locked}>💾 Lưu vào bộ sưu tập</button>
        </div>
        {saved && <p className="text-center text-star-deep font-bold text-lg mt-3">Đã lưu! Bức vẽ nằm trong Bộ sưu tập của con 🖼️</p>}
        {msg && !saved && <p className="text-center text-gray-500 text-sm mt-2">{msg}</p>}
        <p className="text-xs text-gray-400 mt-4 text-center">Mỗi lần con tự làm một việc, Sao Nhí tặng con một tờ giấy vẽ mới ⭐</p>
      </div>

      {/* SHEET đặt tranh ma thuật — voice input + trạng thái đang vẽ (giữ mở tới khi có kết quả) */}
      {wishOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-end lg:items-center justify-center z-50" onClick={() => !wishing && wishResult !== 'done' && closeWish()}>
          <div className="bg-white w-full lg:max-w-lg rounded-t-3xl lg:rounded-[2rem] p-5" onClick={(e) => e.stopPropagation()}>
            {wishing ? (
              /* ĐANG VẼ — giữ sheet, con thấy rõ là app đang làm việc (20-120s) */
              <div className="text-center py-6">
                <div className="text-6xl mb-3 animate-bounce">🪄</div>
                <p className="text-xl font-extrabold text-star-deep">Chú ma thuật đang vẽ…</p>
                <p className="text-sm text-gray-400 mt-2 font-bold">Con chờ chút nhé — vẽ xong sẽ báo con ngay! (chừng 1 phút)</p>
              </div>
            ) : wishResult === 'done' ? (
              /* XONG — hiện ảnh (không border, center) + hỏi lưu mẫu hay vẽ ngay */
              <div className="text-center">
                <p className="text-xl font-extrabold text-star-deep mb-3">🎉 Vẽ xong rồi!</p>
                <div className="flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/photo?p=${encodeURIComponent(wishImage || '')}`} alt="tranh vừa vẽ"
                    className="max-h-[42vh] object-contain" style={{ imageRendering: 'auto' }} />
                </div>
                <p className="text-sm text-gray-500 mt-3 font-bold">Con muốn làm gì với bức tranh này?</p>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button className="btn-secondary !py-4 !text-base" onClick={drawNowFromWish}>🎨 Vẽ ngay</button>
                  <button className="btn-primary !py-4 !text-base" onClick={saveAsTemplate}>💾 Lưu làm mẫu</button>
                </div>
                <p className="text-[11px] text-gray-400 mt-2">Lưu mẫu: tranh dùng lại được nhiều lần (bố duyệt trước khi hiện danh sách)</p>
              </div>
            ) : wishResult === 'fail' ? (
              /* THẤT BẠI — nói rõ + cho thử lại */
              <div className="text-center py-6">
                <div className="text-6xl mb-3">😅</div>
                <p className="text-xl font-extrabold text-star-deep">Chưa vẽ được rồi…</p>
                <p className="text-sm text-gray-500 mt-2 font-bold">{wishErr}</p>
                <div className="grid grid-cols-2 gap-2 mt-5">
                  <button className="btn-secondary !py-4 !text-base" onClick={closeWish}>Để lúc khác</button>
                  <button className="btn-primary !py-4 !text-base" onClick={() => { setWishResult(null); }}>🔁 Thử lại</button>
                </div>
              </div>
            ) : wishPhoto ? (
              /* ĐÃ CHỌN ẢNH — xem trước + xác nhận biến thành tranh */
              <>
                <p className="text-lg font-extrabold mb-1">📷 Ảnh của con đây!</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={wishPhoto} alt="ảnh con vừa chụp" className="w-full h-48 object-contain rounded-2xl bg-gray-50 mt-1" />
                <button className="btn-primary w-full mt-4 !text-base !py-4" onClick={makeWishFromPhoto}>
                  🪄 Biến thành tranh!
                </button>
                <button className="btn-secondary w-full mt-2 !text-base" onClick={() => setWishPhoto(null)}>
                  📷 Chọn ảnh khác
                </button>
              </>
            ) : (
              <>
                <p className="text-lg font-extrabold mb-1">✨ Con muốn vẽ tranh gì?</p>
                <p className="text-xs text-gray-400 mb-3">Kể chú ma thuật nghe — vd: "con mèo đội mũ", "lâu đài công chúa". Chú vẽ xong bố duyệt rồi tranh hiện ở đây!</p>
                <VoiceInput value={wishText} onChange={setWishText} placeholder="VD: chú khủng long dễ thương…" autoFocus />
                <button className="btn-primary w-full mt-4 !text-base" disabled={!wishText.trim()} onClick={makeWish}>
                  🪄 Vẽ cho con nhé!
                </button>
                {/* 📷 chụp ảnh thật → chú ma thuật vẽ thành tranh chibi (10/10) */}
                <input ref={wishPhotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onWishPhoto} />
                <button className="btn-secondary w-full mt-2 !text-base !py-4" onClick={() => wishPhotoRef.current?.click()}>
                  📷 Chụp ảnh làm tranh
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </Shell>
  );
}
