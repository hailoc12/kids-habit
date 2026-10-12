import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// (1) Ép đăng nhập: trang không có session cookie → /login (API tự trả 401)
// (2) API động — cấm browser cache (bug Safari cũ: tick xong GET lấy JSON cũ)
const PUBLIC_PATHS = ['/login', '/register', '/api/auth', '/sw.js', '/manifest.webmanifest', '/icon-'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/api/')) {
    const res = NextResponse.next();
    res.headers.set('Cache-Control', 'no-store, max-age=0');
    return res;
  }

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const hasSession = req.cookies.has('kh_session');
  if (!hasSession && !pathname.startsWith('/_next') && !pathname.includes('.')) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
