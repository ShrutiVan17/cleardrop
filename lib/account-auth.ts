import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { sameSiteWrite } from './account-policy'

export function accountEnabled() { return process.env.CLEARDROP_ACCOUNT_AUTH === '1' }
export function accountConfig() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_PUBLISHABLE_KEY
  const origin = process.env.CLEARDROP_SITE_URL
  if (!url || !key || !origin) throw new Error('Account service is not configured.')
  const parsed = new URL(url), site = new URL(origin)
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error('Account service URL is invalid.')
  if (site.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(site.hostname)) throw new Error('Accounts require HTTPS.')
  return { url, key, origin: site.origin }
}

/** Backend-only auth: no password store or session tokens in browser JavaScript. */
export function accountClient(request: Request, response?: NextResponse, updateRequest?: NextRequest) {
  const { url, key } = accountConfig()
  const jar = new Map((request.headers.get('cookie') || '').split(';').map(part => {
    const index = part.indexOf('=')
    return [part.slice(0, index).trim(), part.slice(index + 1)] as [string, string]
  }).filter(([name]) => name))
  return createServerClient(url, key, {
    cookieOptions: { httpOnly: true, sameSite: 'lax', secure: new URL(accountConfig().origin).protocol === 'https:', path: '/' },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) },
    cookies: {
      getAll: () => Array.from(jar, ([name, value]) => ({ name, value })),
      setAll: changes => changes.forEach(({ name, value, options }) => {
        jar.set(name, value)
        updateRequest?.cookies.set(name, value)
        response?.cookies.set(name, value, { ...options, httpOnly: true, sameSite: 'lax', secure: new URL(accountConfig().origin).protocol === 'https:', path: '/' })
      }),
    },
  })
}
export async function accountUser(request: Request) {
  const { data, error } = await accountClient(request).auth.getUser()
  return !error && data.user?.email_confirmed_at ? data.user : null
}
export async function accountAccess(request: Request): Promise<Response | null> {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && !sameSiteWrite(request)) return new Response('Cross-site request blocked.', { status: 403 })
  try {
    if (!(await accountUser(request))) return Response.json({ error: 'Sign in to continue.' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
    return null
  } catch { return Response.json({ error: 'Account service is unavailable.' }, { status: 503 }) }
}
export async function accountMiddleware(request: NextRequest) {
  const response = NextResponse.next({ request })
  try {
    const { data, error } = await accountClient(request, response, request).auth.getUser()
    if (error || !data.user?.email_confirmed_at) {
      const denied = request.nextUrl.pathname.startsWith('/api/')
        ? NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 })
        : NextResponse.redirect(new URL('/account', request.url))
      response.cookies.getAll().forEach(cookie => denied.cookies.set(cookie))
      denied.headers.set('Cache-Control', 'private, no-store')
      return denied
    }
    // Forward only the refreshed request cookie, never a client-supplied identity header.
    const refreshed = NextResponse.next({ request })
    response.cookies.getAll().forEach(cookie => refreshed.cookies.set(cookie))
    refreshed.headers.set('Cache-Control', 'private, no-store')
    return refreshed
  } catch { return NextResponse.json({ error: 'Account service is unavailable.' }, { status: 503 }) }
}
