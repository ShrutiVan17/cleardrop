'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Header } from '../components/Header'
import { PrivateReviewHistory } from '../components/PrivateReviewHistory'

export default function AccountPage() {
  const [configured, setConfigured] = useState(false)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [deletionPassword, setDeletionPassword] = useState('')
  const [signedIn, setSignedIn] = useState<string | null>(null)
  const [deletion, setDeletion] = useState(false)
  const [signup, setSignup] = useState(false)
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset-request'>('signin')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  async function refresh() {
    try {
      const res = await fetch('/api/account', { cache: 'no-store', signal: AbortSignal.timeout(10000) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Account service unavailable.')
      setConfigured(data.configured); setSignedIn(data.email || null); setDeletion(Boolean(data.deletionAvailable))
      setSignup(Boolean(data.signupAvailable))
      if (!data.configured) setMessage(data.message)
    } catch (e) { setError(e instanceof Error ? e.message : 'Account service unavailable.') }
    finally { setLoading(false) }
  }
  useEffect(() => {
    void refresh()
    const query = new URLSearchParams(window.location.search)
    if (query.has('verified')) setMessage('Email link verified. Continue to your camera, or set a new password if you requested recovery.')
    if (query.has('error')) setError('The email link expired or could not be verified. Request a new one. Open confirmation links in this browser.')
  }, [])
  async function submit(action: string, event?: FormEvent) {
    event?.preventDefault()
    setBusy(true); setError(''); setMessage('')
    try {
      const res = await fetch('/api/account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, email, password: action === 'delete' ? deletionPassword : password }), signal: AbortSignal.timeout(15000) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Account request failed.')
      setPassword(''); setDeletionPassword('')
      if (action === 'delete') {
        for (const key of Object.keys(localStorage)) if (key.startsWith('cleardrop.zone.')) localStorage.removeItem(key)
      }
      setMessage(data.message || (action === 'signin' ? 'You are signed in.' : action === 'delete' ? 'Your account was deleted.' : action === 'signout' ? 'You are signed out.' : 'Password updated. Sign in again.'))
      await refresh()
    } catch (e) { setError(e instanceof Error ? e.message : 'Account request failed.') }
    finally { setBusy(false) }
  }
  return <><Header connected={false} enabledCount={0} simpleMode />
    <main id="main-content" className="cd-shell" tabIndex={-1}>
      <section className="cd-hero"><p className="cd-eyebrow">YOUR ACCOUNT</p><h1>{signedIn ? 'Your private doorway.' : 'Welcome to ClearDrop.'}</h1><p>Account access is separate from connecting your Ring camera. We never ask for your Amazon password.</p></section>
      <section className="cleardrop-controls max-w-xl mx-auto">
        {loading ? <p role="status">Checking account service…</p> : !configured ? <div className="cd-demo-notice"><strong>Setup required</strong><span>Email accounts are not activated. The current website is an owner preview, not a public account service.</span></div> : signedIn ? <>
          <p>Signed in as {signedIn}</p><div className="flex gap-3 mt-4"><a className="cd-button cd-primary" href="/phone">Use phone camera</a><a className="cd-button" href="/doorway">Connect Ring</a></div>
          <button className="cd-button mt-4" disabled={busy} onClick={() => void submit('signout')}>Sign out</button>
          <PrivateReviewHistory />
          <details className="cd-details mt-5"><summary>Password and account deletion</summary><label>New password<input className="cd-input" type="password" autoComplete="new-password" minLength={12} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} /></label><p className="cd-help">Use 12–128 characters. Password recovery requires a valid email link.</p><button className="cd-button" disabled={busy || password.length < 12} onClick={() => void submit('reset-password')}>Set new password</button>
            <form className="mt-5" onSubmit={e => void submit('delete', e)}><p className="cd-error">Deleting your account is permanent. Enter your current password to confirm. Local doorway settings on this browser will also be removed.</p><label>Current password<input className="cd-input" type="password" autoComplete="current-password" required minLength={12} maxLength={128} value={deletionPassword} onChange={e => setDeletionPassword(e.target.value)} /></label><button className="cd-button mt-3" disabled={busy || !deletion}>Permanently delete my account</button>{!deletion && <p className="cd-help">Deletion is not configured yet; this app is not ready for store release.</p>}</form>
          </details>
        </> : <>
          <form onSubmit={e => void submit(mode, e)}><h2 className="text-xl font-semibold mb-4">{mode === 'signup' ? 'Create an account' : mode === 'reset-request' ? 'Reset your password' : 'Sign in'}</h2><label>Email<input className="cd-input mb-4" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></label>{mode !== 'reset-request' && <label>Password<input className="cd-input mb-4" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={12} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} /></label>}{mode === 'signup' && <p className="cd-help">Use at least 12 characters. Confirm your email before signing in. <a href="/privacy" className="cd-text-link">Read the privacy information</a>.</p>}<button className="cd-button cd-primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'reset-request' ? 'Send reset email' : 'Sign in'}</button></form>
          <div className="flex flex-wrap gap-4 mt-5">{signup && <button className="cd-text-link" disabled={busy} onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(''); setPassword('') }}>{mode === 'signup' ? 'Already have an account? Sign in' : 'Create an account'}</button>}<button className="cd-text-link" disabled={busy} onClick={() => { setMode(mode === 'reset-request' ? 'signin' : 'reset-request'); setPassword('') }}>{mode === 'reset-request' ? 'Back to sign in' : 'Forgot password?'}</button></div>
          {!signup && <p className="cd-help mt-4">Sign in with an existing account to connect Ring. Public registration is not open yet. The demo and phone-camera tests need no account.</p>}
        </>}
        {message && <p className="cd-help mt-4" role="status">{message}</p>}{error && <p className="cd-error mt-4" role="alert">{error}</p>}
      </section><p className="cd-help mt-5"><a href="/test" className="cd-text-link">Try camera-processing tests without an account</a> · <a href="/privacy" className="cd-text-link">Privacy information</a></p>
      <footer className="cd-footer">ClearDrop is an experimental review tool, not a safety system.</footer>
    </main></>
}
