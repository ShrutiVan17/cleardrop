import type { Detection } from './package-detection'

/** Freshness is about the source frame, not when inference finishes. */
export function validInferenceSample(sample: {
  capturedAt: number; now: number; mediaTime: number; currentMediaTime: number; lastVideoAdvanceAt: number
  generation: number; currentGeneration: number; active: boolean; editing: boolean
}) {
  if (!sample.active || sample.editing || sample.generation !== sample.currentGeneration) return false
  if (![sample.capturedAt, sample.now, sample.mediaTime, sample.currentMediaTime, sample.lastVideoAdvanceAt].every(Number.isFinite)) return false
  const age = sample.now - sample.capturedAt
  if (age < 0 || age > 15000 || sample.currentMediaTime < sample.mediaTime) return false
  if (sample.lastVideoAdvanceAt > sample.now || sample.now - sample.lastVideoAdvanceAt > 1500) return false
  // A decoded frame that has not advanced during a slow scan is not live evidence.
  return age <= 1500 || sample.currentMediaTime > sample.mediaTime
}

export type InferenceReceipt = {
  version: 1; source: 'local-live-model'; observedAt: string
  model: string; revision: string; frameMediaTime: number; inferenceMs: number
  detections: Detection[]; decision: string; previousObstructionUnresolved: boolean
  limitation: string
}
