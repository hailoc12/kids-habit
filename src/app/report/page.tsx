'use client';
// F15 — Báo cáo tuần (đọc cùng nhau tối CN)
import { useEffect, useState } from 'react';

export default function ReportPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetch('/api/report').then((r) => r.json()).then(setData); }, []);
  if (!data) return <div className="p-10 text-center text-gray-400">Đang tải…</div>;
  return (
    <div className="max-w-2xl mx-auto p-5">
      <h1 className="text-xl font-extrabold">📊 Báo cáo tuần {data.monday} → {data.sunday}</h1>
      <div className="grid grid-cols-3 gap-2 my-4">
        <div className="bg-white rounded-2xl p-4 text-center shadow-sm"><p className="text-3xl font-extrabold text-star-deep">{data.stars}</p><p className="text-xs text-gray-400">sao tuần này</p></div>
        <div className="bg-white rounded-2xl p-4 text-center shadow-sm"><p className="text-3xl font-extrabold text-star-deep">{data.streak}</p><p className="text-xs text-gray-400">chuỗi ngày tốt</p></div>
        <div className="bg-white rounded-2xl p-4 text-center shadow-sm"><p className="text-3xl font-extrabold text-star-deep">{(data.graduated || []).length}</p><p className="text-xs text-gray-400">việc tốt nghiệp 🎓</p></div>
      </div>

      <h2 className="font-bold mb-2 text-sm">Ảnh tuần này</h2>
      <div className="grid grid-cols-4 gap-2 mb-6">
        {data.photos.slice(0, 12).map((p: any, i: number) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={p.url} alt={p.title} className="w-full h-24 object-cover rounded-xl" />
        ))}
        {data.photos.length === 0 && <p className="text-sm text-gray-400 col-span-4">Chưa có ảnh — tuần sau sẽ nhiều hơn!</p>}
      </div>

      <h2 className="font-bold mb-2 text-sm">Từng việc</h2>
      <div className="space-y-1 mb-6">
        {data.perTask.map((t: any) => {
          const pct = t.done ? Math.round((t.on_time / t.done) * 100) : 0;
          return (
            <div key={t.title} className="bg-white rounded-xl px-3 py-2 flex items-center gap-2 text-sm shadow-sm">
              <span>{t.icon}</span><span className="flex-1 truncate">{t.title}</span>
              <span className="text-xs text-gray-400">{t.done} lần</span>
              <div className="w-20 h-2 bg-amber-100 rounded-full overflow-hidden"><div className="h-full bg-star" style={{ width: `${pct}%` }} /></div>
              <span className="text-xs font-bold text-star-deep w-9 text-right">{t.done ? `${pct}%` : '—'}</span>
            </div>
          );
        })}
      </div>

      {(data.graduated || []).length > 0 && (
        <div className="bg-amber-50 rounded-2xl p-4 mb-6 text-sm">
          <p className="font-bold mb-1">🎓 Đã tốt nghiệp khỏi hệ sao:</p>
          {data.graduated.map((g: any) => <p key={g.title}>· {g.title} — con làm chủ rồi!</p>)}
        </div>
      )}
      <p className="text-xs text-gray-400 text-center">In trang này và đọc cùng nhau tối Chủ nhật nhé.</p>
    </div>
  );
}
