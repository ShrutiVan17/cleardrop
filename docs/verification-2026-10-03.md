# Verification — October 3, 2026

## Evidence-first architecture refactor

- Extracted shared `useChangeMonitor` browser lifecycle/capture from the UI. `ChangeMonitor` remains the pure policy engine and sole source of its observation. Ring, phone and generated video explicitly label their camera-source category.
- Enforced complete bounded RGBA frames. Invalid calibration is atomic; broken/resized observations pause monitoring without resolving earlier concern.
- Added 64-entry versioned, source-labelled review receipts with copied metadata, reference revisions, interruption reasons and dropped-event counts. Pixels, account details, device identifiers and credentials are not serialized. These are local history, not tamper-proof audits.
- Added a read-only GitHub test/typecheck/build workflow and documented architecture decisions. Workflow execution is checked separately from configuration.

## Completed local checks

107 deterministic tests passed, including nine new regressions for invalid evidence, receipt provenance/privacy/bounds and interface separation. TypeScript checking passed. The first sandboxed production build stopped on a worker `spawn EPERM`; allowing normal build workers produced a successful Next.js 15.5.27 build. Node.js 24.19.0.

Local production browser testing at `127.0.0.1:3001/test` passed all three measured generated-video scenarios, with 79 sampled frames at completion. Backend health responded HTTP 200; video loss retained unresolved earlier change. Generated pixels test policy and processing, not Ring hardware or semantic recognition. The manual already-present-parcel controls are checked separately. Hosted deployment and actual download completion are not implied by these local checks.

## Hosted and automation checks

Render successfully deployed application commit `ada9bbd`. Anonymous hosted route/account-boundary checks passed. The hosted browser also passed all three generated-video cases with 79 sampled frames and HTTP 200 backend health. The new review-history control was present only under More options. Local manual parcel reporting remained explicitly human-labelled and calibration stayed disabled until removal confirmation. Actual file-download completion and fresh Ring playback were not checked.

The first GitHub Verify ClearDrop run passed tests, typecheck and build on Linux: [run 37166715634](https://github.com/ShrutiVan17/cleardrop/actions/runs/37166715634). Its deprecated action-runtime warning prompted a follow-up workflow-only update to current documented action majors and an explicit Ubuntu 24.04 runner; that follow-up is verified separately. No runtime code changed in the follow-up.

## Remaining gates

No fresh Ring playback, permissioned real-world model benchmark, accuracy claim, public signup/email-delivery test, native-store release, notification delivery or full security certification is established by this refactor. Experimental recognition misses remain documented. Human empty-area confirmation can be mistaken. Session-local history is lost on reload and does not provide authenticated evidence or background monitoring.
