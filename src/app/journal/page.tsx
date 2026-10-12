'use client';
// Nhật ký giọng nói — Bé kể chuyện bằng giọng mình, nghe lại về sau
// Không gắn sao: đây là phút tự chiêm nghiệm (khớp "tự chấm sao cuối ngày")
import { useCallback, useEffect, useRef, useState } from 'react';
import Shell from '@/components/Shell';

const MOODS = ['😊', '😢', '😤', '😮', '🥳', '😰', '💛', '😴'];
const PROMPTS = [
  'Hôm nay có gì vui nhất?',
  'Hôm nay có chuyện gì khó không?',
  'Con muốn nói cảm ơn ai hôm nay?',
  'Nếu hôm nay được làm lại, con muốn đổi gì?',
  'Dạo này con mơ thấy gì? Kể nghe!',
];

export default function JournalPage() {
  const [items, setItems] = useState<any[] | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [mood, setMood] = useState('');
  const [msg, setMsg] = useState('');
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const promptRef = useRef(PROMPTS[Math.floor(Date.now() / 86400000) % PROMPTS.length]);

  const load = useCallback(() => {
    fetch('/api/journal', { cache: 'no-store' }).then((r) => r.json()).then((j) => setItems(j.items || []));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // iOS Safari: 'audio/mp4' · Chrome/Android: 'audio/webm' — chọn theo browser HỖ TRỢ, không hardcode
      const CANDIDATES = ['audio/mp4', 'audio/aac', 'audio/webm;codecs=opus', 'audio/webm'];
      const mime = CANDIDATES.find((t) => { try { return MediaRecorder.isTypeSupported(t); } catch { return false; } }) || '';
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => chunksRef.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        // iOS hay trả mimeType/blob type rỗng → fallback theo UA (Safari ghi mp4/AAC)
        const type = rec.mimeType || mime || (/(iphone|ipad|ipod)/i.test(navigator.userAgent) ? 'audio/mp4' : 'audio/webm');
        const blob = new Blob(chunksRef.current, { type });
        setPreviewBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => { if (s >= 119) { stop(); return 120; } return s + 1; }), 1000);
    } catch {
      setMsg('Không mở được micro — hỏi bố mẹ bật giúp nhé');
      setTimeout(() => setMsg(''), 4000);
    }
  }
  function stop() {
    clearInterval(timerRef.current);
    if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop();
    setRecording(false);
  }

  async function save() {
    if (!previewBlob) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const res = await fetch('/api/journal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: reader.result, mime: previewBlob.type, seconds, mood }),
      });
      const j = await res.json();
      if (j.ok) {
        setMsg('Đã lưu vào nhật ký của con 🌙');
        setPreviewUrl(null); setPreviewBlob(null); setMood('');
        load();
      } else setMsg(j.error);
      setTimeout(() => setMsg(''), 3500);
    };
    reader.readAsDataURL(previewBlob);
  }

  // nhóm theo ngày
  const groups: { date: string; items: any[] }[] = [];
  for (const it of items || []) {
    const last = groups[groups.length - 1];
    if (last && last.date === it.date) last.items.push(it);
    else groups.push({ date: it.date, items: [it] });
  }

  return (
    <Shell>
      <div className="p-4 pt-6 lg:px-6 lg:pt-8">
        <h1 className="text-2xl lg:text-4xl font-extrabold text-star-deep">🌙 Nhật ký của con</h1>
        <p className="text-sm lg:text-lg text-gray-500 mt-1 mb-4">Kể bằng giọng của con — chỉ con và bố mẹ nghe được. Không ai chấm điểm hết!</p>
        {msg && <p className="bg-amber-50 text-star-deep rounded-2xl p-3 font-bold text-sm mb-3">{msg}</p>}

        {/* gợi ý hôm nay */}
        <div className="bg-white rounded-3xl p-4 lg:p-5 shadow-sm">
          <p className="text-sm lg:text-base font-bold text-gray-400 mb-1">Chủ đề gợi ý hôm nay:</p>
          <p className="text-lg lg:text-2xl font-extrabold text-ink">{promptRef.current}</p>

          {!previewUrl ? (
            <div className="flex flex-col items-center py-6">
              {!recording ? (
                <>
                  <button onClick={start} className="w-28 h-28 lg:w-32 lg:h-32 rounded-full bg-red-500 text-white text-5xl shadow-lg active:scale-90 transition flex items-center justify-center" aria-label="bắt đầu ghi">🎙</button>
                  <p className="text-sm font-bold text-gray-400 mt-3">Chạm để bắt đầu kể</p>
                </>
              ) : (
                <>
                  <button onClick={stop} className="w-28 h-28 lg:w-32 lg:h-32 rounded-full bg-red-600 text-white shadow-lg animate-pulse flex items-center justify-center">
                    <span className="w-10 h-10 bg-white rounded-md block" />
                  </button>
                  <p className="text-2xl font-extrabold tabular-nums text-red-600 mt-3">{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')} / 02:00</p>
                  <p className="text-xs text-gray-400">Đang ghi… kể xong bấm nút vuông</p>
                </>
              )}
            </div>
          ) : (
            <div className="py-4">
              <audio src={previewUrl} controls className="w-full" />
              <p className="text-xs text-gray-400 mt-1 mb-3">Nghe thử trước khi lưu nhé</p>
              <div className="flex gap-2 flex-wrap mb-3">
                {MOODS.map((m) => (
                  <button key={m} onClick={() => setMood(m === mood ? '' : m)}
                    className={`w-12 h-12 rounded-2xl text-2xl ${mood === m ? 'bg-star' : 'bg-amber-50'} transition`}>{m}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <button className="btn-primary flex-1" onClick={save}>💾 Lưu lại</button>
                <button className="btn-secondary" onClick={() => { setPreviewUrl(null); setPreviewBlob(null); }}>🎙 Kể lại</button>
              </div>
            </div>
          )}
        </div>

        {/* các bài đã lưu */}
        {items !== null && items.length === 0 && (
          <p className="bg-white rounded-3xl p-6 text-center text-gray-400 mt-4">Chưa có bài nào — bài đầu tiên đang chờ con kể!</p>
        )}
        <div className="space-y-5 mt-5">
          {groups.map((g) => (
            <section key={g.date}>
              <h2 className="text-sm lg:text-lg font-extrabold text-gray-400 mb-2">📆 {g.date}</h2>
              <div className="space-y-2">
                {g.items.map((it: any) => (
                  <div key={it.id} className="bg-white rounded-2xl p-3 shadow-sm flex items-center gap-3">
                    <span className="text-2xl w-9 text-center">{it.mood || '🌙'}</span>
                    <div className="flex-1 min-w-0">
                      <audio src={it.url} controls className="w-full h-10" preload="none" />
                    </div>
                    <span className="text-[11px] text-gray-400 whitespace-nowrap">{(it.created_at || '').slice(11, 16)}</span>
                    <button className="text-xs text-gray-300" onClick={async () => {
                      if (confirm('Xoá bài này khỏi nhật ký nhé?')) { await fetch(`/api/journal?id=${it.id}`, { method: 'DELETE' }); load(); }
                    }}>✕</button>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </Shell>
  );
}
