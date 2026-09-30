/** A single-owner preview gate, not multi-user Ring account authorization. */
export function hostedPreview(): boolean {
  return process.env.CLEARDROP_HOSTED === '1' || Boolean(process.env.RAILWAY_ENVIRONMENT_ID)
}

export async function previewAccess(request: Request): Promise<Response | null> {
  if (!hostedPreview()) return null
  const password = process.env.CLEARDROP_PREVIEW_PASSWORD
  const username = process.env.CLEARDROP_PREVIEW_USERNAME || 'cleardrop'
  const minimumLength = process.env.CLEARDROP_ALLOW_SHORT_PASSWORD === '1' ? 8 : 24
  const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' }
  if (!password || password.length < minimumLength || !/^[A-Za-z0-9._-]+$/.test(username)) {
    return new Response('Private preview is not configured.', { status: 503, headers })
  }
  const header = request.headers.get('authorization') || ''
  let supplied = ''
  try {
    if (/^Basic /i.test(header) && header.length < 2048) supplied = atob(header.slice(6))
  } catch { /* Invalid credentials receive the same challenge. */ }
  const expected = `${username}:${password}`
  const encoder = new TextEncoder()
  const [a, b] = await Promise.all([supplied, expected].map(value => crypto.subtle.digest('SHA-256', encoder.encode(value))))
  const aa = new Uint8Array(a), bb = new Uint8Array(b)
  let different = 0
  for (let i = 0; i < aa.length; i++) different |= aa[i] ^ bb[i]
  if (different) {
    return new Response('Sign in to the private ClearDrop preview.', {
      status: 401, headers: { ...headers, 'WWW-Authenticate': 'Basic realm="ClearDrop preview", charset="UTF-8"' },
    })
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const origin = request.headers.get('origin')
    let sameOrigin = true
    // Next.js may use the internal bind hostname in request.url behind a proxy.
    const requestHost = request.headers.get('host') || new URL(request.url).host
    try { if (origin) sameOrigin = new URL(origin).host === requestHost } catch { sameOrigin = false }
    if (!sameOrigin || request.headers.get('sec-fetch-site') === 'cross-site') {
      return new Response('Cross-site request blocked.', { status: 403, headers })
    }
  }
  return null
}
