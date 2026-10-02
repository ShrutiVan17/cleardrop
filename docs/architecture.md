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

An already-visible parcel can be explicitly reported by the viewer before calibration. This is a manual observation, not recognition evidence. It discards any reference and remains unresolved through interruption; ordinary reference replacement cannot erase it. A checked-empty confirmation is required for every calibration, plus an explicit reported-parcel removal check when applicable. Pixel changes cannot resolve a manually reported parcel while monitoring is paused.

## Security / production gate

Server credentials must never use NEXT_PUBLIC prefixes. WHEP session cleanup only follows permitted Ring session URLs; cross-origin bearer redirects are disabled. The default run commands bind to 127.0.0.1. Optional account mode uses provider-verified identities and binds Ring sessions to the signed-in account. Public-demo mode permits an explicit list of demonstration and account routes, not Ring API access. Missing account configuration fails closed for private routes; account mode never falls back to an owner's server token. Public signup is disabled until separately released. The inherited refresh-token flow requires further validation, and hosted webhooks remain disabled. Durable consumer OAuth, distributed abuse controls and retention policies are still required for a consumer rollout.

## Verification

`pnpm test` runs deterministic monitoring, interface, account, rate-limit and Ring-session checks. `pnpm typecheck` verifies TypeScript. `pnpm build` checks production compilation. Browser checks and build outcome are recorded in `verification-2026-10-01.md`. Successful tests do not establish real-world model accuracy or accessibility outcomes.

`/test` feeds generated moving pixels through the same `ChangeMonitor` as camera input. `CameraTestEvidence` counts only fresh per-run observations, checks phase coverage and source-clock persistence, rejects gaps/reference resets, and exports an opt-in JSON report. Generated video is not a substitute for actual Ring playback or recognition evaluation.
