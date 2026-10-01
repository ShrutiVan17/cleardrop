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
