import { initialDoorwayState, observeDoorway, pauseDoorway } from './doorway-state'
import { packagesInZone, trackPackage, Detection } from './package-detection'

export const DEMO_ZONE = {x:.3,y:.5,w:.4,h:.4}
export const DEMO_STEPS = [
  {title:'A parcel beside the door',detail:'The delivery is outside the marked area. There’s no need to ask you to check it.',kind:'outside',at:0},
  {title:'Too close to the entrance',detail:'A parcel is now in the marked area. ClearDrop waits to see whether it stays there.',kind:'inside',at:1000},
  {title:'Time to take a look',detail:'The parcel has stayed in the doorway for three seconds. Check the view and move it if needed.',kind:'inside',at:4000},
  {title:'The camera loses connection',detail:'We can’t see whether the parcel was moved. The earlier alert stays open.',kind:'offline',at:5000},
  {title:'The view is back',detail:'The parcel appears to be gone. ClearDrop checks again before closing the alert.',kind:'empty',at:6000},
  {title:'One more check',detail:'The marked area still looks empty. ClearDrop waits a little longer to confirm the change.',kind:'empty',at:8000},
  {title:'The parcel has been moved',detail:'The area stayed empty across three checks over five seconds. The alert is closed. Always check for yourself.',kind:'empty',at:11000},
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

