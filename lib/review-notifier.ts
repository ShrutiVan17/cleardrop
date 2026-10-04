import type { AlertOutcome } from './delivery-review'

type Notice = { close(): void }
type NotificationPort = { available(): boolean; permission(): string; request(): Promise<string>; show(tag: string): Notice }

/** One OS notification attempt per review per foreground session. Never claims receipt/read. */
export class ReviewNotifier {
  private enabled = false
  private attempted = new Set<string>()
  private notice: Notice | null = null
  constructor(private port: NotificationPort) {}
  async enable(): Promise<AlertOutcome | 'enabled'> {
    if (!this.port.available()) return 'unsupported'
    try {
      const permission = this.port.permission() === 'granted' ? 'granted' : await this.port.request()
      this.enabled = permission === 'granted'
      return this.enabled ? 'enabled' : 'denied'
    } catch { this.enabled = false; return 'failed' }
  }
  disable() { this.enabled = false; this.notice?.close(); this.notice = null }
  notify(id: string): AlertOutcome {
    if (!this.enabled) return 'not-requested'
    if (this.attempted.has(id)) return 'not-requested'
    this.attempted.add(id)
    if (this.attempted.size > 64) this.attempted.delete(this.attempted.values().next().value!)
    if (!this.port.available()) return 'unsupported'
    if (this.port.permission() !== 'granted') return 'denied'
    try { this.notice?.close(); this.notice = this.port.show(id); return 'presented' }
    catch { return 'failed' }
  }
}
