import { previewAccess } from '@/lib/preview-access'
import { NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/auth'

export async function GET(request: Request) {
  const denied = await previewAccess(request)
  if (denied) return denied
  try {
    await getAccessToken()
    return NextResponse.json({ configured: true })
  } catch (error) {
    console.error('Token error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get token' },
      { status: 500 }
    )
  }
}
