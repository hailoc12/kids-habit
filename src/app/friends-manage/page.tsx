'use client';
// Quản lý bạn bè cho con — parent only (strategy-friends: consent 2 phía bố mẹ)
import { useCallback, useEffect, useState } from 'react';

const CHILD_OF = async (childId: number) => childId; // display resolve server-side qua snapshot

export default function FriendsManagePage() {
  const [data, setData] = useState<any>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    fetch('/api/friends', { cache: 'no-store' }).then((r) => r.json()).then((j) => { setData(j); setName(j.child?.name || ''); }).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  async function act(body: any, okMsg: string) {
    const res = await fetch('/api/friends', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const j = await res.json();
    setMsg(j.ok ? okMsg : j.error);
    if (j.ok) setCode('');
    load();
    setTimeout(() => setMsg(''), 4000);
    return j;
  }

  if (!data) return <div className="p-10 text-center text-gray-400">Đang tải…</div>;
  if (!data.child) return <div className="max-w-md mx-auto p-10 text-center text-gray-500">Gia đình chưa có tài khoản con.</div>;

  return (
    <div className="max-w-2xl mx-auto p-4 pb-20">
      <h1 className="text-xl lg:text-2xl font-extrabold mb-1">👥 Bạn bè của {data.child.name}</h1>
      <p className="text-sm text-gray-500 mb-4">Kết bạn giữa các con — bố mẹ hai bên cùng duyệt. Chỉ chia sẻ số liệu tổng hợp (sao, việc đã làm, danh hiệu) — không ảnh hay nội dung riêng.</p>
      {msg && <p className="bg-amber-50 text-star-deep rounded-2xl p-3 text-sm font-bold mb-3">{msg}</p>}

      {/* MÃ NHÀ MÌNH */}
      <div className="bg-blue-50 rounded-3xl p-4 mb-4">
        <p className="font-bold text-blue-800 text-sm mb-1">Mã nhà mình (đưa cho bố mẹ gia đình bạn):</p>
        <div className="flex items-center gap-3">
          <span className="text-3xl font-extrabold tracking-widest text-blue-900 bg-white rounded-2xl px-4 py-2 shadow-sm">{data.shareCode}</span>
          <button className="text-xs font-bold text-blue-600 underline" onClick={() => navigator.clipboard?.writeText(data.shareCode)}>copy</button>
        </div>
      </div>

      {/* GỬI LỜI MỜI */}
      <div className="bg-white rounded-3xl p-4 shadow-sm mb-4">
        <p className="font-bold text-sm mb-2">Gửi lời mời kết bạn (nhập mã nhà bạn ấy):</p>
        <div className="flex gap-2">
          <input className="input flex-1 uppercase tracking-widest" value={code} onChange={(e) => setCode(e.target.value)} placeholder="VD: K7M2QX" maxLength={6} />
          <button className="btn-primary" disabled={code.length < 6} onClick={() => act({ action: 'send-request', code }, 'Đã gửi lời mời — chờ nhà bạn duyệt')}>📨 Gửi</button>
        </div>
        {data.outgoing?.length > 0 && (
          <p className="text-xs text-gray-400 mt-2">Đang chờ duyệt: {data.outgoing.length} lời mời</p>
        )}
      </div>

      {/* LỜI MỜI ĐẾN */}
      {data.incoming?.length > 0 && (
        <div className="bg-amber-50 rounded-3xl p-4 mb-4">
          <p className="font-bold text-sm mb-2">Lời mời đến con ({data.incoming.length}):</p>
          <div className="space-y-2">
            {data.incoming.map((r: any) => (
              <div key={r.id} className="flex items-center gap-2">
                <span className="flex-1 text-sm font-bold">Nhà bạn #{r.fromChild}</span>
                <button className="text-xs font-bold bg-green-500 text-white rounded-full px-3 py-1.5" onClick={() => act({ action: 'accept', id: r.id }, 'Đã kết bạn!')}>duyệt</button>
                <button className="text-xs font-bold bg-gray-300 rounded-full px-3 py-1.5" onClick={() => act({ action: 'reject', id: r.id }, 'Đã từ chối')}>không</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DANH SÁCH BẠN */}
      {data.friends?.length > 0 && (
        <div className="bg-white rounded-3xl p-4 shadow-sm mb-4">
          <p className="font-bold text-sm mb-2">Bạn của con ({data.friends.length}):</p>
          <div className="space-y-2">
            {data.friends.map((f: any) => (
              <div key={f.id} className="flex items-center gap-3 border-b last:border-0 pb-2 last:pb-0">
                <span className="text-2xl">{f.snapshot.avatar}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{f.snapshot.name}</p>
                  <p className="text-[11px] text-gray-400">hôm nay ⭐{f.snapshot.starsToday} · tuần ⭐{f.snapshot.starsWeek}</p>
                </div>
                <button className="text-xs text-gray-400 underline" onClick={() => { if (confirm('Hủy kết bạn này?')) act({ action: 'unfriend', id: f.id }, 'Đã hủy kết bạn'); }}>hủy</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TÊN HIỂN THỊ */}
      <div className="bg-white rounded-3xl p-4 shadow-sm">
        <p className="font-bold text-sm mb-1">Tên hiển thị với bạn bè:</p>
        <p className="text-xs text-gray-400 mb-2">Mặc định "Bé {data.child.name} nhà …" — đặt tên khác nếu không muốn lộ tên thật.</p>
        <div className="flex gap-2">
          <input className="input flex-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Mèo Con" maxLength={30} />
          <button className="btn-secondary" onClick={() => act({ action: 'set-display', name }, 'Đã lưu tên hiển thị')}>💾</button>
        </div>
      </div>

      <a href="/parent" className="block text-center text-sm text-gray-400 mt-6">← Khu vực bố mẹ</a>
    </div>
  );
}
