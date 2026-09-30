import { randomBytes } from 'node:crypto'

export const RING_COOKIE = 'cleardrop_ring_session'
type Session = { token: string; expiresAt: number }
// Single-replica preview storage. Tokens are never written to disk or returned to the browser.
const shared = globalThis as typeof globalThis & { clearDropRingSessions?: Map<string, Session> }
const sessions = shared.clearDropRingSessions || (shared.clearDropRingSessions = new Map())
export function tokenExpiry(token: string): number | null {
  try {
    const exp = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).exp
    return typeof exp === 'number' && Number.isFinite(exp) ? exp * 1000 : null
  } catch { return null }
}
function sessionId(request?: Request) {
  return request?.headers.get('cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith(`${RING_COOKIE}=`))?.slice(RING_COOKIE.length + 1)
}
function prune() { sessions.forEach((value, id) => { if (value.expiresAt <= Date.now()) sessions.delete(id) }) }
export function sessionToken(request?: Request): string | null {
  const id = sessionId(request)
  if (!id) return null
  prune()
  const session = sessions.get(id)
  if (!session) throw new Error('Your Ring preview session ended. Connect again with a fresh token.')
  return session.token
}
export function saveRingSession(token: string, request: Request) {
  prune()
  const expiry = tokenExpiry(token)
  if (!expiry || expiry <= Date.now()) throw new Error('This token has expired or is incomplete. Generate a fresh Ring Playground token.')
  const old = sessionId(request)
  if (sessions.size >= 64 && (!old || !sessions.has(old))) throw new Error('Too many preview connections. Try again later.')
  const id = randomBytes(32).toString('hex')
  const expiresAt = Math.min(expiry, Date.now() + 4 * 60 * 60 * 1000)
  sessions.set(id, { token, expiresAt })
  if (old) sessions.delete(old)
  return { id, expiresAt }
}
export function forgetRingSession(request: Request) {
  const id = sessionId(request)
  if (id) sessions.delete(id)
}
