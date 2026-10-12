'use client';
// Đăng nhập bắt buộc — multi-family an toàn:
// • Máy ghi nhớ: danh sách người render từ LOCALSTORAGE (không query server — không lộ tên trẻ nhà khác)
// • Máy lạ: gõ tên đăng nhập + PIN
import { useEffect, useState } from 'react';
import Link from 'next/link';

const LS_KEY = 'kh_remembered_users';
const isParent = (r?: string) => ['parent', 'system_admin'].includes(r || '');

export default function LoginPage() {
  const [users, setUsers] = useState<any[]>([]);      // từ localStorage — tin cậy máy này
  const [picked, setPicked] = useState<any | null>(null);
  const [manual, setManual] = useState(false);        // máy lạ → gõ username
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try { setUsers(JSON.parse(localStorage.getItem(LS_KEY) || '[]')); } catch { setUsers([]); }
    fetch('/api/auth', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => { if (j.me) window.location.href = isParent(j.me.role) ? '/review' : '/'; })
      .catch(() => {});
  }, []);

  async function submit(un?: string) {
    const u = un ?? (manual ? username.trim().toLowerCase() : picked?.username);
    if (!u || pin.length < 4) return;
    setBusy(true);
    const res = await fetch('/api/auth', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', username: u, pin, remember }),
    });
    const j = await res.json();
    setBusy(false);
    if (j.ok) {
      if (remember && j.me) {
        try {
          const list: any[] = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
          const next = [...list.filter((x) => x.username !== j.me.username),
            { username: j.me.username, name: j.me.name, avatar: j.me.avatar, role: j.me.role }];
          localStorage.setItem(LS_KEY, JSON.stringify(next.slice(-6)));
        } catch {}
      }
      window.location.href = isParent(j.me.role) ? '/review' : '/';
    } else { setErr(j.error || 'Sai PIN'); setPin(''); setTimeout(() => setErr(''), 3000); }
  }

  const press = (k: string) => {
    if (k === 'del') setPin((p) => p.slice(0, -1));
    else setPin((p) => (p.length >= 8 ? p : p + k));
  };

  return (
    <div className="min-h-dvh bg-gradient-to-b from-amber-50 to-orange-50 flex flex-col items-center justify-center p-6">
      <div className="text-6xl animate-[wiggle_3s_ease-in-out_infinite] select-none">⭐</div>
      <h1 className="text-3xl lg:text-4xl font-extrabold text-star-deep mt-2">Kid Habits</h1>

      {!picked && !manual ? (
        <>
          <p className="text-lg lg:text-xl font-bold text-gray-500 mt-6 mb-4">Ai đang dùng máy này nhỉ?</p>
          <div className="flex gap-4 lg:gap-6 flex-wrap justify-center">
            {users.map((u) => (
              <button key={u.username} onClick={() => setPicked(u)}
                className="bg-white rounded-[2rem] w-36 lg:w-44 p-6 shadow-md active:scale-95 transition flex flex-col items-center">
                <span className="text-6xl lg:text-7xl">{u.avatar}</span>
                <span className="text-lg lg:text-xl font-extrabold mt-3">{u.name}</span>
                <span className="text-xs text-gray-400 font-bold">{isParent(u.role) ? 'bố mẹ' : 'người chơi'}</span>
              </button>
            ))}
          </div>
          {users.length === 0 && (
            <p className="text-sm text-gray-400 font-bold mt-4">Máy này chưa ghi nhớ ai</p>
          )}
          <div className="flex gap-4 mt-6">
            <button className="text-sm font-bold text-star-deep underline" onClick={() => setManual(true)}>gõ tên đăng nhập</button>
            <Link href="/register" className="text-sm font-bold text-blue-500 underline">đăng ký gia đình mới</Link>
          </div>
        </>
      ) : manual && !picked ? (
        <div className="w-full max-w-sm mt-4">
          <button className="text-sm text-gray-400 font-bold mb-2" onClick={() => setManual(false)}>← quay lại</button>
          <input className="input mb-2" placeholder="tên đăng nhập (vd: meohan)" value={username}
            onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" />
          <input className="input mb-2" placeholder="PIN" value={pin} inputMode="numeric"
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} />
          {err && <p className="text-center text-red-400 font-bold mb-2">{err}</p>}
          <button className="btn-primary w-full" disabled={!username || pin.length < 4 || busy}
            onClick={() => submit()}>Đăng nhập</button>
          <Link href="/register" className="block text-center text-sm font-bold text-blue-500 underline mt-4">đăng ký gia đình mới</Link>
        </div>
      ) : (
        <div className="w-full max-w-sm mt-4">
          <button className="text-sm text-gray-400 font-bold mb-2" onClick={() => { setPicked(null); setPin(''); }}>← chọn người khác</button>
          <p className="text-xl lg:text-2xl font-extrabold text-center">{picked.avatar} {picked.name} nhập mã PIN</p>
          <div className="flex justify-center gap-3 my-5">
            {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
              <span key={i} className={`w-5 h-5 rounded-full ${i < pin.length ? 'bg-star' : 'bg-white border-2 border-gray-200'}`} />
            ))}
          </div>
          {err && <p className="text-center text-red-400 font-bold mb-2">{err}</p>}
          <div className="grid grid-cols-3 gap-3">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'].map((k) => (
              <button key={k} onClick={() => (k === 'ok' ? submit() : press(k))}
                className={`h-16 lg:h-20 rounded-2xl text-2xl lg:text-3xl font-extrabold shadow-sm active:scale-90 transition
                  ${k === 'ok' ? (pin.length >= 4 ? 'bg-star text-white' : 'bg-gray-100 text-gray-300')
                    : k === 'del' ? 'bg-white text-gray-400 text-xl' : 'bg-white text-ink'}`}>
                {k === 'del' ? '⌫' : k === 'ok' ? '✓' : k}
              </button>
            ))}
          </div>
          <label className="flex items-center justify-center gap-3 mt-5 text-base lg:text-lg font-bold text-gray-500">
            <input type="checkbox" className="w-6 h-6 accent-amber-500" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Ghi nhớ trên máy này ({remember ? '1 năm' : '12 giờ'})
          </label>
        </div>
      )}
    </div>
  );
}
