'use client'

import { useEffect, useRef, useState } from 'react'
import type { CameraSource, ChangeObservation } from '@/lib/change-monitor'
import { advanceReview, createReview, DeliveryReview, reviewMetadata, ReviewCommand, reviewView } from '@/lib/delivery-review'
import { ReviewNotifier } from '@/lib/review-notifier'
import { ReviewSync } from '@/lib/review-sync'

export function useDeliveryReview(sample: ChangeObservation, source: CameraSource, deviceId?: string) {
  const current = useRef<DeliveryReview | null>(null)
  const [review, setReview] = useState<DeliveryReview | null>(null)
  const [history, setHistory] = useState<DeliveryReview[]>([])
  const [error, setError] = useState('')
  const [notices, setNotices] = useState('Optional desktop alerts are off. The on-page review still works.')
  const [noticesEnabled, setNoticesEnabled] = useState(false)
  const [syncState, setSyncState] = useState('Local only — no review metadata is uploaded.')
  const [syncEnabled, setSyncEnabled] = useState(false)
  const [syncBusy, setSyncBusy] = useState(false)
  const notifier = useRef<ReviewNotifier | null>(null)
  const sync = useRef<ReviewSync | null>(null)
  const generation = useRef(0)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => {
    const value = new ReviewNotifier({ available:()=>typeof window.Notification !== 'undefined' && window.isSecureContext,
      permission:()=>window.Notification.permission, request:()=>window.Notification.requestPermission(),
      show:tag=>new window.Notification('ClearDrop: check your doorway',{ body:'A change needs your review. Open ClearDrop to acknowledge it.', tag, silent:true }) })
    notifier.current = value
    return () => { value.disable(); notifier.current = null }
  }, [])
  useEffect(() => {
    ++generation.current; controller.current?.abort(); sync.current?.dispose(); sync.current = null
    current.current = null; setReview(null); setHistory([]); setError(''); setSyncEnabled(false); setSyncBusy(false)
    setSyncState('Local only — no review metadata is uploaded.')
    return () => { ++generation.current; controller.current?.abort(); sync.current?.dispose() }
  }, [deviceId])

  function commit(next: DeliveryReview) {
    current.current = next; setReview(next)
    setHistory(items => [next,...items.filter(item=>item.id!==next.id)].slice(0,20))
    sync.current?.enqueue(next)
  }
  function command(value: ReviewCommand) {
    const previous = current.current
    if (!previous) return
    try { const next = advanceReview(previous,value,Math.max(Date.now(),previous.updatedAt)); if (next !== previous) commit(next); setError('') }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Review update failed.') }
  }
  function attemptNotice(id: string) {
    if (source === 'generated-video') return
    const outcome = notifier.current?.notify(id) ?? 'not-requested'
    if (outcome !== 'not-requested') command({ kind:'alert', outcome })
    if (outcome === 'presented') setNotices('Desktop notification requested. This does not prove it was delivered or read.')
    if (outcome === 'failed') setNotices('Desktop notification failed. Use the on-page review; no delivery is claimed.')
    if (outcome === 'denied') setNotices('Notification permission is blocked. Use the on-page review.')
    if (outcome === 'unsupported') setNotices('Desktop notifications are unsupported here. Use the on-page review.')
  }
  useEffect(() => {
    const previous = current.current
    if (sample.unresolved || sample.blocked || sample.reportedParcel) {
      if (!previous || previous.phase === 'resolved') {
        const next = createReview(crypto.randomUUID(),source,sample.reportedParcel?'viewer-report':'scene-change',Date.now())
        commit(next); attemptNotice(next.id)
      } else command({ kind:'view', value:reviewView(sample), humanReport:!!sample.reportedParcel })
    } else if (previous && previous.phase !== 'resolved') command({ kind:'view',value:reviewView(sample) })
  }, [sample.ready,sample.blocked,sample.unresolved,sample.reportedParcel,source])

  async function enableNotices() {
    if (source === 'generated-video') return
    const outcome = await notifier.current?.enable()
    setNoticesEnabled(outcome === 'enabled')
    setNotices(outcome === 'enabled' ? 'Desktop alerts are enabled while this page stays open.' : 'Desktop alerts could not be enabled. The on-page review still works.')
    if (outcome === 'enabled' && current.current && current.current.phase !== 'resolved') attemptNotice(current.current.id)
  }
  function disableNotices() { notifier.current?.disable(); setNoticesEnabled(false); setNotices('Optional desktop alerts are off. The on-page review still works.') }
  async function enableSync() {
    if (source !== 'ring' || syncBusy || (current.current && current.current.phase !== 'resolved')) return
    const id = generation.current, abort = new AbortController(); controller.current = abort; setSyncBusy(true)
    const initialTimeout = setTimeout(()=>abort.abort(),10000)
    try {
      const response = await fetch('/api/reviews',{ cache:'no-store', signal:abort.signal })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Private review storage is unavailable.')
      const restored = (body.reviews as unknown[]).map(reviewMetadata)
      clearTimeout(initialTimeout)
      if (id !== generation.current) return
      setHistory(restored); setSyncEnabled(true); setSyncState('Account sync enabled for new reviews. No video or device IDs are saved.')
      sync.current = new ReviewSync(async snapshot => {
        const attempt = new AbortController(), cancel = ()=>attempt.abort()
        abort.signal.addEventListener('abort',cancel,{ once:true }); if (abort.signal.aborted) cancel()
        const timeout = setTimeout(cancel,10000)
        try {
          const saved = await fetch('/api/reviews',{ method:'PUT',headers:{ 'Content-Type':'application/json' },body:JSON.stringify({ review:snapshot }),signal:attempt.signal })
          const result = await saved.json()
          if (!saved.ok) throw new Error(result.error || 'Review was not saved.')
        } finally { clearTimeout(timeout); abort.signal.removeEventListener('abort',cancel) }
      }, (state,detail) => { if (id === generation.current) setSyncState(state==='saved'?'Review status saved to your private account.':state==='saving'?'Saving review status…':`Not saved: ${detail}. Keep reviewing locally. Retry when the problem is fixed.`) })
    } catch (failure) { if (id === generation.current) setSyncState(failure instanceof Error ? failure.message : 'Account sync unavailable.') }
    finally { clearTimeout(initialTimeout); if (id === generation.current) setSyncBusy(false) }
  }
  function disableSync() {
    ++generation.current; controller.current?.abort(); sync.current?.dispose(); sync.current = null
    setSyncEnabled(false); setSyncBusy(false)
    setSyncState('Sync stopped. Pending writes may be unsaved. Download local history; saved account reviews remain private.')
  }
  function resume(item: DeliveryReview) {
    if (current.current && current.current.phase !== 'resolved') { setError('Finish the current review before resuming another.'); return }
    if (item.source !== source || item.phase === 'resolved') return
    current.current = item; setReview(item)
    // Restoring metadata never restores a trusted camera reference or a fresh view.
    command({ kind:'view',value:'unknown' })
  }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ schema:'cleardrop.delivery-review.v1',reviews:history.map(reviewMetadata),
      limits:['User-reported metadata, not authenticated sensor evidence.','Acknowledgement is not removal.','Desktop notification requests do not prove delivery.','No background or caregiver notifications.'] },null,2)],{ type:'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = 'cleardrop-delivery-reviews.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  return { review,history,error,notices,noticesEnabled,enableNotices,disableNotices,syncState,syncEnabled,syncBusy,enableSync,disableSync,
    retrySync:()=>sync.current?.retry(),resume,download,acknowledge:()=>command({ kind:'acknowledge' }),checkRemoval:()=>command({ kind:'check-removal' }),
    resolve:(checkedEmpty:boolean,freshVideo:boolean)=>command({ kind:'resolve',checkedEmpty,freshVideo,observation:sample }) }
}
