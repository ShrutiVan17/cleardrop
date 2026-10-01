export function sameSiteWrite(request: Request): boolean {
  try {
    const origin = request.headers.get('origin')
    const host = request.headers.get('host') || new URL(request.url).host
    return Boolean(origin) && new URL(origin!).host === host && request.headers.get('sec-fetch-site') !== 'cross-site'
  } catch { return false }
}
export function validEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}
export function validPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 12 && value.length <= 128
}
export async function readSmallJson(request: Request, limit = 4096): Promise<Record<string, unknown>> {
  if (Number(request.headers.get('content-length')) > limit) throw new Error('Request too large.')
  if (!request.body) throw new Error('Request is empty.')
  const reader = request.body.getReader(), decoder = new TextDecoder()
  let bytes = 0, text = ''
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      bytes += chunk.value.byteLength
      if (bytes > limit) { await reader.cancel(); throw new Error('Request too large.') }
      text += decoder.decode(chunk.value, { stream: true })
    }
    const value = JSON.parse(text + decoder.decode())
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object.')
    return value
  } finally { reader.releaseLock() }
}
