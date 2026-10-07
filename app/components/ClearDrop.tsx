'use client'

import { RefObject, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { validZone, Zone } from '@/lib/obstruction'
import { CameraSource, ChangeObservation, PauseReason } from '@/lib/change-monitor'
import { useChangeMonitor } from '../hooks/useChangeMonitor'
import { usePackageDetection } from '../hooks/usePackageDetection'
import { useDeliveryReview } from '../hooks/useDeliveryReview'
import { DeliveryReviewPanel } from './DeliveryReviewPanel'
import { DETECTOR_MODELS, DetectorModel } from '@/lib/detector-models'
import type { RuntimePreference } from '@/lib/inference-runtime'

type Entry = { id: number; time: string; kind: string; detail: string }
const defaultZone: Zone = { x: .3, y: .5, w: .4, h: .4 }

export function ClearDrop({ videoRef, active, deviceId, fixedZone, onObservation, source = 'unknown' }: { videoRef: RefObject<HTMLVideoElement>; active: boolean; deviceId?: string; fixedZone?: Zone; source?: CameraSource; onObservation?: (observation: ChangeObservation) => void }) {
  const [zone, setZone] = useState<Zone>(defaultZone)
  const [editing, setEditing] = useState(false)
  const [emptyChecked, setEmptyChecked] = useState(false)
  const [error, setError] = useState('')
  const [entries, setEntries] = useState<Entry[]>([])
  const [fit, setFit] = useState({ left: 0, top: 0, width: 0, height: 0 })
  const drag = useRef<{x: number; y: number} | null>(null)
  const overlay = useRef<HTMLDivElement>(null)
  const seq = useRef(0)
  const monitoring = useChangeMonitor({ videoRef, active, deviceId, zone, editing, source, onObservation })
  const { ready, ratio, blocked, unresolved, reportedParcel } = monitoring.observation
  const reviews = useDeliveryReview(monitoring.observation, source, deviceId)
  const previousBlocked = useRef(false)
  const packages = usePackageDetection(videoRef, active, zone, editing, deviceId)
  useEffect(() => {
    if (packages.alert) log('AI parcel overlap', 'Repeated model detections overlap the doorway zone. Visually verify before acting.')
  }, [packages.alert])
  useEffect(() => {
    if (blocked && !previousBlocked.current) log('Possible obstruction', 'A persistent change appeared inside the doorway zone. Review the video.')
    if (ready && !blocked && previousBlocked.current) log('Reference restored', 'The view looks similar to the saved reference. This does not verify walking clearance.')
    previousBlocked.current = blocked
  }, [blocked, ready])

  function log(kind: string, detail: string) {
    setEntries(items => [{ id: ++seq.current, time: new Date().toLocaleTimeString(), kind, detail }, ...items].slice(0, 20))
  }
  function reset(reason: PauseReason = 'camera-paused') {
    monitoring.pause(reason); setEmptyChecked(false); setError('')
  }
  useEffect(() => {
    setEmptyChecked(false); setError(''); previousBlocked.current = false
    setEntries([])
    try {
      const value = JSON.parse(localStorage.getItem(`cleardrop.zone.${deviceId || 'default'}`) || 'null')
      setZone(fixedZone || (validZone(value) ? value : defaultZone))
    } catch { setZone(fixedZone || defaultZone) }
  }, [deviceId])
  useEffect(() => { if (!active) { setEmptyChecked(false); setError(''); setEditing(false) } }, [active])

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

  function reportParcel() {
    monitoring.reportParcel(); setEmptyChecked(false); setError('')
    log('Parcel reported by viewer', 'An already-visible parcel was reported manually. No occupied reference was saved. Removal needs an explicit visual check.')
  }

  function calibrate(reportedParcelRemoved = false) {
    if (monitoring.calibrate(emptyChecked, reportedParcelRemoved)) {
      packages.confirmEmpty(emptyChecked,monitoring.isFresh())
      setEmptyChecked(false); setError('')
      log('Reference saved', 'Current frame marked as an empty doorway. Monitoring started.')
    }
  }

  function point(event: React.PointerEvent) {
    const rect = overlay.current!.getBoundingClientRect()
    return { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) }
  }
  const title = reportedParcel ? active ? 'You reported a parcel in the marked area' : 'Camera paused — reported parcel still needs review' : !active ? unresolved ? 'Camera paused — earlier change still needs review' : 'Start the camera to begin' : editing ? 'Mark the space to keep clear' : packages.alert ? 'Please check your doorway' : !ready ? 'Is the marked area empty?' : blocked ? 'Something changed near your door' : 'Watching your doorway'

  return <>
    {active && fit.width > 0 && videoRef.current?.parentElement && createPortal(<div ref={overlay} aria-label="Doorway zone editor" style={{ ...fit, position: 'absolute', pointerEvents: editing ? 'auto' : 'none', touchAction: 'none', zIndex: 5 }}
      onPointerDown={e => { if (!editing) return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = point(e) }}
      onPointerMove={e => { if (!drag.current) return; const p = point(e), a = drag.current; setZone({ x: Math.min(a.x,p.x), y: Math.min(a.y,p.y), w: Math.abs(a.x-p.x), h: Math.abs(a.y-p.y) }) }}
      onPointerUp={e => { if (!drag.current) return; drag.current = null; if (!validZone(zone)) setZone(defaultZone) }}
      onPointerCancel={() => { drag.current = null }}>
      <div style={{ position: 'absolute', left: `${zone.x*100}%`, top: `${zone.y*100}%`, width: `${zone.w*100}%`, height: `${zone.h*100}%`, border: `2px ${editing ? 'dashed' : 'solid'} ${blocked || reportedParcel ? '#fb7185' : '#5eead4'}`, background: blocked || reportedParcel ? '#fb71851c' : '#5eead414' }}>
        <span className="absolute left-0 top-0 bg-slate-950/90 px-2 py-1 text-xs text-white">{reportedParcel ? 'Parcel reported by you' : blocked ? 'Review obstruction' : 'Doorway zone'}</span>
      </div>
      {packages.boxes.map((d,i)=><div key={i} style={{position:'absolute',left:`${d.box.xmin*100}%`,top:`${d.box.ymin*100}%`,width:`${(d.box.xmax-d.box.xmin)*100}%`,height:`${(d.box.ymax-d.box.ymin)*100}%`,border:`2px solid ${d.overlap>=.25?'#fb923c':'#a78bfa'}`}}><span className="bg-slate-950/90 px-1 text-xs">Possible parcel · score {d.score.toFixed(2)}</span></div>)}
    </div>, videoRef.current.parentElement)}
    <section className="cleardrop-controls" aria-label="ClearDrop monitoring">
      <h2 className="text-xl font-semibold" role="status" aria-live="polite">{title}</h2>
      {reportedParcel ? <p className="cd-review-alert" role="alert">This is your visual report, not an AI detection. No empty reference has been saved. The parcel stays unresolved through video loss until you explicitly check its removal and save a genuinely empty reference.</p> : unresolved && (!active || !ready) && <p className="cd-review-alert" role="alert">The earlier doorway change has not been verified as removed. Reconnect, check the area yourself, and save a new empty reference only when it is actually clear.</p>}
      <p className="cd-help">{!active ? 'You’ll be able to mark the doorway once the video is playing.' : editing ? 'Drag a box over the doorway in the video, or use the position fields below.' : !ready ? 'Keep the marked area empty, then start watching. Change the area if it doesn’t cover your doorway.' : 'We’ll ask you to check if a change stays in the marked area. Keep this page open.'}</p>
      {active && !editing && !ready && <label className="flex gap-2 items-start mt-4"><input type="checkbox" checked={emptyChecked} onChange={e => setEmptyChecked(e.target.checked)} /><span>{reportedParcel ? 'I removed the reported parcel and visually checked that the marked area is empty.' : 'I visually checked that the marked area is empty — no parcel or object is already there.'}</span></label>}
      {active && <div className="flex flex-wrap gap-3 mt-4">
        {editing ? <button className="cd-button cd-primary" onClick={() => {
          if (!validZone(zone)) { setError('Choose a larger area inside the video.'); return }
          try { localStorage.setItem(`cleardrop.zone.${deviceId || 'default'}`, JSON.stringify(zone)); setError('') } catch { setError('The area works for this session, but could not be saved in this browser.') }
          setEditing(false)
        }}>Save area</button> : <>
          {!ready && <button className="cd-button cd-primary" disabled={!emptyChecked} onClick={() => calibrate(reportedParcel)}>{reportedParcel ? 'Parcel removed — start watching' : 'Area is empty — start watching'}</button>}
          {!ready && !reportedParcel && <button className="cd-button" onClick={reportParcel}>A parcel is already here</button>}
          {!fixedZone && <button className="cd-button" onClick={() => { reset('area-changed'); setEditing(true) }}>Change doorway area</button>}
        </>}
      </div>}
      {editing && <fieldset className="mt-4"><legend className="text-sm mb-2">Area position (percent of video)</legend><div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{(['x','y','w','h'] as const).map(key => <label key={key} className="text-sm">{{x:'Left',y:'Top',w:'Width',h:'Height'}[key]}<input className="cd-input" type="number" min={key==='w'||key==='h'?3:0} max={100} value={Math.round(zone[key]*100)} onChange={e => { const v=Math.max(0,Math.min(1,Number(e.target.value)/100)); setZone(z => { const n={...z,[key]:v}; n.w=Math.min(n.w,1-n.x); n.h=Math.min(n.h,1-n.y); return n }) }} /></label>)}</div></fieldset>}
      {blocked && <div role="alert" className="cd-review-alert"><p>A change stayed in the marked area for three seconds. Is a parcel blocking the doorway?</p><div className="flex flex-wrap gap-2 mt-3"><button className="cd-button" onClick={reportParcel}>Yes, there’s a parcel</button><button className="cd-button" onClick={() => { reset(); log('Dismissed', 'Monitoring paused. Clear the area and save a new reference before continuing.') }}>Dismiss and pause</button></div></div>}
      {packages.alert && !reportedParcel && <div className="cd-review-alert" role="alert"><p>The model repeatedly suggested a parcel in your marked area. Check the video yourself; this is not a confirmed obstruction.</p><button className="cd-button mt-3" disabled={!active || editing} onClick={reportParcel}>I see a parcel — start a review</button><p className="cd-help">A missed detection or stopped model won’t remove this concern. If the area is genuinely empty, save a checked empty reference in More options.</p></div>}
      {(packages.status!=='off' || packages.alert) && <p className="cd-help" role="status">{packages.doorwayStatus}</p>}
      <DeliveryReviewPanel flow={reviews} fresh={monitoring.isFresh} source={source} />
      {(error || monitoring.error) && <p role="alert" className="cd-error mt-3">{error || monitoring.error}</p>}
      <p className="cd-fine-print">Shadows, people, and camera movement can also cause alerts. An alert needs your review. This does not measure parcel size or physical walking clearance.</p>
      <details className="cd-details mt-4">
        <summary>More options</summary>
        <h3 className="font-semibold mt-3">Delivery-review alerts</h3>
        <p className="cd-help">The on-page review works without notification permission. Optional desktop alerts run only while this page is open. No background, email or caregiver delivery is implemented.</p>
        {source!=='generated-video' && <button className="cd-button mt-3" onClick={reviews.noticesEnabled?reviews.disableNotices:()=>void reviews.enableNotices()}>{reviews.noticesEnabled?'Turn off desktop alerts':'Enable desktop alerts'}</button>}
        <p className="cd-help" role="status">{source==='generated-video'?'Generated tests never request desktop notification permission.':reviews.notices}</p>
        {source==='ring' && <><h3 className="font-semibold mt-3">Private review sync</h3><p className="cd-help">Enable before a new review starts. Only status, source category and timestamps are saved to your signed-in account—not video, Ring tokens or device IDs. Old reviews are not automatically linked to a camera.</p>
          {!reviews.syncEnabled && <button className="cd-button mt-3" disabled={reviews.syncBusy || (!!reviews.review && reviews.review.phase!=='resolved')} onClick={()=>void reviews.enableSync()}>{reviews.syncBusy?'Checking review storage…':'Enable private account sync'}</button>}
          <p className="cd-help" role="status">{reviews.syncState}</p>
          {reviews.syncEnabled && <div className="flex flex-wrap gap-3 mt-3"><button className="cd-button" onClick={reviews.retrySync}>Retry unsaved reviews</button><button className="cd-button" onClick={reviews.disableSync}>Stop account sync</button></div>}
          {reviews.history.filter(item=>item.source===source && item.id!==reviews.review?.id && item.phase!=='resolved').map(item=><div key={item.id} className="mt-3"><p className="cd-help">Open review · {new Date(item.createdAt).toLocaleString()} · {item.phase}. Select the correct camera and visually verify it before resuming.</p><button className="cd-button" disabled={!!reviews.review && reviews.review.phase!=='resolved'} onClick={()=>{reset();reviews.resume(item)}}>Resume this review on selected camera</button></div>)}
        </>}
        {reviews.history.length>0 && <button className="cd-button mt-3" onClick={reviews.download}>Download delivery reviews</button>}
        <h3 className="font-semibold mt-3">Review history</h3>
        <p className="cd-help">Download this session’s decisions and their source: your confirmation, pixel changes, or a camera interruption. No video, tokens or account details are included. This is local history, not a tamper-proof audit log.</p>
        <button className="cd-button mt-3" onClick={monitoring.exportReceipt}>Download review history</button>
        {active && ready && <div className="mb-4"><p className="cd-help">Changed area: {Math.round(ratio*100)}%. This is not a confidence score.</p><label className="flex gap-2 my-3"><input type="checkbox" checked={emptyChecked} onChange={e => setEmptyChecked(e.target.checked)} /><span>I visually checked that the marked area is empty before replacing the reference.</span></label><button className="cd-button" disabled={editing || !emptyChecked} onClick={() => calibrate(reportedParcel)}>Save a new empty reference</button></div>}
        <h3 className="font-semibold mt-3">Experimental parcel recognition</h3>
        <p className="cd-help">Grounding DINO is an alternative to the OWL-ViT baseline, which missed the parcel in our initial Ring test. Neither is validated for reliable parcel recognition. No detection does not mean the doorway is clear.</p>
        <p className="cd-help">Optional download: about {DETECTOR_MODELS[packages.modelKey || 'grounding'].q8MB} MB plus runtime files. Frames stay on this device. You do not need this model for change alerts.</p>
        <label className="block mt-3">Recognition model<select className="cd-input" disabled={packages.status==='loading' || packages.status==='ready'} value={packages.modelKey} onChange={event=>packages.configure(event.target.value as DetectorModel,packages.runtime)}>{Object.entries(DETECTOR_MODELS).map(([key,model])=><option key={key} value={key}>{model.name}</option>)}</select></label>
        <label className="block mt-3">Run on this device<select className="cd-input" disabled={packages.status==='loading' || packages.status==='ready'} value={packages.runtime} onChange={event=>packages.configure(packages.modelKey,event.target.value as RuntimePreference)}><option value="auto">GPU if supported, otherwise CPU</option><option value="wasm">CPU — compatibility mode</option></select></label>
        <div className="flex gap-2 mt-3">
          {(packages.status==='off'||packages.status==='error') ? <button className="cd-button" onClick={packages.enable}>Load experimental model</button> : <button className="cd-button" onClick={packages.disable}>{packages.status==='loading'?'Cancel download':'Turn off model'}</button>}
        </div>
        <p className="cd-help" role="status">{packages.message} · {packages.scans} scans{packages.latency!==null ? ` · last scan ${(packages.latency/1000).toFixed(1)}s` : ''}</p>
        {packages.backend && <p className="cd-help">Actual runtime: {packages.backend==='webgpu'?'WebGPU':'WebAssembly CPU'} · quantized q8{packages.fallback?' · GPU failed; CPU fallback is active':''}. Runtime speed and parcel accuracy have not been benchmarked.</p>}
        {packages.receipt && <div className="mt-3"><p className="cd-help">Download the last actual model observation, its timestamp and current review status. This contains no video or credentials.</p><button className="cd-button" onClick={packages.exportReceipt}>Download AI observation</button></div>}
        {entries.length > 0 && <div className="mt-5"><div className="flex justify-between items-center"><h3 className="font-semibold">Recent activity</h3><button className="cd-button" onClick={() => setEntries([])}>Clear list</button></div><ol className="space-y-3 mt-3 max-h-48 overflow-auto">{entries.map(entry => <li key={entry.id} className="text-sm"><div className="flex justify-between gap-3"><strong className="font-medium">{entry.kind}</strong><time>{entry.time}</time></div><p className="cd-help">{entry.detail}</p></li>)}</ol></div>}
      </details>
    </section>
  </>
}
