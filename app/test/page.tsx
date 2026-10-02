'use client'

import { useEffect, useRef, useState } from 'react'
import { Header } from '../components/Header'
import { AppNavigation } from '../components/AppNavigation'
import { ClearDrop } from '../components/ClearDrop'
import { ChangeObservation } from '@/lib/change-monitor'
import { drawCameraFixture, FIXTURE_ZONE, FixturePlacement } from '@/lib/camera-fixture'

type Result = 'Waiting' | 'Passed' | 'Failed'
const TEST_NAMES = ['Box beside the doorway: no change alert', 'Box inside, then removed: alert and verified clearing', 'Video lost: earlier alert remains unresolved']
const initialObservation: ChangeObservation = { ready: false, blocked: false, unresolved: false, ratio: 0, scans: 0 }

export default function CameraTestPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const feed = useRef<MediaStream | null>(null)
  const drawing = useRef<ReturnType<typeof setInterval> | null>(null)
  const runner = useRef<ReturnType<typeof setInterval> | null>(null)
  const placement = useRef<FixturePlacement>('empty')
  const observation = useRef(initialObservation)
  const generation = useRef(0)
  const [active, setActive] = useState(false)
  const [running, setRunning] = useState(false)
  const [seen, setSeen] = useState(initialObservation)
  const [results, setResults] = useState<Result[]>(['Waiting', 'Waiting', 'Waiting'])
  const [stage, setStage] = useState('Start the test video, then save its empty doorway reference.')
  const [error, setError] = useState('')
  const [backend, setBackend] = useState('Checking backend…')
  const [runId, setRunId] = useState(0)

  function release() {
    if (drawing.current) clearInterval(drawing.current)
    drawing.current = null
    feed.current?.getTracks().forEach(track => track.stop())
    feed.current = null
    const video = videoRef.current
    if (video) { video.pause(); video.srcObject = null }
    setActive(false)
  }
  function cancel() {
    ++generation.current
    if (runner.current) clearInterval(runner.current)
    runner.current = null
    setRunning(false); release()
  }
  useEffect(() => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    void fetch('/api/health', { cache: 'no-store', signal: controller.signal }).then(async res => {
      const data = await res.json()
      setBackend(res.ok && data.status === 'ok' ? 'Backend responding — HTTP 200' : 'Backend check failed')
    }).catch(() => setBackend('Backend could not be reached')).finally(() => clearTimeout(timeout))
    const hide = () => { if (document.hidden) { cancel(); setStage('Test interrupted: keep this page visible and start again.') } }
    document.addEventListener('visibilitychange', hide)
    return () => { controller.abort(); clearTimeout(timeout); document.removeEventListener('visibilitychange', hide); cancel() }
  }, [])

  async function start() {
    cancel()
    const attempt = generation.current
    setError(''); setRunId(value => value + 1)
    setResults(['Waiting', 'Waiting', 'Waiting']); observation.current = initialObservation; setSeen(initialObservation)
    placement.current = 'empty'
    try {
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360
      const ctx = canvas.getContext('2d')
      if (!ctx || !canvas.captureStream) throw new Error('Use Chrome or Edge for these controlled video tests.')
      const started = performance.now()
      const draw = () => drawCameraFixture(ctx, placement.current, (performance.now() - started) / 1000)
      draw(); drawing.current = setInterval(draw, 67)
      const stream = canvas.captureStream(15); feed.current = stream
      const video = videoRef.current
      if (!video) throw new Error('Video element is unavailable.')
      video.srcObject = stream
      await video.play()
      if (attempt !== generation.current) return
      setActive(true); setStage('The area is empty. Tap “Area is empty — start watching” below.')
    } catch (e) {
      if (attempt !== generation.current) return
      release(); setError(e instanceof Error ? e.message : 'Test video could not start.')
    }
  }

  function run() {
    if (!active || !observation.current.ready || running) return
    const started = performance.now()
    let outsidePassed = false, insidePassed = false, removedPassed = false, secondAlert = false, stopped = false
    setRunning(true); setResults(['Waiting', 'Waiting', 'Waiting'])
    runner.current = setInterval(() => {
      const elapsed = performance.now() - started, current = observation.current
      if (elapsed < 4500) {
        placement.current = 'beside'; setStage('Test 1: the box stays outside your keep-clear area.')
      } else if (elapsed < 10000) {
        if (!outsidePassed) { outsidePassed = current.ready && !current.blocked && !current.unresolved && current.scans >= 8; setResults(items => [outsidePassed ? 'Passed' : 'Failed', items[1], items[2]]) }
        placement.current = 'inside'; setStage('Test 2: the box stays inside. The real change detector must wait three seconds.')
        if (current.blocked) insidePassed = true
      } else if (elapsed < 14000) {
        placement.current = 'empty'; setStage('Test 2: box removed. Wait for the actual empty-reference checks to clear the alert.')
        if (insidePassed && current.ready && !current.blocked && !current.unresolved) removedPassed = true
        setResults(items => [items[0], removedPassed ? 'Passed' : items[1], items[2]])
      } else if (elapsed < 19500) {
        placement.current = 'inside'; setStage('Test 3: create another real pixel-change alert before stopping the video.')
        if (current.blocked && current.unresolved) secondAlert = true
      } else if (elapsed < 20750) {
        if (!stopped) { stopped = true; release() }
        setStage('Test 3: video stopped. The earlier change must stay unresolved.')
      } else {
        setResults(items => [items[0], insidePassed && removedPassed ? 'Passed' : 'Failed', secondAlert && !current.ready && current.unresolved ? 'Passed' : 'Failed'])
        setStage('Tests finished. Results come from the same monitoring component used by phone and Ring video.')
        if (runner.current) clearInterval(runner.current)
        runner.current = null; setRunning(false)
      }
    }, 200)
  }

  return <><Header connected={false} enabledCount={0} simpleMode /><AppNavigation active="demo" />
    <main id="main-content" className="cd-shell" tabIndex={-1}>
      <section className="cd-hero"><p className="cd-eyebrow">CAMERA PROCESSING TESTS</p><h1>Watch the actual checks work.</h1><p>Three repeatable tests send moving video through the same empty-reference change detector used by phone and Ring camera input.</p></section>
      <div className="cd-demo-notice"><strong>Controlled test video</strong><span>Generated pixels, not Ring footage or proof of parcel-recognition accuracy.</span></div>
      <p className="cd-help" role="status">{backend}</p>
      <section className="cd-camera-card"><div className="cd-card-heading"><span>Test doorway</span><span>{active ? 'Generated video playing' : 'Video stopped'}</span></div>
        <div className="cd-video"><video ref={videoRef} autoPlay muted playsInline aria-label="Controlled doorway test video" className="w-full h-full object-contain" />{!active && <div className="cd-video-placeholder"><p>{stage}</p>{!running && <button className="cd-button cd-primary" onClick={() => void start()}>Start test video</button>}</div>}</div>
      </section>
      <section className="cleardrop-controls" aria-label="Camera test results"><p role="status">{stage}</p><ol className="mt-4 space-y-3">{TEST_NAMES.map((name, index) => <li key={name} className="flex justify-between gap-3"><span>{index + 1}. {name}</span><strong className={results[index] === 'Failed' ? 'cd-error' : ''}>{results[index]}</strong></li>)}</ol>
        <p className="cd-help">Actual analysis: {seen.scans} sampled frames · {Math.round(seen.ratio * 100)}% area changed · {seen.unresolved ? 'Earlier change unresolved' : seen.ready ? 'Monitoring' : 'Reference needed'}</p>
        {active && <button className="cd-button cd-primary mt-3" disabled={!seen.ready || running} onClick={run}>{running ? 'Tests running…' : 'Run all three tests'}</button>}
        {running && <button className="cd-button mt-3 ml-3" onClick={() => { cancel(); setStage('Cancelled. Start again with a fresh empty reference.'); setResults(['Waiting', 'Waiting', 'Waiting']) }}>Cancel tests</button>}
        {error && <p role="alert" className="cd-error">{error}</p>
        }
      </section>
      <ClearDrop key={runId} videoRef={videoRef} active={active} deviceId="controlled-video-test" fixedZone={FIXTURE_ZONE} onObservation={sample => { observation.current = sample; setSeen(sample) }} />
      <p className="cd-help mt-5"><a className="cd-text-link" href="/phone">Test a physical box with your phone</a> · <a className="cd-text-link" href="/doorway">Connect Ring preview</a> · <a className="cd-text-link" href="/demo">Illustrated walkthrough</a></p>
      <footer className="cd-footer">A passing controlled test verifies processing and state transitions only. Physical camera quality and Ring playback must be checked separately. Always check the doorway yourself.</footer>
    </main></>
}
