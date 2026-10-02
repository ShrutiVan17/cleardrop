# Verification — October 1, 2026

- Production build passed on Windows, Node 24.19.0, Next 15.5.27.
- 84 deterministic tests passed after AI-freshness, public-demo boundaries and account rate-limit follow-ups. Auth policy tests and mocked Ring tests are not live-provider evidence.
- Registry production-dependency audit returned no known vulnerabilities after updating Next and overriding PostCSS 8.5.23 / sharp 0.35.4. This does not establish complete application security.
- `/test` ran in the actual browser: generated 640×360 moving video, decoded by HTMLVideoElement and sampled through the same ClearDrop/ChangeMonitor path as real input. All three cases passed: outside-zone change ignored; persistent inside-zone change and reference restoration; video stopped with prior change unresolved. At completion the UI showed 143 sampled frames, including pre-run reference monitoring. No preset pass values or scripted detector boxes were used.
- Backend health returned HTTP 200. Account-disabled UI reports setup required, not successful signup.
- Separate account-enabled server without project configuration rejected private phone/Ring routes with HTTP 503, rejected cross-site account writes with HTTP 403, and left the non-personal demo available.
- Initial checks were account-disabled. The owner's free Supabase project was subsequently configured for controlled tests: email confirmation required, 12-character minimum, secure password changes, and exact hosted/local confirmation redirects. SMTP for general public users, distributed abuse controls and signup/recovery-email delivery remain unverified. Public-demo mode now bypasses Basic auth only for demonstrations/account entry, keeps Ring APIs account-protected, and disables public signup by default.
- Physical phone-camera placement and new Ring playback were not exercised in this run. No physical Ring camera is available; the previous Playground token expired. Generated video is not evidence of hardware integration or semantic recognition accuracy.
- No native store build, store submission, security certification or injury-prevention claim is made.

## AI evidence follow-up

- Added five tests for live inference freshness: delayed frames, source generations, paused/rewound video and video freezing after one new frame. All five passed.
- Live inference now rejects results when decoded video has stopped advancing, including while a worker is busy. Unknown model state hides old detection boxes and retains the unresolved-obstruction decision.
- An optional JSON observation download records the actual model, revision, source-frame timestamp, detections and current review status. It includes no footage or credentials. It does not constitute recognition-accuracy evidence.
- These changes do not fix the documented OWL-ViT recognition misses or Grounding DINO inference timeout. A replacement model still needs permissioned positive/negative evaluation before reliable-recognition claims.

## Live backend account checks

Supabase settings and server-key API checks both returned HTTP 200. Eight local-backend integration checks against the real provider passed: cross-site rejection; creation of one reserved-domain, admin-confirmed fixture without email; wrong-password rejection; provider login and verified session/camera-route access; logout blocking camera access; password change rejecting the old password; deletion requiring the current password; deletion with cleared session. The temporary fixture was removed. This is not email-verification or SMTP evidence, and no real user's password was used.

## Public demonstration follow-up

- The root page is now a token-free landing page; private Ring controls moved to `/doorway`.
- Anonymous local HTTP checks passed for `/`, `/demo`, `/test`, `/phone`, `/account`, `/privacy` and the install manifest. No Basic-auth challenge was sent. `/doorway` redirected to account sign-in; Ring configuration, devices, token, events and stream endpoints returned 401. Cross-site account writes returned 403; unopened public signup returned 503 without emailing a fixture.
- Eight live-provider account checks were rerun successfully using `/doorway` as the private route. The temporary reserved-domain test account was deleted; no real user was removed.
- The actual browser reran all three generated-video cases successfully (82 sampled frames at completion). No account or Ring token was required. This remains controlled processing evidence, not fresh Ring playback.
- `node scripts/test-public-live.cjs` checks the local public mode. Pass the configured HTTPS deployment URL to run the same anonymous checks there. It sends no credentials and never opens a Ring stream.

## Measured camera-test follow-up

- 92 deterministic tests passed after eight evidence-report regressions were added. The updated production build also passed. Counts earlier in this record describe earlier runs, not the current total.
- Fixed a test-report timing error detected by a real browser run: React callback delay must not be mistaken for the monitor's persistence clock. Fresh observations now carry their actual sampling timestamp, and a callback-jitter regression verifies the boundary.
- The local browser reran all three cases successfully after the fix, showing 79 sampled frames at completion. Per-run evidence excludes pre-run scans, retains transient outside-zone alerts, requires measured phase coverage, and fails on source interruption or reference resets. The downloadable JSON contains phase counts and state transitions, not footage or credentials.
- Anonymous local HTTP checks passed again: public pages needed no credentials; private Ring endpoints rejected anonymous access; cross-site writes and unopened signup stayed blocked.
- A 132-second WAV narration draft was generated locally with Microsoft's installed female Zira synthetic voice. It is not synchronized to a recording yet and contains no claim of fresh Ring playback.
- Render free deployment configuration is prepared but not deployed or verified at this checkpoint. Owner sign-in is required. A fresh real Ring session remains separate from controlled-video evidence.

## Render deployment follow-up

- The owner signed into Render and explicitly approved copying the server-only Supabase key into its private environment settings. One Free Docker web service deployed commit `e49c7e7a4f47ab65d7405671c65e1b99b7d4c1b0` successfully at https://cleardrop-shrutivan17.onrender.com. No payment details, paid database or shared Ring token were added.
- Supabase's site URL is now the exact Render origin. Its exact `/auth/confirm` callback was added without removing the existing Railway and local callbacks.
- Anonymous HTTP checks on Render passed for the seven public page/manifest routes. Private Ring endpoints returned 401, `/doorway` redirected to account entry, cross-site account writes returned 403, and public signup remained closed with 503.
- The hosted browser ran all three measured generated-video cases successfully, showing 79 sampled frames at completion. This is controlled processing evidence, not a fresh Ring stream or a physical-camera accuracy test.
- Owner email login, confirmation/recovery-email delivery and actual Ring playback were not exercised during this deployment check. Free hosting sleeps after inactivity, may restart, and has usage quotas; it does not guarantee availability or preserve in-memory Ring sessions.
