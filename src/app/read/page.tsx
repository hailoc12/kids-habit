'use client';
// Trình đọc EPUB (epub.js) — chữ to cho Bé, lưu vị trí, thưởng sao có trần
import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Shell from '@/components/Shell';

export default function ReadPage() {
  return (
    <Suspense fallback={<Shell><div className="p-10 text-center text-gray-400">Đang mở sách…</div></Shell>}>
      <Reader />
    </Suspense>
  );
}

function Reader() {
  const router = useRouter();
  const params = useSearchParams();
  const bookId = params.get('id');
  const areaRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<any>(null);
  const minutesRef = useRef(0);           // phút đọc phiên này (visibility-aware)
  const pctRef = useRef(0);
  const cfiRef = useRef('');
  const [title, setTitle] = useState('');
  const [pct, setPct] = useState(0);
  const [bookStars, setBookStars] = useState(0);
  const [toast, setToast] = useState('');
  const [toc, setToc] = useState<any[] | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  function enterFs() {
    setFullscreen(true);
    document.documentElement.requestFullscreen?.().catch(() => {});
    // epub.js cần resize lại sau khi đổi kích thước container
    setTimeout(() => renditionRef.current?.resize(), 100);
  }
  function exitFs() {
    setFullscreen(false);
    document.exitFullscreen?.().catch(() => {});
    setTimeout(() => renditionRef.current?.resize(), 100);
  }

  // đếm phút chỉ khi tab hiện
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') minutesRef.current += 1 / 6; // mỗi tick 10s = 1/6 phút
    }, 10000);
    return () => clearInterval(t);
  }, []);

  // lưu tiến độ mỗi 30s + khi rời trang
  async function saveProgress(showToast = false) {
    if (!bookId) return;
    const res = await fetch('/api/books', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'progress', bookId: Number(bookId), cfi: cfiRef.current, pct: pctRef.current, minutes: minutesRef.current }),
    });
    const j = await res.json();
    if (j.ok && showToast && j.stars > 0) {
      setToast(j.finishedNow ? `🏆 Con đọc XONG cả cuốn — nhận ${j.stars} sao!` : `⭐ Con nhận thêm ${j.stars} sao vì chăm đọc!`);
      setTimeout(() => setToast(''), 3500);
    }
  }
  useEffect(() => {
    const iv = setInterval(() => saveProgress(false), 30000);
    const onHide = () => { if (document.visibilityState === 'hidden') saveProgress(false); };
    document.addEventListener('visibilitychange', onHide);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', onHide); saveProgress(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  // khởi tạo epub.js
  useEffect(() => {
    if (!bookId || !areaRef.current) return;
    let cancelled = false;
    (async () => {
      const ePub = (await import('epubjs')).default;
      // load binary trực tiếp (ArrayBuffer) — không để epub.js tự fetch URL theo đường dẫn tương đối (gây 404 noise)
      const dataRes = await fetch(`/api/books/file?id=${bookId}`);
      const buf = await dataRes.arrayBuffer();
      const book = ePub(buf as ArrayBuffer);
      const rendition = book.renderTo(areaRef.current as HTMLElement, {
        width: '100%', height: '100%', flow: 'paginated', spread: 'none',
      } as any);
      rendition.themes.default({ 'body': { 'font-size': '22px !important', 'line-height': '1.8 !important' } });
      renditionRef.current = rendition;
      const meta = await book.loaded.metadata;
      if (!cancelled) setTitle((meta as any).title || '');
      await book.ready;
      // mục lục
      const nav = await book.loaded.navigation;
      if (!cancelled) setToc(nav.toc);
      // resume từ tiến độ
      const r = await fetch('/api/books', { cache: 'no-store' }).then((x) => x.json());
      const prog = (r.books || []).find((b: any) => b.id === Number(bookId));
      setBookStars(prog?.star_reward || 0);
      const startCfi = prog?.cfi || undefined;
      await rendition.display(startCfi);
      // sự kiện lật trang: chạm trái/phải
      rendition.on('relocated', (loc: any) => {
        cfiRef.current = loc.start.cfi;
        if (loc.start.percentage) { pctRef.current = Math.round(loc.start.percentage * 100); setPct(pctRef.current); }
      });
    })().catch(() => setToast('Không mở được sách — báo bố mẹ nhé'));
    return () => { cancelled = true; try { renditionRef.current?.destroy(); } catch {} };
  }, [bookId]);

  return (
    <Shell>
      <div className="lg:px-6 pt-4">
        <div className="flex items-center gap-2 px-4 lg:px-0">
          <button className="btn-secondary !py-2 !px-4 !text-sm" onClick={() => { saveProgress(false); router.push('/reading'); }}>← Kệ sách</button>
          <div className="flex-1 min-w-0">
            <p className="font-extrabold text-sm lg:text-lg truncate">{title || 'Đang mở…'}</p>
          </div>
          <span className="text-xs lg:text-sm font-bold text-star-deep">{pct}%</span>
          {bookStars > 0 && <span className="text-[10px] lg:text-xs font-bold text-star-deep bg-star/10 rounded-full px-2 py-0.5">⭐ {Math.floor((pct / 100) * bookStars)}/{bookStars}</span>}
          <button className="btn-secondary !py-2 !px-4 !text-sm" onClick={() => setToc(toc ? null : (toc || []))}>☰</button>
          <button className="btn-secondary !py-2 !px-4 !text-sm" onClick={enterFs}>⛶</button>
          <button className="btn-primary !py-2 !px-4 !text-sm" onClick={() => saveProgress(true)}>💾 Lưu & nhận sao</button>
        </div>
        {toast && <p className="mx-4 lg:mx-0 mt-2 bg-amber-50 text-star-deep rounded-2xl p-3 font-bold text-sm">{toast}</p>}
        {toc && (
          <div className="mx-4 lg:mx-0 mt-2 bg-white rounded-2xl p-2 shadow-sm max-h-48 overflow-auto">
            {(toc as any[]).map((t: any, i: number) => (
              <button key={i} className="block w-full text-left text-sm p-2 hover:bg-amber-50 rounded-lg font-semibold"
                onClick={() => { renditionRef.current?.display(t.href); setToc(null); }}>{t.label.trim()}</button>
            ))}
          </div>
        )}
        {/* vùng đọc — chạm 2 bên để lật trang; ⛶ mở fullscreen toàn màn */}
        <div className={fullscreen
          ? 'fixed inset-0 z-[60] bg-white'
          : 'relative mx-4 lg:mx-0 mt-2 bg-white rounded-[2rem] shadow-md overflow-hidden h-[68vh] lg:h-[74vh]'}>
          <div ref={areaRef} className="w-full h-full" />
          <div className="absolute left-0 top-0 bottom-0 w-1/4" onClick={() => renditionRef.current?.prev()} aria-label="trang trước" />
          <div className="absolute right-0 top-0 bottom-0 w-1/4" onClick={() => renditionRef.current?.next()} aria-label="trang sau" />
          {fullscreen && (
            <div className="absolute top-2 right-2 flex gap-2 z-10">
              <button className="w-11 h-11 rounded-full bg-white/90 shadow flex items-center justify-center text-lg" onClick={() => { saveProgress(false); exitFs(); }} aria-label="thoát fullscreen">✕</button>
            </div>
          )}
          {fullscreen && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-3 z-10">
              <button className="w-14 h-14 rounded-full bg-white/90 shadow flex items-center justify-center text-2xl" onClick={() => renditionRef.current?.prev()}>◀</button>
              <button className="w-14 h-14 rounded-full bg-white/90 shadow flex items-center justify-center text-2xl" onClick={() => renditionRef.current?.next()}>▶</button>
            </div>
          )}
        </div>
        {!fullscreen && (
          <div className="flex justify-center gap-3 mt-3">
            <button className="btn-secondary !py-2" onClick={() => renditionRef.current?.prev()}>◀</button>
            <button className="btn-secondary !py-2" onClick={() => renditionRef.current?.next()}>▶</button>
          </div>
        )}
      </div>
    </Shell>
  );
}
