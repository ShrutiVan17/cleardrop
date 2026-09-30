# Private hosted preview

ClearDrop can run on Railway from the included Dockerfile. This is a single-owner preview, not a multi-user camera service.

## Configuration

Set these service variables privately in Railway:

- `CLEARDROP_HOSTED=1`
- `CLEARDROP_PREVIEW_PASSWORD`: a randomly generated password of at least 24 characters.
- `CLEARDROP_PREVIEW_USERNAME`: optional login name (defaults to `cleardrop`).
- `CLEARDROP_ALLOW_SHORT_PASSWORD=1`: optional owner override allowing passwords of at least 8 characters. Short, predictable passwords are unsafe for camera access; a strong random password is recommended.
- `RING_ACCESS_TOKEN`: your current Ring Playground token.
- `PORT=3000`

Use the generated HTTPS domain. Sign in with the configured username (default `cleardrop`) and preview password. Anyone given this password can access the configured camera; share it only with trusted reviewers. Rotate it after sharing.

Only `/api/health`, the install manifest and app icon are unauthenticated. All pages and Ring routes require the preview password, and Ring routes independently enforce access checks. Inherited webhook routes are disabled in hosted mode. Missing or short passwords fail closed. No Ring token is copied into the image or sent to the browser.

The local `pnpm dev` and `pnpm start` commands remain loopback-only. `pnpm start:hosted` binds externally with the preview gate enabled. Railway runs the standalone server from the Docker image with the same gate.

## Free allowance and limits

Do not upgrade to a paid plan to run this preview. Railway's trial and subsequent free monthly allowance are limited and shared with other projects. Enable application sleeping to conserve credits. A sleeping app may take time to wake. Free hosting does not guarantee continuous availability.

Playground tokens expire, usually after about 30 minutes. Use **Connect Ring preview** on the doorway page to validate a fresh token and reconnect without redeploying. Tokens submitted there live in server memory, keyed by an opaque HttpOnly, SameSite cookie; sessions are isolated between browsers and expire no later than the token (maximum four hours). Expired entries are pruned on the next session access. Keep one replica. Server restarts or sleeping-container replacement can end these temporary sessions. Disconnecting leaves a signed-out marker so that browser does not silently fall back to the server owner's token. The environment-variable workflow remains available for the single-owner fallback connection. Hosting cannot extend token lifetime.

The three illustrated scenarios require no Ring token, but still require preview sign-in. They are simulated tests, not footage from a Ring camera or evidence of recognition accuracy. Physical Ring linking and sustained hardware playback remain to be verified with approved credentials and hardware.

Recognition remains experimental. Hosting does not improve model accuracy. Camera frames and recordings stay in the browser; monitoring stops when the page closes. No background alert service is included.

Before offering public multi-user access, implement account-scoped Ring authorization, secure session management, rate limiting and a verified token lifecycle. Do not remove the preview gate while an owner's Ring credentials are configured.
