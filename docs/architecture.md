# Architecture and boundaries

## Modular monolith, local processing

One Next.js deployment owns the server boundary. Supabase supplies verified account identity. Browser adapters feed pure TypeScript policy modules; no broker, cloud video store or paid inference service is needed for this foreground prototype. See [architecture decisions](architecture-decisions.md) for alternatives and tradeoffs.

```text
Ring WebRTC ────┐
Phone camera ───┼→ useChangeMonitor → ChangeMonitor → simple review UI
Generated video ┘                         ├→ bounded decision receipt
                                          ├→ per-run test evidence
                                          └→ DeliveryReview → acknowledgement → removal check
                                                ├→ opt-in desktop notification attempt
                                                └→ opt-in ordered metadata sync → verified API → owner RLS
```

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

`useWebRTCStream` owns the peer connection, startup timeout, media diagnostics and cleanup. A connection state alone never establishes playback. `useChangeMonitor` owns browser capture, sampling, visibility/stall handling and cleanup. `ChangeMonitor` owns the reference, persistence, unresolved concerns and transition history. `ClearDrop` renders that single observation instead of independently maintaining ready/blocked/unresolved booleans. It owns zone editing and presents human-review actions. `usePackageDetection` owns optional worker inference, single-flight scheduling and stale-result rejection. `package-detection` filters parcel labels/boxes, overlap and tracks persistence. `doorway-state` owns experimental inference uncertainty. `ReplayLab` runs independently of Ring credentials. `demo-scenario` exercises the same policy with transparent synthetic inputs.

## What survives

Doorway coordinates are stored per device in local storage. Reference frames, activity, inference state, pixel decision history and captured clips are memory-only. Exported JSON exists only when requested. Supabase persists account data and explicitly opted-in delivery-review metadata. No camera evidence, multi-user sharing, cloud frame processing, background alerting or remote notification service is implemented.

Receipts retain 64 transitions with human/pixels/system attribution, reference versions, sequence numbers and a dropped-event count. They allowlist source categories and exclude pixels, accounts, credentials and device identifiers. This is inspectable local history, not signed or tamper-proof audit storage.

## Failure policy

No usable frame: do not claim active playback. No fresh inference: status becomes unknown; unresolved obstruction stays unresolved. A model exception is a failed sample, not evidence of no parcel. Clip-end is not proof of removal. The AI and calibrated scene-change workflows are separate and must not be conflated. The illustrated demo proves decision behavior only, not perception performance.

Frames must have positive integer dimensions, a complete RGBA buffer and at most 307,200 pixels. Malformed or resized observations invalidate the reference without resolving concern. Capture is downsampled to 240 pixels wide and at most 720 high. A 1.5-second observation gap, frozen video or hidden page pauses monitoring; receipts name the interruption reason. These are processing guards, not accuracy certification.

An already-visible parcel can be explicitly reported by the viewer before calibration. This is a manual observation, not recognition evidence. It discards any reference and remains unresolved through interruption; ordinary reference replacement cannot erase it. A checked-empty confirmation is required for every calibration, plus an explicit reported-parcel removal check when applicable. Pixel changes cannot resolve a manually reported parcel while monitoring is paused.

## Security / production gate

Delivery reviews are a separate pure state machine. Acknowledgement is not removal. Closure requires the removal-check phase, explicit human confirmation and a fresh usable empty-reference observation. Ordered bounded writes retain failed versions for explicit retry; queue overflow requires local export/reload rather than claiming dropped versions were saved. API routes use verified account identity with the publishable session client, not the service-role key. RLS independently restricts CRUD to the owner. A database trigger enforces initial state, immutable identity, consecutive versions and legal transitions. This records user reports, not trusted sensor evidence. Saved reviews do not contain device IDs and must be manually matched to the correct camera before resuming.

Server credentials must never use NEXT_PUBLIC prefixes. WHEP session cleanup only follows permitted Ring session URLs; cross-origin bearer redirects are disabled. The default run commands bind to 127.0.0.1. Optional account mode uses provider-verified identities and binds Ring sessions to the signed-in account. Public-demo mode permits an explicit list of demonstration and account routes, not Ring API access. Missing account configuration fails closed for private routes; account mode never falls back to an owner's server token. Public signup is disabled until separately released. The inherited refresh-token flow requires further validation, and hosted webhooks remain disabled. Durable consumer OAuth, distributed abuse controls and retention policies are still required for a consumer rollout.

## Verification

`pnpm test` runs deterministic monitoring, interface, account, rate-limit and Ring-session checks. `pnpm typecheck` verifies TypeScript. `pnpm build` checks production compilation. `.github/workflows/verify.yml` runs these on main pushes and pull requests with read-only repository permissions and no deployment secrets. Configuration and actual workflow execution are verified separately. See the dated verification records. Successful tests do not establish real-world model accuracy or accessibility outcomes.

`/test` feeds generated moving pixels through the same `ChangeMonitor` as camera input. `CameraTestEvidence` counts only fresh per-run observations, checks phase coverage and source-clock persistence, rejects gaps/reference resets, and exports an opt-in JSON report. Generated video is not a substitute for actual Ring playback or recognition evaluation.
