// Ring API authentication — supports two modes:
// 1. Access token (RING_ACCESS_TOKEN) — use directly, no other credentials needed
// 2. Refresh token (RING_REFRESH_TOKEN) — auto-renewing, requires client credentials

export type AuthMode = 'access_token' | 'refresh_token'

let cachedToken: { token: string; expiresAt: number } | null = null

export class RingTokenExpiredError extends Error {
  constructor() {
    super('Your Ring playground token has expired. Generate a new token in the Ring Playground, update RING_ACCESS_TOKEN in .env.local, then reload this app.')
    this.name = 'RingTokenExpiredError'
  }
}

// Read expiry only for UI/preflight checks; Ring still validates the token.
export function getAccessTokenExpiry(): number | null {
  const token = process.env.RING_ACCESS_TOKEN
  if (!token) return null
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
    return typeof payload.exp === 'number' && Number.isFinite(payload.exp) ? payload.exp * 1000 : null
  } catch { return null }
}

export function getAuthMode(): AuthMode | null {
  if (process.env.RING_ACCESS_TOKEN && process.env.RING_REFRESH_TOKEN) {
    return null // conflict
  }
  if (process.env.RING_ACCESS_TOKEN) return 'access_token'
  if (process.env.RING_REFRESH_TOKEN) return 'refresh_token'
  return null
}

export async function getAccessToken(): Promise<string> {
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
      const error = await res.text()
      throw new Error(`Token refresh failed: ${error}`)
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
