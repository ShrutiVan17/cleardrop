'use client'
import { RefObject, useEffect, useRef, useState } from 'react'
export type CapturedClip = {file:File; duration:number; origin:'ring-recording'; durationEstimated:true}
export function RingReplayCapture({videoRef,active,onCaptured}:{videoRef:RefObject<HTMLVideoElement>;active:boolean;onCaptured:(clip:CapturedClip)=>void}) {
  const [armed,setArmed]=useState(false)
  const [recording,setRecording]=useState(false)
  const [message,setMessage]=useState('Record up to 12 seconds of authorized Ring footage into memory for local evaluation. No upload or microphone recording.')
  const recorder=useRef<MediaRecorder|null>(null)
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null)
  const alive=useRef(true)
  const callback=useRef(onCaptured);callback.current=onCaptured
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;if(timer.current)clearTimeout(timer.current);if(recorder.current?.state==='recording')recorder.current.stop()}},[])
  useEffect(()=>{
    if(!active&&recorder.current?.state==='recording'){recorder.current.stop();return}
    if(!active||!armed||recorder.current)return
    try {
      const source=videoRef.current?.srcObject
      if(!(source instanceof MediaStream))throw new Error('No Ring video track is available.')
      const mime=['video/webm;codecs=vp8','video/webm'].find(type=>MediaRecorder.isTypeSupported(type))
      if(!mime)throw new Error('This browser does not support local video recording.')
      const stream=new MediaStream(source.getVideoTracks())
      const r=new MediaRecorder(stream,{mimeType:mime});recorder.current=r
      const chunks:BlobPart[]=[];const started=performance.now()
      r.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)}
      r.onerror=()=>{if(alive.current)setMessage('Recording failed. Retry with a fresh stream.')}
      r.onstop=()=>{
        if(timer.current)clearTimeout(timer.current);recorder.current=null
        if(!alive.current)return
        setRecording(false)
        const duration=Math.max(0,(performance.now()-started)/1000-.5)
        const file=new File(chunks,'ring-sandbox-or-device-recording.webm',{type:'video/webm'})
        if(duration<1||file.size<1000){setMessage('Recording was too short. Start a fresh stream and try again.');return}
        callback.current({file,duration,origin:'ring-recording',durationEstimated:true})
        setMessage(`Recorded ${duration.toFixed(1)} seconds (estimated). Open the recording in replay to evaluate. Nothing was uploaded.`)
      }
      r.start(250);setRecording(true);setArmed(false);setMessage('Recording locally… stops automatically after 12 seconds.')
      timer.current=setTimeout(()=>{if(r.state==='recording')r.stop()},12000)
    } catch(e) {setArmed(false);setMessage(e instanceof Error?e.message:'Could not record the stream')}
  },[active,armed,videoRef])
  return <section className="my-3 rounded-xl border border-slate-700 p-3"><p className="text-sm" role="status">{message}</p><button className="cd-button mt-2" onClick={()=>{if(recording){recorder.current?.stop()}else{setArmed(v=>!v)}}}>{recording?'Finish recording':armed?'Cancel recording request':active?'Record this video for replay':'Record next Ring session for replay'}</button>{armed&&<p className="text-xs text-amber-300 mt-2">Armed: start the Ring stream. Only record footage you have permission to use.</p>}</section>
}
