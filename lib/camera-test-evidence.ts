import type { ChangeObservation } from './change-monitor'

export type CameraTestPhase = 'outside' | 'inside' | 'restored' | 'second-alert' | 'lost' | 'finished'
export type CameraTestResult = 'Waiting' | 'Passed' | 'Failed'
export const CAMERA_TEST_NAMES = ['Box beside the doorway: no change alert', 'Box inside, then removed: reference restored', 'Video lost: earlier alert remains unresolved']
export function cameraTestPhase(elapsed: number): CameraTestPhase {
  if (elapsed < 4500) return 'outside'
  if (elapsed < 10000) return 'inside'
  if (elapsed < 14000) return 'restored'
  if (elapsed < 19500) return 'second-alert'
  return elapsed < 20750 ? 'lost' : 'finished'
}
type PhaseEvidence = { samples: number; firstMs: number | null; lastMs: number | null; peakChangedRatio: number }
const freshPhase = (): PhaseEvidence => ({ samples: 0, firstMs: null, lastMs: null, peakChangedRatio: 0 })

/** Measures observations, not scripted answers. Old scans cannot count as new evidence. */
export class CameraTestEvidence {
  private lastScan: number
  private lastAt: number
  private lastFreshAt: number
  private outsideAlert = false
  private insideAlert = false
  private referenceRestored = false
  private secondAlert = false
  private lostUnresolved = false
  private failure: string | null = null
  private phases = { outside: freshPhase(), inside: freshPhase(), restored: freshPhase(), 'second-alert': freshPhase(), lost: freshPhase() }
  private transitions: { elapsedMs: number; phase: CameraTestPhase; ready: boolean; blocked: boolean; unresolved: boolean; scans: number }[] = []
  private previousState = ''
  constructor(private startedAt: number, initial: ChangeObservation) {
    this.lastScan = initial.scans; this.lastAt = startedAt; this.lastFreshAt = startedAt
    if (!Number.isFinite(startedAt) || !initial.ready || initial.blocked || initial.unresolved) this.failure = 'Start with a fresh, empty reference.'
  }
  observe(sample: ChangeObservation, at: number) {
    if (!Number.isFinite(at) || at <= this.lastAt || !Number.isInteger(sample.scans) || sample.scans < this.lastScan || !Number.isFinite(sample.ratio)) {
      this.failure = 'Observation clock or reference changed during the run.'; return
    }
    this.lastAt = at
    // React callbacks can arrive with slightly different delays. Persistence
    // must use the detector's clock, not the UI delivery time.
    const fresh = sample.scans > this.lastScan
    const sampleAt = fresh ? sample.sampledAt ?? at : at
    if (!Number.isFinite(sampleAt) || sampleAt > at || (fresh && sampleAt <= this.lastFreshAt)) {
      this.failure = 'Invalid source sampling timestamp.'; return
    }
    const elapsed = sampleAt - this.startedAt, phase = cameraTestPhase(elapsed)
    if (phase === 'finished') return
    const state = `${phase}:${sample.ready}:${sample.blocked}:${sample.unresolved}`
    if (state !== this.previousState && this.transitions.length < 64) {
      this.transitions.push({ elapsedMs: Math.round(elapsed), phase, ready: sample.ready, blocked: sample.blocked, unresolved: sample.unresolved, scans: sample.scans })
      this.previousState = state
    }
    if (phase === 'lost') { this.lostUnresolved = !sample.ready && !sample.blocked && sample.unresolved; return }
    if (!sample.ready) this.failure = 'Video stopped or reference was reset before the disconnect test.'
    if (sample.scans === this.lastScan) return
    if (sampleAt - this.lastFreshAt > 1500) this.failure = 'Fresh-frame sampling was interrupted.'
    this.lastScan = sample.scans; this.lastFreshAt = sampleAt
    const evidence = this.phases[phase]
    evidence.samples++; evidence.firstMs ??= elapsed; evidence.lastMs = elapsed
    evidence.peakChangedRatio = Math.max(evidence.peakChangedRatio, sample.ratio)
    if ((phase === 'inside' || phase === 'second-alert') && sample.blocked && elapsed - evidence.firstMs < 3000) this.failure = 'The change alert fired before the required persistence interval.'
    if (phase === 'restored' && this.insideAlert && !sample.blocked && !sample.unresolved && elapsed - evidence.firstMs < 2000) this.failure = 'The reference-restoration checks cleared too early.'
    if (phase === 'outside' && (sample.blocked || sample.unresolved)) this.outsideAlert = true
    if (phase === 'inside' && sample.blocked && sample.unresolved) this.insideAlert = true
    if (phase === 'restored' && this.insideAlert && !sample.blocked && !sample.unresolved) this.referenceRestored = true
    if (phase === 'second-alert' && sample.blocked && sample.unresolved) this.secondAlert = true
  }
  private sufficient(phase: 'outside' | 'inside' | 'restored' | 'second-alert', span: number) {
    const evidence = this.phases[phase]
    return evidence.samples >= 8 && evidence.firstMs !== null && evidence.lastMs !== null && evidence.lastMs - evidence.firstMs >= span
  }
  results(at: number): CameraTestResult[] {
    const elapsed = at - this.startedAt, valid = !this.failure
    return [
      elapsed < 4500 ? 'Waiting' : valid && this.sufficient('outside', 3000) && !this.outsideAlert ? 'Passed' : 'Failed',
      elapsed < 14000 ? 'Waiting' : valid && this.sufficient('inside', 3000) && this.sufficient('restored', 2000) && this.insideAlert && this.referenceRestored ? 'Passed' : 'Failed',
      elapsed < 20750 ? 'Waiting' : valid && this.sufficient('second-alert', 3000) && this.secondAlert && this.lostUnresolved ? 'Passed' : 'Failed',
    ]
  }
  report(at: number) {
    return {
      schema: 'cleardrop.camera-test.v1', source: 'generated-video', monitor: 'ChangeMonitor',
      completed: Number.isFinite(at) && at - this.startedAt >= 20750,
      elapsedMs: Math.round(at - this.startedAt), failure: this.failure,
      cases: CAMERA_TEST_NAMES.map((name, index) => ({ name, result: this.results(at)[index] })),
      phases: JSON.parse(JSON.stringify(this.phases)) as typeof this.phases,
      transitions: this.transitions.map(item => ({ ...item })),
      limits: ['Not Ring footage or hardware evidence.', 'Not a parcel-recognition accuracy benchmark.', 'A restored reference does not measure walking clearance or guarantee safety.'],
    }
  }
}
