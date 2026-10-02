# Hosting: public demo or private preview

ClearDrop can run on Railway from the included Dockerfile. It supports an explicitly public demonstration with private account-scoped camera access, or a password-protected owner preview. Neither is a durable consumer camera service.

## Public demonstration

Set `CLEARDROP_PUBLIC_DEMO=1` and `CLEARDROP_ACCOUNT_AUTH=1`, alongside the configured private Supabase variables documented in `account-security.md`. The landing page `/`, illustrated `/demo`, generated-video `/test`, local camera `/phone`, privacy page and account endpoints need no shared username, password or Ring token. The phone-camera page requires the visitor's own camera permission and sends no frames to Ring.

`/doorway` and all Ring APIs require a provider-verified account. Routes independently enforce account access, bind temporary Ring tokens to the account and never fall back to the server owner's token. Missing account setup fails closed for private routes. A visitor cannot obtain the owner's camera merely by opening the site.

Existing account login is available. Public registration remains disabled unless `CLEARDROP_PUBLIC_SIGNUP=1` is separately enabled after SMTP and abuse controls pass. Do not enable it with Supabase's default project-team-only email service. The included application attempt limiter is single-process, not distributed protection.

The public demo does not expire with a Playground token. It is clearly labelled generated/illustrated content, not live Ring video or model-accuracy evidence. Demonstrate actual Ring playback separately with an owner-authorized simulator/device connection. Consumer account linking requires approved Ring app credentials and a verified OAuth lifecycle; a Playground token is not a permanent consumer connection.

## Private owner preview configuration (default)

Set these service variables privately in Railway:

- `CLEARDROP_HOSTED=1`
- `CLEARDROP_PREVIEW_PASSWORD`: a randomly generated password of at least 24 characters.
- `CLEARDROP_PREVIEW_USERNAME`: optional login name (defaults to `cleardrop`).
- `CLEARDROP_ALLOW_SHORT_PASSWORD=1`: optional owner override allowing passwords of at least 8 characters. Short, predictable passwords are unsafe for camera access; a strong random password is recommended.
- `RING_ACCESS_TOKEN`: your current Ring Playground token.
- `PORT=3000`

Use the generated HTTPS domain. Sign in with the configured username (default `cleardrop`) and preview password. Anyone given this password can access the configured camera; share it only with trusted reviewers. Rotate it after sharing.

Without `CLEARDROP_PUBLIC_DEMO=1`, only `/api/health`, the install manifest and app icon bypass the owner gate. Pages and Ring routes require the preview password, and Ring routes independently enforce access checks. Inherited webhook routes are disabled in hosted mode. Missing or short passwords fail closed. No Ring token is copied into the image or sent to the browser.

The local `pnpm dev` and `pnpm start` commands remain loopback-only. `pnpm start:hosted` binds externally with the preview gate enabled. Railway runs the standalone server from the Docker image with the same gate.

## Free allowance and limits

Do not upgrade to a paid plan to run this preview. Railway's trial and subsequent free monthly allowance are limited and shared with other projects. Enable application sleeping to conserve credits. A sleeping app may take time to wake. Free hosting does not guarantee continuous availability.

Playground tokens expire, usually after about 30 minutes. Use **Connect Ring preview** on the doorway page to validate a fresh token and reconnect without redeploying. Tokens submitted there live in server memory, keyed by an opaque HttpOnly, SameSite cookie; sessions are isolated between browsers and expire no later than the token (maximum four hours). Expired entries are pruned on the next session access. Keep one replica. Server restarts or sleeping-container replacement can end these temporary sessions. Disconnecting leaves a signed-out marker so that browser does not silently fall back to the server owner's token. The environment-variable workflow remains available for the single-owner fallback connection. Hosting cannot extend token lifetime.

In private-preview mode the illustrated scenarios also require preview sign-in. Physical Ring linking and sustained hardware playback remain to be verified with approved credentials and hardware.

Recognition remains experimental. Hosting does not improve model accuracy. Camera frames and recordings stay in the browser; monitoring stops when the page closes. No background alert service is included.

Do not simply remove the owner gate and expose shared credentials. Public-demo mode uses account verification on Ring routes and no owner fallback. Durable encrypted per-user credential storage, approved consumer OAuth, distributed limits and tested email delivery are still required for a production multi-user release.
