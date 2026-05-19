import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register', '/', '/superadmin'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.get('has_session')?.value === '1';

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    if (hasSession && (pathname === '/login' || pathname === '/register')) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
