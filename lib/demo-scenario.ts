import { initialDoorwayState, observeDoorway, pauseDoorway } from './doorway-state'
import { packagesInZone, trackPackage, Detection } from './package-detection'

export const DEMO_ZONE = {x:.3,y:.5,w:.4,h:.4}
export const DEMO_STEPS = [
  {title:'An ordinary delivery',detail:'A parcel beside the doorway should not become an obstruction alert.',kind:'outside',at:0},
  {title:'The wrong place',detail:'A parcel overlaps the doorway. One observation is not enough to alert.',kind:'inside',at:1000},
  {title:'Review required',detail:'Repeated overlapping observations span three seconds. The app asks a person to review.',kind:'inside',at:4000},
  {title:'Connection lost',detail:'Missing video is not evidence of removal. The previous obstruction remains unresolved.',kind:'offline',at:5000},
  {title:'Checking removal',detail:'Video returns without an overlapping parcel. One clear scan cannot resolve the alert.',kind:'empty',at:6000},
  {title:'Still verifying',detail:'A second observation agrees. The removal verification window is not finished.',kind:'empty',at:8000},
  {title:'Removal observed',detail:'Three non-overlapping scans across five seconds resolve the observation—not a safety guarantee.',kind:'empty',at:11000},
] as const

export function demoState(index:number) {
  let state=initialDoorwayState()
  let track:ReturnType<typeof trackPackage>=null
  for(const step of DEMO_STEPS.slice(0,index+1)) {
    if(step.kind==='offline'){state=pauseDoorway(state);track=null;continue}
    const detections:Detection[]=step.kind==='empty'?[]:[{label:'a cardboard box',score:.8,box:step.kind==='outside'?{xmin:.78,ymin:.6,xmax:.95,ymax:.8}:{xmin:.4,ymin:.62,xmax:.6,ymax:.82}}]
    const boxes=packagesInZone(detections,DEMO_ZONE)
    track=trackPackage(track,boxes,step.at)
    state=observeDoorway(state,{at:step.at,candidate:boxes.some(b=>b.overlap>=.25),persistent:!!track?.alert})
  }
  return state
}
