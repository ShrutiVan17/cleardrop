import { NextResponse } from 'next/server'
import { accountClient, accountConfig, accountEnabled } from '@/lib/account-auth'
import { allowAccountAttempt } from '@/lib/account-rate-limit'

export async function GET(request: Request) {
  if (!accountEnabled()) return NextResponse.json({ error: 'Accounts are not activated.' }, { status: 503 })
  try {
    const url = new URL(request.url)
    const response = NextResponse.redirect(accountConfig().origin + '/account?verified=1')
    const client = accountClient(request, response)
    const code = url.searchParams.get('code'), hash = url.searchParams.get('token_hash'), type = url.searchParams.get('type')
    if ((code && code.length > 2048) || (hash && hash.length > 2048)) return NextResponse.json({ error: 'Invalid confirmation link.' }, { status: 400 })
    if (!allowAccountAttempt('confirm')) return NextResponse.json({ error: 'Too many confirmation attempts. Try again in a minute.' }, { status: 429, headers: { 'Retry-After': '60', 'Cache-Control': 'private, no-store' } })
    const result = code ? await client.auth.exchangeCodeForSession(code) : hash && ['email', 'signup', 'recovery'].includes(type || '') ? await client.auth.verifyOtp({ token_hash: hash, type: type as 'email' | 'signup' | 'recovery' }) : null
    if (!result || result.error) return NextResponse.redirect(accountConfig().origin + '/account?error=verification')
    response.headers.set('Cache-Control', 'private, no-store'); response.headers.set('Referrer-Policy', 'no-referrer')
    return response
  } catch { return NextResponse.json({ error: 'Confirmation could not complete. Request a new email.' }, { status: 400 }) }
}
