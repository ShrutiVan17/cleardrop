# ClearDrop product walkthrough

Record only what actually runs. Hide tokens and personal account details. Rehearse once. Do not use copyrighted music. The illustrative route is a simulation, not Ring video.

## Before recording

Start the verified app locally. Open `/demo` and `/` in separate tabs. Refresh the Ring playground token privately in `.env.local`; restart the server. Confirm a real sandbox session plays. Select the scenario deliberately. If the sandbox footage's rights are unclear, resolve them before publishing or use permissioned footage. Attribution for the previously tested Package clip is in `third-party-notices.md`.

## 0:00–0:20 — the problem

Show `/demo` hero. Say: “A delivery can reach the right address and still block the space someone needs to enter. ClearDrop explores a doorway-first Ring experience, designed with mobility needs in mind. It keeps analysis local and asks a person to review uncertain observations.”

## 0:20–1:05 — actual Ring integration

Switch to `/`, choose Start camera and show moving Ring footage. Open Testing & connection details to show received frames. Say: “This is Ring sandbox video arriving through WHEP and WebRTC. Connection accepted is not enough—we check whether frames arrive.”

Show Change doorway area and the position fields. If the selected scene has a genuinely empty area, choose Area is empty — start watching. Otherwise explain the empty reference and do not mark an occupied doorway as empty. Say: “The change detector finds persistent scene changes. It does not know whether the change is a parcel; the viewer reviews it.”

## 1:05–1:55 — decision lifecycle, explicitly simulated

Switch to `/demo`. Say: “This labelled simulation supplies scripted detections to our actual decision rules. It is not an AI accuracy demonstration.” Step through all seven stages: outside-zone placement; inside-zone candidate; persistent overlap; connection lost; checking removal; second observation; removal observed.

Say: “The important detail is what happens when evidence disappears. We keep the prior obstruction unresolved. A single clear scan cannot dismiss it; removal needs repeated observations across five seconds.”

## 1:55–2:20 — honest evaluation

Open Test a clip. Show upload, model selection and report controls without pretending a new run has completed. If you have a real saved report, show it. Say: “We built a replay lab because a loaded model is not a validated model. OWL-ViT missed the visible parcel in our test, so recognition remains experimental. We report errors and missed detections rather than hiding them.”

## 2:20–2:40 — close

Return to the simulation's final state. Say: “ClearDrop is a local-first review workflow with explicit uncertainty, backed by tested geometry and state rules. Next: representative clip evaluation and feedback from people with mobility needs. This is an experimental prototype, not a safety system.”

Keep real Ring footage and illustrated examples clearly labelled when sharing a demonstration.

