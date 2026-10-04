import type { CameraSource, ChangeObservation } from './change-monitor'

export type ReviewPhase = 'needs-review' | 'acknowledged' | 'checking-removal' | 'resolved'
export type ReviewCause = 'scene-change' | 'viewer-report'
export type ReviewView = 'concern' | 'reference-restored' | 'unknown'
export type AlertOutcome = 'not-requested' | 'presented' | 'denied' | 'unsupported' | 'failed'
export type DeliveryReview = {
  id: string; source: CameraSource; cause: ReviewCause; phase: ReviewPhase; view: ReviewView
  version: number; createdAt: number; updatedAt: number; acknowledgedAt: number | null; resolvedAt: number | null
  alert: AlertOutcome
}
export const validReviewId = (id: unknown): id is string => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)

export function createReview(id: string, source: CameraSource, cause: ReviewCause, at: number): DeliveryReview {
  if (!validReviewId(id) || !Number.isFinite(at) || at < 0) throw new Error('Invalid review identity or clock.')
  return { id, source, cause, phase: 'needs-review', view: 'concern', version: 1,
    createdAt: at, updatedAt: at, acknowledgedAt: null, resolvedAt: null, alert: 'not-requested' }
}
export type ReviewCommand =
  | { kind: 'acknowledge' }
  | { kind: 'check-removal' }
  | { kind: 'resolve'; checkedEmpty: boolean; observation: ChangeObservation; freshVideo: boolean }
  | { kind: 'view'; value: ReviewView; humanReport?: boolean }
  | { kind: 'alert'; outcome: AlertOutcome }

/** User review decisions, not authenticated sensor evidence or parcel-recognition claims. */
export function advanceReview(review: DeliveryReview, command: ReviewCommand, at: number): DeliveryReview {
  if (!Number.isFinite(at) || at < review.updatedAt) throw new Error('Review clock moved backwards.')
  if (review.phase === 'resolved') throw new Error('This review is already closed.')
  let change: Partial<DeliveryReview>
  switch (command.kind) {
    case 'acknowledge':
      if (review.phase !== 'needs-review') return review
      change = { phase: 'acknowledged', acknowledgedAt: at }; break
    case 'check-removal':
      if (review.phase === 'checking-removal') return review
      if (review.phase !== 'acknowledged') throw new Error('Acknowledge this review before checking removal.')
      change = { phase: 'checking-removal' }; break
    case 'resolve':
      if (review.phase !== 'checking-removal') throw new Error('Start the removal check first.')
      if (!command.checkedEmpty || !command.freshVideo || !command.observation.ready || command.observation.blocked || command.observation.unresolved || command.observation.reportedParcel) {
        throw new Error('Check a fresh, empty view and save its reference before closing this review.')
      }
      change = { phase: 'resolved', view: 'reference-restored', resolvedAt: at }; break
    case 'view':
      if (review.view === command.value && (!command.humanReport || review.cause === 'viewer-report')) return review
      change = { view: command.value, ...(command.humanReport ? { cause: 'viewer-report' as const } : {}) }; break
    case 'alert':
      if (review.alert === command.outcome) return review
      change = { alert: command.outcome }; break
  }
  return { ...review, ...change, updatedAt: at, version: review.version + 1 }
}

export function reviewView(sample: ChangeObservation): ReviewView {
  if (sample.reportedParcel) return 'concern'
  if (!sample.ready) return 'unknown'
  return sample.blocked || sample.unresolved ? 'concern' : 'reference-restored'
}

/** Strict cloud boundary: only statuses/timestamps, never frames or arbitrary nested data. */
export function reviewMetadata(value: unknown): DeliveryReview {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid review.')
  const r = value as DeliveryReview
  const allowed = ['id','source','cause','phase','view','version','createdAt','updatedAt','acknowledgedAt','resolvedAt','alert']
  if (Object.keys(value).some(key => !allowed.includes(key)) || !validReviewId(r.id) ||
    !['ring','phone','generated-video','unknown'].includes(r.source) || !['scene-change','viewer-report'].includes(r.cause) ||
    !['needs-review','acknowledged','checking-removal','resolved'].includes(r.phase) || !['concern','reference-restored','unknown'].includes(r.view) ||
    !['not-requested','presented','denied','unsupported','failed'].includes(r.alert) || !Number.isInteger(r.version) || r.version < 1 || r.version > 100000 ||
    !Number.isSafeInteger(r.createdAt) || !Number.isSafeInteger(r.updatedAt) || r.createdAt < 0 || r.updatedAt < r.createdAt ||
    (r.acknowledgedAt !== null && (!Number.isSafeInteger(r.acknowledgedAt) || r.acknowledgedAt < r.createdAt || r.acknowledgedAt > r.updatedAt)) ||
    (r.resolvedAt !== null && (!Number.isSafeInteger(r.resolvedAt) || r.resolvedAt < (r.acknowledgedAt ?? r.createdAt) || r.resolvedAt > r.updatedAt)) ||
    (r.phase === 'needs-review') !== (r.acknowledgedAt === null) || (r.phase === 'resolved') !== (r.resolvedAt !== null)) throw new Error('Invalid review metadata.')
  return { id:r.id, source:r.source, cause:r.cause, phase:r.phase, view:r.view, version:r.version,
    createdAt:r.createdAt, updatedAt:r.updatedAt, acknowledgedAt:r.acknowledgedAt, resolvedAt:r.resolvedAt, alert:r.alert }
}

export function validReviewReplacement(previous: DeliveryReview, next: DeliveryReview): boolean {
  const edges: Record<ReviewPhase, ReviewPhase[]> = {
    'needs-review': ['needs-review','acknowledged'], acknowledged: ['acknowledged','checking-removal'],
    'checking-removal': ['checking-removal','resolved'], resolved: [],
  }
  return previous.id === next.id && previous.source === next.source && previous.createdAt === next.createdAt &&
    next.version === previous.version + 1 && next.updatedAt >= previous.updatedAt && edges[previous.phase].includes(next.phase) &&
    (previous.cause !== 'viewer-report' || next.cause === 'viewer-report') &&
    (previous.acknowledgedAt === null || previous.acknowledgedAt === next.acknowledgedAt)
}
