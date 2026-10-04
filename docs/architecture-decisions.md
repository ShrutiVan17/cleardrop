# Architecture decisions

## ADR 001 — Pure policy, shared browser adapter, one deployment

Status: implemented.

Ring, phone and controlled video need the same calibrated rules. Policy in a UI component encouraged independently updated booleans to drift from the engine. `ChangeMonitor` now owns observations/transitions; `useChangeMonitor` owns browser capture/lifecycle; `ClearDrop` presents the observation. Pure tests and browser checks exercise different layers of the same path.

Rejected for this scope: microservices per source and a broker. They add credentials, cost, retries and deployment failures without a tested customer feature. The server session store explicitly requires one replica; scaling it is a separate production decision.

## ADR 002 — Fail unknown, retain unresolved evidence

Status: implemented.

Invalid RGBA buffers, dimension changes, sampling gaps, hidden pages and frozen video cannot establish restoration. Explicit interruption reasons pause analysis and retain concerns. Calibration validates its frame before state replacement. Bounded samples prevent accidental full-resolution processing.

Tradeoff: interruptions require another visual empty-area check. This is less convenient but missing evidence cannot imply removal. Users can still incorrectly attest that an occupied zone is empty; calibration is not an automatic occupancy gate.

## ADR 003 — Private, source-labelled decision receipts

Status: implemented.

Opt-in JSON exports identify human confirmation, calibrated pixels and system interruptions. Event/reference sequences expose resets; the rolling 64-event cap reports dropped entries. Copies prevent exports mutating the engine. No frame, credential, account or device identifier is exported.

History is memory-only: not durable event sourcing, authenticated audit storage or accuracy proof. It explains why the foreground app changed state.

## ADR 004 — Separate experimental perception from the usable path

Status: implemented; real-world evaluation pending.

OWL-ViT missed a visible Ring parcel; Grounding DINO timed out on first synthetic inference. Neither supports reliable recognition claims. Optional worker inference remains separate from scene-change review and explicit viewer reports.

Before expanding claims: evaluate permissioned labelled positive/negative clips across lighting, scale and viewpoints; report misses, false positives, latency and failures separately. Deterministic tests are not perception benchmarks. Consumer Ring OAuth, background/caregiver notifications, native distribution and distributed abuse controls are separate release gates.

## ADR 005 — Human review separate from sensor state

Status: implemented.

A pixel restoration does not prove removal and acknowledging a warning does not close it. The review state machine explicitly separates acknowledgement, removal checking and closure. Camera loss changes the review view to unknown without resolving it. Optional foreground desktop notifications are attempts, not delivery receipts. Generated tests never ask for notification permission.

## ADR 006 — Opt-in metadata persistence, no cloud footage

Status: implemented; database installation and live checks recorded separately.

Ring users can opt in before a new review. An ordered, bounded client queue sends strict status/timestamp metadata through independently authenticated APIs. Owner RLS and a database transition trigger provide a second boundary. Consecutive versions detect competing updates; identical retries are idempotent. Failures stay visible and retries are explicit. Public demonstrations remain local. This is not authenticated event sourcing, caregiver sharing or a sensor-proof ledger.

Tradeoff: no device IDs means cloud history cannot automatically choose a camera. Resuming requires explicit camera selection and a fresh reference. A 200-row cap bounds account storage; users can delete closed reviews or their account. Automatic retention and distributed abuse controls remain release work.
