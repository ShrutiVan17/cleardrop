'use client'

import { useState, useEffect, useRef } from 'react'
import { Header } from '../components/Header'
import { AppNavigation } from '../components/AppNavigation'
import { ClearDrop } from '../components/ClearDrop'
import { RingConnection } from '../components/RingConnection'
import { ReplayLab } from '../components/ReplayLab'
import { RingReplayCapture, CapturedClip } from '../components/RingReplayCapture'
import { useWebRTCStream } from '../hooks/useWebRTCStream'

export default function Dashboard() {
  const [source, setSource] = useState<'ring' | 'replay'>('ring')
  const [capturedClip, setCapturedClip] = useState<CapturedClip | null>(null)
  const [deviceId, setDeviceId] = useState<string>()
  const [devices, setDevices] = useState<{id: string; name: string}[]>([])
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
      setLoading(true); setSetupError(''); setDeviceId(undefined); setDevices([])
      try {
        const configResponse = await fetch('/api/ring/config', { signal: controller.signal })
        const config = await configResponse.json()
        if (!configResponse.ok || config.error || !config.mode) throw new Error(config.error || 'Ring has not been set up yet.')
        const response = await fetch('/api/ring/devices', { signal: controller.signal })
        const data = await response.json()
        if (!response.ok || data.error) throw new Error(data.error || 'We could not reach Ring.')
        if (!data.devices?.length) throw new Error('No camera was found for this Ring connection.')
        if (!controller.signal.aborted) { setDevices(data.devices); setDeviceId(data.devices[0].id) }
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
    window.history.replaceState(null, '', view === 'replay' ? '/doorway?view=replay' : '/doorway')
  }

  return <>
    <Header connected={false} enabledCount={0} simpleMode />
    <AppNavigation active={source} onSelect={select} />
    <main id="main-content" className="cd-shell" tabIndex={-1}>
      {source === 'replay' ? <div className="cd-lab"><ReplayLab initialClip={capturedClip} /></div> : <>
        <section className="cd-hero">
          <p className="cd-eyebrow">MY DOORWAY</p>
          <h1>A delivery shouldn’t block your way.</h1>
          <p>A parcel photo tells you what arrived. ClearDrop helps you review whether the space you marked at your doorway has changed.</p>
          <a className="cd-button mt-4" href="/phone">Use phone camera instead</a>
        </section>

        {loading ? <section className="cd-empty-state" role="status"><h2>Finding your camera…</h2><p>This should only take a moment.</p></section> : setupError ? <>
          <p className="cd-help" role="status">{setupError}</p>
          <RingConnection onConnected={() => setRetry(value => value + 1)} />
        </> : <>
          <div className="cd-demo-notice"><strong>Ring API connected</strong><span>Camera discovered. Start video to verify playback; discovery alone does not prove the camera is live.</span></div>
          {devices.length > 1 && <label className="block mb-4">Choose camera<select className="cd-input" value={deviceId || ''} onChange={async event => { const id = event.target.value; await stopStream(); setDeviceId(id) }}>{devices.map(device => <option key={device.id} value={device.id}>{device.name}</option>)}</select></label>}
          <section className="cd-camera-card" aria-label="Doorway camera">
            <div className="cd-card-heading"><span>{devices.find(device => device.id === deviceId)?.name || 'Ring camera'}</span><span>{streamActive ? 'Video playing' : connecting ? 'Connecting…' : 'Camera paused'}</span></div>
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
          <ClearDrop videoRef={videoRef} active={streamActive} deviceId={deviceId} source="ring" />
          <details className="cd-details cd-extra-tools"><summary>Renew or disconnect Ring</summary><RingConnection onConnected={() => { void stopStream(); setRetry(value => value + 1) }} /><button className="cd-button mt-3" onClick={async () => { await stopStream(); const response = await fetch('/api/ring/connect', { method: 'DELETE' }); if (response.ok) setRetry(value => value + 1); else setSetupError('Could not disconnect Ring. Please reload and try again.') }}>Disconnect this browser</button></details>
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
