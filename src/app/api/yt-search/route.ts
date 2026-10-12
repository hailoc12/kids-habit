import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';

/**
 * GET /api/yt-search?q=... — tìm kiếm YouTube server-side (KHÔNG dùng được embed
 * listType=search nữa — YouTube đã bỏ). Scrape trang results như browser, trả tối đa
 * 12 video (id, title, duration) để child chọn → embed /embed/<id> chuẩn.
 */
interface Vid { id: string; title: string; length: string }

function walk(o: any, out: Vid[]) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o)) { for (const v of o) walk(v, out); return; }
  if (o.videoRenderer) {
    const v = o.videoRenderer;
    const vid = v.videoId;
    const title = (v.title?.runs || []).map((r: any) => r.text).join('');
    const ts = v.lengthText || {};
    const length = ts.simpleText || (ts.runs || []).map((r: any) => r.text).join('');
    if (vid && title && /^\d{1,2}:\d{2}(:\d{2})?$/.test(length)) out.push({ id: vid, title, length });
    return;
  }
  for (const k of Object.keys(o)) walk(o[k], out);
}

export async function GET(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const q = (new URL(req.url).searchParams.get('q') || '').trim().slice(0, 80);
  if (!q) return NextResponse.json({ videos: [] });

  try {
    const res = await fetch('https://www.youtube.com/results?search_query=' + encodeURIComponent(q), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });
    const html = await res.text();
    const m = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
    if (!m) return NextResponse.json({ videos: [] });
    const out: Vid[] = [];
    walk(JSON.parse(m[1]), out);
    // bỏ shorts (<1 phút) và dài >65 phút; dedup
    const secs = (l: string) => l.split(':').reduce((s, x) => s * 60 + Number(x), 0);
    const seen = new Set<string>();
    const videos = out
      .filter((v) => { const s = secs(v.length); return s >= 60 && s <= 3900; })
      .filter((v) => (seen.has(v.id) ? false : (seen.add(v.id), true)))
      .slice(0, 12);
    return NextResponse.json({ videos });
  } catch {
    return NextResponse.json({ videos: [], error: 'không tìm được — thử lại nhé' }, { status: 200 });
  }
}
