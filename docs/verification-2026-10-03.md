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

## Delivery-review implementation follow-up

Added a separate acknowledgement/removal-check state machine, optional foreground desktop notification attempts, ordered bounded metadata sync and independently authenticated private review APIs. Public generated tests remain local and never request notification permission. Ring account sync is opt-in before a new review; saved metadata cannot restore a camera reference or automatically select a device. Account settings expose latest saved history and explicitly confirmed closed-review deletion. Privacy and retention limitations are documented.

122 deterministic tests passed (15 added checks for review transitions, notification failures, ordered retry/disposal/overflow, metadata validation and owner-bound API behavior). Type checking and final production compilation passed. Anonymous local `/api/reviews` returned 401.

The approved migration was installed through the existing Supabase project’s SQL Editor. Live SQL checks using `authenticated` and `anon` roles passed owner CRUD, cross-owner select/update/delete denial, foreign-owner insert denial, anonymous select denial, consecutive-version enforcement, acknowledgement ordering, immutable human reports and closed-state guards. All fixture users and records were rolled back. These database checks are distinct from mocked API tests.

Local production browser checks passed the already-present manual report → acknowledgement → removal-check flow. Closure stayed disabled without an empty reference, remained open after reference restoration, reset visual confirmation when the view changed, and closed only after a new explicit confirmation with fresh video. All three measured generated-video cases passed; the resulting review remained open with unknown evidence after video loss. Generated tests did not request desktop notification permission or offer account sync.

Fresh Ring playback, actual OS notification delivery and private review saving from a fresh Ring feed require separate checks; do not infer them from the SQL checks.

GitHub [Verify ClearDrop run 37169401058](https://github.com/ShrutiVan17/cleardrop/actions/runs/37169401058) passed installation, all deterministic tests, type checking and production compilation for commit `e067fc2`. Local public-route checks passed with the new review endpoint restricted to signed-in accounts. The separate Pages workflow does not host this server application.

Render deployed `e067fc2` successfully on its existing free service. Hosted anonymous route/access checks passed, including 401 for private review metadata. The existing owner session remained signed in after deployment, and Account → Private review history loaded the empty owner history without an error. This verifies authenticated reads and installed storage, not a real-camera write or notification delivery.

Hosted generated-video processing passed all three measured cases with 82 sampled frames. The review remained open with unknown evidence after video loss. Acknowledgement and starting the removal check did not enable closure, even with the visual-check box ticked. The private account history remained empty after the public test. Actual OS notification delivery, fresh physical Ring verification and live-camera metadata writes remain unverified.
