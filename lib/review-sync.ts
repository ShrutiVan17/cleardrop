import type { DeliveryReview } from './delivery-review'

/** Ordered snapshot writes: no skipped versions, no infinite retries or hidden data uploads. */
export class ReviewSync {
  private queue: DeliveryReview[] = []
  private running = false
  private paused = false
  private disposed = false
  private overflowed = false
  constructor(private write: (review: DeliveryReview) => Promise<void>, private status: (state: 'saving'|'saved'|'error', detail?: string) => void) {}
  enqueue(review: DeliveryReview) {
    if (this.disposed || this.overflowed || this.queue.some(item => item.id === review.id && item.version === review.version)) return
    if (this.queue.length >= 64) { this.overflowed = true; this.paused = true; this.status('error','Sync queue is full. Download your local history and reload; retry cannot recover dropped versions.'); return }
    this.queue.push({ ...review }); void this.flush()
  }
  retry() { if (this.overflowed || this.disposed) return; this.paused = false; void this.flush() }
  dispose() { this.disposed = true; this.queue = [] }
  private async flush() {
    if (this.running || this.paused || this.disposed) return
    this.running = true
    while (this.queue.length && !this.disposed && !this.paused) {
      const review = this.queue[0]; this.status('saving')
      try { await this.write(review); if (this.disposed) break; this.queue.shift(); this.status('saved') }
      catch (failure) { if (this.disposed) break; this.paused = true; this.status('error', failure instanceof Error ? failure.message : 'Review was not saved.'); break }
    }
    this.running = false
  }
}
