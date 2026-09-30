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
  const [unresolved, setUnresolved] = useState(false)
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
    setUnresolved(false)
    try {
      const value = JSON.parse(localStorage.getItem(`cleardrop.zone.${deviceId || 'default'}`) || 'null')
      setZone(validZone(value) ? value : defaultZone)
    } catch { setZone(defaultZone) }
  }, [deviceId])
  useEffect(() => { if (!active) { reset(); setEditing(false) } }, [active])

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
      if (!validZone(zone)) throw new Error('Mark a doorway area inside the video first.')
      baseline.current = capture(); persistence.current = emptyPersistence()
      setReady(true); setBlocked(false); setUnresolved(false); setConfirmed(false); setError(''); setRatio(0)
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
          setUnresolved(true)
          setConfirmed(false)
          log('Possible obstruction', 'A persistent change appeared inside the doorway zone. Review the video.')
        } else if (!next.active && previous.active) {
          setUnresolved(false)
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
  const title = !active ? unresolved ? 'Camera paused — earlier change still needs review' : 'Start the camera to begin' : editing ? 'Mark the space to keep clear' : packages.alert ? 'Please check your doorway' : !ready ? 'Is the marked area empty?' : blocked ? confirmed ? 'You confirmed a parcel is in the way' : 'Something changed near your door' : 'Watching your doorway'

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
      <h2 className="text-xl font-semibold" role="status" aria-live="polite">{title}</h2>
      {unresolved && (!active || !ready) && <p className="cd-review-alert" role="alert">The earlier doorway change has not been verified as removed. Reconnect, check the area yourself, and save a new empty reference only when it is actually clear.</p>}
      <p className="cd-help">{!active ? 'You’ll be able to mark the doorway once the video is playing.' : editing ? 'Drag a box over the doorway in the video, or use the position fields below.' : !ready ? 'Keep the marked area empty, then start watching. Change the area if it doesn’t cover your doorway.' : 'We’ll ask you to check if a change stays in the marked area. Keep this page open.'}</p>
      {active && <div className="flex flex-wrap gap-3 mt-4">
        {editing ? <button className="cd-button cd-primary" onClick={() => {
          if (!validZone(zone)) { setError('Choose a larger area inside the video.'); return }
          try { localStorage.setItem(`cleardrop.zone.${deviceId || 'default'}`, JSON.stringify(zone)); setError('') } catch { setError('The area works for this session, but could not be saved in this browser.') }
          setEditing(false)
        }}>Save area</button> : <>
          {!ready && <button className="cd-button cd-primary" onClick={calibrate}>Area is empty — start watching</button>}
          <button className="cd-button" onClick={() => { reset(); setEditing(true) }}>Change doorway area</button>
        </>}
      </div>}
      {editing && <fieldset className="mt-4"><legend className="text-sm mb-2">Area position (percent of video)</legend><div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{(['x','y','w','h'] as const).map(key => <label key={key} className="text-sm">{{x:'Left',y:'Top',w:'Width',h:'Height'}[key]}<input className="cd-input" type="number" min={key==='w'||key==='h'?3:0} max={100} value={Math.round(zone[key]*100)} onChange={e => { const v=Math.max(0,Math.min(1,Number(e.target.value)/100)); setZone(z => { const n={...z,[key]:v}; n.w=Math.min(n.w,1-n.x); n.h=Math.min(n.h,1-n.y); return n }) }} /></label>)}</div></fieldset>}
      {blocked && <div role="alert" className="cd-review-alert"><p>{confirmed ? 'You confirmed a parcel is blocking the marked area.' : 'A change stayed in the marked area for three seconds. Is a parcel blocking the doorway?'}</p><div className="flex flex-wrap gap-2 mt-3">{!confirmed && <button className="cd-button" onClick={() => {setConfirmed(true);log('Package confirmed', 'Manually confirmed by the viewer.')}}>Yes, there’s a parcel</button>}<button className="cd-button" onClick={() => { reset(); log('Dismissed', 'Monitoring paused. Clear the area and save a new reference before continuing.') }}>Dismiss and pause</button></div></div>}
      {packages.status!=='off' && <p className="cd-help" role="status">{packages.doorwayStatus}</p>}
      {error && <p role="alert" className="cd-error mt-3">{error}</p>}
      <p className="cd-fine-print">Shadows, people, and camera movement can also cause alerts. An alert needs your review. This does not measure parcel size or physical walking clearance.</p>
      <details className="cd-details mt-4">
        <summary>More options</summary>
        {active && ready && <div className="mb-4"><p className="cd-help">Changed area: {Math.round(ratio*100)}%. This is not a confidence score.</p><button className="cd-button" disabled={editing} onClick={calibrate}>Save a new empty reference</button></div>}
        <h3 className="font-semibold mt-3">Experimental parcel recognition</h3>
        <p className="cd-help">This model missed the parcel in our initial Ring test. It can miss or misidentify objects. No detection does not mean the doorway is clear.</p>
        <p className="cd-help">Optional download: about 155 MB plus runtime files. Frames stay on this device. You do not need this model for change alerts.</p>
        <div className="flex gap-2 mt-3">
          {(packages.status==='off'||packages.status==='error') ? <button className="cd-button" onClick={packages.enable}>Load experimental model</button> : <button className="cd-button" onClick={packages.disable}>{packages.status==='loading'?'Cancel download':'Turn off model'}</button>}
        </div>
        <p className="cd-help" role="status">{packages.message} · {packages.scans} scans{packages.latency!==null ? ` · last scan ${(packages.latency/1000).toFixed(1)}s` : ''}</p>
        {entries.length > 0 && <div className="mt-5"><div className="flex justify-between items-center"><h3 className="font-semibold">Recent activity</h3><button className="cd-button" onClick={() => setEntries([])}>Clear list</button></div><ol className="space-y-3 mt-3 max-h-48 overflow-auto">{entries.map(entry => <li key={entry.id} className="text-sm"><div className="flex justify-between gap-3"><strong className="font-medium">{entry.kind}</strong><time>{entry.time}</time></div><p className="cd-help">{entry.detail}</p></li>)}</ol></div>}
      </details>
    </section>
  </>
}
