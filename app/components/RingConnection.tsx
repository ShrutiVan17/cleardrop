'use client'
import { useEffect, useRef, useState } from 'react'

export function RingConnection({ onConnected }: { onConnected: () => void }) {
  const [token, setToken] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [])
  async function connect(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    const controller = new AbortController(); pending.current = controller
    setBusy(true); setError('')
    const timeout = setTimeout(() => controller.abort(), 16000)
    try {
      const response = await fetch('/api/ring/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: token.trim() }), signal: controller.signal })
      const result = await response.json()
      if (!response.ok || !result.connected) throw new Error(result.error || 'Could not connect to Ring.')
      setToken(''); onConnected()
    } catch (error) { setError(controller.signal.aborted ? 'Connection timed out. Check your internet and try again.' : error instanceof Error ? error.message : 'Could not connect.') }
    finally { clearTimeout(timeout); pending.current = null; setBusy(false) }
  }
  return <section className="cleardrop-controls" aria-label="Connect Ring preview">
    <h2 className="text-xl font-semibold">Connect Ring preview</h2>
    <p className="cd-help">For now, use a temporary developer token. No files to edit and no deployment needed.</p>
    <ol className="list-decimal pl-5 space-y-2 my-4"><li>Open <a className="cd-text-link" href="https://developer.amazon.com/ring/console/playground" target="_blank" rel="noreferrer">Ring Playground</a> and generate a token.</li><li>Paste it below. We’ll ask Ring which cameras you can use.</li><li>Choose a camera, then start its video.</li></ol>
    <form onSubmit={connect}><label className="text-sm" htmlFor="ring-preview-token">Ring access token</label><input id="ring-preview-token" type="password" autoComplete="off" spellCheck={false} autoCapitalize="none" className="cd-input" value={token} maxLength={8000} onChange={event => setToken(event.target.value)} placeholder="Paste your temporary token" required disabled={busy} /><button className="cd-button cd-primary mt-3" disabled={busy || !token.trim()}>{busy ? 'Checking with Ring…' : 'Connect Ring'}</button></form>
    {error && <p className="cd-error mt-3" role="alert">{error}</p>}
    <p className="cd-fine-print">Temporary connection, usually 30 minutes with Playground. The token is held in server memory for this browser session; a server restart also ends it. Never enter your Amazon password here. A Playground camera is a sandbox, not your physical doorway.</p>
    <details className="cd-details mt-3"><summary>Connecting a physical Ring camera</summary><p className="cd-help">A customer-ready Ring sign-in needs approved account linking and device-sharing consent. This preview does not yet provide that sign-in flow. Phone-camera tests do not verify physical Ring hardware.</p></details>
  </section>
}
