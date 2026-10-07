import type { Zone } from './obstruction'
export type Detection = { label: string; score: number; box: { xmin: number; ymin: number; xmax: number; ymax: number } }
export const PACKAGE_LABELS = ['a cardboard box', 'a padded mailing envelope', 'a plastic delivery parcel']
export function validDetectionBatch(value: unknown): value is Detection[] {
  return Array.isArray(value) && value.length <= 64 && value.every(d =>
    d && typeof d === 'object' && typeof d.label === 'string' && d.label.length <= 120 &&
    Number.isFinite(d.score) && d.score >= 0 && d.score <= 1 && d.box &&
    ['xmin','ymin','xmax','ymax'].every(key => Number.isFinite(d.box[key])) &&
    d.box.xmax > d.box.xmin && d.box.ymax > d.box.ymin)
}
export function intersection(a: Detection['box'], b: Detection['box']) {
  return Math.max(0, Math.min(a.xmax,b.xmax)-Math.max(a.xmin,b.xmin)) * Math.max(0,Math.min(a.ymax,b.ymax)-Math.max(a.ymin,b.ymin))
}
const area = (b: Detection['box']) => Math.max(0,b.xmax-b.xmin)*Math.max(0,b.ymax-b.ymin)
export function iou(a: Detection['box'], b: Detection['box']) { const n=intersection(a,b); return n / Math.max(1e-9,area(a)+area(b)-n) }
export function packagesInZone(detections: Detection[], zone: Zone) {
  const kept: Detection[] = []
  for (const d of detections.filter(d => PACKAGE_LABELS.includes(d.label) && d.score >= .15 && Number.isFinite(d.score) && Object.values(d.box).every(Number.isFinite)).sort((a,b)=>b.score-a.score)) {
    const box = { xmin:Math.max(0,d.box.xmin), ymin:Math.max(0,d.box.ymin), xmax:Math.min(1,d.box.xmax), ymax:Math.min(1,d.box.ymax) }
    if (area(box) <= .001 || area(box) > .6 || kept.some(k => iou(k.box,box) > .4)) continue
    kept.push({...d,box})
  }
  return kept.map(d => ({...d, overlap: intersection(d.box,{xmin:zone.x,ymin:zone.y,xmax:zone.x+zone.w,ymax:zone.y+zone.h}) / area(d.box)}))
}
export type PackageTrack = { box: Detection['box']; since: number; last: number; hits: number; alert: boolean }
export function trackPackage(previous: PackageTrack | null, detections: ReturnType<typeof packagesInZone>, time: number): PackageTrack | null {
  if (!Number.isFinite(time) || time < 0) return previous
  if (previous && time <= previous.last) return previous
  const candidates = detections.filter(d => d.overlap >= .25)
  const match = previous && time-previous.last <= 15000 ? candidates.find(d => iou(previous.box,d.box) >= .3) : undefined
  const d = match || candidates[0]
  if (!d) return null
  const since = match && previous ? previous.since : time
  const hits = match && previous ? previous.hits+1 : 1
  return {box:d.box,since,last:time,hits,alert:hits >= 2 && time-since >= 3000}
}
