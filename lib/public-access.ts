/** Explicit opt-in: public demonstrations never expose personal camera routes. */
export function publicDemoEnabled() { return process.env.CLEARDROP_PUBLIC_DEMO === '1' }
export function publicInferenceAsset(path: string) {
  return ['/inference-runtime/ort-wasm-simd-threaded.jsep.mjs', '/inference-runtime/ort-wasm-simd-threaded.jsep.wasm'].includes(path)
}
export function publicDemoPath(path: string) {
  return ['/', '/demo', '/test', '/phone', '/privacy', '/account', '/auth/confirm', '/api/account', '/api/health', '/manifest.webmanifest', '/icon.svg'].includes(path)
    || path.startsWith('/_next/')
    || publicInferenceAsset(path)
}
export function publicSignupEnabled() {
  // Public registration needs verified SMTP and provider abuse controls first.
  return !publicDemoEnabled() || process.env.CLEARDROP_PUBLIC_SIGNUP === '1'
}
