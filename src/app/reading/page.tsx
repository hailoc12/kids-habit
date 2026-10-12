'use client';
// F08 — Nhật ký đọc sách (nhóm A: KHÔNG sao — chỉ kỷ niệm)
import { useCallback, useEffect, useRef, useState } from 'react';
import Shell from '@/components/Shell';

export default function ReadingPage() {
  const [items, setItems] = useState<any[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [enjoyed, setEnjoyed] = useState(true);
  const [photo, setPhoto] = useState<string | null>(null);
  const [books, setBooks] = useState<any[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/reading');
    const j = await res.json();
    setItems(j.items);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch('/api/books', { cache: 'no-store' }).then((r) => r.json()).then((j) => setBooks(j.books || [])).catch(() => {});
  }, []);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setPhoto(r.result as string);
    r.readAsDataURL(f);
  }

  async function add() {
    if (!title) return;
    await fetch('/api/reading', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, coverPhoto: photo, enjoyed }),
    });
    setAdding(false); setTitle(''); setPhoto(null); setEnjoyed(true);
    load();
  }

  return (
    <Shell>
      <div className="p-4 pt-6">
        <h1 className="text-2xl font-extrabold text-star-deep">📚 Tủ sách của con</h1>
        <p className="text-sm text-gray-500 mb-4">
          {items ? `Con đã đọc ${items.length} cuốn. Sách là niềm vui của riêng con.` : 'Đang tải…'}
        </p>

        {/* Thư viện sách trong app — đọc ngay, chữ to, tự lưu vị trí */}
        {books.length > 0 && (
          <div className="mb-6">
            <h2 className="font-extrabold text-lg text-star-deep mb-1">📖 Sách đọc ngay trong app</h2>
            <p className="text-xs text-gray-400 mb-2">Chạm để mở — app nhớ con đọc tới đâu. Đọc chăm có sao (tối đa 3⭐/ngày), đọc XONG cả cuốn +5⭐!</p>
            <div className="grid grid-cols-3 lg:grid-cols-5 gap-2">
              {books.map((b: any) => (
                <a key={b.id} href={`/read?id=${b.id}`}
                  className="bg-white rounded-2xl p-3 shadow-sm active:scale-95 transition relative overflow-hidden">
                  {b.pct > 0 && (
                    <span className="absolute bottom-0 left-0 right-0 h-1.5 bg-amber-100">
                      <span className="block h-full bg-star" style={{ width: `${b.pct}%` }} />
                    </span>
                  )}
                  {b.finished_at && <span className="absolute top-1 right-1 text-sm">🏆</span>}
                  <div className="w-full aspect-[3/4] rounded-lg bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center p-2 mb-1.5 overflow-hidden">
                    {b.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.coverUrl} alt={b.title} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <span className="text-2xl">{b.finished_at ? '🏆' : '📖'}</span>
                    )}
                  </div>
                  <p className="text-[11px] font-bold leading-tight line-clamp-2">{b.title}</p>
                  <p className="text-[9px] text-gray-400 truncate">{b.author}</p>
                </a>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-3 gap-3">
          {(items || []).map((b: any) => (
            <div key={b.id} className="bg-white rounded-2xl overflow-hidden shadow-sm">
              {b.coverUrl ? (// eslint-disable-next-line @next/next/no-img-element
                <img src={b.coverUrl} alt={b.title} className="w-full h-32 object-cover" />) : (
                <div className="w-full h-32 bg-amber-100 flex items-center justify-center text-4xl">📖</div>)}
              <p className="p-2 text-xs font-bold leading-tight">{b.title} {b.enjoyed ? '⭐' : ''}</p>
            </div>
          ))}
        </div>
        <button className="btn-secondary w-full mt-6" onClick={() => setAdding(true)}>📖 Hôm nay con đọc gì?</button>
      </div>

      {adding && (
        <div className="fixed inset-0 bg-black/40 flex items-end" onClick={() => setAdding(false)}>
          <div className="bg-white w-full rounded-t-3xl p-5" onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-bold mb-3">Cuốn sách con vừa đọc</p>
            <input className="input mb-3" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tên cuốn sách" />
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="" className="w-full h-40 object-cover rounded-2xl mb-3" />
            ) : (
              <button className="btn-secondary w-full mb-3" onClick={() => fileRef.current?.click()}>📷 Chụp ảnh bìa sách</button>
            )}
            <label className="flex items-center gap-3 mb-4 text-lg">
              <input type="checkbox" className="w-6 h-6 accent-amber-500" checked={enjoyed} onChange={(e) => setEnjoyed(e.target.checked)} />
              Con thấy cuốn này hay ⭐
            </label>
            <button className="btn-primary w-full" onClick={add} disabled={!title}>Làm kỷ niệm</button>
          </div>
        </div>
      )}
    </Shell>
  );
}
