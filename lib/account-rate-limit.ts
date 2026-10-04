/** Single-process abuse backstop. Provider/distributed limits are still required. */
export function createAccountLimiter(now: () => number = Date.now, limits = { global: 60, perKey: 8 }) {
  const windowMs = 60000
  let globalStart = now(), globalCount = 0
  const buckets = new Map<string, { start: number; count: number }>()
  return (key: string) => {
    const time = now()
    if (time - globalStart >= windowMs) { globalStart = time; globalCount = 0; buckets.clear() }
    if (globalCount >= limits.global) return false
    globalCount++
    const previous = buckets.get(key)
    const bucket = previous && time - previous.start < windowMs ? previous : { start: time, count: 0 }
    if (bucket.count >= limits.perKey) return false
    bucket.count++
    buckets.set(key, bucket) // bounded by the global window; never stores passwords
    return true
  }
}
export const allowAccountAttempt = createAccountLimiter()
