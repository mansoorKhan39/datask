import { NextResponse, type NextRequest } from 'next/server'

// Cheap gate: the real check happens on the server for every API call.
export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has('datask_token')
  const { pathname } = req.nextUrl
  const isAuthPage = pathname === '/login' || pathname === '/register'
  if (pathname.startsWith('/app') && !hasSession) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }
  if (isAuthPage && hasSession) {
    const url = req.nextUrl.clone()
    url.pathname = '/app'
    url.search = ''
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = { matcher: ['/app/:path*', '/login', '/register'] }
