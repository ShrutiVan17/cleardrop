import { NextResponse } from 'next/server'
import { previewAccess, hostedPreview } from '@/lib/preview-access'
import { saveRingSession, forgetRingSession, tokenExpiry, RING_COOKIE } from '@/lib/ring-session'

export const runtime = 'nodejs'
function sameOrigin(request: Request) {
  try {
    const origin = request.headers.get('origin')
    return request.headers.get('sec-fetch-site') !== 'cross-site' && (!origin || new URL(origin).host === (request.headers.get('host') || new URL(request.url).host))
  } catch { return false }
}
export async function POST(request: Request) {
  const denied = await previewAccess(request)
  if (denied) return denied
  // Also protect the loopback-only local developer workflow against cross-site writes.
  if (!sameOrigin(request)) return new Response('Cross-site request blocked.', { status: 403 })
  try {
    if (Number(request.headers.get('content-length')) > 12000) return NextResponse.json({ error: 'Token is too long.' }, { status: 413 })
    const body = await request.text()
    if (body.length > 12000) return NextResponse.json({ error: 'Token is too long.' }, { status: 413 })
    let token: unknown
    try { token = JSON.parse(body).token } catch { return NextResponse.json({ error: 'Paste a Ring access token.' }, { status: 400 }) }
    if (typeof token !== 'string' || token.length > 8000 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return NextResponse.json({ error: 'Paste the complete Ring access token, without quotes.' }, { status: 400 })
    if ((tokenExpiry(token) || 0) <= Date.now()) return NextResponse.json({ error: 'That token has expired. Generate a new one in Ring Playground.' }, { status: 400 })
    const ring = await fetch('https://api.amazonvision.com/v1/devices', { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(12000), redirect: 'error', cache: 'no-store' })
    if (!ring.ok) return NextResponse.json({ error: ring.status === 401 || ring.status === 403 ? 'Ring rejected this token. Generate a new Ring Playground token and try again.' : 'Ring is unavailable. Please try again shortly.' }, { status: ring.status === 401 || ring.status === 403 ? 400 : 502 })
    const data = await ring.json()
    if (!Array.isArray(data.data) || !data.data.length) return NextResponse.json({ error: 'Ring accepted the token, but shared no cameras. Select a camera in the Ring developer setup.' }, { status: 400 })
    let ownerId: string | undefined
    if (process.env.CLEARDROP_ACCOUNT_AUTH === '1') {
      const { accountUser } = await import('@/lib/account-auth')
      const user = await accountUser(request)
      if (!user) return NextResponse.json({ error: 'Sign in to connect Ring.' }, { status: 401 })
      ownerId = user.id
    }
    const session = saveRingSession(token, request, ownerId)
    const response = NextResponse.json({ connected: true, cameraCount: data.data.length, expiresAt: session.expiresAt }, { headers: { 'Cache-Control': 'no-store' } })
    response.cookies.set(RING_COOKIE, session.id, { httpOnly: true, secure: hostedPreview() || new URL(request.url).protocol === 'https:', sameSite: 'strict', path: '/api/ring', maxAge: 14400 })
    return response
  } catch {
    return NextResponse.json({ error: 'Could not complete the Ring connection. Please try again.' }, { status: 502 })
  }
}
export async function DELETE(request: Request) {
  const denied = await previewAccess(request)
  if (denied) return denied
  if (!sameOrigin(request)) return new Response('Cross-site request blocked.', { status: 403 })
  forgetRingSession(request)
  const response = NextResponse.json({ disconnected: true }, { headers: { 'Cache-Control': 'no-store' } })
  // A tombstone prevents silently switching to the server owner's camera credentials.
  response.cookies.set(RING_COOKIE, 'disconnected', { httpOnly: true, secure: hostedPreview(), sameSite: 'strict', path: '/api/ring', maxAge: 14400 })
  return response
}
