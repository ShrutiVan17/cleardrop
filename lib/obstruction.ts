export type Zone = { x: number; y: number; w: number; h: number }
export type Frame = { data: Uint8ClampedArray; width: number; height: number }

// Monitoring uses small RGBA samples, not arbitrary full-resolution uploads.
export const MAX_FRAME_PIXELS = 640 * 480
export function validFrame(value: unknown): value is Frame {
  if (!value || typeof value !== 'object') return false
  const frame = value as Frame
  return Number.isInteger(frame.width) && Number.isInteger(frame.height) &&
    frame.width > 0 && frame.height > 0 && frame.width * frame.height <= MAX_FRAME_PIXELS &&
    ArrayBuffer.isView(frame.data) && Object.prototype.toString.call(frame.data) === '[object Uint8ClampedArray]' &&
    frame.data.length === frame.width * frame.height * 4
}

export function validZone(value: unknown): value is Zone {
  if (!value || typeof value !== 'object') return false
  const z = value as Zone
  return [z.x, z.y, z.w, z.h].every(Number.isFinite) && z.x >= 0 && z.y >= 0 &&
    z.w >= .03 && z.h >= .03 && z.x + z.w <= 1.001 && z.y + z.h <= 1.001
}

// Background comparison, not semantic package recognition. Compensates for
// uniform exposure changes; shadows, camera motion and people can still trigger it.
export function compareZone(reference: Frame, current: Frame, zone: Zone) {
  if (!validFrame(reference) || !validFrame(current) || reference.width !== current.width || reference.height !== current.height || !validZone(zone)) {
    throw new Error('Reference frame or zone does not match')
  }
  const { width, height } = current
  const x0 = Math.floor(zone.x * width), y0 = Math.floor(zone.y * height)
  const x1 = Math.min(width, Math.ceil((zone.x + zone.w) * width))
  const y1 = Math.min(height, Math.ceil((zone.y + zone.h) * height))
  const shifts: number[] = []
  for (let y = 0; y < height; y += 4) for (let x = 0; x < width; x += 4) {
    const i = (y * width + x) * 4
    shifts.push((current.data[i] + current.data[i+1] + current.data[i+2] - reference.data[i] - reference.data[i+1] - reference.data[i+2]) / 3)
  }
  shifts.sort((a, b) => a-b)
  const shift = shifts[Math.floor(shifts.length / 2)] || 0
  let changed = 0, count = 0
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * width + x) * 4
    const difference = (Math.abs(current.data[i]-reference.data[i]-shift) + Math.abs(current.data[i+1]-reference.data[i+1]-shift) + Math.abs(current.data[i+2]-reference.data[i+2]-shift)) / 3
    if (difference > 32) changed++
    count++
  }
  return count ? changed / count : 0
}

export type Persistence = { since: number | null; active: boolean; clearSince: number | null }
export const emptyPersistence = (): Persistence => ({ since: null, active: false, clearSince: null })
export function advanceDetection(previous: Persistence, ratio: number, now: number): Persistence {
  if (ratio >= .12) {
    const since = previous.since ?? now
    return { since, active: previous.active || now - since >= 3000, clearSince: null }
  }
  if (ratio < .06) {
    const clearSince = previous.clearSince ?? now
    if (now - clearSince >= 2000) return emptyPersistence()
    return { ...previous, since: previous.active ? previous.since : null, clearSince }
  }
  return { ...previous, since: previous.active ? previous.since : null, clearSince: null }
}
