/** Capability negotiation only. Successful loading is not an accuracy benchmark. */
export type InferenceBackend = 'wasm' | 'webgpu'
export type RuntimePreference = 'auto' | 'wasm'
export function canConfirmInferenceConcern(value: { checkedEmpty: boolean; freshVideo: boolean; active: boolean; editing: boolean; hidden: boolean }) {
  return value.checkedEmpty && value.freshVideo && value.active && !value.editing && !value.hidden
}

export async function loadInferenceRuntime<T>(
  create: (backend: InferenceBackend) => Promise<T>,
  preference: RuntimePreference,
  gpuAvailable: boolean,
): Promise<{ detector: T; backend: InferenceBackend; fallback: boolean }> {
  if (preference === 'auto' && gpuAvailable) {
    try { return { detector: await create('webgpu'), backend: 'webgpu', fallback: false } }
    catch { return { detector: await create('wasm'), backend: 'wasm', fallback: true } }
  }
  return { detector: await create('wasm'), backend: 'wasm', fallback: false }
}

/** Bound both axes, including portrait phone frames, before transferring pixels. */
export function inferenceFrameSize(width: number, height: number) {
  if (![width, height].every(n => Number.isFinite(n) && Number.isInteger(n) && n > 0)) throw new Error('Invalid frame size')
  const scale = Math.min(1, 640 / width, 640 / height)
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

export function validInferenceFrame(width: unknown, height: unknown, pixels: unknown): boolean {
  return typeof width === 'number' && typeof height === 'number' &&
    Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 && width <= 640 && height <= 640 &&
    pixels instanceof ArrayBuffer && pixels.byteLength === width * height * 4
}
