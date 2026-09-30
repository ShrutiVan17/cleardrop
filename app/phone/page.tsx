'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Header } from '../components/Header'
import { ClearDrop } from '../components/ClearDrop'
import { PhoneCamera, CameraState } from '@/lib/phone-camera'

export default function PhonePage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const camera = useRef<PhoneCamera | null>(null)
  const [state, setState] = useState<CameraState>({ status: 'idle', message: '' })
  const [awake, setAwake] = useState(false)
  const active = state.status === 'live'
  const requesting = state.status === 'requesting'

  useEffect(() => {
    const controller = new PhoneCamera({ video: () => videoRef.current, onState: setState,
      getMedia: constraints => {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) return Promise.reject(new Error('HTTPS camera access required'))
        return navigator.mediaDevices.getUserMedia(constraints)
      },
    })
    camera.current = controller
    const pause = () => { if (document.visibilityState === 'hidden') controller.stop('Camera paused because the app was hidden. Start it again and save a new empty reference.') }
    const leave = () => controller.stop()
    document.addEventListener('visibilitychange', pause)
    window.addEventListener('pagehide', leave)
    return () => { controller.dispose(); camera.current = null; document.removeEventListener('visibilitychange', pause); window.removeEventListener('pagehide', leave) }
  }, [])

  useEffect(() => {
    if (!active) { setAwake(false); return }
    let cancelled = false
    let lock: { release: () => Promise<void>; addEventListener: (event: string, callback: () => void) => void } | undefined
    const wake = (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<NonNullable<typeof lock>> } }).wakeLock
    if (wake) void wake.request('screen').then(value => {
      if (cancelled) { void value.release(); return }
      lock = value; setAwake(true)
      value.addEventListener('release', () => { if (!cancelled) setAwake(false) })
    }).catch(() => setAwake(false))
    return () => { cancelled = true; void lock?.release() }
  }, [active])

  return <>
    <Header connected={false} enabledCount={0} simpleMode />
    <nav aria-label="Camera source" className="cd-navigation"><Link href="/">Ring camera</Link><Link href="/phone" aria-current="page">Phone camera</Link></nav>
    <main id="main-content" className="cd-shell" tabIndex={-1}>
      <section className="cd-hero"><p className="cd-eyebrow">TEST WITH YOUR PHONE</p><h1>Your phone is the camera.</h1><p>Try the real doorway checks. No Ring device or Ring token needed.</p></section>
      <section className="cd-camera-card" aria-label="Phone camera">
        <div className="cd-card-heading"><span>This device</span><span role="status">{active ? 'Live camera' : requesting ? 'Opening camera…' : 'Camera off'}</span></div>
        <div className="cd-video">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain" aria-label="Live phone camera video" />
          {!active && <div className="cd-video-placeholder"><p>{requesting ? 'Allow access to your camera.' : 'Place your phone where it can see the doorway.'}</p><button className="cd-button cd-primary" onClick={() => requesting ? camera.current?.stop() : void camera.current?.start()}>{requesting ? 'Cancel' : 'Start phone camera'}</button></div>}
          {active && <button className="cd-button cd-video-stop" onClick={() => camera.current?.stop()}>Stop camera</button>}
        </div>
        {state.message && <p className="p-4 cd-help" role={state.status === 'error' ? 'alert' : 'status'}>{state.message}</p>}
      </section>
      <ClearDrop videoRef={videoRef} active={active} deviceId="phone-local" />
      <section className="cleardrop-controls" aria-label="Phone test instructions"><h2 className="text-xl font-semibold">Try it in one minute</h2><ol className="list-decimal pl-5 mt-3 space-y-2"><li>Keep the phone still, with an empty doorway in view.</li><li>Mark the doorway and tap <strong>Area is empty — start watching</strong>.</li><li>Place a box inside the marked area, then step out of view. After a persistent change, review the alert.</li><li>Remove the box and check that the view returns to the saved reference.</li></ol><p className="cd-help mt-3">This tests camera input and change alerts, not Ring pairing or reliable parcel recognition. Movement and shadows can also trigger an alert.</p></section>
      <details className="cd-details cd-extra-tools"><summary>Use it like a mobile app</summary><p className="cd-help">Open this HTTPS site directly in Safari on iPhone or Chrome on Android. In the browser menu, choose Add to Home Screen (or Install app when offered).</p><p className="cd-help">No 30-minute Ring token limit in this mode. Keep the app visible and phone powered for longer tests. Locking the screen, changing apps, calls, heat or battery saving can interrupt the camera.</p><p className="cd-help" role="status">{active && awake ? 'Screen keep-awake is active while the camera runs.' : 'If your screen dims, adjust its auto-lock setting during the test.'}</p><p className="cd-help">Video stays on this phone. This is not a remote camera feed, background monitor or offline app. Ring account pairing for other users is not implemented yet.</p></details>
      <footer className="cd-footer">Live phone camera, not simulated footage. Always check the doorway yourself. Not a safety system.</footer>
    </main>
  </>
}
