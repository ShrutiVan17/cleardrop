# ClearDrop engineering case study

## Problem and scope

A delivery photo answers whether something arrived, not whether the space a resident marked to keep clear has changed. ClearDrop explores that second question through a foreground, local-first review workflow. The prototype does not measure parcel dimensions, walking clearance, or injury prevention.

## Contributions beyond the starter

The project retains the Amazon Ring API Hello World starter and its MIT attribution. ClearDrop adds a calibrated doorway-zone workflow, persistent pixel-change monitoring, unknown-first decisions, phone-camera input, reproducible generated-video tests, a replay evaluation lab, received-frame diagnostics, private per-account Ring sessions, Supabase account boundaries, and a token-free public demonstration. It is not represented as entirely built from scratch.

## Key engineering decisions

- Keep frames local: the normal monitor compares video pixels in the browser against a user-approved empty reference. Phone input is not uploaded or remotely streamed.
- Separate transport from evidence: an accepted Ring request or connected ICE state is insufficient. Received bytes and decoded frames are shown independently.
- Preserve uncertainty: stopping video removes the reference but retains an unresolved earlier change. Resuming requires a new empty reference after human inspection.
- Keep demos honest: `/demo` uses scripted observations; `/test` uses generated video through the production monitor. Neither stands in for actual Ring playback or semantic accuracy.
- Isolate credentials: public demonstrations require no Ring token. Private Ring routes independently verify the account, bind sessions to that account, and prohibit fallback to the server owner's token.
- Measure fresh evidence: camera-test reports count only new samples within each run, require phase coverage, reject observation gaps/reference resets, and use the detector sampling clock rather than jittery UI callback delivery.

## Evidence and failures

Run `pnpm test`, `pnpm typecheck` and `pnpm build`. The deterministic suite covers pixel comparison, geometry, persistence, stale observations, privacy boundaries and mocked transport failures. Opt-in provider integration checks are separate and use an explicitly disposable fixture. Consult the dated verification record for what actually ran.

OWL-ViT missed a visible parcel in an evaluated Ring clip. Grounding DINO loaded but timed out during its first synthetic inference. Those results are documented rather than presented as reliable recognition. Optional AI remains experimental; calibrated scene-change review is the independently testable path.

## Code map

- `lib/change-monitor.ts`: shared calibrated pixel monitor and interruption behavior.
- `lib/camera-test-evidence.ts`: independent per-run evidence and JSON report.
- `app/test/page.tsx`: generated moving video, real browser decoding, measured scenarios.
- `lib/phone-camera.ts`: foreground camera lifecycle and track cleanup.
- `app/doorway/page.tsx` and `app/api/`: private Ring preview workflow and server boundaries.
- `lib/inference-evidence.ts`: rejection of stale experimental model evidence.
- `docs/account-security.md`: account setup and remaining release controls.

## Remaining work

Representative permissioned positive/negative clips, lighting and viewpoint evaluation, accessibility feedback, approved consumer Ring OAuth, durable sessions, distributed abuse protection, tested public SMTP, and native-store builds remain separate work. Free sleeping hosting can restart the server and end in-memory Ring sessions. No usage, accuracy, accessibility-study, safety-certification or employment outcome is claimed.
