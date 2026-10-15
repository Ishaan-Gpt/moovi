import { NextResponse, type NextRequest } from 'next/server';

/**
 * Pages need a session: without the cookie, go and sign in (and come back). The session itself is checked against
 * the graph by each page and API; this only spares a render for visitors who are clearly signed out.
 */
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  // the door, the API (each route checks the session itself), and public files (the mark, the icon)
  if (pathname.startsWith('/auth') || pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname.startsWith('/brand/') || pathname === '/icon.svg') return NextResponse.next();
  if (!req.cookies.get('moovi_session')) {
    const url = req.nextUrl.clone();
    url.pathname = '/auth';
    url.search = `?next=${encodeURIComponent(`/studio${pathname === '/' ? '' : pathname}${search}`)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
