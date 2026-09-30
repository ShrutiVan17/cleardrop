# Private hosted preview

ClearDrop can run on Railway from the included Dockerfile. This is a single-owner preview, not a multi-user camera service.

## Configuration

Set these service variables privately in Railway:

- `CLEARDROP_HOSTED=1`
- `CLEARDROP_PREVIEW_PASSWORD`: a randomly generated password of at least 24 characters.
- `RING_ACCESS_TOKEN`: your current Ring Playground token.
- `PORT=3000`

Use the generated HTTPS domain. Sign in with username `cleardrop` and the preview password. Anyone given this password can access the configured camera; share it only with trusted reviewers. Rotate it after sharing.

Only `/api/health` is unauthenticated. All pages and Ring routes require the preview password, and Ring routes independently enforce access checks. Inherited webhook routes are disabled in hosted mode. Missing or short passwords fail closed. No Ring token is copied into the image or sent to the browser.

The local `pnpm dev` and `pnpm start` commands remain loopback-only. `pnpm start:hosted` binds externally with the preview gate enabled. Railway runs the standalone server from the Docker image with the same gate.

## Free allowance and limits

Do not upgrade to a paid plan to run this preview. Railway's trial and subsequent free monthly allowance are limited and shared with other projects. Enable application sleeping to conserve credits. A sleeping app may take time to wake. Free hosting does not guarantee continuous availability.

Playground tokens expire, usually after about 30 minutes. To restore live video, replace `RING_ACCESS_TOKEN` in the service variables and redeploy. Hosting cannot extend the token lifetime. The illustrated demo does not require a Ring token, but still requires preview sign-in.

Recognition remains experimental. Hosting does not improve model accuracy. Camera frames and recordings stay in the browser; monitoring stops when the page closes. No background alert service is included.

Before offering public multi-user access, implement account-scoped Ring authorization, secure session management, rate limiting and a verified token lifecycle. Do not remove the preview gate while an owner's Ring credentials are configured.
