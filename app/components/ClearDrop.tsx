'use client'

import { RefObject, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { advanceDetection, compareZone, emptyPersistence, validZone, Zone } from '@/lib/obstruction'
import { usePackageDetection } from '../hooks/usePackageDetection'

type Entry = { id: number; time: string; kind: string; detail: string }
const defaultZone: Zone = { x: .3, y: .5, w: .4, h: .4 }

export function ClearDrop({ videoRef, active, deviceId }: { videoRef: RefObject<HTMLVideoElement>; active: boolean; deviceId?: string }) {
  const [zone, setZone] = useState<Zone>(defaultZone)
  const [editing, setEditing] = useState(false)
  const [ready, setReady] = useState(false)
  const [ratio, setRatio] = useState(0)
  const [blocked, setBlocked] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')
  const [entries, setEntries] = useState<Entry[]>([])
  const [fit, setFit] = useState({ left: 0, top: 0, width: 0, height: 0 })
  const baseline = useRef<ImageData | null>(null)
  const persistence = useRef(emptyPersistence())
  const lastTime = useRef(-1)
  const drag = useRef<{x: number; y: number} | null>(null)
  const overlay = useRef<HTMLDivElement>(null)
  const frameCanvas = useRef<HTMLCanvasElement | null>(null)
  const seq = useRef(0)
  const packages = usePackageDetection(videoRef, active, zone, editing)
  useEffect(() => {
    if (packages.alert) log('AI parcel overlap', 'Repeated model detections overlap the doorway zone. Visually verify before acting.')
  }, [packages.alert])

  function log(kind: string, detail: string) {
    setEntries(items => [{ id: ++seq.current, time: new Date().toLocaleTimeString(), kind, detail }, ...items].slice(0, 20))
  }
  function reset() {
    baseline.current = null; persistence.current = emptyPersistence(); lastTime.current = -1
    setReady(false); setRatio(0); setBlocked(false); setConfirmed(false); setError('')
  }
  useEffect(() => {
    reset()
    setEntries([])
    try {
      const value = JSON.parse(localStorage.getItem(`cleardrop.zone.${deviceId || 'default'}`) || 'null')
      setZone(validZone(value) ? value : defaultZone)
    } catch { setZone(defaultZone) }
  }, [deviceId])
  useEffect(() => { if (!active) reset() }, [active])

  useEffect(() => {
    const video = videoRef.current
    const parent = video?.parentElement
    if (!video || !parent) return
    const resize = () => {
      if (!video.videoWidth) return
      const scale = Math.min(parent.clientWidth / video.videoWidth, parent.clientHeight / video.videoHeight)
      const width = video.videoWidth * scale, height = video.videoHeight * scale
      setFit({ left: (parent.clientWidth-width)/2, top: (parent.clientHeight-height)/2, width, height })
    }
    const observer = new ResizeObserver(resize)
    observer.observe(parent); video.addEventListener('loadedmetadata', resize); resize()
    return () => { observer.disconnect(); video.removeEventListener('loadedmetadata', resize) }
  }, [videoRef, active])

  function capture() {
    const video = videoRef.current
    if (!active || !video || video.readyState < 2 || !video.videoWidth) throw new Error('Start the live video first.')
    const canvas = frameCanvas.current || (frameCanvas.current = document.createElement('canvas'))
    canvas.width = 240; canvas.height = Math.max(1, Math.round(240 * video.videoHeight / video.videoWidth))
    const context = canvas.getContext('2d', { willReadFrequently: true })!
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    return context.getImageData(0, 0, canvas.width, canvas.height)
  }

  function calibrate() {
    try {
      baseline.current = capture(); persistence.current = emptyPersistence()
      setReady(true); setBlocked(false); setConfirmed(false); setError(''); setRatio(0)
      log('Reference saved', 'Current frame marked as an empty doorway. Monitoring started.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not capture reference') }
  }

  useEffect(() => {
    if (!active || !ready || editing) return
    const timer = setInterval(() => {
      const video = videoRef.current
      if (!video || video.paused || video.currentTime === lastTime.current || !baseline.current) return
      lastTime.current = video.currentTime
      try {
        const score = compareZone(baseline.current, capture(), zone)
        const previous = persistence.current
        const next = advanceDetection(previous, score, performance.now())
        persistence.current = next; setRatio(score); setBlocked(next.active)
        if (next.active && !previous.active) {
          setConfirmed(false)
          log('Possible obstruction', 'A persistent change appeared inside the doorway zone. Review the video.')
        } else if (!next.active && previous.active) {
          setConfirmed(false); log('Change cleared', 'The doorway looks similar to the saved reference again.')
        }
      } catch (e) { setError(e instanceof Error ? e.message : 'Analysis failed'); setReady(false) }
    }, 250)
    return () => clearInterval(timer)
  }, [active, ready, editing, zone, videoRef])

  function point(event: React.PointerEvent) {
    const rect = overlay.current!.getBoundingClientRect()
    return { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) }
  }
  const title = !active ? 'Monitoring paused' : editing ? 'Draw your doorway zone' : packages.alert ? 'AI detected a possible package obstruction' : !ready ? packages.status==='ready' ? 'AI parcel scanning active' : 'Save an empty-doorway reference' : blocked ? confirmed ? 'Package obstruction confirmed' : 'Possible doorway obstruction' : 'Watching for a persistent change'

  return <>
    {active && fit.width > 0 && videoRef.current?.parentElement && createPortal(<div ref={overlay} aria-label="Doorway zone editor" style={{ ...fit, position: 'absolute', pointerEvents: editing ? 'auto' : 'none', touchAction: 'none', zIndex: 5 }}
      onPointerDown={e => { if (!editing) return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = point(e) }}
      onPointerMove={e => { if (!drag.current) return; const p = point(e), a = drag.current; setZone({ x: Math.min(a.x,p.x), y: Math.min(a.y,p.y), w: Math.abs(a.x-p.x), h: Math.abs(a.y-p.y) }) }}
      onPointerUp={e => { if (!drag.current) return; drag.current = null; if (!validZone(zone)) setZone(defaultZone) }}
      onPointerCancel={() => { drag.current = null }}>
      <div style={{ position: 'absolute', left: `${zone.x*100}%`, top: `${zone.y*100}%`, width: `${zone.w*100}%`, height: `${zone.h*100}%`, border: `2px ${editing ? 'dashed' : 'solid'} ${blocked ? '#fb7185' : '#5eead4'}`, background: blocked ? '#fb71851c' : '#5eead414' }}>
        <span className="absolute left-0 top-0 bg-slate-950/90 px-2 py-1 text-xs text-white">{blocked ? 'Review obstruction' : 'Doorway zone'}</span>
      </div>
      {packages.boxes.map((d,i)=><div key={i} style={{position:'absolute',left:`${d.box.xmin*100}%`,top:`${d.box.ymin*100}%`,width:`${(d.box.xmax-d.box.xmin)*100}%`,height:`${(d.box.ymax-d.box.ymin)*100}%`,border:`2px solid ${d.overlap>=.25?'#fb923c':'#a78bfa'}`}}><span className="bg-slate-950/90 px-1 text-xs">Possible parcel · score {d.score.toFixed(2)}</span></div>)}
    </div>, videoRef.current.parentElement)}
    <section className="cleardrop-controls" aria-label="ClearDrop monitoring">
      <div className="flex flex-wrap justify-between gap-3 items-start">
        <div><p className="text-xs uppercase tracking-widest text-teal-300 mb-2">ClearDrop · Doorway watch</p><h2 className="text-xl font-semibold" role="status" aria-live="polite">{title}</h2></div>
        <span className="text-xs rounded-full border border-slate-600 px-3 py-2">{active && ready ? 'Local analysis · 4 fps' : 'Setup required'}</span>
      </div>
      <p className="text-sm text-slate-400 mt-3">1. Start video. 2. Mark the doorway. 3. Save a reference while the zone is empty.</p>
      <details className="cd-details my-4">
        <summary>Optional parcel AI · experimental</summary>
        <p className="text-xs text-amber-200 mt-2">This model missed the visible parcel in our initial Ring sample. Use visual review; an absent detection does not mean the doorway is clear.</p>
        <p className="text-xs text-slate-400 mt-2">Load before starting the short Ring sample. About 155 MB plus runtime files, cached when supported. Frames stay local. No API key required. AI scanning needs a saved zone but no empty-scene calibration.</p>
        <div className="flex gap-2 mt-3">
          {(packages.status==='off'||packages.status==='error') ? <button className="cd-button" onClick={packages.enable}>Load package model</button> : <button className="cd-button" onClick={packages.disable}>{packages.status==='loading'?'Cancel model loading':'Disable package AI'}</button>}
        </div>
        <p className="text-xs text-slate-300 mt-2" role="status">{packages.message} · {packages.scans} completed scans{packages.latency!==null ? ` · last scan ${(packages.latency/1000).toFixed(1)}s` : ''}</p>
        <p className={`text-sm mt-3 ${packages.decision.lastKnownObstruction?'text-orange-300':'text-slate-300'}`} role={packages.alert?'alert':'status'}>{packages.doorwayStatus}</p>
        {packages.alert && <p className="text-xs text-slate-400 mt-2">An alert is held through uncertain scans. Removal requires at least three non-overlapping scans spanning five seconds. A disconnected camera cannot confirm removal.</p>}
      </details>
      {packages.status!=='off'&&<p className="text-sm text-amber-200" role="status">{packages.doorwayStatus}</p>}
      <div className="flex flex-wrap gap-2 mt-4">
        <button className="cd-button" disabled={!active} onClick={() => {
          reset()
          if (editing) {
            if (!validZone(zone)) { setError('Choose a larger zone.'); return }
            try { localStorage.setItem(`cleardrop.zone.${deviceId || 'default'}`, JSON.stringify(zone)) } catch { setError('Zone could not be saved in this browser.') }
          }
          setEditing(!editing)
        }}>{editing ? 'Save zone' : 'Edit doorway zone'}</button>
        <button className="cd-button cd-primary" disabled={!active || editing} onClick={calibrate}>{ready ? 'Reset empty reference' : 'Doorway is empty — calibrate'}</button>
      </div>
      {editing && <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">{(['x','y','w','h'] as const).map(key => <label key={key} className="text-xs text-slate-300">{{x:'Left',y:'Top',w:'Width',h:'Height'}[key]} (%)<input className="w-full bg-slate-950 border border-slate-600 rounded mt-1 p-2" type="number" min={key==='w'||key==='h'?3:0} max={100} value={Math.round(zone[key]*100)} onChange={e => { const v=Math.max(0,Math.min(1,Number(e.target.value)/100)); setZone(z => { const n={...z,[key]:v}; n.w=Math.min(n.w,1-n.x); n.h=Math.min(n.h,1-n.y); return n }) }} /></label>)}</div>}
      {ready && <div className="mt-4"><div className="flex justify-between text-xs text-slate-400"><span>Changed area in zone (not confidence)</span><span>{Math.round(ratio*100)}%</span></div><div className="h-1.5 rounded bg-slate-800 mt-2"><div className={`h-full rounded ${blocked?'bg-rose-400':'bg-teal-300'}`} style={{width:`${ratio*100}%`}} /></div></div>}
      {blocked && <div role="alert" className="mt-4 border border-rose-400/50 rounded-xl p-4 bg-rose-400/10"><p>{confirmed ? 'You confirmed a package is blocking the marked area.' : 'An object or scene change persisted for 3 seconds. Check whether it blocks the doorway.'}</p><div className="flex flex-wrap gap-2 mt-3"><button className="cd-button" disabled={confirmed} onClick={() => {setConfirmed(true);log('Package confirmed', 'Manually confirmed by the viewer.')}}>Confirm package</button><button className="cd-button" onClick={() => { reset(); log('Dismissed', 'Monitoring paused. Clear the area and recalibrate before continuing.') }}>Dismiss & pause</button></div></div>}
      {error && <p role="alert" className="text-rose-300 mt-3">{error}</p>}
      <p className="text-xs text-slate-500 mt-4">The calibrated change detector and optional AI parcel detector are separate. AI can miss or misidentify objects; people, shadows, or camera movement may trigger change alerts. Scores are not accuracy guarantees. No frames are uploaded. Not a safety system.</p>
      <div className="mt-5 border-t border-slate-700 pt-4"><div className="flex justify-between"><h3 className="font-medium">Activity</h3><button className="text-xs text-slate-400" onClick={() => setEntries([])}>Clear activity</button></div>{entries.length === 0 ? <p className="text-sm text-slate-500 mt-3">No events yet. Calibrate to begin monitoring.</p> : <ol className="space-y-3 mt-3 max-h-48 overflow-auto">{entries.map(entry => <li key={entry.id} className="text-sm"><div className="flex justify-between gap-3"><strong className="font-medium">{entry.kind}</strong><time className="text-xs text-slate-500">{entry.time}</time></div><p className="text-xs text-slate-400 mt-1">{entry.detail}</p></li>)}</ol>}</div>
    </section>
  </>
}
