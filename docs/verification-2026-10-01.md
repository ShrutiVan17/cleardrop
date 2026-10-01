# Verification — October 1, 2026

- Production build passed on Windows, Node 24.19.0, Next 15.5.27.
- 71 deterministic tests passed. Auth policy tests and mocked Ring tests are not live-provider evidence.
- Registry production-dependency audit returned no known vulnerabilities after updating Next and overriding PostCSS 8.5.23 / sharp 0.35.4. This does not establish complete application security.
- `/test` ran in the actual browser: generated 640×360 moving video, decoded by HTMLVideoElement and sampled through the same ClearDrop/ChangeMonitor path as real input. All three cases passed: outside-zone change ignored; persistent inside-zone change and reference restoration; video stopped with prior change unresolved. At completion the UI showed 143 sampled frames, including pre-run reference monitoring. No preset pass values or scripted detector boxes were used.
- Backend health returned HTTP 200. Account-disabled UI reports setup required, not successful signup.
- Separate account-enabled server without project configuration rejected private phone/Ring routes with HTTP 503, rejected cross-site account writes with HTTP 403, and left the non-personal demo available.
- Supabase project, SMTP/verification, abuse controls and live account lifecycle are not configured or live-tested. Account mode remains disabled on the owner preview.
- Physical phone-camera placement and new Ring playback were not exercised in this run. No physical Ring camera is available; the previous Playground token expired. Generated video is not evidence of hardware integration or semantic recognition accuracy.
- No native store build, store submission, security certification or injury-prevention claim is made.

## AI evidence follow-up

- Added five tests for live inference freshness: delayed frames, source generations, paused/rewound video and video freezing after one new frame. All five passed.
- Live inference now rejects results when decoded video has stopped advancing, including while a worker is busy. Unknown model state hides old detection boxes and retains the unresolved-obstruction decision.
- An optional JSON observation download records the actual model, revision, source-frame timestamp, detections and current review status. It includes no footage or credentials. It does not constitute recognition-accuracy evidence.
- These changes do not fix the documented OWL-ViT recognition misses or Grounding DINO inference timeout. A replacement model still needs permissioned positive/negative evaluation before reliable-recognition claims.
