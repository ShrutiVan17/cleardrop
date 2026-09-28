# ClearDrop: deliveries should not block your way

## Product decision

Focus on delivery-related doorway access, particularly for residents using mobility aids or carrying children, groceries, or other items. This is a proposed audience and problem hypothesis, not validated user research. Ask at least three potential users about actual incidents, what action they could take, and whether false alerts would be tolerable.

One-sentence pitch: **ClearDrop uses Ring video to flag a possible delivery obstruction in a resident-defined doorway zone, explain the evidence, and track whether it has been removed.**

Do not claim novelty without competitor research, physical clearance measurements from a 2D box, emergency protection, ADA compliance, or guaranteed safety. The ambition is a complete, useful workflow rather than another camera viewer. Package identity remains experimental.

## Hackathon fit (checked September 26, 2026)

The Ring track permits simulators without physical devices and lists accessibility and caretaking as priorities. The rules distinguish basic live view/motion alerts from non-security accessibility and delivery-management experiences. Technical implementation, design, impact and idea quality have equal weight. The overview lists October 23, 2026 at noon PDT as the deadline; the ten-day schedule below is our development target, not the official deadline.

Submission: actual Ring integration, runnable source and required access/license, an English public demo under three minutes, and feedback for tools used. Optional friction logs may earn a bonus. Confirm the current rules and eligibility directly before submitting.

Sources:
- https://amazonappdev2026.devpost.com/
- https://amazonappdev2026.devpost.com/rules

## Honest current state

Implemented: Ring sandbox WHEP playback; expired-token checks; parcel-model worker; editable normalized zone; background comparison; model box filtering and spatial persistence; local decision state; basic activity UI; twenty deterministic logic tests.

Verified: sandbox playback and actual local model inference. **A correct positive package detection has not yet been verified.** Tests cover application logic, not recognition accuracy. Activity is not durable, monitoring stops when the browser closes, and the playground token expires. There is no caregiver notification service, production account onboarding, or 24/7 backend worker. Do not imply otherwise in the submission.

## Dependable architecture target

Keep one Next.js application, a model Web Worker and pure domain modules. Do not add distributed services for the ten-day prototype.

1. **Video source boundary:** Ring sandbox is the real integration. Add a separate local-file replay source for repeatable evaluations using footage the user owns or is permitted to use. A prominent source label must distinguish replay from live Ring footage. Both sources produce frames with source ID, session ID, frame timestamp and dimensions.
2. **Recognition boundary:** a replaceable detector returns label, box, model/version, score and capture timestamp. Keep model loading, timeouts, cancellation and progress out of the UI component. One inference at a time; bounded frame size; stale outputs rejected. Pin the model revision and record configuration for release reproducibility.
3. **Geometry policy:** normalized zones, correct letterbox transforms, overlap tests and matching across frames. Add a second 'preferred delivery spot' zone only after the detection gate passes. A preferred zone is a user choice, not a computed physically safe path.
4. **Decision policy:** pure functions separate unknown, observing, verifying, obstructed and checking-clear. A connection failure cannot resolve an obstruction. Single missed detections cannot resolve one either. User confirmation, AI inference and background changes are distinct evidence types.
5. **Incident record:** planned stable ID, source/session/zone version, first/last observation, model evidence, current state, acknowledgement and resolution reason. Store metadata locally with visible deletion/export controls. Do not retain camera frames by default. Screenshots require explicit opt-in and a retention policy.
6. **Action surface:** planned one understandable card: 'Possible parcel across the doorway; last observed 8 seconds ago', evidence, 'I checked', 'Not an obstruction', and eventual verified-resolution status. Acknowledgement is not removal. External messages require explicit setup and consent; do not simulate sending them as if delivered.
7. **Evaluation harness:** deterministic domain tests plus labeled replay clips and a machine-readable run report. Report recognition errors separately from overlap errors, latency, stale data and duplicate notifications. Freeze prompts/thresholds before held-out evaluation.

## Reliability work delivered with this blueprint

`lib/doorway-state.ts` now owns freshness and removal decisions, separately from the model. One negative scan cannot clear an established obstruction. At least three negative observations spanning five seconds are required. A returning candidate restarts removal checks. Old/duplicate samples are ignored. A 15-second evidence gap becomes unknown and preserves the fact that a previous obstruction was not verified as removed. Eight tests cover these behaviors.

These thresholds are prototype policy, not validated safety values. Re-evaluate them using footage, latency measurements and user feedback. Evidence currently survives disconnection within the mounted page, not a full reload.

## Release gates (targets, not achieved claims)

- Recognition: collect at least 30 permissioned clips spanning blocking packages, packages outside the zone, people carrying packages, shadows, plants/mats, removal and occlusion. Hold out clips from different recordings; never tune on the held-out set.
- Report event-level precision/recall, raw TP/FP/FN counts, duplicate alerts and time to first alert. A provisional target is at least 90% precision and 85% recall on the held-out sample; a small sample does not establish general reliability.
- No false 'removed' transition on disconnect, model errors, stale results, zone edits or one missed frame in the defined regression cases.
- Performance: measure cold model load and p50/p95 scan/alert latency on the demo laptop. If scans are routinely stale, stop presenting this as live monitoring and use a better model/runtime before submission.
- Fresh-setup test: an independent person can follow the README without receiving a secret token in source or chat.
- Design: keyboard-only zone configuration, readable contrast, status text not color alone, focus visibility and useful empty/error states. Test at phone and laptop widths.
- Security: before exposing the server publicly, replace permissive starter webhook handling with verified Ring authentication/signatures per current documentation; validate payloads before deduplication; protect event streams and token-bearing routes. Localhost testing is not deployment hardening.

## Ten-day execution plan

1. Validate the audience/problem and collect permitted clips. Document labels and expected decisions.
2. Build replay evaluation. Prove a correct positive parcel detection. If OWL-ViT fails, compare an alternative on the same frozen evaluation set; do not disguise failure with hand-picked thresholds.
3. Improve detector/matching and measure false alerts. Keep background-change warnings distinct.
4. Finish incident lifecycle, zone versioning, freshness and failure recovery.
5. Add accessible onboarding and an optional preferred delivery spot.
6. Add local incident metadata history, acknowledgement, export/delete and evidence explanations.
7. Harden Ring session/token handling; verify integration and document production limitations.
8. Run held-out evaluation, browser checks and independent usability testing. Fix failures.
9. Polish the product story and record a truthful demo. Keep replay source labels visible.
10. Fresh install, regression suite, license/attribution review, repository access, feedback/friction log and submission.

Do not spend these ten days adding facial recognition, emergency calling, autonomous locks, paid infrastructure or extra Amazon tracks unless the core workflow is proven and the user approves the expansion.

## Three-minute demonstration target

First show the problem and intended user. Show real Ring integration, then a parcel outside the marked access zone, a parcel overlapping it with repeated evidence, an acknowledgement, and verified removal. Demonstrate that losing the connection yields 'unknown' instead of 'clear'. Finish with measured results and limitations. If using replay for repeatability, label it and separately demonstrate the real Ring connection. Never replace an unverified model result with a scripted alert without clearly identifying it as a simulation.
