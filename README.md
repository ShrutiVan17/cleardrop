# ClearDrop
A delivery should not block the doorway.

ClearDrop is a local-first Ring prototype for marking doorway space, reviewing persistent changes, and keeping uncertainty visible when the camera disconnects.

## Start
Verified with Node.js 24.19.0 and pnpm 11.19.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open http://127.0.0.1:3000 and choose:

- **Watch Ring** — real camera or Ring sandbox video. Requires a Ring token.
- **Try demo** — seven scripted examples using the actual decision rules. No token needed.
- **Test a clip** — local video evaluation, with model settings under an expandable section.

The demo is a labelled simulation, not proof of AI recognition or actual Ring playback.

## Connect Ring
1. Generate a temporary token in the [Ring Playground](https://developer.amazon.com/ring/console/playground).
2. Create `.env.local` with `RING_ACCESS_TOKEN=your_token_here`.
3. Restart the server. Choose **Watch Ring**, start video, mark the doorway, then save a reference **while the zone is empty**.

Never commit the token. Renew it when it expires. For replay testing, clips and frames stay on your device.

## Features
- Ring device discovery and WHEP/WebRTC streaming with received-frame diagnostics.
- Doorway-zone editing, local calibrated scene-change detection, persistence and human confirmation.
- Optional experimental parcel AI in a Web Worker.
- Unknown-first decision rules: a disconnect cannot verify removal.
- Local video recording/replay, raw predictions and JSON evaluation reports.
- Simple navigation; advanced controls tucked away without removing functionality.

## Important limitations
This is a hackathon prototype, **not a safety system**. Scene change is not parcel recognition. OWL-ViT missed the visible parcel in our Ring test; Grounding DINO loaded but timed out on its first synthetic inference. Both remain experimental. Read the [evaluation evidence](docs/sandbox-evaluation.md).

No remote caregiver notifications, background monitoring after closing the page, or production multi-user authentication are implemented. Activity and captured clips are memory-only; zone coordinates use local storage. Model weights/runtime files are downloaded when enabled; frames are not sent to a recognition service.

The app binds to **127.0.0.1**. Do not expose its Ring routes publicly with your credentials. Production requires authenticated users, account-scoped authorization, webhook hardening, rate limits and retention controls. The inherited refresh-token/webhook workflow has not been validated end-to-end for this submission.

## Verify
```sh
pnpm test
pnpm typecheck
pnpm build
pnpm start
```

Thirty deterministic tests cover geometry, persistence, stale observations, evaluation reports and demo behavior. The production build passed. These tests do not establish real-world model accuracy.

Use `pnpm-lock.yaml` as the canonical lockfile; the npm lockfile in the original checkout is inherited from the starter.

## Submission materials
- [Devpost description and checklist](docs/submission.md)
- [Demo video script](docs/demo-script.md)
- [Architecture and security boundaries](docs/architecture.md)
- [Detailed instructions](docs/cleardrop.md)
- [Verification record](docs/release-checks.md)
- [Developer friction log](docs/friction-log.md)

A Ring submission needs actual Ring playback in the demo video, not just the illustrated simulation.

## Attribution
Built on [AmazonAppDev/ring-api-helloworld](https://github.com/AmazonAppDev/ring-api-helloworld). Original Amazon copyright and [MIT license](LICENSE) retained. ClearDrop adds the doorway workflow, decision policies, replay evaluation, stream-health improvements and demo UI. See [third-party notices](docs/third-party-notices.md) for model and footage attribution.
