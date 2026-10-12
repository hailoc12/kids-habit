'use client';
// F14 — Bảng sticker in cho khung 21h ngoài phòng ngủ (iPad không vào phòng)
import { useEffect, useState } from 'react';

export default function PaperBoard() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { fetch('/api/today').then((r) => r.json()).then((j) => setItems(j.items.filter((i: any) => i.section === 'toi'))); }, []);
  return (
    <div className="max-w-xl mx-auto p-6 print:p-2">
      <h1 className="text-xl font-extrabold">🌙 Bảng sticker tối — {new Date().toLocaleDateString('vi-VN')}</h1>
      <p className="text-xs text-gray-400 mb-4">In ra, dán ngoài phòng ngủ. Con tự dán sticker sau khi làm — không cần iPad!</p>
      <div className="space-y-3">
        {items.map((i) => (
          <div key={i.instanceId} className="border-2 border-dashed border-amber-300 rounded-2xl p-4 flex items-center gap-4">
            <span className="text-3xl">{i.icon}</span>
            <span className="font-bold flex-1">{i.title}</span>
            <span className="w-10 h-10 border-2 border-gray-300 rounded-lg" />
          </div>
        ))}
      </div>
      <p className="text-[11px] text-gray-400 mt-4">Sáng mai bố nhập lại vào app (mục "nhập bù sticker" ở /parent → review).</p>
      <button className="btn-secondary mt-4 print:hidden" onClick={() => window.print()}>🖨️ In bảng này</button>
    </div>
  );
}
