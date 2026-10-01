// Ring API authentication — supports two modes:
// 1. Access token (RING_ACCESS_TOKEN) — use directly, no other credentials needed
// 2. Refresh token (RING_REFRESH_TOKEN) — auto-renewing, requires client credentials

import { sessionToken } from './ring-session'
export type AuthMode = 'access_token' | 'refresh_token'

let cachedToken: { token: string; expiresAt: number } | null = null

export class RingTokenExpiredError extends Error {
  constructor() {
    super('Your Ring token has expired. Generate a fresh token in Ring Playground and use Connect Ring preview to reconnect.')
    this.name = 'RingTokenExpiredError'
  }
}

// Read expiry only for UI/preflight checks; Ring still validates the token.
export function getAccessTokenExpiry(request?: Request): number | null {
  const token = sessionToken(request) || (process.env.CLEARDROP_ACCOUNT_AUTH === '1' ? undefined : process.env.RING_ACCESS_TOKEN)
  if (!token) return null
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
    return typeof payload.exp === 'number' && Number.isFinite(payload.exp) ? payload.exp * 1000 : null
  } catch { return null }
}

export function getAuthMode(request?: Request): AuthMode | null {
  if (sessionToken(request)) return 'access_token'
  if (process.env.CLEARDROP_ACCOUNT_AUTH === '1') return null
  if (process.env.RING_ACCESS_TOKEN && process.env.RING_REFRESH_TOKEN) {
    return null // conflict
  }
  if (process.env.RING_ACCESS_TOKEN) return 'access_token'
  if (process.env.RING_REFRESH_TOKEN) return 'refresh_token'
  return null
}

export async function getAccessToken(request?: Request): Promise<string> {
  let ownerId: string | undefined
  if (process.env.CLEARDROP_ACCOUNT_AUTH === '1') {
    const { accountUser } = await import('./account-auth')
    if (!request) throw new Error('Sign in to connect Ring.')
    const user = await accountUser(request)
    if (!user) throw new Error('Sign in to connect Ring.')
    ownerId = user.id
  }
  const browserToken = sessionToken(request, ownerId)
  if (browserToken) return browserToken
  if (ownerId) throw new Error('Connect Ring for your own account.')
  // Conflict check
  if (process.env.RING_ACCESS_TOKEN && process.env.RING_REFRESH_TOKEN) {
    throw new Error(
      'Both RING_ACCESS_TOKEN and RING_REFRESH_TOKEN are set. Please use only one.'
    )
  }

  // Mode 1: Direct access token
  if (process.env.RING_ACCESS_TOKEN) {
    const expiry = getAccessTokenExpiry()
    if (expiry !== null && Date.now() >= expiry) throw new RingTokenExpiredError()
    return process.env.RING_ACCESS_TOKEN
  }

  // Mode 2: Refresh token flow (requires client credentials)
  if (process.env.RING_REFRESH_TOKEN) {
    if (!process.env.RING_CLIENT_ID || !process.env.RING_CLIENT_SECRET) {
      throw new Error(
        'RING_CLIENT_ID and RING_CLIENT_SECRET are required when using RING_REFRESH_TOKEN'
      )
    }

    if (cachedToken && Date.now() < cachedToken.expiresAt) {
      return cachedToken.token
    }

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: process.env.RING_REFRESH_TOKEN,
      client_id: process.env.RING_CLIENT_ID,
      client_secret: process.env.RING_CLIENT_SECRET,
    })

    const res = await fetch('https://oauth.ring.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })

    if (!res.ok) {
      throw new Error('Ring token renewal failed. Reconnect your Ring account.')
    }

    const data = await res.json()
    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000 - 60000,
    }
    return data.access_token
  }

  throw new Error(
    'Authentication not configured. Set RING_ACCESS_TOKEN or RING_REFRESH_TOKEN in .env.local'
  )
}
