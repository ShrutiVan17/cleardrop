'use client'
import { useEffect, useRef, useState } from 'react'
import { Detection, packagesInZone, PACKAGE_LABELS } from '@/lib/package-detection'
import { Zone, validZone } from '@/lib/obstruction'
import { Expectation, ReplaySample, sampleTimes, summarizeReplay } from '@/lib/replay-evaluation'
import { createPipelineClip } from '@/lib/synthetic-replay'
import type { CapturedClip } from './RingReplayCapture'
import { DETECTOR_MODELS, DetectorModel } from '@/lib/detector-models'

type Run = {version:1; source:'local-replay'; clip:{name:string;bytes:number;duration:number;synthetic:boolean;origin:string;durationEstimated:boolean}; expected:Expectation; zone:Zone; startedAt:string; complete:boolean; planned:number; samples:ReplaySample[]; configuration:object}
type Pending = {resolve:(value:Detection[])=>void; reject:(error:Error)=>void; timer:ReturnType<typeof setTimeout>}

export function ReplayLab({initialClip}:{initialClip?:CapturedClip|null}) {
  const video=useRef<HTMLVideoElement>(null)
  const objectUrl=useRef<string|null>(null)
  const worker=useRef<Worker|null>(null)
  const pending=useRef<Pending|null>(null)
  const generation=useRef(0)
  const loadTimer=useRef<ReturnType<typeof setTimeout>|null>(null)
  const [file,setFile]=useState<File|null>(null)
  const [duration,setDuration]=useState(0)
  const [ready,setReady]=useState(false)
  const [loading,setLoading]=useState(false)
  const [running,setRunning]=useState(false)
  const [message,setMessage]=useState('Choose a short video you own or have permission to use. It stays on this device.')
  const [error,setError]=useState('')
  const [zone,setZone]=useState<Zone>({x:.3,y:.5,w:.4,h:.4})
  const [expected,setExpected]=useState<Expectation>('unlabeled')
  const [run,setRun]=useState<Run|null>(null)
  const [boxes,setBoxes]=useState<ReturnType<typeof packagesInZone>>([])
  const [aspect,setAspect]=useState(16/9)
  const [creating,setCreating]=useState(false)
  const [synthetic,setSynthetic]=useState(false)
  const durationHint=useRef<number|null>(null)
  const [origin,setOrigin]=useState('local-file')
  const [dtype,setDtype]=useState<'q8'|'fp32'>('q8')
  const [modelKey,setModelKey]=useState<DetectorModel>('owlvit')
  const selectedModel=DETECTOR_MODELS[modelKey]
  useEffect(()=>{if(initialClip){chooseFile(initialClip.file);durationHint.current=initialClip.duration;setOrigin(initialClip.origin)}},[initialClip])

  function stopWorker() {
    worker.current?.terminate();worker.current=null
    if(loadTimer.current)clearTimeout(loadTimer.current)
    if(pending.current) {clearTimeout(pending.current.timer);pending.current.reject(new Error('Evaluation canceled'));pending.current=null}
  }
  function cancel() {
    ++generation.current;stopWorker();setReady(false);setLoading(false);setRunning(false)
    setMessage('Stopped. Any partial results remain marked incomplete. Reload the model to run again.')
  }
  useEffect(()=>()=>{++generation.current;stopWorker();if(objectUrl.current)URL.revokeObjectURL(objectUrl.current)},[])

  function loadModel() {
    stopWorker();setLoading(true);setReady(false);setError('');setMessage(`Loading ${selectedModel.name} (${dtype}): approximately ${dtype==='q8'?selectedModel.q8MB:selectedModel.fp32MB} MB plus runtime files; browser cache may be reused.`)
    const w=new Worker(new URL('../workers/package.worker.ts',import.meta.url));worker.current=w
    const fail=(message:string)=>{if(worker.current!==w)return;stopWorker();setLoading(false);setReady(false);setError(message)}
    loadTimer.current=setTimeout(()=>fail('Model loading timed out. Check your connection and try again.'),300000)
    w.onerror=()=>fail('Model worker failed. Try reloading the model.')
    w.onmessage=({data})=>{
      if(worker.current!==w)return
      if(data.type==='progress')setMessage(data.text)
      if(data.type==='ready'){if(loadTimer.current)clearTimeout(loadTimer.current);setReady(true);setLoading(false);setMessage('Model ready. Set the expected result before running the evaluation.')}
      if(data.type==='result'&&pending.current){const p=pending.current;pending.current=null;clearTimeout(p.timer);p.resolve(data.results)}
      if(data.type==='error')fail(data.message || 'Inference failed')
    }
    w.postMessage({type:'load',dtype,modelKey})
  }

  function chooseFile(selected:File|undefined, isSynthetic=false) {
    if(!selected)return
    if(selected.size>250*1024*1024){setError('Choose a clip smaller than 250 MB.');return}
    if(!selected.type.startsWith('video/')){setError('Choose a browser-supported video file, such as MP4 or WebM.');return}
    ++generation.current;video.current?.pause();durationHint.current=null;setOrigin(isSynthetic?'synthetic':'local-file')
    if(objectUrl.current)URL.revokeObjectURL(objectUrl.current)
    objectUrl.current=URL.createObjectURL(selected)
    setFile(selected);setSynthetic(isSynthetic);setDuration(0);setRun(null);setBoxes([]);setExpected('unlabeled');setError('')
    if(video.current){video.current.src=objectUrl.current;video.current.load()}
  }

  async function seek(time:number) {
    const v=video.current!
    if(v.readyState>=2&&Math.abs(v.currentTime-time)<.001)return
    await new Promise<void>((resolve,reject)=>{
      const cleanup=()=>{v.removeEventListener('seeked',done);v.removeEventListener('error',failed);clearTimeout(timeout)}
      const done=()=>{cleanup();resolve()}
      const failed=()=>{cleanup();reject(new Error('Video could not be decoded at this timestamp.'))}
      const timeout=setTimeout(()=>{cleanup();reject(new Error('Video seek timed out.'))},10000)
      v.addEventListener('seeked',done);v.addEventListener('error',failed);v.currentTime=time
    })
  }

  async function evaluate() {
    if(!file||!ready||!video.current||!validZone(zone)||running)return
    let times:number[]
    try{times=sampleTimes(duration)}catch(e){setError((e as Error).message);return}
    const id=++generation.current
    const record:Run={version:1,source:'local-replay',clip:{name:file.name,bytes:file.size,duration,synthetic,origin,durationEstimated:durationHint.current!==null},expected:synthetic?'unlabeled':expected,zone:{...zone},startedAt:new Date().toISOString(),complete:false,planned:times.length,samples:[],configuration:{model:selectedModel.id,modelRevision:selectedModel.revision,runtime:'Transformers.js 3.8.1',dtype,device:'wasm',queries:PACKAGE_LABELS,modelThreshold:selectedModel.threshold,scoreThreshold:.15,overlapThreshold:.25,intervalSeconds:2,resizeWidth:640,metric:'sampled-frame classification; not event-level or safety accuracy'}}
    setRun(record);setRunning(true);setError('');setBoxes([])
    const v=video.current;v.pause()
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=Math.round(640*v.videoHeight/v.videoWidth)
    const ctx=canvas.getContext('2d',{willReadFrequently:true})!
    try {
      for(const time of times) {
        if(generation.current!==id)break
        setMessage(`Evaluating frame ${record.samples.length+1}/${times.length} at ${time.toFixed(1)} seconds…`)
        await seek(time)
        if(generation.current!==id)break
        ctx.drawImage(v,0,0,canvas.width,canvas.height)
        const pixels=ctx.getImageData(0,0,canvas.width,canvas.height)
        const began=performance.now()
        const detections=await new Promise<Detection[]>((resolve,reject)=>{
          const timer=setTimeout(()=>{pending.current=null;reject(new Error('Inference timed out after 60 seconds.'))},60000)
          pending.current={resolve,reject,timer}
          worker.current!.postMessage({type:'detect',pixels:pixels.data.buffer,width:pixels.width,height:pixels.height,id,capturedAt:began},[pixels.data.buffer])
        })
        if(generation.current!==id)break
        record.samples.push({time,latencyMs:Math.round(performance.now()-began),detections})
        setBoxes(packagesInZone(detections,record.zone));setRun({...record,samples:[...record.samples]})
      }
      if(generation.current===id){record.complete=true;setRun({...record,samples:[...record.samples]});setMessage('Evaluation complete. These results apply only to the sampled frames in this clip.')}
    } catch(e) {
      if(generation.current===id){const reason=e instanceof Error?e.message:'Evaluation failed';record.samples.push({time:times[record.samples.length]??0,latencyMs:0,detections:[],error:reason});setRun({...record,samples:[...record.samples]});setError(reason);setMessage('Evaluation stopped with an error. The report is incomplete; unprocessed frames are not successful negatives.');stopWorker();setReady(false)}
    } finally {if(generation.current===id)setRunning(false)}
  }
  function download() {
    if(!run)return
    const url=URL.createObjectURL(new Blob([JSON.stringify({...run,summary:summarizeReplay(run.samples,run.expected,run.zone)},null,2)],{type:'application/json'}))
    const a=document.createElement('a');a.href=url;a.download='cleardrop-replay-evaluation.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  const summary=run?summarizeReplay(run.samples,run.expected,run.zone):null
  return <section className="p-4 max-w-5xl mx-auto w-full">
    <h1 className="text-2xl font-semibold mb-2">Test a clip</h1>
    <p className="text-sm text-slate-400 mb-4">Choose a video, load the model, then run the test. Up to 2 minutes / 250 MB. Video stays on this device.</p>
    <p className="cd-demo-notice">Local replay, not live video. Parcel recognition is experimental and missed the parcel in our initial test.</p>
    <label className="block text-sm mb-4">Choose local test video<input className="block mt-2" type="file" accept="video/*" disabled={running||creating} onChange={e=>chooseFile(e.target.files?.[0])}/></label>
    {origin==='ring-recording'&&<p className="text-amber-300 text-sm mb-3">Recorded Ring footage — local replay, not a current live view. Duration is estimated. Sandbox content is not representative real-world validation; retain the source attribution before sharing footage.</p>}
    <details className="cd-details mb-4"><summary>No clip? Create a diagnostic sample</summary><p className="text-xs text-slate-400 my-3">Checks model execution only, not recognition accuracy.</p><button className="cd-button mb-4" disabled={running||creating} onClick={async()=>{const id=++generation.current;setCreating(true);try{const clip=await createPipelineClip();if(id===generation.current)chooseFile(clip,true)}catch(e){setError((e as Error).message)}finally{setCreating(false)}}}>{creating?'Creating test clip…':'Create synthetic pipeline check'}</button></details>
    {synthetic&&<p className="text-amber-300 text-sm mb-3">Synthetic diagnostic footage: model execution test only. Accuracy scoring is disabled.</p>}
    <div className="relative bg-black rounded-xl overflow-hidden" style={{aspectRatio:aspect}}>
      <video ref={video} playsInline muted controls={!running} className="w-full h-full object-contain" onLoadedMetadata={()=>{const v=video.current!;const seconds=durationHint.current??(synthetic?4:v.duration);setDuration(seconds);setAspect(v.videoWidth/v.videoHeight);if(!Number.isFinite(seconds)||seconds>120)setError('Clip must have a finite duration of at most 120 seconds.')}} onError={()=>setError('This video could not be decoded. Try an MP4 (H.264) or WebM file.')} onSeeking={()=>{if(!running)setBoxes([])}}/>
      <span className="absolute top-2 left-2 bg-amber-300 text-black text-xs font-bold px-2 py-1 pointer-events-none">LOCAL REPLAY</span>
      <div className="absolute pointer-events-none border-2 border-teal-300" style={{left:`${zone.x*100}%`,top:`${zone.y*100}%`,width:`${zone.w*100}%`,height:`${zone.h*100}%`}}><span className="bg-black/80 text-xs">Doorway test zone</span></div>
      {boxes.map((d,i)=><div key={i} className="absolute pointer-events-none border-2 border-orange-400" style={{left:`${d.box.xmin*100}%`,top:`${d.box.ymin*100}%`,width:`${(d.box.xmax-d.box.xmin)*100}%`,height:`${(d.box.ymax-d.box.ymin)*100}%`}}><span className="bg-black/80 text-xs">{d.label} · {d.score.toFixed(2)}</span></div>)}
    </div>
    <details className="cd-details my-4"><summary>Adjust zone, labels and model</summary>
    <fieldset disabled={running} className="my-4"><legend className="font-medium">Doorway test zone</legend><div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">{(['x','y','w','h'] as const).map(key=><label key={key} className="text-sm">{{x:'Left',y:'Top',w:'Width',h:'Height'}[key]} (%)<input className="block w-full bg-slate-950 border border-slate-600 rounded p-2" type="number" min={0} max={100} value={Math.round(zone[key]*100)} onChange={e=>{setZone(z=>({...z,[key]:Number(e.target.value)/100}));setBoxes([]);setRun(null)}}/></label>)}</div></fieldset>
    {!validZone(zone)&&<p role="alert" className="text-rose-300">Zone must be inside the video and at least 3% wide and tall.</p>}
    <label className="block text-sm">Expected result throughout the entire clip (set before evaluation)<select className="block bg-slate-950 border border-slate-600 rounded p-2 mt-2 w-full" disabled={running||synthetic} value={expected} onChange={e=>{setExpected(e.target.value as Expectation);setRun(null)}}><option value="unlabeled">Unlabeled — inspect detections only, no accuracy scores</option><option value="no-parcel">No parcel anywhere in view</option><option value="parcel-outside">Parcel visible, outside doorway zone</option><option value="parcel-overlapping">Parcel visible and overlapping doorway zone</option></select></label>
    <p className="text-xs text-slate-400 my-2">Use a short clip with one consistent expected state. Trim placement/removal transitions into separate clips. Whole-clip labels are not suitable for changing scenes.</p>
    <label className="block text-sm my-3">Detector model<select className="block bg-slate-950 border border-slate-600 rounded p-2 mt-2" disabled={running||loading} value={modelKey} onChange={e=>{stopWorker();setReady(false);setModelKey(e.target.value as DetectorModel);setDtype('q8');setRun(null);setBoxes([])}}>{Object.entries(DETECTOR_MODELS).map(([key,model])=><option key={key} value={key}>{model.name}</option>)}</select></label>
    <label className="block text-sm my-3">Model precision<select className="block bg-slate-950 border border-slate-600 rounded p-2 mt-2" disabled={running||loading} value={dtype} onChange={e=>{stopWorker();setReady(false);setDtype(e.target.value as 'q8'|'fp32');setRun(null);setBoxes([])}}><option value="q8">Compact q8 — approximately {selectedModel.q8MB} MB</option><option value="fp32">Full precision fp32 — approximately {selectedModel.fp32MB} MB, higher memory use</option></select></label>
    </details>
    {!validZone(zone)&&<p role="alert" className="text-rose-300">Open test settings and choose a valid doorway zone.</p>}
    <p className="text-xs text-slate-400">{selectedModel.name} · {dtype} · approximately {dtype==='q8'?selectedModel.q8MB:selectedModel.fp32MB} MB download plus runtime files. Experimental; may miss objects or time out.</p>
    <div className="flex flex-wrap gap-2 my-4">{!ready&&!loading&&<button className="cd-button" onClick={loadModel}>Load model</button>}{(loading||running)&&<button className="cd-button" onClick={cancel}>Cancel</button>}<button className="cd-button cd-primary" disabled={!ready||!file||running||!validZone(zone)||duration<=0||duration>120} onClick={evaluate}>Run test</button><button className="cd-button" disabled={!run||running} onClick={download}>Download report</button></div>
    <p role="status" className="text-sm text-slate-300">{message}</p>{error&&<p role="alert" className="text-rose-300 mt-2">{error}</p>}
    {run&&summary&&<div className="card mt-4"><h3 className="font-semibold">{run.complete?'Completed':'Incomplete'} run · {summary.successful}/{run.planned} frames analyzed</h3><p className="text-sm text-slate-400 mt-2">Failed samples: {summary.failed}. Failed/unprocessed samples are not counted as true negatives. Inference p95: {summary.p95InferenceMs===null?'N/A':`${(summary.p95InferenceMs/1000).toFixed(1)}s`}.</p><p className="text-xs text-slate-400 mt-2">Sampled-frame results, not event-level accuracy. A single clip cannot establish general reliability.</p>
      {summary.parcel&&summary.overlap?<div className="overflow-x-auto mt-3"><table className="w-full text-sm text-left"><thead><tr>{['Check','TP','FP','TN','FN','Precision','Recall'].map(h=><th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{([['Parcel recognition',summary.parcel],['Doorway overlap',summary.overlap]] as const).map(([label,m])=><tr key={label}><td className="p-2">{label}</td>{[m.tp,m.fp,m.tn,m.fn,m.precision===null?'N/A':`${Math.round(m.precision*100)}%`,m.recall===null?'N/A':`${Math.round(m.recall*100)}%`].map((value,i)=><td key={i} className="p-2">{value}</td>)}</tr>)}</tbody></table></div>:<p className="text-sm mt-2">No ground-truth label: accuracy metrics intentionally omitted.</p>}
      <details className="mt-3"><summary>Per-frame results</summary><ol className="text-xs space-y-2 mt-2 max-h-64 overflow-auto">{run.samples.map(s=><li key={s.time}>{s.time.toFixed(1)}s: {s.error||`${packagesInZone(s.detections,run.zone).length} parcel candidates, ${s.latencyMs}ms inference`} <button className="underline ml-2" disabled={running} onClick={async()=>{try{await seek(s.time);setBoxes(packagesInZone(s.detections,run.zone))}catch(e){setError((e as Error).message)}}}>Preview frame {s.time.toFixed(1)}s</button><details><summary>Raw model predictions at {s.time.toFixed(1)}s</summary><pre className="whitespace-pre-wrap">{JSON.stringify(s.detections,null,2)}</pre></details></li>)}</ol></details>
    </div>}
  </section>
}
