# Release verification — September 29, 2026

UI simplification: two main destinations, My doorway and Try a demo. Warm white and deep teal, plain-language steps, minimum 44px action buttons, keyboard focus indicators and a skip link. Experimental recognition and clip testing are collapsed by default. No live-stream or setup controls are shown as available when the camera is unavailable.

- Node 24.19.0; pnpm 11.19.0; Next.js 15.5.18.
- TypeScript `tsc --noEmit`: passed.
- Six deterministic test suites: 34 checks passed, including interface structure and selected text-color contrast pairs.
- Next.js optimized production build: passed after allowing normal build child processes; the first sandbox-only attempt stopped with spawn EPERM.
- Browser: all seven interactive scenario states produced their expected statuses, including unresolved obstruction through disconnect and cautious removal verification.
- Browser: all seven steps, restart, and navigation tested using keyboard activation; no horizontal overflow at the observed 343px content width. Back and Next buttons measured 44px high. This is not a complete accessibility audit.
- The browser automation did not observe a completed simulation-JSON download within its 10-second wait; download completion is not verified in this environment.
- Browser: expired Ring credential showed recovery instructions rather than a broken stream screen; local replay remained accessible.
- Grounding DINO q8 loaded, but its first synthetic-frame inference exceeded the 60-second limit. The report remained incomplete with an explicit error. No model-accuracy claim is supported by this check.
- `.env.local` remains gitignored. Source packaging uses an explicit allowlist and excludes local credentials, dependency/build trees and recorded video; it additionally checks for JWT/private-key patterns. This is a basic leak check, not a comprehensive security audit.
- Fresh Ring playback was not reverified today: the current token has expired. Prior development did verify Ring video playback; see `sandbox-evaluation.md` and `friction-log.md`. Refresh credentials and check actual video before recording a demonstration.

Not completed: representative model evaluation, accessibility user testing, production authorization, hosted Next.js deployment or public demo-video upload. The source repository is public. GitHub Pages successfully built a Jekyll site, which does not run this app's Next.js server or Ring API routes.

