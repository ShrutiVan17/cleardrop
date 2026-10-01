import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { accountClient, accountConfig, accountEnabled } from '@/lib/account-auth'
import { readSmallJson, sameSiteWrite, validEmail, validPassword } from '@/lib/account-policy'

export const runtime = 'nodejs'
const headers = { 'Cache-Control': 'private, no-store' }
export async function GET(request: Request) {
  if (!accountEnabled()) return NextResponse.json({ configured: false, message: 'Account setup is not activated. This is still the owner preview.' }, { headers })
  try {
    const { data, error } = await accountClient(request).auth.getUser()
    return NextResponse.json({ configured: true, email: !error && data.user?.email_confirmed_at ? data.user.email : null, deletionAvailable: Boolean(process.env.SUPABASE_SECRET_KEY) }, { headers })
  } catch { return NextResponse.json({ error: 'Account service is unavailable.' }, { status: 503, headers }) }
}
export async function POST(request: Request) {
  if (!sameSiteWrite(request)) return NextResponse.json({ error: 'Cross-site request blocked.' }, { status: 403, headers })
  if (!accountEnabled()) return NextResponse.json({ error: 'Accounts are not activated yet.' }, { status: 503, headers })
  try { accountConfig() } catch { return NextResponse.json({ error: 'Account service is not configured.' }, { status: 503, headers }) }
  try {
    const body = await readSmallJson(request)
    const action = typeof body.action === 'string' ? body.action : ''
    const email = typeof body.email === 'string' ? body.email : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const captchaToken = body.captchaToken
    if (!['signin', 'signup', 'signout', 'reset-request', 'reset-password', 'delete'].includes(action)) return NextResponse.json({ error: 'Invalid account action.' }, { status: 400, headers })
    if (['signin', 'signup', 'reset-request'].includes(action) && !validEmail(email)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400, headers })
    if (['signin', 'signup', 'reset-password', 'delete'].includes(action) && !validPassword(password)) return NextResponse.json({ error: 'Use a password with 12–128 characters.' }, { status: 400, headers })
    const response = NextResponse.json({ success: true }, { headers })
    const client = accountClient(request, response)
    const options = typeof captchaToken === 'string' && captchaToken.length < 4096 ? { captchaToken } : undefined
    if (action === 'signup') {
      const { data, error } = await client.auth.signUp({ email, password, options: { ...options, emailRedirectTo: accountConfig().origin + '/auth/confirm' } })
      if (error) return NextResponse.json({ error: 'Could not create the account. Check your details or try again later.' }, { status: 400, headers })
      // Email verification is mandatory even if the project is accidentally configured otherwise.
      if (data.session) { await client.auth.signOut(); return NextResponse.json({ error: 'Email verification must be enabled by the operator.' }, { status: 503, headers }) }
      const confirmed = NextResponse.json({ success: true, message: 'Check your email to confirm your account. Then sign in.' }, { headers })
      response.cookies.getAll().forEach(cookie => confirmed.cookies.set(cookie))
      return confirmed
    }
    if (action === 'signin') {
      const { data, error } = await client.auth.signInWithPassword({ email, password, options })
      if (error || !data.user?.email_confirmed_at) return NextResponse.json({ error: 'Sign-in failed. Check your email, password and email confirmation.' }, { status: 401, headers })
    } else if (action === 'reset-request') {
      await client.auth.resetPasswordForEmail(email, { ...options, redirectTo: accountConfig().origin + '/auth/confirm' })
      return NextResponse.json({ success: true, message: 'If this email has an account, a password-reset link will arrive.' }, { headers })
    } else if (action === 'signout') {
      const { error } = await client.auth.signOut({ scope: 'global' })
      if (error) return NextResponse.json({ error: 'Could not revoke the session. Please try again.' }, { status: 503, headers })
    } else {
      const { data, error } = await client.auth.getUser()
      if (error || !data.user?.email_confirmed_at) return NextResponse.json({ error: 'Sign in again to continue.' }, { status: 401, headers })
      if (action === 'delete') {
        const secret = process.env.SUPABASE_SECRET_KEY
        if (!secret) return NextResponse.json({ error: 'Account deletion is not configured. Do not publish this app until deletion is enabled.' }, { status: 503, headers })
        const check = await client.auth.signInWithPassword({ email: data.user.email!, password, options })
        if (check.error || check.data.user?.id !== data.user.id) return NextResponse.json({ error: 'Your current password is required.' }, { status: 401, headers })
        const admin = createClient(accountConfig().url, secret, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) } })
        const removed = await admin.auth.admin.deleteUser(data.user.id)
        if (removed.error) return NextResponse.json({ error: 'Deletion could not complete. Please try again.' }, { status: 503, headers })
        await client.auth.signOut({ scope: 'local' })
      } else {
        // Recovery must be an authenticated provider-issued recovery session.
        const changed = await client.auth.updateUser({ password })
        if (changed.error) return NextResponse.json({ error: 'Password could not be changed. Request a new recovery email.' }, { status: 400, headers })
        await client.auth.signOut({ scope: 'global' })
      }
    }
    if (['signin', 'signout', 'delete', 'reset-password'].includes(action)) response.cookies.set('cleardrop_ring_session', 'disconnected', { httpOnly: true, secure: accountConfig().origin.startsWith('https:'), sameSite: 'strict', path: '/api/ring', maxAge: 14400 })
    return response
  } catch { return NextResponse.json({ error: 'Account request could not complete. Please try again.' }, { status: 400, headers }) }
}
