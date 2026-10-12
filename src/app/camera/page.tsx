'use client';
// Xem Nhà — 2 lens camera JOOAN qua HLS (T5 + dual-lens 10/10)
// Luồng mỗi lens: /api/cam/status?cam=N poll 10s → live thì <video> HLS (Safari iPad
// native), chưa live sau 15s thì xem ảnh snapshot 10s/lần, camera chết thì "😴" + thử lại.
// iPad autoplay: phải muted + playsInline, nút Play to ≥44pt vì con cần chạm 1 lần.
import { useCallback, useEffect, useRef, useState } from 'react';
import Shell from '@/components/Shell';

type CamStatus = { live: boolean; reason: string };

const CAMS: { cam: 0 | 1; label: string; emoji: string }[] = [
  { cam: 0, label: 'Camera 1', emoji: '📹' },
  { cam: 1, label: 'Camera 2', emoji: '🎥' },
];

export default function CameraPage() {
  return (
    <Shell>
      <div className="p-4 pt-6 lg:px-6 lg:pt-8">
        <h1 className="text-2xl lg:text-4xl font-extrabold text-star-deep">📷 Xem Nhà</h1>
        <p className="text-sm lg:text-lg text-gray-500 mt-1">Hình nhà mình đang diễn ra nhé!</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          {CAMS.map((c) => <CamView key={c.cam} cam={c.cam} label={c.label} emoji={c.emoji} />)}
        </div>
        <p className="text-xs text-gray-400 mt-4 text-center">Chỉ nhà mình mới xem được nhé 🔒</p>
      </div>
    </Shell>
  );
}

function CamView({ cam, label, emoji }: { cam: 0 | 1; label: string; emoji: string }) {
  const [status, setStatus] = useState<CamStatus | null>(null);
  const [playing, setPlaying] = useState(false);
  const [liveKey, setLiveKey] = useState(0); // remount <video> khi vừa lên live
  const [snapTick, setSnapTick] = useState(0); // cache-bust ảnh snapshot
  const videoRef = useRef<HTMLVideoElement>(null);
  const mountedAt = useRef(Date.now());

  const poll = useCallback(() => {
    fetch(`/api/cam/status?cam=${cam}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j) return;
        setStatus((prev) => {
          if (!prev?.live && j.live) {
            setPlaying(false); // hiện nút Play to — iPad cần chạm mới phát
            setLiveKey((k) => k + 1);
          }
          return { live: j.live, reason: j.reason || '' };
        });
      })
      .catch(() => {});
  }, [cam]);

  useEffect(() => {
    poll();
    const t = setInterval(poll, 10_000);
    // tab mở qua đêm → state stale: quay lại tab là poll lại ngay (CLAUDE.md #2)
    const onVis = () => { if (document.visibilityState === 'visible') poll(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [poll]);

  // chế độ ảnh: làm mới snapshot mỗi 10s
  const showSnapshot = !!status && !status.live && Date.now() - mountedAt.current >= 15_000 && !isDead(status);
  useEffect(() => {
    if (!showSnapshot) return;
    setSnapTick((t) => t + 1);
    const t = setInterval(() => setSnapTick((x) => x + 1), 10_000);
    return () => clearInterval(t);
  }, [showSnapshot]);

  function play() {
    videoRef.current?.play().then(() => setPlaying(true)).catch(() => {});
  }

  const elapsed = Date.now() - mountedAt.current;
  const loading = status === null;
  const waking = !!status && !status.live && elapsed < 15_000;
  const dead = !!status && !status.live && elapsed >= 15_000 && isDead(status);
  const live = !!status?.live;

  return (
    <div>
      <p className="font-extrabold text-star-deep text-base lg:text-xl mb-2">{emoji} {label}</p>

      {/* LIVE — video HLS */}
      {live && (
        <div className="relative rounded-[2rem] overflow-hidden shadow-md border-4 border-star/40 bg-black">
          <video
            key={liveKey}
            ref={videoRef}
            src={`/api/cam/playlist?cam=${cam}`}
            playsInline
            muted
            autoPlay
            onPlaying={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onError={() => setStatus({ live: false, reason: 'video-error' })}
            className="w-full aspect-video object-contain bg-black"
          />
          {!playing && (
            <button
              onClick={play}
              aria-label="phát"
              className="absolute inset-0 flex items-center justify-center bg-black/30 active:bg-black/40"
            >
              <span className="flex items-center justify-center w-24 h-24 lg:w-28 lg:h-28 rounded-full bg-white/90 shadow-lg text-5xl lg:text-6xl">
                ▶️
              </span>
            </button>
          )}
        </div>
      )}

      {/* ĐANG ĐÁNH THỨC */}
      {(loading || waking) && (
        <div className="h-[36vh] lg:h-[44vh] rounded-[2rem] bg-white shadow-md border-4 border-star/40 flex flex-col items-center justify-center gap-3">
          <span className="text-5xl animate-bounce">🔍</span>
          <p className="text-base lg:text-xl font-bold text-gray-500">Đang mở mắt…</p>
        </div>
      )}

      {/* ẢNH SNAPSHOT — HLS chưa lên nhưng camera còn sống */}
      {showSnapshot && (
        <div className="rounded-[2rem] overflow-hidden shadow-md border-4 border-star/40 bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/cam/snapshot?cam=${cam}&t=${snapTick}`}
            alt="ảnh nhà mình"
            className="w-full aspect-video object-contain bg-gray-100"
          />
          <p className="text-center text-sm lg:text-lg font-bold text-gray-500 py-2">
            🖼️ Đang xem ảnh — hình sống sẽ sớm về
          </p>
        </div>
      )}

      {/* CAMERA NGỦ */}
      {dead && (
        <div className="h-[36vh] lg:h-[44vh] rounded-[2rem] bg-white shadow-md border-4 border-gray-200 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <span className="text-6xl">😴</span>
          <p className="text-lg lg:text-2xl font-extrabold text-gray-500">Camera đang ngủ</p>
          <button
            onClick={() => { mountedAt.current = Date.now(); poll(); }}
            className="btn-primary !py-4 !px-8 !text-lg"
          >
            🔁 Thử lại
          </button>
        </div>
      )}
    </div>
  );
}

/** "chết hẳn" = không có tiến trình ffmpeg / ssh lỗi — khác với đang khởi động */
function isDead(s: CamStatus): boolean {
  return s.reason === 'no-process' || s.reason.startsWith('ssh') || s.reason === 'video-error';
}
