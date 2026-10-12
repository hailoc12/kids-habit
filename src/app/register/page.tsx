'use client';
// Đăng ký gia đình mới — tạo family + bố mẹ + bé đầu tiên, seed nội dung mặc định
import { useState } from 'react';
import Link from 'next/link';

export default function RegisterPage() {
  const [familyName, setFamilyName] = useState('');
  const [parentName, setParentName] = useState('');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [childName, setChildName] = useState('');
  const [childPin, setChildPin] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);

  async function submit() {
    setBusy(true);
    const res = await fetch('/api/auth', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'register', familyName, parentName, username, pin, childName, childPin }),
    });
    const j = await res.json();
    setBusy(false);
    if (j.ok) setOk(true);
    else { setErr(j.error); setTimeout(() => setErr(''), 4000); }
  }

  if (ok) {
    return (
      <div className="min-h-dvh bg-gradient-to-b from-amber-50 to-orange-50 flex flex-col items-center justify-center p-6">
        <div className="text-7xl mb-3">🎉</div>
        <h1 className="text-2xl lg:text-3xl font-extrabold text-star-deep">Gia đình {familyName} đã sẵn sàng!</h1>
        <p className="text-gray-500 font-bold mt-2 text-center">Checklist và cửa hàng mặc định đã được tạo.<br />Bé vào bằng tài khoản <b>{username}_be</b> + PIN của bé.</p>
        <Link href="/" className="btn-primary w-full max-w-sm mt-6 block text-center">Vào app</Link>
      </div>
    );
  }

  const canSubmit = familyName && parentName && /^[a-z0-9_]{3,20}$/.test(username) && /^\d{6,8}$/.test(pin) && childName && /^\d{4,8}$/.test(childPin);
  return (
    <div className="min-h-dvh bg-gradient-to-b from-amber-50 to-orange-50 flex flex-col items-center justify-center p-6">
      <div className="text-5xl mb-1">👨‍👩‍👧</div>
      <h1 className="text-2xl font-extrabold text-star-deep">Đăng ký gia đình mới</h1>
      <div className="w-full max-w-sm mt-4 space-y-2">
        <input className="input" placeholder="Tên gia đình (vd: Nhà Bin)" value={familyName} onChange={(e) => setFamilyName(e.target.value)} maxLength={40} />
        <input className="input" placeholder="Tên bố/mẹ (vd: Mẹ Hoa)" value={parentName} onChange={(e) => setParentName(e.target.value)} maxLength={30} />
        <input className="input" placeholder="Tên đăng nhập của bố/mẹ (a-z, số, _)" value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} autoCapitalize="none" />
        <input className="input" placeholder="PIN bố/mẹ (6-8 số)" value={pin} inputMode="numeric"
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} />
        <input className="input" placeholder="Tên của bé" value={childName} onChange={(e) => setChildName(e.target.value)} maxLength={30} />
        <input className="input" placeholder="PIN của bé (4-8 số)" value={childPin} inputMode="numeric"
          onChange={(e) => setChildPin(e.target.value.replace(/\D/g, '').slice(0, 8))} />
        {err && <p className="text-red-400 font-bold text-sm text-center">{err}</p>}
        <button className="btn-primary w-full" disabled={!canSubmit || busy} onClick={submit}>
          {busy ? 'Đang tạo…' : '🎉 Tạo gia đình'}
        </button>
        <Link href="/login" className="block text-center text-sm font-bold text-gray-400 mt-2">đã có tài khoản → đăng nhập</Link>
      </div>
    </div>
  );
}
