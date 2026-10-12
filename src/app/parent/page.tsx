'use client';
// Khu vực bố mẹ — chuyển người dùng / đăng xuất (login thật ở /login) + điều khiển nhà
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ParentPage() {
  const [me, setMe] = useState<any>(null);
  const [home, setHome] = useState<any>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/auth', { cache: 'no-store' }).then((r) => r.json()).then((j) => setMe(j.me)).catch(() => {});
    fetch('/api/home', { cache: 'no-store' }).then((r) => r.json()).then(setHome).catch(() => {});
  }, []);

  async function homeAct(action: string, device = 'soundbar') {
    setMsg('…');
    const res = await fetch('/api/home', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device, action }),
    });
    const j = await res.json();
    setMsg(j.ok ? '✓ đã lệnh' : `✗ ${j.error}`);
    setTimeout(() => setMsg(''), 3500);
  }

  async function logout() {
    await fetch('/api/auth', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
    window.location.href = '/login';
  }

  return (
    <div className="max-w-md mx-auto p-6 min-h-dvh flex flex-col justify-center">
      <h1 className="text-2xl font-extrabold mb-1">👨‍👩‍👧 Khu vực bố mẹ</h1>
      <p className="text-gray-500 mb-6 text-sm">Đăng nhập bằng tài khoản của mình để duyệt ngày & quản lý app.</p>

      {me && ['parent','system_admin'].includes(me.role) && (
        <div className="space-y-2 mb-6">
          <Link href="/review" className="btn-primary w-full block text-center">🔍 Duyệt ngày + thưởng sao</Link>
          <Link href="/friends-manage" className="btn-secondary w-full block text-center">👥 Bạn bè của con</Link>
          <Link href="/admin" className="btn-secondary w-full block text-center">⚙️ Admin</Link>
          <Link href="/report" className="btn-secondary w-full block text-center">📊 Báo cáo tuần</Link>
        </div>
      )}

      {/* 🔊 Điều khiển nhà — soundbar AirPlay (đã verify), Apple TV chờ ghép đôi */}
      {me && ['parent','system_admin'].includes(me.role) && (
        <div className="bg-white rounded-3xl p-4 shadow-sm mb-6">
          <p className="font-extrabold mb-1">🔊 Soundbar {home?.soundbar?.online ? <span className="text-emerald-600">· online</span> : <span className="text-gray-400">· chưa thấy</span>}</p>
          {msg && <p className="text-xs font-bold text-star-deep mb-2">{msg}</p>}
          <div className="flex gap-2">
            <button className="btn-secondary flex-1 !py-3" onClick={() => homeAct('volume_up')}>➕</button>
            <button className="btn-secondary flex-1 !py-3" onClick={() => homeAct('volume_down')}>➖</button>
            <button className="btn-secondary flex-1 !py-3" onClick={() => homeAct('play_file')}>▶️ test</button>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">Âm lượng &amp; nhạc qua AirPlay từ server nhà. Sau 20h30 khóa phát (giờ ngủ con).</p>
          <p className="font-extrabold mt-3 mb-1">📺 Apple TV {home?.appletv?.paired ? <span className={home?.appletv?.online ? 'text-emerald-600' : 'text-amber-500'}>· {home?.appletv?.online ? 'online' : 'ngủ'}</span> : <span className="text-gray-400">· chưa pair</span>}</p>
          <div className="grid grid-cols-3 gap-2">
            <button className="btn-secondary !py-3 !text-sm" onClick={() => homeAct('launch_youtube', 'appletv')}>▶️ YouTube</button>
            <button className="btn-secondary !py-3 !text-sm" onClick={() => homeAct('launch_music', 'appletv')}>🎵 Music</button>
            <button className="btn-secondary !py-3 !text-sm" onClick={() => homeAct('turn_off', 'appletv')}>⏻ Tắt TV</button>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">Pomodoro quà: nhận quà → TV tự bật mở YouTube · hết quà → tự tắt.</p>
        </div>
      )}

      <button className="btn-secondary w-full" onClick={logout}>
        🔄 Đăng nhập tài khoản khác {me ? `(hiện: ${me.avatar} ${me.name})` : ''}
      </button>
      <Link href="/" className="text-center text-sm text-gray-300 mt-6">← về trang của Bé</Link>
    </div>
  );
}
