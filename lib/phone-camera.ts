export type CameraState = { status: 'idle' | 'requesting' | 'live' | 'error'; message: string }

export function cameraError(error: unknown): string {
  const name = (error as { name?: string })?.name
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Camera access was blocked. Allow camera access in your browser’s site settings, then try again.'
  if (name === 'NotFoundError') return 'No camera was found on this device.'
  if (name === 'NotReadableError') return 'The camera is busy. Close other camera apps, then try again.'
  return 'The camera could not start. Use Chrome or Safari over HTTPS and try again.'
}

/** Owns only this page’s camera tracks. Late permission responses cannot restart a stopped camera. */
export class PhoneCamera {
  private generation = 0
  private stream: MediaStream | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private disposed = false
  constructor(private options: {
    video: () => HTMLVideoElement | null
    getMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>
    onState: (state: CameraState) => void
    now?: () => number
  }) {}
  private emit(state: CameraState) { if (!this.disposed) this.options.onState(state) }
  stop(message = '') {
    ++this.generation
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    const stream = this.stream
    this.stream = null
    stream?.getTracks().forEach(track => { track.onended = null; track.onmute = null; track.stop() })
    const video = this.options.video()
    if (video) { video.pause(); video.srcObject = null }
    this.emit({ status: message ? 'error' : 'idle', message })
  }
  async start() {
    this.stop()
    const generation = this.generation
    this.emit({ status: 'requesting', message: 'Allow camera access when your browser asks.' })
    try {
      const stream = await this.options.getMedia({ audio: false, video: {
        facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 15, max: 30 },
      } })
      if (generation !== this.generation || this.disposed) { stream.getTracks().forEach(track => track.stop()); return }
      this.stream = stream
      const video = this.options.video()
      if (!video) { this.stop(); return }
      const tracks = stream.getVideoTracks()
      if (!tracks.length) throw new Error('No video track')
      for (const track of tracks) {
        track.onended = () => this.stop('Camera disconnected. Tap Start phone camera to reconnect and save a new empty reference.')
        track.onmute = () => this.stop('Camera was interrupted. Keep this app visible, then start the camera again.')
      }
      video.srcObject = stream
      await video.play()
      if (generation !== this.generation || this.disposed) return
      const now = this.options.now || Date.now
      let previous = -1, lastFrame = now(), live = false
      this.timer = setInterval(() => {
        if (video.readyState >= 2 && video.videoWidth > 0 && !video.paused && video.currentTime !== previous) {
          previous = video.currentTime; lastFrame = now()
          if (!live) { live = true; this.emit({ status: 'live', message: '' }) }
        } else if (now() - lastFrame >= 8000) {
          this.stop('Video stopped updating. Start the camera again; doorway status is unknown until you recalibrate.')
        }
      }, 500)
    } catch (error) {
      if (generation === this.generation && !this.disposed) this.stop(cameraError(error))
    }
  }
  dispose() { this.disposed = true; this.stop() }
}
