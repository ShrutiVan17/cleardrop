import { advanceDetection, compareZone, emptyPersistence, Frame, Persistence, validZone, Zone } from './obstruction'

export type ChangeObservation = {
  ready: boolean
  blocked: boolean
  unresolved: boolean
  ratio: number
  scans: number
}

/** Shared by real camera monitoring and controlled video tests. No semantic AI claims. */
export class ChangeMonitor {
  private reference: Frame | null = null
  private zone: Zone | null = null
  private persistence: Persistence = emptyPersistence()
  private lastSample: number | null = null
  private state: ChangeObservation = { ready: false, blocked: false, unresolved: false, ratio: 0, scans: 0 }

  snapshot(): ChangeObservation { return { ...this.state } }

  pause(): ChangeObservation {
    this.reference = null
    this.persistence = emptyPersistence()
    this.lastSample = null
    this.state = { ...this.state, ready: false, blocked: false, ratio: 0 }
    return this.snapshot()
  }

  calibrate(frame: Frame, zone: Zone, at: number): ChangeObservation {
    if (!validZone(zone) || !Number.isFinite(at)) throw new Error('Choose a valid doorway area and fresh reference.')
    // Copy pixels: a reusable capture buffer must not silently change the reference.
    this.reference = { width: frame.width, height: frame.height, data: new Uint8ClampedArray(frame.data) }
    this.zone = { ...zone }
    this.persistence = emptyPersistence()
    this.lastSample = at
    this.state = { ready: true, blocked: false, unresolved: false, ratio: 0, scans: 0 }
    return this.snapshot()
  }

  observe(frame: Frame, at: number): ChangeObservation {
    if (!this.reference || !this.zone || !Number.isFinite(at)) return this.snapshot()
    if (this.lastSample !== null && at <= this.lastSample) return this.snapshot()
    // A gap cannot stand in for continuously observed presence or removal.
    if (this.lastSample !== null && at - this.lastSample > 1500) return this.pause()
    const ratio = compareZone(this.reference, frame, this.zone)
    const previous = this.persistence
    const next = advanceDetection(previous, ratio, at)
    this.persistence = next
    this.lastSample = at
    this.state = { ready: true, blocked: next.active,
      unresolved: next.active || (this.state.unresolved && !(previous.active && !next.active)),
      ratio, scans: this.state.scans + 1 }
    return this.snapshot()
  }
}
