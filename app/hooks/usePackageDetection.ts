'use client'
import { RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { Detection, packagesInZone, PackageTrack, trackPackage } from '@/lib/package-detection'
import type { Zone } from '@/lib/obstruction'
import { initialDoorwayState, observeDoorway, pauseDoorway, expireDoorway, doorwayStatus } from '@/lib/doorway-state'
import { validInferenceSample, InferenceReceipt } from '@/lib/inference-evidence'
import { DETECTOR_MODELS } from '@/lib/detector-models'

export function usePackageDetection(videoRef: RefObject<HTMLVideoElement>, active: boolean, zone: Zone, editing: boolean) {
  const [status, setStatus] = useState<'off'|'loading'|'ready'|'error'>('off')
  const [message, setMessage] = useState('Model not loaded')
  const [boxes, setBoxes] = useState<ReturnType<typeof packagesInZone>>([])
  const [decision, setDecision] = useState(initialDoorwayState)
  const alert = decision.phase === 'obstructed' || decision.phase === 'checking-clear'
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
    ++generation.current; track.current=null; setBoxes([]);setAlert(false);setScans(0);setReceipt(null);setStatus('off');setMessage('Model not loaded')
  }, [])
  const enable = useCallback(() => {
    disable(); setStatus('loading');setMessage('Loading OWL-ViT. First download is approximately 155 MB plus runtime files…')
    const w = new Worker(new URL('../workers/package.worker.ts', import.meta.url))
    worker.current=w
    const fail = (message: string) => { if(worker.current!==w)return; w.terminate(); worker.current=null; busy.current=false;setStatus('error');setMessage(message);setBoxes([]);setAlert(false); if(deadline.current) clearTimeout(deadline.current) }
    deadline.current=setTimeout(()=>fail('Model loading timed out. Check your connection and retry.'),300000)
    w.onerror=()=>fail('Model worker failed. Reload the model or try a current Chrome/Edge browser.')
    w.onmessage=({data})=>{
      if(worker.current!==w)return
      if(data.type==='progress') setMessage(data.text)
      if(data.type==='ready') {if(deadline.current)clearTimeout(deadline.current);setStatus('ready');setMessage('Model ready — start video to scan')}
      if(data.type==='error') fail(`Package recognition unavailable: ${data.message}`)
      if(data.type==='result') {
        busy.current=false; if(deadline.current)clearTimeout(deadline.current)
        if(data.id!==generation.current || !current.current.active || current.current.editing)return
        setLatency(Math.round(performance.now()-data.capturedAt))
        if (!validInferenceSample({ capturedAt:data.capturedAt, now:performance.now(), mediaTime:data.mediaTime,
          currentMediaTime:videoRef.current?.currentTime ?? NaN, lastVideoAdvanceAt:lastVideoAdvanceAt.current, generation:data.id, currentGeneration:generation.current,
          active:current.current.active && !!videoRef.current && !videoRef.current.paused, editing:current.current.editing })) {
          setBoxes([]);setAlert(false);track.current=null;setMessage('Camera evidence is stale or interrupted; model result discarded.');return
        }
        if (!Array.isArray(data.results)) {fail('Model returned an invalid result.');return}
        const found=packagesInZone(data.results as Detection[],current.current.zone)
        track.current=trackPackage(track.current,found,data.capturedAt)
        setBoxes(found)
        const observation = {at:data.capturedAt,candidate:found.some(d=>d.overlap>=.25),persistent:!!track.current?.alert}
        setDecision(previous => observeDoorway(previous, observation))
        const model=DETECTOR_MODELS.owlvit
        setReceipt({version:1,source:'local-live-model',observedAt:new Date(Date.now()-(performance.now()-data.capturedAt)).toISOString(),
          model:model.id,revision:model.revision,frameMediaTime:data.mediaTime,inferenceMs:Math.round(performance.now()-data.capturedAt),
          detections:found.map(({label,score,box})=>({label,score,box})),decision:observation.persistent?'Repeated parcel overlap':observation.candidate?'Candidate needs another observation':'No parcel detected in this frame',
          previousObstructionUnresolved:false,limitation:'Model scores are not calibrated probabilities. Missing a detection is not proof of clearance. No injury-prevention or hardware-validation claim.'})
        setScans(n=>n+1)
        setMessage(found.length ? `${found.length} possible parcel(s) in last scan · scores are not calibrated probabilities` : 'No parcel detected in last scan — this does not guarantee a clear doorway')
      }
    }
    w.postMessage({type:'load'})
  }, [disable])
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
      if(!worker.current||!video||video.readyState<2||video.paused)return
      if(video.currentTime===lastTime)return
      lastTime=video.currentTime
      lastVideoAdvanceAt.current=performance.now()
      if(busy.current)return
      if (!video.videoWidth || !video.videoHeight) return
      canvas.width=640;canvas.height=Math.round(640*video.videoHeight/video.videoWidth)
      const ctx=canvas.getContext('2d',{willReadFrequently:true})!
      try {
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
    const report={...receipt,decision:doorwayStatus(decision),previousObstructionUnresolved:decision.lastKnownObstruction,
      exportedAt:new Date().toISOString(),containsVideo:false,containsCredentials:false}
    const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}))
    const anchor=document.createElement('a');anchor.href=url;anchor.download='cleardrop-ai-observation.json';anchor.click()
    setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  return {status,message,boxes,alert,scans,latency,enable,disable,decision,receipt,exportReceipt,doorwayStatus:doorwayStatus(decision)}
}
