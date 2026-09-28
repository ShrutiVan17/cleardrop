# ClearDrop — submission kit

Status: Devpost entry not submitted. Repository: https://github.com/ShrutiVan17/cleardrop . Add a public demo video before submitting. Confirm personal/team eligibility and that your work was created during the contest window yourself.

## Project name
ClearDrop

## Tagline
A delivery should not block the doorway. Ring-powered, local-first doorway review with explicit uncertainty.

## Inspiration
A package can arrive successfully and still be left in an inconvenient place. For someone using a wheelchair, walker, or other mobility aid, the space immediately outside the door matters. We wanted to explore a camera workflow focused on usable space rather than identifying people. This is a design hypothesis, not a claim that we have completed accessibility user research.

## What it does
ClearDrop connects to Ring video, lets the viewer mark a doorway zone, and looks for persistent changes against an empty-doorway reference. The viewer reviews the video and can confirm or dismiss the possible obstruction. Experimental parcel recognition runs locally in a worker. Its decision layer requires repeated overlapping observations and retains unresolved obstructions when video is unavailable.

A replay lab makes model failures inspectable: load permissioned local footage, define a zone and optional consistent ground-truth label, inspect predictions, and export an evaluation report. A separate illustrated simulation demonstrates the decision lifecycle using scripted detections. That simulation is explicitly labelled and does not imply successful AI recognition.

## How we built it
We extended Amazon's MIT-licensed Ring API Hello World starter with Next.js 15, React, TypeScript, Tailwind, Ring WHEP/WebRTC, canvas-based local frame comparison and Transformers.js/ONNX Runtime in a Web Worker. The Ring credential stays server-side. Geometry, persistence, stale-data handling and report calculations are pure modules with deterministic tests. Thirty tests cover the core policies. A browser-only replay path separates media/inference evaluation from authentication and transient live sessions.

## Challenges
A negotiated WebRTC connection did not always mean received video. We added byte/frame diagnostics and explicit startup, playing and ended states. Short sandbox clips made manual setup difficult, so we added an in-memory recording/replay workflow. The tested OWL-ViT configurations failed to recognize the visible parcel in the package sample; full precision did not solve that miss. We preserved the failure evidence rather than turning low-confidence or whole-scene boxes into apparent successes.

## Accomplishments
Real Ring sandbox video integration, local zone-based change review, conservative decision rules, a model-evaluation workspace, and a reproducible interactive explanation of the failure handling. No face recognition or identity inference is used. The interface separates a human confirmation from a machine suggestion.

## What we learned / next
Reliable media delivery, correct decision logic and accurate perception are separate engineering problems. Next work is representative positive/negative clip evaluation, selecting a smaller parcel-focused model, and testing the interaction with intended users. Production authentication, remote notifications and long-running monitoring are outside this prototype.

## Built with
Ring API, WHEP, WebRTC, Next.js, React, TypeScript, Tailwind CSS, canvas, Web Workers, Transformers.js, ONNX Runtime, OWL-ViT. Grounding DINO is an unvalidated replay comparison option.

## Product feedback
Ring's sandbox made it possible to develop without owning a camera, and the starter provided a useful working API integration. The biggest friction was distinguishing a successfully negotiated session from one actually delivering frames, followed by short-lived credentials and short clips. We would build with Ring again, especially with documented repeatable placement/removal scenarios, a media-health indicator, and clearer token-expiry recovery. Transformers.js made local inference possible, but first-load weight downloads and model quality required explicit evaluation. See the detailed friction log for observations, severity, workarounds and suggestions.

## Submission checklist

- [ ] Choose the Ring primary track. Do not claim AWS Builder integration; none is implemented.
- [ ] Create/publish your own GitHub repository, preserving LICENSE and notices. Never publish `.env.local`, tokens, private footage, `.next` or `node_modules`.
- [ ] Add the repository URL to Devpost. If private, follow the current rules for reviewer access.
- [ ] Record real Ring sandbox or device footage running in ClearDrop. A simulation-only video is insufficient for this Ring submission.
- [ ] Record the labelled walkthrough and briefly show the replay lab. Do not claim validated parcel recognition.
- [ ] Upload an English demo under three minutes to public YouTube or Vimeo; add its link. Avoid private addresses/faces and respect footage licenses.
- [ ] Paste project description and product feedback; include the friction log.
- [ ] Review eligibility, team details, source attribution, all claims and final entry yourself before submitting.

Official requirements checked September 28, 2026: https://amazonappdev2026.devpost.com/ and https://amazonappdev2026.devpost.com/rules . The listed deadline is October 23, 2026, noon PDT; submitting earlier is your choice. External requirements can change—check the entry form before final submission.
