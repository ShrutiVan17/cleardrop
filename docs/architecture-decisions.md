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

Before expanding claims: evaluate permissioned labelled positive/negative clips across lighting, scale and viewpoints; report misses, false positives, latency and failures separately. Deterministic tests are not perception benchmarks. Consumer Ring OAuth, notifications, native distribution and distributed abuse controls are separate release gates.
