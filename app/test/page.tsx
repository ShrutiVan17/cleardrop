'use client'

import { useEffect, useRef, useState } from 'react'
import { Header } from '../components/Header'
import { AppNavigation } from '../components/AppNavigation'
import { ClearDrop } from '../components/ClearDrop'
import { ChangeObservation } from '@/lib/change-monitor'
import { drawCameraFixture, FIXTURE_ZONE, FixturePlacement } from '@/lib/camera-fixture'
import { CameraTestEvidence, cameraTestPhase, CAMERA_TEST_NAMES, CameraTestResult } from '@/lib/camera-test-evidence'

const initialObservation: ChangeObservation = { ready: false, blocked: false, unresolved: false, ratio: 0, scans: 0 }

export default function CameraTestPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const feed = useRef<MediaStream | null>(null)
  const drawing = useRef<ReturnType<typeof setInterval> | null>(null)
  const runner = useRef<ReturnType<typeof setInterval> | null>(null)
  const placement = useRef<FixturePlacement>('empty')
  const observation = useRef(initialObservation)
  const generation = useRef(0)
  const evidence = useRef<CameraTestEvidence | null>(null)
  const [active, setActive] = useState(false)
  const [running, setRunning] = useState(false)
  const [seen, setSeen] = useState(initialObservation)
  const [results, setResults] = useState<CameraTestResult[]>(['Waiting', 'Waiting', 'Waiting'])
  const [report, setReport] = useState<ReturnType<CameraTestEvidence['report']> | null>(null)
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
    const hide = () => { if (document.hidden && (feed.current || runner.current)) { cancel(); evidence.current = null; setReport(null); setResults(['Waiting', 'Waiting', 'Waiting']); setStage('Test interrupted: keep this page visible and start again.') } }
    document.addEventListener('visibilitychange', hide)
    return () => { controller.abort(); clearTimeout(timeout); document.removeEventListener('visibilitychange', hide); cancel() }
  }, [])

  async function start() {
    cancel()
    const attempt = generation.current
    setError(''); setRunId(value => value + 1)
    evidence.current = null; setReport(null)
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
      setActive(true); setStage('Check the empty area, tick the visual-check box, then tap “Area is empty — start watching” below.')
    } catch (e) {
      if (attempt !== generation.current) return
      release(); setError(e instanceof Error ? e.message : 'Test video could not start.')
    }
  }

  function run() {
    if (!active || !observation.current.ready || running) return
    const started = performance.now()
    let stopped = false
    const runEvidence = new CameraTestEvidence(started, observation.current)
    evidence.current = runEvidence; setReport(null); placement.current = 'beside'
    setRunning(true); setResults(['Waiting', 'Waiting', 'Waiting'])
    runner.current = setInterval(() => {
      const now = performance.now(), phase = cameraTestPhase(now - started)
      setResults(runEvidence.results(now))
      if (phase === 'outside') {
        placement.current = 'beside'; setStage('Test 1: the box stays outside your keep-clear area.')
      } else if (phase === 'inside') {
        placement.current = 'inside'; setStage('Test 2: the box stays inside. The real change detector must wait three seconds.')
      } else if (phase === 'restored') {
        placement.current = 'empty'; setStage('Test 2: box removed. Wait for the scene to match the empty reference again.')
      } else if (phase === 'second-alert') {
        placement.current = 'inside'; setStage('Test 3: create another real pixel-change alert before stopping the video.')
      } else if (phase === 'lost') {
        if (!stopped) { stopped = true; release() }
        setStage('Test 3: video stopped. The earlier change must stay unresolved.')
      } else {
        setReport(runEvidence.report(now)); evidence.current = null
        setStage('Tests finished. Results come from the same monitoring component used by phone and Ring video.')
        if (runner.current) clearInterval(runner.current)
        runner.current = null; setRunning(false)
      }
    }, 200)
  }

  function downloadReport() {
    if (!report) return
    const url = URL.createObjectURL(new Blob([JSON.stringify({ ...report, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'cleardrop-camera-test.json'; anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return <><Header connected={false} enabledCount={0} simpleMode /><AppNavigation active="demo" />
    <main id="main-content" className="cd-shell" tabIndex={-1}>
      <section className="cd-hero"><p className="cd-eyebrow">CAMERA PROCESSING TESTS</p><h1>Watch the actual checks work.</h1><p>Three repeatable tests send moving video through the same empty-reference change detector used by phone and Ring camera input.</p></section>
      <div className="cd-demo-notice"><strong>Controlled test video</strong><span>Generated pixels, not Ring footage or proof of parcel-recognition accuracy.</span></div>
      <p className="cd-help" role="status">{backend}</p>
      <section className="cd-camera-card"><div className="cd-card-heading"><span>Test doorway</span><span>{active ? 'Generated video playing' : 'Video stopped'}</span></div>
        <div className="cd-video"><video ref={videoRef} autoPlay muted playsInline aria-label="Controlled doorway test video" className="w-full h-full object-contain" />{!active && <div className="cd-video-placeholder"><p>{stage}</p>{!running && <button className="cd-button cd-primary" onClick={() => void start()}>Start test video</button>}</div>}</div>
      </section>
      <section className="cleardrop-controls" aria-label="Camera test results"><p role="status" aria-live="polite">{stage}</p><ol className="mt-4 space-y-3">{CAMERA_TEST_NAMES.map((name, index) => <li key={name} className="flex justify-between gap-3"><span>{index + 1}. {name}</span><strong className={results[index] === 'Failed' ? 'cd-error' : ''}>{results[index]}</strong></li>)}</ol>
        <p className="cd-help">Actual analysis: {seen.scans} sampled frames · {Math.round(seen.ratio * 100)}% area changed · {seen.unresolved ? 'Earlier change unresolved' : seen.ready ? 'Monitoring' : 'Reference needed'}</p>
        {active && <button className="cd-button cd-primary mt-3" disabled={!seen.ready || running} onClick={run}>{running ? 'Tests running…' : 'Run all three tests'}</button>}
        {running && <button className="cd-button mt-3 ml-3" onClick={() => { cancel(); evidence.current = null; setReport(null); setStage('Cancelled. Start again with a fresh empty reference.'); setResults(['Waiting', 'Waiting', 'Waiting']) }}>Cancel tests</button>}
        {report && <details className="cd-details mt-4"><summary>Measured test evidence</summary><p className="cd-help">Only samples collected during this run count. An interruption or reference reset fails the run. No frames or credentials are included.</p><p className="cd-help">Fresh samples: beside {report.phases.outside.samples} · inside {report.phases.inside.samples} · reference restored {report.phases.restored.samples} · second change {report.phases['second-alert'].samples}</p>{report.failure && <p className="cd-error" role="alert">{report.failure}</p>}<button className="cd-button" onClick={downloadReport}>Download test report</button></details>}
        {error && <p role="alert" className="cd-error">{error}</p>
        }
      </section>
      <ClearDrop key={runId} videoRef={videoRef} active={active} deviceId="controlled-video-test" fixedZone={FIXTURE_ZONE} onObservation={sample => { observation.current = sample; evidence.current?.observe(sample, performance.now()); setSeen(sample) }} />
      <p className="cd-help mt-5"><a className="cd-text-link" href="/phone">Test a physical box with your phone</a> · <a className="cd-text-link" href="/doorway">Connect Ring preview</a> · <a className="cd-text-link" href="/demo">Illustrated walkthrough</a></p>
      <footer className="cd-footer">A passing controlled test verifies processing and state transitions only. Physical camera quality and Ring playback must be checked separately. Always check the doorway yourself.</footer>
    </main></>
}
