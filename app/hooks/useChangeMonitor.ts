'use client'

import { RefObject, useEffect, useRef, useState } from 'react'
import { ChangeMonitor, ChangeObservation, CameraSource, PauseReason } from '@/lib/change-monitor'
import { Zone } from '@/lib/obstruction'

/** Browser adapter only; detection, human reports and decision history live in the pure engine. */
export function useChangeMonitor({ videoRef, active, deviceId, zone, editing, source, onObservation }: {
  videoRef: RefObject<HTMLVideoElement>; active: boolean; deviceId?: string; zone: Zone; editing: boolean
  source: CameraSource; onObservation?: (observation: ChangeObservation) => void
}) {
  const engine = useRef(new ChangeMonitor())
  const [observation, setObservation] = useState(() => engine.current.snapshot())
  const [error, setError] = useState('')
  const callback = useRef(onObservation); callback.current = onObservation
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const lastMediaTime = useRef(-1)
  const lastFrameAt = useRef(0)

  function publish(next: ChangeObservation) { setObservation(next); callback.current?.(next); return next }
  function pause(reason: PauseReason = 'camera-paused') {
    lastMediaTime.current = -1; setError('')
    return publish(engine.current.pause(reason, performance.now()))
  }
  useEffect(() => { engine.current = new ChangeMonitor(); publish(engine.current.snapshot()); setError('') }, [deviceId])
  useEffect(() => { if (!active) pause() }, [active])
  useEffect(() => {
    const hide = () => { if (document.hidden) { pause('page-hidden'); setError('Monitoring paused while this page was hidden. Check the area and save a fresh empty reference.') } }
    document.addEventListener('visibilitychange', hide)
    return () => document.removeEventListener('visibilitychange', hide)
  }, [])

  function capture() {
    const video = videoRef.current
    if (!active || document.hidden || !video || video.paused || video.readyState < 2 || !video.videoWidth || !video.videoHeight) throw new Error('Start fresh, visible video first.')
    const frame = canvas.current || (canvas.current = document.createElement('canvas'))
    const height = Math.max(1, Math.min(720, Math.round(240 * video.videoHeight / video.videoWidth)))
    if (frame.width !== 240 || frame.height !== height) { frame.width = 240; frame.height = height }
    const context = frame.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Camera analysis is unavailable in this browser.')
    context.drawImage(video, 0, 0, frame.width, frame.height)
    return context.getImageData(0, 0, frame.width, frame.height)
  }

  function calibrate(checkedEmpty: boolean, reportedParcelRemoved = false) {
    try {
      const next = engine.current.calibrate(capture(), zone, performance.now(), { checkedEmpty, reportedParcelRemoved })
      lastMediaTime.current = videoRef.current!.currentTime; lastFrameAt.current = performance.now()
      setError(''); publish(next); return true
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not capture reference'); return false }
  }
  function reportParcel() { setError(''); return publish(engine.current.reportParcel()) }

  useEffect(() => {
    if (!active || !observation.ready || editing) return
    const timer = setInterval(() => {
      const video = videoRef.current, at = performance.now()
      if (document.hidden) { pause('page-hidden'); return }
      if (!video || video.paused || video.currentTime === lastMediaTime.current) {
        if (at - lastFrameAt.current > 1500) { pause('frame-stalled'); setError('Video is not updating. Check the area and save a fresh empty reference.') }
        return
      }
      lastFrameAt.current = at; lastMediaTime.current = video.currentTime
      try {
        const next = publish(engine.current.observe(capture(), at))
        if (!next.ready) setError('Camera analysis was interrupted. Check the area and save a fresh empty reference.')
      } catch { pause('analysis-failed'); setError('Camera analysis failed. Check the area and save a fresh empty reference.') }
    }, 250)
    return () => clearInterval(timer)
  }, [active, observation.ready, editing, zone, videoRef])

  function exportReceipt() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(engine.current.receipt(source), null, 2)], { type: 'application/json' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'cleardrop-review-history.json'; anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return { observation, error, pause, calibrate, reportParcel, exportReceipt }
}
