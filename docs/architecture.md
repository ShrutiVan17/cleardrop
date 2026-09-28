# Architecture and boundaries

```text
Ring Playground / permissioned device
  → server-only Ring credential → device discovery + WHEP session proxy
  → browser RTCPeerConnection → actual decoded-frame health checks
      ├─ calibrated frame comparison → persistence → human review / activity
      ├─ optional worker inference → parcel filtering → overlap / track policy
      │     → unknown / observing / verifying / obstructed / checking-clear
      └─ opt-in video-only MediaRecorder → in-memory local replay

Local replay file → sampled frames → isolated inference worker → JSON evidence
Labelled simulation → scripted detections → same pure AI decision rules
```

## Separation of responsibilities

`useWebRTCStream` owns the peer connection, startup timeout, media diagnostics and cleanup. A connection state alone never establishes playback. `ClearDrop` owns the calibrated scene-change workflow and human confirmation. `usePackageDetection` owns the optional inference worker, single-flight scheduling and stale-result rejection. `package-detection` filters parcel labels/boxes, performs overlap and tracks persistence. `doorway-state` owns uncertainty and cautious removal. `ReplayLab` runs independently so expired Ring credentials do not block model evaluation. `demo-scenario` exercises the same policy with transparent synthetic inputs.

## What survives

Doorway coordinates are stored per device in local storage. Reference frames, activity, inference state and captured clips are memory-only. Exported JSON exists only when the viewer requests a download. There is no database, multi-user sharing, cloud frame processing, background alerting or remote notification service.

## Failure policy

No usable frame: do not claim active playback. No fresh inference: status becomes unknown; unresolved obstruction stays unresolved. A model exception is a failed sample, not evidence of no parcel. Clip-end is not proof of removal. The AI and calibrated scene-change workflows are separate and must not be conflated. The illustrated demo proves decision behavior only, not perception performance.

## Security / production gate

Server credentials must never use NEXT_PUBLIC prefixes. WHEP session cleanup only follows permitted Ring session URLs; cross-origin bearer redirects are disabled. The default run commands bind to 127.0.0.1. This server lacks application-user authentication and account-level authorization, so it must not be internet-exposed with real Ring credentials. The inherited webhook endpoint and refresh-token flow require further validation and hardening before deployment. Add authenticated users, account isolation, restricted origins, rate limiting, webhook verification, durable bounded storage and deletion policies before any production rollout.

## Verification

`pnpm test` runs 30 deterministic checks. `pnpm typecheck` verifies TypeScript. `pnpm build` checks production compilation. Browser checks and build outcome for this release are recorded in `release-checks.md`. Successful tests do not establish real-world model accuracy or accessibility outcomes.
