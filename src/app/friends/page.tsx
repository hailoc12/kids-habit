'use client';
// 👥 Bạn bè — snapshot aggregate của bạn cùng thi đua (không xếp hạng, mô tả hành vi)
// Chỉ con THẤY: tên hiển thị, sao hôm nay/tuần, X/13, streak, danh hiệu. Không nội dung nào khác.
import { useCallback, useEffect, useState } from 'react';
import Shell from '@/components/Shell';

export default function FriendsPage() {
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    fetch('/api/friends', { cache: 'no-store' }).then((r) => r.json()).then(setData).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  async function sendNote(toChildId: number, text: string) {
    const res = await fetch('/api/friends', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send-note', code: toChildId, name: text }),
    });
    const j = await res.json();
    if (!j.ok) setMsg(j.error);
    load();
    setTimeout(() => setMsg(''), 3000);
  }

  if (!data) return <Shell><div className="p-10 text-center text-gray-400 text-xl">Đang tải…</div></Shell>;
  const friends: any[] = data.friends || [];

  return (
    <Shell>
      <div className="p-4 pt-6 lg:px-6 lg:pt-8">
        <h1 className="text-2xl lg:text-4xl font-extrabold text-star-deep">👥 Bạn bè của con</h1>
        <p className="text-sm lg:text-lg text-gray-500 mt-1 mb-4">Cùng nhau chăm nào — mỗi bạn mỗi ngày một tiến bộ!</p>
        {msg && <p className="bg-amber-50 text-star-deep rounded-2xl p-3 font-bold text-sm mb-3">{msg}</p>}

        {friends.length === 0 ? (
          <div className="bg-white rounded-[2rem] p-8 text-center shadow-sm">
            <div className="text-7xl mb-3">🤝</div>
            <p className="text-lg lg:text-xl font-extrabold text-star-deep">Chưa có bạn nào — bố mẹ kết bạn giúp con nhé!</p>
            <p className="text-sm text-gray-400 mt-2">Khi có bạn, con sẽ thấy bạn chăm chỉ thế nào mỗi ngày 💛</p>
          </div>
        ) : (
          <div className="space-y-3">
            {friends.map((f: any) => {
              const notes = (data.notes || []).filter((n: any) => n.peerId === f.childId).slice(0, 3);
              return (
              <div key={f.childId} className="bg-white rounded-[2rem] p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{f.avatar}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-lg truncate">{f.name}</p>
                    <p className="text-xs text-gray-400">hôm nay làm được {f.doneToday}/{f.totalToday} việc{f.streak > 0 ? ` · chuỗi ${f.streak} ngày ✨` : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-extrabold text-star-deep">⭐ {f.starsToday}</p>
                    <p className="text-[11px] text-gray-400">tuần này {f.starsWeek}⭐</p>
                  </div>
                </div>
                {f.badges?.length > 0 && (
                  <div className="flex gap-2 flex-wrap mt-2">
                    {f.badges.map((b: string) => (
                      <span key={b} className="bg-amber-50 rounded-full px-3 py-1 text-xs font-bold text-star-deep">{b}</span>
                    ))}
                  </div>
                )}
                {/* tin nhắn mẫu 2 chiều với bạn này */}
                <div className="mt-3 pt-3 border-t border-amber-50">
                  <div className="flex gap-2 flex-wrap">
                    {(data.noteOptions || []).map((t: string) => (
                      <button key={t} onClick={() => sendNote(f.childId, t)}
                        className="bg-amber-50 rounded-full px-3 py-1.5 text-xs font-bold text-star-deep active:scale-95 transition">{t}</button>
                    ))}
                  </div>
                  {notes.length > 0 && (
                    <div className="space-y-1 mt-2">
                      {notes.map((n: any) => (
                        <p key={n.id} className={`text-xs font-bold ${n.fromMe ? 'text-gray-400 text-right' : 'text-star-deep'}`}>
                          {n.fromMe ? `con: ${n.text}` : `${n.text}`}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              );
            })}
            <p className="text-center text-xs text-gray-400 mt-4">
              Bạn bè cùng tuổi cùng cố gắng — con làm đều đặn là tuyệt vời rồi! 💛
            </p>
          </div>
        )}
      </div>
    </Shell>
  );
}
