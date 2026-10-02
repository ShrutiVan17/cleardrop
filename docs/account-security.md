# Account authentication foundation

This is an implemented, disabled-by-default foundation, not a security certification or store-ready release. Account signup/login/email verification/recovery/deletion have not been tested against a live Supabase project yet.

## Free-tier setup

1. Create your own free Supabase project at https://supabase.com/dashboard. You must accept its account/project terms yourself. Do not upgrade the plan.
2. Copy the project URL and publishable key into private environment variables `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. Set `CLEARDROP_SITE_URL` to the exact HTTPS deployment origin. Never commit credentials.
3. Enable Confirm email, minimum password length 12, appropriate rate limits and secure password change/reauthentication. Configure a production email sender: the default test email service is not suitable for arbitrary public users.
4. Allow the exact `/auth/confirm` URL in Auth redirect settings. Confirmation and recovery use the provider's PKCE code exchange or verified email token hash. Use email templates that redirect to this handler. No user-supplied redirect destination is accepted.
5. Add a server-only Supabase secret/service-role key as `SUPABASE_SECRET_KEY` for account deletion. Never prefix it with `NEXT_PUBLIC`. It is used only after validating the user and rechecking their current password.
6. Configure provider abuse protection before opening public signup. CAPTCHA is not wired into this UI yet; do not enable public signup and call it abuse-resistant. Provider limits currently see the backend's outbound IP. Distributed application throttling is still required for public traffic.
7. Set `CLEARDROP_ACCOUNT_AUTH=1` for controlled account testing after the project settings are ready. Missing or unreachable account configuration fails closed. On the hosted deployment, owner Basic auth remains an outer gate for account signup and camera routes; verified user accounts are an additional boundary, not a public-signup launch. Public release requires separately reviewed abuse controls and email delivery.

## Implemented boundaries

- Password processing uses official Supabase SDKs on the server. ClearDrop does not store plaintext passwords or build its own password database.
- Auth cookies are HttpOnly, same-site and Secure on HTTPS; refresh cookies are forwarded by Next.js middleware. Routes validate users independently using the provider's `getUser`, not unverified cookie contents.
- State-changing account calls reject cross-site requests. Passwords are bounded at 12–128 characters. Auth responses are private/no-store; errors do not echo provider messages or account existence on recovery.
- Ring sessions can be bound to a verified account ID. Other accounts cannot use that token. Account mode never falls back to the server owner's Ring environment credentials. Sign-in/out clears the browser's Ring connection.
- Account deletion requires current-password reauthentication and removes the Supabase identity. The app stores no cloud doorway/video data in this version. Browser zone settings on other devices and provider operational logs are separate retention concerns.
- Camera permissions are limited to this origin; microphone/geolocation are disabled. Frame embedding is blocked. CSP permits inline code/styles needed by the current Next.js build; nonce-based CSP and further hardening remain follow-up work.

## Required before store release

Live signup/verification/login/recovery/logout/deletion tests; independent security review; abuse controls and MFA design; operator privacy/support details and retention policy; HTTPS operations/backups/incident handling; approved consumer Ring OAuth; encrypted durable per-user Ring credential storage; native Android/iOS packaging, permission disclosures and signed builds; actual store review and developer accounts.

The current website is not a submitted native app. A passing generated-video check does not prove physical Ring integration or recognition reliability.

Sources: https://supabase.com/docs/guides/auth/server-side/creating-a-client ; https://developer.apple.com/support/offering-account-deletion-in-your-app ; https://support.google.com/googleplay/android-developer/answer/13327111
