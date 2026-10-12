'use client';
// Tủ Tư Duy — Wikipedia mini cho Bé: mỗi bài dạy một kiểu tư duy
// Cấu trúc bài cho bé 6 tuổi: Đây là gì? → Ví dụ ngay ở nhà mình → Thử ngay!
import { useCallback, useEffect, useState } from 'react';
import Shell from '@/components/Shell';

export default function LearnPage() {
  const [data, setData] = useState<any>(null);
  const [open, setOpen] = useState<any>(null);
  const [toast, setToast] = useState('');

  const load = useCallback(() => {
    fetch('/api/lessons').then((r) => r.json()).then(setData);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function readDone(lesson: any) {
    const res = await fetch('/api/lessons', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessonId: lesson.id }),
    });
    const j = await res.json();
    if (j.ok) {
      setToast(j.firstTime ? `🌟 Con vừa học một tư duy mới — nhận ${j.stars} sao!` : 'Con đã đọc bài này rồi — đọc lại thêm lần nữa cũng giỏi!');
      setTimeout(() => setToast(''), 3500);
    }
    load();
  }

  if (!data) return <Shell><div className="p-10 text-center text-gray-400 text-xl">Đang tải…</div></Shell>;
  const { lessons, progress } = data;

  return (
    <Shell>
      <div className="p-4 pt-6 lg:px-6 lg:pt-8">
        <div className="flex items-end justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl lg:text-4xl font-extrabold text-star-deep">🧠 Tủ Tư Duy</h1>
            <p className="text-sm lg:text-lg text-gray-500 mt-1">
              Con đã học <span className="font-extrabold text-star-deep">{progress.read}/{progress.total}</span> kiểu tư duy
            </p>
          </div>
          <div className="w-40 h-4 bg-amber-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-amber-300 to-star" style={{ width: `${progress.total ? Math.round((progress.read / progress.total) * 100) : 0}%` }} />
          </div>
        </div>
        {toast && <p className="bg-amber-50 text-star-deep rounded-2xl p-3 text-sm lg:text-base font-bold mt-3">{toast}</p>}

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
          {lessons.map((l: any) => (
            <button key={l.id} onClick={() => setOpen(l)}
              className="bg-white rounded-3xl p-4 shadow-sm text-left active:scale-95 transition relative">
              {l.readAt && <span className="absolute top-2 right-2 text-lg" aria-label="đã học">✅</span>}
              <span className="text-5xl">{l.icon}</span>
              <p className="font-extrabold text-base lg:text-xl mt-2 leading-tight">{l.title}</p>
              <p className="text-xs lg:text-sm text-gray-400 mt-1 line-clamp-2">{l.summary}</p>
              <p className="text-[10px] lg:text-xs text-star-deep font-bold mt-2">{l.category}</p>
            </button>
          ))}
        </div>
      </div>

      {/* bài đọc */}
      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 overflow-auto" onClick={() => setOpen(null)}>
          <div className="bg-white w-full lg:max-w-2xl lg:mx-auto lg:my-8 rounded-t-[2rem] lg:rounded-[2rem] p-6 lg:p-10" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-4">
              <span className="text-6xl">{open.icon}</span>
              <div>
                <p className="text-[11px] lg:text-xs font-bold text-star-deep uppercase tracking-wide">{open.category}</p>
                <h2 className="text-2xl lg:text-3xl font-extrabold leading-tight">{open.title}</h2>
              </div>
            </div>
            <p className="text-base lg:text-lg text-gray-500 italic mt-3">{open.summary}</p>

            <Section title="🤔 Đây là gì?">{open.intro}</Section>
            <Section title="🏠 Ví dụ ngay ở nhà mình">{open.example}</Section>
            <Section title="🚀 Thử ngay!">{open.try_it}</Section>

            <button className="btn-primary w-full mt-6 !text-lg" onClick={() => { readDone(open); setOpen(null); }}>
              ✅ Con hiểu rồi!
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="mt-6">
      <h3 className="font-extrabold text-lg lg:text-xl text-star-deep mb-1">{title}</h3>
      <p className="text-base lg:text-lg leading-relaxed whitespace-pre-line">{children}</p>
    </div>
  );
}
