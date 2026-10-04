import { advanceDetection, compareZone, emptyPersistence, Frame, Persistence, validFrame, validZone, Zone } from './obstruction'

export type PauseReason = 'camera-paused' | 'frame-stalled' | 'sample-gap' | 'invalid-frame' | 'analysis-failed' | 'page-hidden' | 'area-changed' | 'manual-report'
export type CameraSource = 'ring' | 'phone' | 'generated-video' | 'unknown'
export type MonitorEvent = {
  sequence: number
  kind: 'reference-saved' | 'parcel-reported' | 'change-persisted' | 'reference-restored' | 'monitor-paused'
  evidence: 'human' | 'pixels' | 'system'
  referenceVersion: number
  sampledAt: number | null
  scans: number
  unresolved: boolean
  reason?: PauseReason
}

export type ChangeObservation = {
  ready: boolean
  blocked: boolean
  unresolved: boolean
  ratio: number
  scans: number
  sampledAt?: number
  reportedParcel?: boolean
  pauseReason?: PauseReason
}

/** Shared by real camera monitoring and controlled video tests. No semantic AI claims. */
export class ChangeMonitor {
  private reference: Frame | null = null
  private zone: Zone | null = null
  private persistence: Persistence = emptyPersistence()
  private lastSample: number | null = null
  private state: ChangeObservation = { ready: false, blocked: false, unresolved: false, ratio: 0, scans: 0 }
  private referenceVersion = 0
  private sequence = 0
  private journal: MonitorEvent[] = []
  private droppedEvents = 0

  snapshot(): ChangeObservation { return { ...this.state } }

  private record(kind: MonitorEvent['kind'], evidence: MonitorEvent['evidence'], at?: number, reason?: PauseReason) {
    this.journal.push({ sequence: ++this.sequence, kind, evidence, referenceVersion: this.referenceVersion,
      sampledAt: Number.isFinite(at) ? at! : null, scans: this.state.scans, unresolved: this.state.unresolved,
      ...(reason ? { reason } : {}) })
    if (this.journal.length > 64) { this.journal.shift(); this.droppedEvents++ }
  }

  // Allowlisted metadata only. Never serialize pixels, tokens, device IDs or account data.
  receipt(source: CameraSource = 'unknown') {
    const allowed = ['ring', 'phone', 'generated-video', 'unknown']
    return { schema: 'cleardrop.monitor.v1', source: allowed.includes(source) ? source : 'unknown',
      referenceVersion: this.referenceVersion, observation: this.snapshot(), droppedEvents: this.droppedEvents,
      events: this.journal.map(event => ({ ...event })),
      limits: ['Session-local review history, not a tamper-proof audit log.', 'Human reports are not automatic detections.',
        'Pixel changes are not parcel recognition or physical clearance measurements.', 'No background monitoring or safety guarantee.'] }
  }

  pause(reason: PauseReason = 'camera-paused', at?: number): ChangeObservation {
    const changed = this.state.ready || this.state.pauseReason !== reason
    this.reference = null
    this.persistence = emptyPersistence()
    this.lastSample = null
    this.state = { ...this.state, ready: false, blocked: false, ratio: 0, pauseReason: reason }
    if (changed) this.record('monitor-paused', 'system', at, reason)
    return this.snapshot()
  }

  /** Human report, not a model detection. Never learn an occupied reference. */
  reportParcel(): ChangeObservation {
    this.pause('manual-report')
    this.state = { ...this.state, reportedParcel: true, unresolved: true }
    this.record('parcel-reported', 'human')
    return this.snapshot()
  }

  calibrate(frame: Frame, zone: Zone, at: number, confirmation?: { checkedEmpty: boolean; reportedParcelRemoved?: boolean }): ChangeObservation {
    if (confirmation?.checkedEmpty !== true) throw new Error('Check the marked area is empty before saving a reference.')
    if (this.state.reportedParcel && confirmation.reportedParcelRemoved !== true) throw new Error('Confirm the reported parcel was removed before saving an empty reference.')
    if (!validZone(zone) || !Number.isFinite(at)) throw new Error('Choose a valid doorway area and fresh reference.')
    if (!validFrame(frame)) throw new Error('A valid, bounded camera frame is required for calibration.')
    // Copy pixels: a reusable capture buffer must not silently change the reference.
    this.reference = { width: frame.width, height: frame.height, data: new Uint8ClampedArray(frame.data) }
    this.zone = { ...zone }
    this.persistence = emptyPersistence()
    this.lastSample = at
    this.state = { ready: true, blocked: false, unresolved: false, reportedParcel: false, ratio: 0, scans: 0 }
    this.referenceVersion++
    this.record('reference-saved', 'human', at)
    return this.snapshot()
  }

  observe(frame: Frame, at: number): ChangeObservation {
    if (!this.reference || !this.zone || !Number.isFinite(at)) return this.snapshot()
    if (this.lastSample !== null && at <= this.lastSample) return this.snapshot()
    // A gap cannot stand in for continuously observed presence or removal.
    if (this.lastSample !== null && at - this.lastSample > 1500) return this.pause('sample-gap', at)
    if (!validFrame(frame) || frame.width !== this.reference.width || frame.height !== this.reference.height) return this.pause('invalid-frame', at)
    const ratio = compareZone(this.reference, frame, this.zone)
    const previous = this.persistence
    const next = advanceDetection(previous, ratio, at)
    this.persistence = next
    this.lastSample = at
    this.state = { ready: true, blocked: next.active,
      unresolved: next.active || (this.state.unresolved && !(previous.active && !next.active)),
      ratio, scans: this.state.scans + 1, sampledAt: at }
    if (!previous.active && next.active) this.record('change-persisted', 'pixels', at)
    if (previous.active && !next.active) this.record('reference-restored', 'pixels', at)
    return this.snapshot()
  }
}
