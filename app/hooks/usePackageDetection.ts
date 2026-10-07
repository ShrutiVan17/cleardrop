'use client'
import { RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { packagesInZone, PackageTrack, trackPackage, validDetectionBatch } from '@/lib/package-detection'
import type { Zone } from '@/lib/obstruction'
import { initialDoorwayState, observeDoorway, pauseDoorway, expireDoorway, doorwayStatus } from '@/lib/doorway-state'
import { validInferenceSample, InferenceReceipt } from '@/lib/inference-evidence'
import { DETECTOR_MODELS, DetectorModel } from '@/lib/detector-models'
import { canConfirmInferenceConcern, inferenceFrameSize, InferenceBackend, RuntimePreference } from '@/lib/inference-runtime'

export function usePackageDetection(videoRef: RefObject<HTMLVideoElement>, active: boolean, zone: Zone, editing: boolean, deviceId?: string) {
  const [status, setStatus] = useState<'off'|'loading'|'ready'|'error'>('off')
  const [message, setMessage] = useState('Model not loaded')
  const [boxes, setBoxes] = useState<ReturnType<typeof packagesInZone>>([])
  const [decision, setDecision] = useState(initialDoorwayState)
  // A model miss, worker failure or disabled model must not resolve a prior suggestion.
  const [alert, setReviewRequired] = useState(false)
  const [modelKey, setModelKey] = useState<DetectorModel>('grounding')
  const [runtime, setRuntime] = useState<RuntimePreference>('auto')
  const [backend, setBackend] = useState<InferenceBackend | null>(null)
  const [fallback, setFallback] = useState(false)
  const setAlert = (value: boolean) => { if(!value) setDecision(pauseDoorway) }
  const [scans,setScans] = useState(0)
  const [latency,setLatency] = useState<number | null>(null)
  const [receipt,setReceipt] = useState<InferenceReceipt | null>(null)
  const worker = useRef<Worker | null>(null)
  const busy = useRef(false)
  const generation = useRef(0)
  const lastVideoAdvanceAt = useRef(0)
  const track = useRef<PackageTrack | null>(null)
  const current = useRef({active,zone,editing}); current.current={active,zone,editing}
  const deadline = useRef<ReturnType<typeof setTimeout> | null>(null)

  const disable = useCallback(() => {
    worker.current?.terminate(); worker.current=null; busy.current=false
    if(deadline.current) clearTimeout(deadline.current)
    ++generation.current; track.current=null; setBoxes([]);setAlert(false);setScans(0);setReceipt(null);setBackend(null);setFallback(false);setStatus('off');setMessage('Model not loaded')
  }, [])
  const enable = useCallback(() => {
    disable(); setStatus('loading');setMessage(`Loading ${DETECTOR_MODELS[modelKey].name}. First download is approximately ${DETECTOR_MODELS[modelKey].q8MB} MB plus runtime files…`)
    const w = new Worker(new URL('../workers/package.worker.ts', import.meta.url))
    worker.current=w
    const fail = (message: string) => { if(worker.current!==w)return; w.terminate(); worker.current=null; busy.current=false;setStatus('error');setMessage(message);setBoxes([]);setAlert(false); if(deadline.current) clearTimeout(deadline.current) }
    deadline.current=setTimeout(()=>fail('Model loading timed out. Check your connection and retry.'),300000)
    w.onerror=()=>fail('Model worker failed. Reload the model or try a current Chrome/Edge browser.')
    w.onmessage=({data})=>{
      if(worker.current!==w)return
      if(data.type==='runtime') {setBackend(data.backend);setFallback(!!data.fallback)}
      if(data.type==='progress') setMessage(data.text)
      if(data.type==='ready') {if(deadline.current)clearTimeout(deadline.current);setStatus('ready');setMessage('Model ready — start video to scan')}
      if(data.type==='error') fail(`Package recognition unavailable: ${data.message}`)
      if(data.type==='result') {
        busy.current=false; if(deadline.current)clearTimeout(deadline.current)
        if(data.id!==generation.current || !current.current.active || current.current.editing)return
        setLatency(Math.round(performance.now()-data.capturedAt))
        if (!validInferenceSample({ capturedAt:data.capturedAt, now:performance.now(), mediaTime:data.mediaTime,
          currentMediaTime:videoRef.current?.currentTime ?? NaN, lastVideoAdvanceAt:lastVideoAdvanceAt.current, generation:data.id, currentGeneration:generation.current,
          active:current.current.active && !document.hidden && !!videoRef.current && !videoRef.current.paused, editing:current.current.editing })) {
          setBoxes([]);setAlert(false);track.current=null;setMessage('Camera evidence is stale or interrupted; model result discarded.');return
        }
        if (!validDetectionBatch(data.results) || data.modelKey!==modelKey) {fail('Model returned an invalid result.');return}
        const found=packagesInZone(data.results,current.current.zone)
        track.current=trackPackage(track.current,found,data.capturedAt)
        setBoxes(found)
        const observation = {at:data.capturedAt,candidate:found.some(d=>d.overlap>=.25),persistent:!!track.current?.alert}
        if(observation.persistent)setReviewRequired(true)
        setDecision(previous => observeDoorway(previous, observation))
        const model=DETECTOR_MODELS[modelKey]
        setReceipt({version:1,source:'local-live-model',observedAt:new Date(Date.now()-(performance.now()-data.capturedAt)).toISOString(),
          model:model.id,revision:model.revision,backend:data.backend,dtype:data.dtype,frameMediaTime:data.mediaTime,inferenceMs:Math.round(performance.now()-data.capturedAt),
          detections:found.map(({label,score,box})=>({label,score,box})),decision:observation.persistent?'Repeated parcel overlap':observation.candidate?'Candidate needs another observation':'No parcel detected in this frame',
          previousObstructionUnresolved:false,limitation:'Model scores are not calibrated probabilities. Missing a detection is not proof of clearance. No injury-prevention or hardware-validation claim.'})
        setScans(n=>n+1)
        setMessage(found.length ? `${found.length} possible parcel(s) in last scan · scores are not calibrated probabilities` : 'No parcel detected in last scan — this does not guarantee a clear doorway')
      }
    }
    w.postMessage({type:'load',modelKey,runtime,dtype:'q8'})
  }, [disable,modelKey,runtime,videoRef])
  useEffect(()=>{disable();setDecision(initialDoorwayState());setReviewRequired(false)},[deviceId,disable])
  useEffect(()=>{
    const hide=()=>{if(document.hidden){++generation.current;track.current=null;setBoxes([]);setDecision(pauseDoorway);setMessage('Analysis paused while the page is hidden. Existing suggestions still need your review.')}}
    document.addEventListener('visibilitychange',hide)
    return()=>document.removeEventListener('visibilitychange',hide)
  },[])
  useEffect(()=>{
    ++generation.current;track.current=null;setBoxes([]);setAlert(false)
    if(active) {setScans(0);setLatency(null)}
    if(status==='ready')setMessage(!active?'Model ready — monitoring paused':editing?'Monitoring paused while editing zone':'Scanning live video…')
  },[active,editing,zone,status])
  useEffect(()=>{
    if(status!=='ready'||!active||editing)return
    const canvas=document.createElement('canvas');let lastTime=-1
    const timer=setInterval(()=>{
      const video=videoRef.current
      if(document.hidden||!worker.current||!video||video.readyState<2||video.paused)return
      if(video.currentTime===lastTime)return
      lastTime=video.currentTime
      lastVideoAdvanceAt.current=performance.now()
      if(busy.current)return
      if (!video.videoWidth || !video.videoHeight) return
      const size=inferenceFrameSize(video.videoWidth,video.videoHeight)
      canvas.width=size.width;canvas.height=size.height
      const ctx=canvas.getContext('2d',{willReadFrequently:true})
      try {
        if(!ctx)throw new Error('Frame capture unavailable')
        ctx.drawImage(video,0,0,canvas.width,canvas.height)
        const frame=ctx.getImageData(0,0,canvas.width,canvas.height)
        busy.current=true
        deadline.current=setTimeout(()=>{worker.current?.terminate();worker.current=null;busy.current=false;setStatus('error');setMessage('Inference timed out. Reload model to retry.');setBoxes([]);setAlert(false)},60000)
        worker.current.postMessage({type:'detect',pixels:frame.data.buffer,width:frame.width,height:frame.height,id:generation.current,capturedAt:performance.now(),mediaTime:video.currentTime},[frame.data.buffer])
      } catch {setStatus('error');setMessage('Could not read this video frame.');setBoxes([]);setAlert(false)}
    },1000)
    return()=>clearInterval(timer)
  },[status,active,editing,videoRef])
  useEffect(()=>()=>{worker.current?.terminate();if(deadline.current)clearTimeout(deadline.current)},[])
  useEffect(()=>{const timer=setInterval(()=>setDecision(previous=>expireDoorway(previous,performance.now())),1000);return()=>clearInterval(timer)},[])
  useEffect(()=>{if(decision.phase==='unknown')setBoxes([])},[decision.phase])
  const exportReceipt=()=>{
    if(!receipt)return
    const report={...receipt,decision:alert?'Model suggestion remains unresolved until your empty-area check':doorwayStatus(decision),previousObstructionUnresolved:alert,
      exportedAt:new Date().toISOString(),containsVideo:false,containsCredentials:false}
    const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}))
    const anchor=document.createElement('a');anchor.href=url;anchor.download='cleardrop-ai-observation.json';anchor.click()
    setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  function confirmEmpty(checkedEmpty:boolean,freshVideo:boolean) {
    if(!canConfirmInferenceConcern({checkedEmpty,freshVideo,active:current.current.active,editing:current.current.editing,hidden:document.hidden}))return false
    ++generation.current;track.current=null;setBoxes([]);setReviewRequired(false);setDecision(initialDoorwayState());return true
  }
  function configure(model:DetectorModel,preference:RuntimePreference) {
    disable();setModelKey(model);setRuntime(preference)
  }
  return {status,message,boxes,alert,scans,latency,enable,disable,decision,receipt,exportReceipt,confirmEmpty,configure,modelKey,runtime,backend,fallback,
    doorwayStatus:alert?'Earlier AI parcel suggestion still needs your visual empty-area check':doorwayStatus(decision)}
}
