import type { Detection } from './package-detection'
import { packagesInZone } from './package-detection'
import type { Zone } from './obstruction'
export type Expectation = 'unlabeled' | 'no-parcel' | 'parcel-outside' | 'parcel-overlapping'
export type ReplaySample = {time:number; latencyMs:number; detections:Detection[]; error?:string}
export function sampleTimes(duration:number, interval=2):number[] {
  if (!Number.isFinite(duration)||duration<=0||duration>120||!Number.isFinite(interval)||interval<1) throw new Error('Use a video between 0 and 120 seconds and a sample interval of at least one second.')
  const result:number[]=[]
  for(let time=0; time<duration-.05 && result.length<120; time+=interval) result.push(time)
  return result.length?result:[0]
}
export function summarizeReplay(samples:ReplaySample[], expected:Expectation, zone:Zone) {
  const successful=samples.filter(s=>!s.error)
  function score(target:'parcel'|'overlap') {
    if(expected==='unlabeled')return null
    const truth=target==='parcel'?expected!=='no-parcel':expected==='parcel-overlapping'
    let tp=0,fp=0,tn=0,fn=0
    for(const sample of successful) {
      const boxes=packagesInZone(sample.detections,zone)
      const prediction=target==='parcel'?boxes.length>0:boxes.some(d=>d.overlap>=.25)
      if(truth&&prediction)tp++; else if(!truth&&prediction)fp++; else if(truth)fn++; else tn++
    }
    return {tp,fp,tn,fn,precision:tp+fp?tp/(tp+fp):null,recall:tp+fn?tp/(tp+fn):null}
  }
  const latencies=successful.map(s=>s.latencyMs).sort((a,b)=>a-b)
  return {attempted:samples.length,successful:successful.length,failed:samples.length-successful.length,
    parcel:score('parcel'),overlap:score('overlap'),
    medianInferenceMs:latencies.length?latencies[Math.floor(latencies.length/2)]:null,
    p95InferenceMs:latencies.length?latencies[Math.max(0,Math.ceil(latencies.length*.95)-1)]:null}
}
