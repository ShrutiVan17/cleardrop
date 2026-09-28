/** Pure decision layer, independent of Ring, React and the recognition model.
 * "No obstruction detected" describes observations, never a safety guarantee.
 */
export type DoorwayPhase = 'unknown' | 'observing' | 'verifying' | 'obstructed' | 'checking-clear'
export type DoorwayState = {
  phase: DoorwayPhase
  lastObservation: number | null
  lastKnownObstruction: boolean
  clearSince: number | null
  clearScans: number
}
export const initialDoorwayState = (): DoorwayState => ({phase:'unknown',lastObservation:null,lastKnownObstruction:false,clearSince:null,clearScans:0})
export function pauseDoorway(state: DoorwayState): DoorwayState {
  return {...state,phase:'unknown',lastObservation:null,clearSince:null,clearScans:0}
}
export function expireDoorway(state: DoorwayState, now: number): DoorwayState {
  return state.lastObservation !== null && now-state.lastObservation > 15000 ? pauseDoorway(state) : state
}
export function observeDoorway(state: DoorwayState, sample: {at:number; candidate:boolean; persistent:boolean}): DoorwayState {
  if (!Number.isFinite(sample.at) || (state.lastObservation !== null && sample.at <= state.lastObservation)) return state
  const fresh = expireDoorway(state,sample.at)
  if (sample.persistent) return {phase:'obstructed',lastObservation:sample.at,lastKnownObstruction:true,clearSince:null,clearScans:0}
  if (fresh.lastKnownObstruction) {
    if (sample.candidate) return {...fresh,phase:'checking-clear',lastObservation:sample.at,clearSince:null,clearScans:0}
    const clearSince=fresh.clearSince ?? sample.at
    const clearScans=fresh.clearScans+1
    if (clearScans >= 3 && sample.at-clearSince >= 5000) {
      return {phase:'observing',lastObservation:sample.at,lastKnownObstruction:false,clearSince:null,clearScans:0}
    }
    return {...fresh,phase:'checking-clear',lastObservation:sample.at,clearSince,clearScans}
  }
  return {phase:sample.candidate?'verifying':'observing',lastObservation:sample.at,lastKnownObstruction:false,clearSince:null,clearScans:0}
}
export function doorwayStatus(state: DoorwayState): string {
  switch (state.phase) {
    case 'unknown': return state.lastKnownObstruction ? 'View unavailable — previous obstruction has not been verified as removed' : 'Doorway status unknown — waiting for fresh observations'
    case 'observing': return 'No obstruction detected in recent scans — not a safety guarantee'
    case 'verifying': return 'Possible parcel in zone — waiting for repeated observations'
    case 'obstructed': return 'Repeated parcel detections overlap the doorway — review required'
    case 'checking-clear': return 'Previous obstruction needs review — checking for consistent removal'
  }
}
