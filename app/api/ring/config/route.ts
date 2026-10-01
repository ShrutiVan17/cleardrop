import { previewAccess } from '@/lib/preview-access'
import { NextResponse } from 'next/server'
import { getAuthMode, getAccessToken, getAccessTokenExpiry, RingTokenExpiredError } from '@/lib/auth'

export async function GET(request: Request) {
  const denied = await previewAccess(request)
  if (denied) return denied
  try {
  if (process.env.CLEARDROP_ACCOUNT_AUTH === '1') await getAccessToken(request)
  const mode = getAuthMode(request)

  if (mode === null && process.env.RING_ACCESS_TOKEN && process.env.RING_REFRESH_TOKEN) {
    return NextResponse.json(
      { error: 'Both RING_ACCESS_TOKEN and RING_REFRESH_TOKEN are set. Please use only one.' },
      { status: 400 }
    )
  }

  if (mode === null) {
    return NextResponse.json(
      { error: 'Use Connect Ring preview to connect a camera.' },
      { status: 400 }
    )
  }

  const expiresAt = getAccessTokenExpiry(request)
  if (expiresAt !== null && Date.now() >= expiresAt) {
    return NextResponse.json({ error: new RingTokenExpiredError().message }, { status: 401 })
  }
  return NextResponse.json({ mode, expiresAt })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Ring connection unavailable.' }, { status: 401 })
  }
}
