import { NextRequest, NextResponse } from 'next/server'
import { hostedPreview, previewAccess } from './lib/preview-access'
import { accountEnabled, accountMiddleware } from './lib/account-auth'

export async function middleware(request: NextRequest) {
  if (['/api/health', '/manifest.webmanifest', '/icon.svg'].includes(request.nextUrl.pathname)) return NextResponse.next()
  if (accountEnabled()) {
    if (['/account', '/privacy', '/demo', '/test', '/auth/confirm', '/api/account'].includes(request.nextUrl.pathname) || request.nextUrl.pathname.startsWith('/_next/')) return NextResponse.next()
    return accountMiddleware(request)
  }
  const denied = await previewAccess(request)
  if (denied) return denied
  const response = NextResponse.next()
  if (hostedPreview()) {
    response.headers.set('Cache-Control', 'private, no-store')
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('Referrer-Policy', 'no-referrer')
  }
  return response
}
