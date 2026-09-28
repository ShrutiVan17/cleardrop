# Release verification — September 28, 2026

UI simplification: consistent Watch Ring / Try demo / Test a clip navigation; shorter demo; optional AI, replay configuration, connection setup and developer tools collapsed by default. Rebuilt successfully and reran all 30 tests. Browser keyboard navigation verified between Ring and replay; direct replay URL works without a token.

- Node 24.19.0; pnpm 11.19.0; Next.js 15.5.18.
- TypeScript `tsc --noEmit`: passed.
- Five deterministic test suites: 30 checks passed.
- Next.js optimized production build: passed after allowing normal build child processes; the first sandbox-only attempt stopped with spawn EPERM.
- Browser: all seven interactive scenario states produced their expected statuses, including unresolved obstruction through disconnect and cautious removal verification.
- Browser: one footer in the DOM and no horizontal overflow at the observed viewport.
- The browser automation did not observe a completed simulation-JSON download within its 10-second wait; download completion is not verified in this environment.
- Browser: expired Ring credential showed recovery instructions rather than a broken stream screen; local replay remained accessible.
- Grounding DINO q8 loaded, but its first synthetic-frame inference exceeded the 60-second limit. The report remained incomplete with an explicit error. No model-accuracy claim is supported by this check.
- `.env.local` remains gitignored. Source packaging uses an explicit allowlist and excludes local credentials, dependency/build trees and recorded video; it additionally checks for JWT/private-key patterns. This is a basic leak check, not a comprehensive security audit.
- Fresh Ring playback was not reverified today: the Playground token control did not return a token during this check. Prior development did verify Ring video playback; see `sandbox-evaluation.md` and `friction-log.md`. Refresh credentials and check actual video before recording the submission.

Not completed: representative model evaluation, live accessibility user testing, production authorization, hosted deployment, public repository publication, public demo-video upload or Devpost submission.
