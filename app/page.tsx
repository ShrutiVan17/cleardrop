'use client'

import { useState, useEffect, useRef } from 'react'
import { useVideoProcessing } from '@/lib/video-processors/useVideoProcessing'
import '@/lib/video-processors' // Register built-in processors

import { Header } from './components/Header'
import { AppNavigation } from './components/AppNavigation'
import { ClearDrop } from './components/ClearDrop'
import { ReplayLab } from './components/ReplayLab'
import { RingReplayCapture, CapturedClip } from './components/RingReplayCapture'
import { EventPanel } from './components/EventPanel'
import { ProcessorPanel } from './components/ProcessorPanel'
import { useWebRTCStream } from './hooks/useWebRTCStream'
import { useEventStream } from './hooks/useEventStream'
import { useCanvasOverlay } from './hooks/useCanvasOverlay'

type RightPanelTab = 'events' | 'processors'
type AuthMode = 'access_token' | 'refresh_token' | null

export default function Dashboard() {
  const [source,setSource] = useState<'ring'|'replay'>('ring')
  const [capturedClip,setCapturedClip] = useState<CapturedClip|null>(null)
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('events')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined)
  const [deviceError, setDeviceError] = useState<string | null>(null)
  const [authMode, setAuthMode] = useState<AuthMode>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(()=>{if(new URLSearchParams(window.location.search).get('view')==='replay')setSource('replay')},[])

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Fetch auth mode on mount
  useEffect(() => {
    fetch('/api/ring/config')
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setAuthError(data.error)
        } else {
          setAuthMode(data.mode)
        }
      })
      .catch(err => setAuthError(err.message))
      .finally(() => setLoading(false))
  }, [])

  // Auto-discover device on mount (after auth mode is confirmed)
  useEffect(() => {
    if (!authMode) return
    fetch('/api/ring/devices')
      .then(res => res.json())
      .then(data => {
        if (data.devices && data.devices.length > 0) {
          setDeviceId(data.devices[0].id)
        } else {
          setDeviceError(data.error || 'No devices found')
        }
      })
      .catch(err => setDeviceError(err.message))
  }, [authMode])

  // Custom hooks
  const { streamActive, connecting, diagnostics, streamError, startStream, stopStream } = useWebRTCStream({ videoRef, deviceId })
  const { events, connected } = useEventStream({ enabled: source==='ring' && authMode==='refresh_token' })
  const { processors, results, toggleProcessor, enabledCount } = useVideoProcessing({
    video: videoRef.current,
    canvas: canvasRef.current,
    enabled: streamActive,
    fps: 10,
  })

  // Canvas overlay rendering
  useCanvasOverlay({ videoRef, canvasRef, events, results })

  // Set webhook URL on mount
  useEffect(() => {
    setWebhookUrl(`${window.location.origin}/api/webhook`)
  }, [])

  const isSimpleMode = authMode === 'access_token'
  const sourceTabs = <AppNavigation active={source} onSelect={async view=>{if(view==='replay')await stopStream();setSource(view);window.history.replaceState(null,'',view==='replay'?'/?view=replay':'/')}} />
  if(source==='replay') return <div className="min-h-screen"><Header connected={false} enabledCount={0} simpleMode />{sourceTabs}<ReplayLab initialClip={capturedClip} /></div>

  // Loading state
  if (loading) {
    return (
      <div><Header connected={false} enabledCount={0} simpleMode />{sourceTabs}<div className="min-h-[70vh] flex items-center justify-center bg-dash-bg">
        <p className="text-slate-400">Loading...</p>
      </div></div>
    )
  }

  // Auth error state
  if (authError) {
    return (
      <div><Header connected={false} enabledCount={0} simpleMode />{sourceTabs}<div className="min-h-[70vh] flex items-center justify-center bg-dash-bg p-6">
        <div className="max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-8">
          <h1 className="text-2xl font-semibold mb-4">Connect Ring to start.</h1>
          <p className="text-slate-400">Add a fresh Playground token to watch your camera here. You can try the demo without one.</p>
          <details className="cd-details my-5"><summary>Connection setup</summary><p className="text-sm text-amber-200 mt-3">{authError}</p><ol className="list-decimal pl-5 space-y-3 my-4 text-sm text-slate-300"><li>Generate a token in the Ring Playground.</li><li>Set RING_ACCESS_TOKEN in .env.local. Never publish it.</li><li>Restart the server and retry.</li></ol></details>
          <div className="flex flex-wrap gap-3"><a className="cd-button cd-primary" href="https://developer.amazon.com/ring/console/playground" target="_blank" rel="noreferrer">Open Ring Playground</a><a className="cd-button" href="/demo">Try interactive demo</a><button className="cd-button" onClick={()=>window.location.reload()}>Retry connection</button></div>
          <p className="text-xs text-slate-400 mt-5">Demo = simulation. Watch Ring = actual camera or Ring sandbox footage.</p>
        </div>
      </div></div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        connected={isSimpleMode ? false : connected}
        enabledCount={isSimpleMode ? 0 : enabledCount}
        simpleMode={isSimpleMode}
      />
      {sourceTabs}

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Video section — full width in simple mode, 60% in full mode */}
        <div className="w-full max-w-5xl mx-auto p-4 flex flex-col">
          <h1 className="text-2xl font-semibold mb-2">Watch your doorway</h1>
          <p className="text-sm text-slate-400 mb-4">Start video, mark the doorway, then save an empty reference.</p>
          <div className="relative bg-black rounded-xl overflow-hidden h-[55vh] min-h-[280px]">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain" />
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

            {!streamActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <button
                  onClick={startStream}
                  disabled={!deviceId || connecting}
                  className={`px-6 py-3 font-bold rounded-lg transition ${deviceId ? 'bg-dash-cyan text-black hover:bg-cyan-300' : 'bg-slate-600 text-slate-400 cursor-not-allowed'}`}
                >
                  {connecting ? 'Connecting — waiting for video…' : deviceId ? '▶ Start Live Stream' : '⏳ Discovering device...'}
                </button>
                {streamError && (
                  <p className="text-red-400 text-sm">{streamError}</p>
                )}
                {deviceError && (
                  <p className="text-red-400 text-sm">{deviceError}</p>
                )}
              </div>
            )}

            {(streamActive || connecting) && (
              <button
                onClick={stopStream}
                className="absolute z-10 top-3 right-3 px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-500"
              >
                ■ Stop
              </button>
            )}
          </div>
          <details className="text-xs text-slate-400 mt-2"><summary>Connection details</summary><p role="status">{diagnostics}</p></details>
          <details className="cd-details mt-3"><summary>Record a clip for testing</summary><RingReplayCapture videoRef={videoRef} active={streamActive} onCaptured={setCapturedClip} /></details>
          {capturedClip&&<div className="flex gap-2"><button className="cd-button" onClick={async()=>{await stopStream();setSource('replay')}}>Evaluate recorded Ring clip</button><button className="cd-button" onClick={()=>setCapturedClip(null)}>Discard recording from memory</button></div>}
          <ClearDrop videoRef={videoRef} active={streamActive} deviceId={deviceId} />

          {/* Webhook URL helper — only in full mode */}
          {!isSimpleMode && (
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <span>Webhook URL:</span>
              <code className="bg-dash-card px-2 py-1 rounded text-slate-300 flex-1 truncate">{webhookUrl}</code>
              <button
                onClick={() => navigator.clipboard.writeText(webhookUrl)}
                className="px-2 py-1 bg-dash-card rounded hover:bg-slate-600 text-slate-400"
              >
                Copy
              </button>
            </div>
          )}
        </div>

        {/* Right panel — only shown in refresh_token (full) mode */}
        {!isSimpleMode && (
          <details className="cd-details m-4 lg:max-w-sm"><summary>Developer tools</summary><div>
            {/* Tab switcher */}
            <div className="p-3 border-b border-slate-700 flex gap-2">
              <button
                onClick={() => setRightPanelTab('events')}
                className={`text-xs px-3 py-1 rounded-full ${rightPanelTab === 'events' ? 'bg-dash-cyan text-black font-medium' : 'bg-dash-card text-slate-400 hover:bg-slate-600'}`}
              >
                Events
              </button>
              <button
                onClick={() => setRightPanelTab('processors')}
                className={`text-xs px-3 py-1 rounded-full ${rightPanelTab === 'processors' ? 'bg-dash-cyan text-black font-medium' : 'bg-dash-card text-slate-400 hover:bg-slate-600'}`}
              >
                Processors {enabledCount > 0 && `(${enabledCount})`}
              </button>
            </div>

            {rightPanelTab === 'events' ? (
              <EventPanel events={events} webhookUrl={webhookUrl} />
            ) : (
              <ProcessorPanel processors={processors} results={results} onToggle={toggleProcessor} />
            )}
          </div></details>
        )}
      </div>
    </div>
  )
}
