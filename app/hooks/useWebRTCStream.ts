'use client'

import { useState, useRef, useCallback, useEffect, RefObject } from 'react'

interface UseWebRTCStreamOptions {
  videoRef: RefObject<HTMLVideoElement>
  deviceId?: string
}

interface UseWebRTCStreamReturn {
  connecting: boolean
  diagnostics: string
  streamActive: boolean
  streamError: string | null
  startStream: () => Promise<void>
  stopStream: () => Promise<void>
}

/**
 * Manages WebRTC connection to Ring camera stream.
 * Handles ICE gathering, SDP negotiation, and cleanup.
 */
export function useWebRTCStream({ videoRef, deviceId }: UseWebRTCStreamOptions): UseWebRTCStreamReturn {
  const [streamActive, setStreamActive] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [diagnostics, setDiagnostics] = useState('Idle')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [streamError, setStreamError] = useState<string | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const sessionUrlRef = useRef<string | null>(null)
  const attemptRef = useRef(0)
  const releaseSession = useCallback(() => {
    const sessionUrl = sessionUrlRef.current
    sessionUrlRef.current = null
    if (sessionUrl) void fetch('/api/ring/stream', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionUrl }), keepalive: true,
    }).catch(() => {})
  }, [])

  const startStream = useCallback(async () => {
    const attempt = ++attemptRef.current
    if (timerRef.current) clearInterval(timerRef.current)
    pcRef.current?.close()
    releaseSession()
    if (videoRef.current) videoRef.current.srcObject = null
    setStreamActive(false)
    setConnecting(true)
    setStreamError(null)
    setDiagnostics('Gathering connection candidates')
    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      })
      pcRef.current = pc
      pc.onicecandidate = () => {
        if (attemptRef.current !== attempt) return
        setDiagnostics(`Gathering: ${pc.iceGatheringState}; candidates: ${(pc.localDescription?.sdp.match(/a=candidate:/g) || []).length}`)
      }
      pc.onicecandidateerror = (event) => {
        if (attemptRef.current !== attempt) return
        const iceError = event as RTCPeerConnectionIceErrorEvent
        setDiagnostics(`ICE server error ${iceError.errorCode}: ${iceError.errorText}; candidates: ${(pc.localDescription?.sdp.match(/a=candidate:/g) || []).length}`)
      }

      pc.addTransceiver('video', { direction: 'recvonly' })
      pc.addTransceiver('audio', { direction: 'recvonly' })

      pc.ontrack = (e) => {
        if (pcRef.current !== pc) return
        if (videoRef.current && e.track.kind === 'video') {
          videoRef.current.srcObject = e.streams[0] || new MediaStream([e.track])
          void videoRef.current.play().catch(() => {
            if (attemptRef.current !== attempt) return
            setStreamError('Video playback could not start. Stop and retry the stream.')
          })
        }
      }

      pc.onconnectionstatechange = () => {
        if (pcRef.current !== pc) return
        if (pc.connectionState === 'failed') {
          setStreamError('Ring session created, but the video connection failed. Check network/WebRTC access and retry.')
          setStreamActive(false)
          setConnecting(false)
          if (timerRef.current) clearInterval(timerRef.current)
          releaseSession()
        }
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      // Wait for ICE gathering
      await new Promise<void>((resolve, reject) => {
        if (pc.iceGatheringState === 'complete') return resolve()
        const timeout = setTimeout(() => {
          pc.onicegatheringstatechange = null
          if (pc.localDescription?.sdp.includes('a=candidate:')) resolve()
          else reject(new Error('The browser produced no network candidates for video. Open this local app in Chrome or Edge and retry; a VPN or firewall may also block WebRTC.'))
        }, 12000)
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === 'complete') {
            clearTimeout(timeout)
            resolve()
          }
        }
      })

      if (pcRef.current !== pc) return

      const res = await fetch('/api/ring/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sdpOffer: pc.localDescription!.sdp, deviceId }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Stream start failed')
      }

      const { sdpAnswer, sessionUrl } = await res.json()
      if (pcRef.current !== pc) {
        if (sessionUrl) void fetch('/api/ring/stream', {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionUrl }),
        }).catch(() => {})
        return
      }
      sessionUrlRef.current = sessionUrl
      await pc.setRemoteDescription({ type: 'answer', sdp: sdpAnswer })
      const started = Date.now()
      let lastFrames = 0
      let lastFrameAt = started
      let hadVideo = false
      timerRef.current = setInterval(async () => {
        if (pcRef.current !== pc) return
        const stats = await pc.getStats().catch(() => null)
        if (!stats) return
        if (pcRef.current !== pc) return
        let bytes = 0, frames = 0
        stats.forEach(s => {
          if (s.type === 'inbound-rtp' && s.kind === 'video') {
            bytes += s.bytesReceived || 0
            frames += s.framesDecoded || 0
          }
        })
        const video = videoRef.current
        const playing = !!video && video.readyState >= 2 && video.videoWidth > 0
        if (frames > lastFrames) {
          lastFrames = frames
          lastFrameAt = Date.now()
        }
        const answeredCodecs = Array.from(new Set((sdpAnswer.match(/a=rtpmap:\d+ [^\r\n]+/g) || []).map((line: string) => line.replace(/a=rtpmap:\d+ /, '')))).join(', ')
        setDiagnostics(`ICE: ${pc.iceConnectionState} | connection: ${pc.connectionState} | received: ${bytes} bytes | decoded: ${frames} frames | negotiated codecs: ${answeredCodecs}`)
        if (hadVideo && Date.now() - lastFrameAt > 8000) {
          setStreamActive(false)
          setConnecting(false)
          setStreamError('The video stopped. Ring sessions are time-limited. Choose Reconnect camera to start a new session.')
          if (timerRef.current) clearInterval(timerRef.current)
          pcRef.current = null
          pc.close()
          releaseSession()
        } else if (playing && frames > 0) {
          hadVideo = true
          setStreamActive(true)
          setConnecting(false)
        } else if (Date.now() - started > 25000) {
          setConnecting(false)
          setStreamActive(false)
          setStreamError(`Ring accepted the session, but no video arrived (ICE ${pc.iceConnectionState}). See connection details below.`)
          if (timerRef.current) clearInterval(timerRef.current)
          pc.close()
          releaseSession()
        }
      }, 1000)
    } catch (err) {
      if (attemptRef.current !== attempt) return
      const message = err instanceof Error ? err.message : 'Stream failed'
      console.error('Stream error:', err)
      setStreamError(message)
      setStreamActive(false)
      setConnecting(false)
      pcRef.current?.close()
      releaseSession()
    }
  }, [videoRef, deviceId, releaseSession])

  const stopStream = useCallback(async () => {
    ++attemptRef.current
    if (timerRef.current) clearInterval(timerRef.current)
    pcRef.current?.close()
    pcRef.current = null
    releaseSession()
    if (videoRef.current) videoRef.current.srcObject = null
    setStreamActive(false)
    setStreamError(null)
    setConnecting(false)
    setDiagnostics('Stopped')
  }, [videoRef, releaseSession])

  useEffect(() => () => {
    ++attemptRef.current
    if (timerRef.current) clearInterval(timerRef.current)
    pcRef.current?.close()
    pcRef.current = null
    releaseSession()
  }, [releaseSession])

  return { streamActive, connecting, diagnostics, streamError, startStream, stopStream }
}

