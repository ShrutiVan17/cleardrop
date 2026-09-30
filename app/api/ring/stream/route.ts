import { previewAccess } from '@/lib/preview-access'
import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken, RingTokenExpiredError } from '@/lib/auth'

const API_BASE = 'https://api.amazonvision.com'

function trustedSessionUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value, API_BASE)
    if (url.origin !== API_BASE || url.username || url.password ||
        !/^\/v1\/devices\/[^/]+\/media\/streaming\/whep\/sessions\/[^/]+$/.test(url.pathname)) return null
    return url.href
  } catch { return null }
}

export async function POST(request: NextRequest) {
  const denied = await previewAccess(request)
  if (denied) return denied
  try {
    const { sdpOffer, deviceId } = await request.json()

    if (typeof sdpOffer !== 'string' || !sdpOffer.startsWith('v=0') || sdpOffer.length > 100000) {
      return NextResponse.json({ error: 'Missing sdpOffer' }, { status: 400 })
    }

    // Use deviceId from request body, fall back to env var
    const resolvedDeviceId = deviceId || process.env.NEXT_PUBLIC_RING_DEVICE_ID
    if (typeof resolvedDeviceId !== 'string' || !/^[A-Za-z0-9._-]+$/.test(resolvedDeviceId)) {
      return NextResponse.json(
        { error: 'No device ID provided. Pass deviceId in request body or set NEXT_PUBLIC_RING_DEVICE_ID.' },
        { status: 400 }
      )
    }

    const token = await getAccessToken(request)
    const whepUrl = `${API_BASE}/v1/devices/${resolvedDeviceId}/media/streaming/whep/sessions`

    const response = await fetch(whepUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/sdp',
      },
      body: sdpOffer,
      signal: AbortSignal.timeout(20000),
      redirect: 'error',
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: response.status === 401 ? 'Ring rejected the token. Use Connect Ring preview with a fresh token.' : `WHEP failed: ${response.status}` },
        { status: response.status }
      )
    }

    const sdpAnswer = await response.text()
    const sessionUrl = trustedSessionUrl(response.headers.get('Location'))

    return NextResponse.json({ sdpAnswer, sessionUrl })
  } catch (error) {
    console.error('Stream error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Stream failed' },
      { status: error instanceof RingTokenExpiredError ? 401 : 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const denied = await previewAccess(request)
  if (denied) return denied
  try {
    const body = await request.json()
    const sessionUrl = trustedSessionUrl(body.sessionUrl)
    if (!sessionUrl) {
      return NextResponse.json({ error: 'Invalid Ring session URL' }, { status: 400 })
    }

    const token = await getAccessToken(request)
    const response = await fetch(sessionUrl, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok && response.status !== 404 && response.status !== 410) {
      return NextResponse.json({ error: 'Ring could not close the session' }, { status: response.status })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to close session' }, { status: 500 })
  }
}
