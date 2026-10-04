# ClearDrop
A delivery should not block the doorway.

ClearDrop is a local-first doorway-access prototype: a delivery photo tells you what arrived; ClearDrop helps you review whether a personally marked keep-clear area changed, whether the change persisted, and whether removal is actually known. A camera disconnect is not an all-clear. It does not measure physical clearance or guarantee safety.

## Start
Verified with Node.js 24.19.0 and pnpm 11.19.0.

Try the [public website](https://cleardrop-shrutivan17.onrender.com) without an account or Ring token. Free hosting may take about a minute to wake after inactivity. Personal Ring preview still requires your own confirmed account and current token.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open http://127.0.0.1:3000 and choose:

- **Try the working demo** — actual browser video-processing checks at `/test`; no account or token needed in public-demo mode.
- **Use my phone camera** — local camera testing at `/phone`; no Ring token needed.

**My doorway** is at `/doorway`, separate from the public landing page. Personal Ring access requires a verified account in public-demo mode. `/demo` offers three labelled illustrated scenarios using scripted observations, not live video.

For actual video processing, open `/test`: **Start test video → Area is empty — start watching → Run all three tests**. A generated moving video is decoded and sampled by the production monitoring component. Results are measured from pixels and real elapsed time, not preset pass badges. This verifies the camera-processing path, not physical Ring playback or semantic recognition. Use `/phone` with a real box for a physical-camera check.

Clip testing is available under **Testing & connection details**. Experimental recognition stays under **More options**, outside the main workflow.

The demo is a labelled simulation, not proof of AI recognition or actual Ring playback.

## Connect Ring
1. Generate a temporary token in the [Ring Playground](https://developer.amazon.com/ring/console/playground).
2. On **My doorway**, paste the token into **Connect Ring preview**. The server validates it with Ring before saving a per-browser session. No environment-file change or deployment is required. Alternatively, set `RING_ACCESS_TOKEN` privately on the server.
3. Choose a discovered camera, then **Start camera**. Adjust the marked area if needed and choose **Area is empty — start watching**, only **while the area is empty**.

If a parcel is already visible, choose **A parcel is already here**. This is an explicit viewer report, not an AI detection; the app does not save occupied pixels as an empty reference. The report remains unresolved through video loss. Remove the parcel, check the area yourself, tick the removal/empty-area confirmation, then save a new reference. Every empty-reference save requires a visual-check confirmation.

Never commit the token. Renew it when it expires. Browser Ring connections use an opaque HttpOnly cookie and bounded single-process server memory; server restarts or sleeping-container replacement can end the session. These connections require one server replica and are not a durable production OAuth system. For replay testing, clips and frames stay on your device.

## Features
- Phone camera testing at `/phone`: real rear-camera input, the same doorway checks, no Ring token. Supports home-screen launch; keep the page visible. Frames stay on that device, with no remote viewing or background monitoring. Phone testing does not validate Ring pairing or model accuracy.
- Ring device discovery and WHEP/WebRTC streaming with received-frame diagnostics.
- Doorway-zone editing, local calibrated scene-change detection, persistence and human confirmation.
- Optional experimental parcel AI in a Web Worker.
- Unknown-first decision rules: a disconnect cannot verify removal.
- Shared pure monitoring engine and browser adapter for Ring, phone and controlled tests; invalid or stale frames pause analysis.
- Source-labelled review-history export under More options: human confirmations, pixel transitions and interruption reasons, with no video or credentials.
- Delivery review flow: acknowledge, check removal, then explicitly confirm a fresh empty view. Restored pixels never close a review automatically.
- Optional desktop notification attempts while the page is open. Unsupported or denied notifications fall back to on-page review.
- Opt-in private account sync for Ring reviews with row-level owner policies, consecutive-version checks and status-only storage. Public tests remain local; Account settings show saved history and offer confirmed deletion of closed reviews.
- Local video recording/replay, raw predictions and JSON evaluation reports.
- Simple navigation; advanced controls tucked away without removing functionality.

## Important limitations
This is an experimental prototype, **not a safety system**. Scene change is not parcel recognition. OWL-ViT missed the visible parcel in our Ring test; Grounding DINO loaded but timed out on its first synthetic inference. Both remain experimental. Read the [evaluation evidence](docs/sandbox-evaluation.md).

No remote caregiver notifications or background monitoring after closing the page are implemented. Activity and captured clips are memory-only; zone coordinates use local storage. Only explicitly account-synced review metadata persists in Supabase, with a 200-review cap and manual deletion rather than automatic expiry. Model weights/runtime files are downloaded when enabled; frames are not sent to a recognition service.

Local commands bind to **127.0.0.1**. The [Railway deployment](docs/hosting.md) supports either a private owner preview or explicit public-demo mode. The latter exposes only token-free demonstrations and account endpoints; Ring routes still require verified account access and never fall back to the server owner's token. Inherited webhooks remain disabled in hosted mode. Durable consumer Ring OAuth and distributed abuse controls are not implemented; the inherited refresh-token workflow is not verified end-to-end.

An optional [email-account foundation](docs/account-security.md) adds sign-up, verification, sign-in/out, recovery and account deletion through Supabase. It is disabled until the owner configures a project. `/account` clearly reports setup status; it does not simulate successful authentication. This version is not an App Store/Play Store release or a security-certified product.

GitHub Pages does not run the Next.js server or its Ring API routes. A successful Pages/Jekyll build is not a deployment of this application.

## Verify
```sh
pnpm test
pnpm typecheck
pnpm build
pnpm start
```

Deterministic tests cover geometry, persistence, stale observations, evaluation reports, demo behavior, basic interface structure, selected text-color contrast pairs and hosted-preview access controls. These tests do not establish real-world model accuracy or replace accessibility user testing.

Use `pnpm-lock.yaml` as the canonical lockfile; the npm lockfile in the original checkout is inherited from the starter.

## Documentation
- [Product walkthrough](docs/walkthrough.md)
- [Architecture and security boundaries](docs/architecture.md)
- [Architecture decisions and tradeoffs](docs/architecture-decisions.md)
- [Delivery review setup, privacy and failure policy](docs/delivery-reviews.md)
- [Detailed instructions](docs/cleardrop.md)
- [Current verification record](docs/verification-2026-10-03.md)
- [Already-present-parcel setup checks](docs/verification-2026-10-02.md)
- [Earlier integration and deployment checks](docs/verification-2026-10-01.md)
- [Engineering case study](docs/engineering-case-study.md)
- [Free Render hosting](docs/render-hosting.md)
- [Account setup and security release boundaries](docs/account-security.md)
- [Developer friction log](docs/friction-log.md)

The illustrated demo is separate from actual Ring playback.

## Attribution
Built on [AmazonAppDev/ring-api-helloworld](https://github.com/AmazonAppDev/ring-api-helloworld). Original Amazon copyright and [MIT license](LICENSE) retained. ClearDrop adds the doorway workflow, decision policies, replay evaluation, stream-health improvements and demo UI. See [third-party notices](docs/third-party-notices.md) for model and footage attribution.
