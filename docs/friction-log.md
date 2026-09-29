# Developer experience notes

## 1. A negotiated Ring session is not proof of playback

- Task: play the sandbox stream in the starter application.
- Observed: WHEP accepted a session and the browser announced a track, but initially received zero video bytes/decoded frames. The starter displayed Stop before playable frames existed. The Ring playground also initially showed no frames in this environment.
- Expected: distinguish negotiating, receiving, playing, failed and ended.
- Severity: high for onboarding and demo trust.
- Workaround: show byte/frame diagnostics and only declare playback after frames arrive; bound startup waiting. Later renewing an expired token and starting a fresh session produced 1280-wide video and over 600 decoded frames.
- Uncertainty: the initial zero-byte failure happened before the original token expired. We have not established its root cause; do not attribute every no-video case to token expiration.
- Suggestion: provide explicit media-health states and troubleshooting IDs in the starter and playground.

## 2. Short-lived credentials are easy to confuse with media failure

- Task: return to the local prototype the next day.
- Observed: saved playground credential had expired, while the page still showed old stream diagnostics.
- Severity: medium/high.
- Workaround: inspect expiry without exposing the token; renew locally; reject expired credentials with a specific recovery message.
- Suggestion: visible expiration countdown and documented local-secret update flow. A sandbox token is not a production authentication architecture.

## 3. Short sandbox clips complicate testing of persistent detections

- Task: edit a zone, calibrate and test a multi-second decision.
- Observed: our sample ended after roughly 21 seconds; manual setup consumed much of the available footage.
- Severity: medium.
- Workaround: load the model first, save the zone and reconnect. Keep explicit ended/unknown state.
- Suggestion: documented repeatable scenarios with package placement/removal and a sandbox replay/reset control. Any app-side replay must be labeled, not presented as live Ring footage.

## 4. Browser model setup has a large first-load cost

- Tool: Transformers.js / OWL-ViT, not Ring.
- Observed: quantized model weights are approximately 155 MB; inference did run in the browser, but no correct positive parcel detection has yet been verified.
- Severity: medium.
- Workaround: explicit opt-in loading, progress, cancellation, worker isolation, local frames and no API key; reject stale outputs.
- Suggestion: a smaller parcel-focused model and representative evaluation footage would improve the experience. Do not describe successful loading as validated recognition.

