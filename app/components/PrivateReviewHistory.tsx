'use client'
import { useEffect, useState } from 'react'
import { DeliveryReview, reviewMetadata } from '@/lib/delivery-review'

export function PrivateReviewHistory() {
  const [reviews,setReviews] = useState<DeliveryReview[]>([])
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [message,setMessage] = useState('')
  const [confirm,setConfirm] = useState(false)
  async function refresh(signal?:AbortSignal) {
    setBusy(true);setError('')
    const attempt=new AbortController(),cancel=()=>attempt.abort(),timer=setTimeout(cancel,10000)
    signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel()
    try {
      const response=await fetch('/api/reviews',{cache:'no-store',signal:attempt.signal})
      const body=await response.json()
      if(!response.ok)throw new Error(body.error||'Private history is unavailable.')
      if(!signal?.aborted)setReviews((body.reviews as unknown[]).map(reviewMetadata))
    } catch(failure) {if(!signal?.aborted)setError(failure instanceof Error?failure.message:'Private history is unavailable.')}
    finally {clearTimeout(timer);signal?.removeEventListener('abort',cancel);if(!signal?.aborted)setBusy(false)}
  }
  useEffect(()=>{const controller=new AbortController();void refresh(controller.signal);return()=>controller.abort()},[])
  async function clearResolved() {
    if(!confirm||busy)return
    setBusy(true);setError('');setMessage('')
    try {
      const response=await fetch('/api/reviews',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmDelete:true}),signal:AbortSignal.timeout(10000)})
      const body=await response.json()
      if(!response.ok)throw new Error(body.error||'Deletion failed.')
      setReviews(items=>items.filter(item=>item.phase!=='resolved'));setConfirm(false);setMessage('Your saved closed reviews were deleted. Open reviews were kept.')
    }catch(failure){setError(failure instanceof Error?failure.message:'Deletion failed.')}
    finally{setBusy(false)}
  }
  return <details className="cd-details mt-5"><summary>Private review history</summary>
    <p className="cd-help">The latest 20 opt-in account-synced records appear here. Public tests and unsynced phone sessions are not uploaded. This is user-reported history, not proof that a parcel was delivered or removed.</p>
    <button className="cd-button mt-3" disabled={busy} onClick={()=>void refresh()}>{busy?'Loading history…':'Refresh history'}</button>
    {!busy&&!error&&reviews.length===0&&<p className="cd-help">No saved reviews yet. Enable private account sync in Ring’s More options before a new review starts.</p>}
    <ol className="space-y-3 mt-3">{reviews.map(item=><li key={item.id}><p>{new Date(item.createdAt).toLocaleString()} · {item.phase.replace(/-/g,' ')}</p><p className="cd-help">{item.source} · {item.cause==='viewer-report'?'Your parcel report':'Scene change'} · version {item.version}</p></li>)}</ol>
    {reviews.length>0&&<><label className="flex gap-2 mt-3"><input type="checkbox" checked={confirm} onChange={event=>setConfirm(event.target.checked)}/><span>Delete all my saved closed reviews permanently, including older records not shown here. Keep open reviews.</span></label><button className="cd-button mt-3" disabled={!confirm||busy} onClick={()=>void clearResolved()}>Delete closed reviews</button></>}
    {message&&<p role="status" className="cd-help">{message}</p>}{error&&<p role="alert" className="cd-error">{error}</p>}
  </details>
}
