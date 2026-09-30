'use client'

import { useState, useEffect, useRef } from 'react'
import { Header } from './components/Header'
import { AppNavigation } from './components/AppNavigation'
import { ClearDrop } from './components/ClearDrop'
import { ReplayLab } from './components/ReplayLab'
import { RingReplayCapture, CapturedClip } from './components/RingReplayCapture'
import { useWebRTCStream } from './hooks/useWebRTCStream'

export default function Dashboard() {
  const [source, setSource] = useState<'ring' | 'replay'>('ring')
  const [capturedClip, setCapturedClip] = useState<CapturedClip | null>(null)
  const [deviceId, setDeviceId] = useState<string>()
  const [setupError, setSetupError] = useState('')
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const { streamActive, connecting, diagnostics, streamError, startStream, stopStream } = useWebRTCStream({ videoRef, deviceId })

  useEffect(() => {
    setSource(new URLSearchParams(window.location.search).get('view') === 'replay' ? 'replay' : 'ring')
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const timeout = setTimeout(() => {
      controller.abort()
      setSetupError('Ring took too long to respond. Check your connection and try again.')
      setLoading(false)
    }, 15000)
    async function connect() {
      setLoading(true); setSetupError(''); setDeviceId(undefined)
      try {
        const configResponse = await fetch('/api/ring/config', { signal: controller.signal })
        const config = await configResponse.json()
        if (!configResponse.ok || config.error || !config.mode) throw new Error(config.error || 'Ring has not been set up yet.')
        const response = await fetch('/api/ring/devices', { signal: controller.signal })
        const data = await response.json()
        if (!response.ok || data.error) throw new Error(data.error || 'We could not reach Ring.')
        if (!data.devices?.length) throw new Error('No camera was found for this Ring connection.')
        if (!controller.signal.aborted) setDeviceId(data.devices[0].id)
      } catch (error) {
        if (!controller.signal.aborted) setSetupError(error instanceof Error ? error.message : 'Connection unavailable.')
      } finally {
        clearTimeout(timeout)
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void connect()
    return () => { clearTimeout(timeout); controller.abort() }
  }, [retry])

  async function select(view: 'ring' | 'replay') {
    if (view === 'replay') await stopStream()
    setSource(view)
    window.history.replaceState(null, '', view === 'replay' ? '/?view=replay' : '/')
  }

  return <>
    <Header connected={false} enabledCount={0} simpleMode />
    <AppNavigation active={source} onSelect={select} />
    <main id="main-content" className="cd-shell" tabIndex={-1}>
      {source === 'replay' ? <div className="cd-lab"><ReplayLab initialClip={capturedClip} /></div> : <>
        <section className="cd-hero">
          <p className="cd-eyebrow">MY DOORWAY</p>
          <h1>A clear view of your entrance.</h1>
          <p>Watch your camera and check for changes near the door.</p>
          <a className="cd-button mt-4" href="/phone">Use phone camera instead</a>
        </section>

        {loading ? <section className="cd-empty-state" role="status"><h2>Finding your camera…</h2><p>This should only take a moment.</p></section> : setupError ? <section className="cd-empty-state">
          <span className="cd-empty-icon" aria-hidden="true">⌂</span>
          <h2>Your camera isn’t connected yet.</h2>
          <p>Use your phone camera to test real doorway changes, or explore the illustrated demo.</p>
          <a className="cd-button cd-primary" href="/demo">Try the demo</a>
          <details className="cd-details cd-setup"><summary>Connect a Ring camera</summary>
            <p>This preview needs a Ring connection configured by the person running the app.</p>
            <ol className="list-decimal pl-5 space-y-2 my-4"><li>Generate a token in the <a className="cd-text-link" href="https://developer.amazon.com/ring/console/playground" target="_blank" rel="noreferrer">Ring Playground</a>.</li><li>Set <code>RING_ACCESS_TOKEN</code> in <code>.env.local</code>. Keep it private.</li><li>Restart the app, then check the connection again.</li></ol>
            <button className="cd-button" onClick={() => setRetry(value => value + 1)}>Check connection</button>
            <p className="cd-error mt-3" role="status">{setupError}</p>
          </details>
        </section> : <>
          <section className="cd-camera-card" aria-label="Doorway camera">
            <div className="cd-card-heading"><span>Front entrance</span><span>{streamActive ? 'Video playing' : connecting ? 'Connecting…' : 'Camera paused'}</span></div>
            <div className="cd-video">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain" aria-label="Ring doorway video" />
              {!streamActive && <div className="cd-video-placeholder">
                <p>{connecting ? 'Opening your camera…' : 'Your doorway, when you need it.'}</p>
                {!connecting && <button onClick={startStream} className="cd-button cd-primary">{streamError ? 'Reconnect camera' : 'Start camera'}</button>}
                {connecting && <button onClick={stopStream} className="cd-button">Cancel</button>}
              </div>}
              {streamActive && <button onClick={stopStream} className="cd-button cd-video-stop">Stop camera</button>}
            </div>
            {streamError && <p className="cd-error p-4" role="alert">{streamError}</p>}
          </section>
          <ClearDrop videoRef={videoRef} active={streamActive} deviceId={deviceId} />
        </>}

        <details className="cd-details cd-extra-tools"><summary>Testing & connection details</summary>
          <p className="mb-3">Optional tools for checking the connection and reviewing saved video.</p>
          <p className="cd-diagnostics" role="status">{diagnostics}</p>
          {deviceId && <div className="cd-lab"><RingReplayCapture videoRef={videoRef} active={streamActive} onCaptured={setCapturedClip} /></div>}
          <div className="flex flex-wrap gap-3 mt-3"><button className="cd-button" onClick={() => select('replay')}>{capturedClip ? 'Review recorded clip' : 'Test a saved clip'}</button>{capturedClip && <button className="cd-button" onClick={() => setCapturedClip(null)}>Discard recording</button>}</div>
        </details>
      </>}
      <footer className="cd-footer">Video analysis stays on your device. Always check the doorway yourself. Not a safety system.</footer>
    </main>
  </>
}
