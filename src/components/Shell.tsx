'use client';
// Shell điều hướng — mobile: bottom tabs · iPad landscape (lg+): LEFT SIDEBAR + user chip / switch user
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import SessionGate from './SessionGate';

const TABS = [
  { href: '/', label: 'Hôm Nay', icon: '🏠' },
  { href: '/pets', label: 'Thú Cưng', icon: '🐣' },
  { href: '/missions', label: 'Nhiệm Vụ', icon: '💪' },
  { href: '/okr', label: 'Vươn Xa', icon: '🧭' },
  { href: '/friends', label: 'Bạn Bè', icon: '👥' },
  { href: '/pomodoro', label: 'Chăm Chỉ', icon: '🐢' },
  { href: '/fun', label: 'Giải Trí', icon: '🎬' },
  { href: '/draw', label: 'Vẽ', icon: '🎨' },
  { href: '/piano', label: 'Đàn Piano', icon: '🎹' },
  { href: '/camera', label: 'Xem Nhà', icon: '📷' },
  { href: '/wishlist', label: 'Mục Tiêu', icon: '🎯' },
  { href: '/reading', label: 'Đọc Sách', icon: '📚' },
  { href: '/journal', label: 'Nhật Ký', icon: '🌙' },
  { href: '/learn', label: 'Tư Duy', icon: '🧠' },
  { href: '/calendar', label: 'Lịch', icon: '📅' },
  { href: '/ideas', label: 'Góp Ý', icon: '📣' },
];

async function switchUser() {
  await fetch('/api/auth', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'logout' }),
  });
  window.location.href = '/login';
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [me, setMe] = useState<{ avatar: string; name: string; role: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    fetch('/api/auth', { cache: 'no-store' }).then((r) => r.json()).then((j) => setMe(j.me)).catch(() => {});
  }, []);

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <div className="min-h-dvh lg:flex">
      {/* iPad landscape: sidebar trái cố định */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 h-dvh sticky top-0 bg-amber-50/95 backdrop-blur border-r border-amber-100 p-3 gap-1 z-40">
        <Link href="/" className="flex items-center gap-2 px-3 py-4 select-none">
          <span className="text-4xl animate-[wiggle_3s_ease-in-out_infinite]">⭐</span>
          <span className="text-2xl font-extrabold text-star-deep leading-none">Kid Habits</span>
        </Link>
        <nav className="flex flex-col gap-1.5 mt-2">
          {TABS.map((t) => {
            const active = isActive(t.href);
            const cls = active
              ? 'bg-star text-white shadow-md'
              : 'bg-white text-gray-500 hover:bg-amber-100';
            return (
              <Link key={t.href} href={t.href}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-lg font-bold transition active:scale-95 ${cls}`}>
                <span className="text-2xl w-8 text-center">{t.icon}</span>
                {t.label}
              </Link>
            );
          })}
        </nav>
        {/* user nhỏ gọn dưới sidebar (bấm avatar góc phải trên để mở menu đầy đủ) */}
        <div className="mt-auto pb-2">
          {me && (
            <div className="flex items-center gap-2 px-3 py-2 bg-white/70 rounded-2xl">
              <span className="text-2xl">{me.avatar}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-extrabold truncate">{me.name}</p>
                <p className="text-[10px] text-gray-400 font-bold">{['parent','system_admin'].includes(me.role) ? 'bố mẹ' : 'người chơi'}</p>
              </div>
            </div>
          )}
        </div>
        <SessionGate />
      </aside>

      {/* Nội dung: mobile full-width · iPad đẩy phải khỏi sidebar */}
      <div className="flex-1 min-w-0">
        <div className="max-w-xl mx-auto pb-24 lg:max-w-6xl lg:pb-8">{children}</div>
      </div>

      {/* AVATAR GÓC PHẢI TRÊN — to, dễ thấy dễ bấm (mọi kích thước màn hình) → menu Đổi/Đăng xuất */}
      {me && (
        <div className="fixed top-3 right-3 z-50">
          <button onClick={() => setMenuOpen((v) => !v)} aria-label="tài khoản"
            className="w-14 h-14 lg:w-16 lg:h-16 rounded-full bg-white shadow-lg border-2 border-amber-100 flex items-center justify-center text-3xl lg:text-4xl active:scale-90 transition">
            {me.avatar}
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-3xl shadow-xl border border-amber-100 p-3 z-50">
                <p className="font-extrabold text-sm px-2 pt-1">{me.name}</p>
                <p className="text-[11px] text-gray-400 font-bold px-2 mb-2">{['parent','system_admin'].includes(me.role) ? 'bố mẹ' : 'người chơi'}</p>
                {['parent','system_admin'].includes(me.role) && (
                  <Link href="/admin" onClick={() => setMenuOpen(false)}
                    className="block w-full text-left text-sm font-bold text-blue-600 hover:bg-blue-50 rounded-2xl px-3 py-2.5">⚙️ Admin</Link>
                )}
                <Link href="/parent" onClick={() => setMenuOpen(false)}
                  className="block w-full text-left text-sm font-bold text-gray-600 hover:bg-amber-50 rounded-2xl px-3 py-2.5">🔍 Duyệt ngày</Link>
                <button onClick={switchUser}
                  className="w-full text-left text-sm font-bold text-gray-600 hover:bg-amber-50 rounded-2xl px-3 py-2.5">🔄 Đổi người / Đăng xuất</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Mobile: bottom tabs (giữ nguyên) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-amber-100 z-40">
        <div className="max-w-xl mx-auto grid grid-cols-6">
          {TABS.map((t) => {
            const active = isActive(t.href);
            return (
              <Link key={t.href} href={t.href}
                className={`flex flex-col items-center py-2 text-[11px] font-bold ${active ? 'text-star-deep' : 'text-gray-400'}`}>
                <span className="text-2xl">{t.icon}</span>
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
