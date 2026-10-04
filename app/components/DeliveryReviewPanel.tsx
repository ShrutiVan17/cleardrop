'use client'
import { useEffect, useState } from 'react'
import type { CameraSource } from '@/lib/change-monitor'
import type { useDeliveryReview } from '../hooks/useDeliveryReview'

export function DeliveryReviewPanel({ flow, fresh, source }: { flow:ReturnType<typeof useDeliveryReview>; fresh:()=>boolean; source:CameraSource }) {
  const [checkedEmpty,setCheckedEmpty] = useState(false)
  useEffect(()=>setCheckedEmpty(false),[flow.review?.id,flow.review?.phase,flow.review?.view])
  const review = flow.review
  if (!review) return null
  const phase = { 'needs-review':'Needs your review',acknowledged:'Review acknowledged','checking-removal':'Removal check needed',resolved:'Closed after your empty-area check' }[review.phase]
  return <section className="cd-review-alert mt-4" aria-label="Delivery review">
    <h3 className="font-semibold">Delivery review: {phase}</h3>
    <p className="cd-help">{review.cause==='viewer-report'?'Started from your parcel report, not AI recognition.':'Started from a persistent scene change, not a confirmed parcel detection.'}</p>
    {review.phase!=='resolved' && <p className="cd-help">{review.view==='unknown'?'Fresh camera evidence is unavailable. This review stays open.':review.view==='reference-restored'?'The view resembles the empty reference. You still need to check removal yourself.':'Check the marked area. Acknowledging this message does not confirm removal.'}</p>}
    <div className="flex gap-3 flex-wrap mt-3">
      {review.phase==='needs-review' && <button className="cd-button" onClick={flow.acknowledge}>I’ve reviewed this</button>}
      {review.phase==='acknowledged' && <button className="cd-button" onClick={flow.checkRemoval}>Check removal</button>}
    </div>
    {review.phase==='checking-removal' && <><p className="cd-help">Reconnect if needed, physically check the correct doorway, remove any obstruction, and save a fresh empty reference.</p><label className="flex gap-2 mt-3"><input type="checkbox" checked={checkedEmpty} onChange={e=>setCheckedEmpty(e.target.checked)} /><span>I visually checked that this doorway’s marked area is empty.</span></label><button className="cd-button mt-3" disabled={!checkedEmpty || review.view!=='reference-restored'} onClick={()=>flow.resolve(checkedEmpty,fresh())}>Confirm empty area — close review</button></>}
    {flow.error && <p role="alert" className="cd-error">{flow.error}</p>}
    <p className="cd-help">{flow.syncEnabled ? flow.syncState : 'This review is local to this page unless account sync was enabled before it started.'}</p>
    {source==='generated-video' && <p className="cd-help">Controlled test review, not an actual delivery.</p>}
  </section>
}
