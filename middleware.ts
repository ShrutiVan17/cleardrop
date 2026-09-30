import { NextRequest, NextResponse } from 'next/server'
import { hostedPreview, previewAccess } from './lib/preview-access'

export async function middleware(request: NextRequest) {
  if (['/api/health', '/manifest.webmanifest', '/icon.svg'].includes(request.nextUrl.pathname)) return NextResponse.next()
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
