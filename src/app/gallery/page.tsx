'use client';
// Bộ sưu tập vẽ của con — theo thời gian (xem tự do, không khóa)
import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';

export default function GalleryPage() {
  const [items, setItems] = useState<any[] | null>(null);
  const [full, setFull] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/drawings').then((r) => r.json()).then((j) => setItems(j.items || []));
  }, []);

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
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-2xl lg:text-4xl font-extrabold text-star-deep">🖼️ Bộ sưu tập của con</h1>
          <a href="/draw" className="btn-secondary !py-2 !text-sm">🎨 Vẽ tiếp</a>
        </div>
        <p className="text-sm lg:text-lg text-gray-500 mt-1 mb-4">
          {items === null ? 'Đang tải…' : `Con đã vẽ được ${items.length} bức!`}
        </p>

        {items !== null && items.length === 0 && (
          <div className="bg-white rounded-3xl p-8 text-center text-gray-400 text-lg">
            Chưa có bức vẽ nào — tờ giấy đầu tiên đang chờ con ở Xưởng vẽ! 🎨
          </div>
        )}

        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.date}>
              <h2 className="text-sm lg:text-lg font-extrabold text-gray-400 mb-2">📆 {g.date}</h2>
              <div className="grid grid-cols-3 lg:grid-cols-5 gap-2 lg:gap-3">
                {g.items.map((it: any) => (
                  <button key={it.id} onClick={() => setFull(it.url)} className="bg-white rounded-2xl overflow-hidden shadow-sm active:scale-95 transition">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={it.url} alt="bức vẽ của con" className="w-full aspect-square object-contain bg-white" />
                    {it.title && <p className="p-1.5 text-[11px] lg:text-xs text-gray-400 truncate">{it.icon} sau việc: {it.title}</p>}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {full && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6" onClick={() => setFull(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={full} alt="bức vẽ của con" className="max-w-full max-h-full rounded-2xl shadow-2xl" />
        </div>
      )}
    </Shell>
  );
}
