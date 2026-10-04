# Delivery reviews

## Use

1. Start a phone or Ring camera and visually check the marked area before saving an empty reference. If a parcel is already present, explicitly report it instead of calibrating occupied pixels.
2. A persistent change or your report opens a review. Choose **I’ve reviewed this** to acknowledge it. This does not assert removal.
3. Choose **Check removal**, inspect the correct doorway, remove the obstruction, and save a fresh empty reference if needed.
4. Tick the visual check and **Confirm empty area — close review**. A disconnected, hidden, frozen or still-concerning view cannot close the review.

Camera tests use the same flow but are explicitly generated tests, not real deliveries. No desktop permission is requested for generated input. Desktop alerts are opt-in under More options and are supported only where the browser notification API permits them. They work while the page is open, not as a background monitoring service. An API notification attempt does not prove delivery or reading.

## Private account storage

Apply `supabase/migrations/20261003_delivery_reviews.sql` once to the configured project. It creates only the review table, policies, index and guard trigger. It does not change existing authentication configuration. Run `supabase/tests/delivery_reviews.sql` as postgres afterward: temporary auth/review fixtures and every mutation are wrapped in a rollback transaction. These SQL checks are separate from mocked API tests.

On the private Ring page, enable account sync in More options **before** a review starts. Initial records must be version 1. Prior local reviews are not silently imported. Account settings show the latest 20 saved records. Closed reviews can be permanently deleted after explicit confirmation; account deletion cascades all owned reviews. The database caps total history at 200 reviews per owner. No automatic expiration is implemented.

Only review UUID, source category, cause, phase, view status, version, client-reported times and notification-attempt outcome are sent. The database adds owner identity and server receipt time. No video, frames, tokens, device IDs or arbitrary nested payload is allowed. The Supabase session client uses the publishable key and verified identity, with owner filters and RLS. The review API never uses the service-role key.

## Failure and concurrency

Writes are ordered rather than coalesced because the server and trigger require consecutive versions. Duplicate identical writes are idempotent. Conflicting updates return 409 and require reload/review; no last-write-wins overwrite is attempted. Network/storage failure pauses the queue, leaves local review working and clearly says not saved. Retry is explicit. The 64-snapshot queue is bounded; overflow is terminal and asks for local history export/reload rather than hiding lost versions. Stopping sync aborts pending requests and drops queued writes, but a request already accepted by the server may remain saved.

Saved reviews have no camera identifier. They are never automatically linked to live video. Select the correct camera, explicitly resume an open review and re-establish a fresh view. Pixel history and reference frames are not restored from cloud metadata. Status and timestamps are user-reported and are not authenticated physical evidence.

## Unfinished production features

No background push service, caregiver contacts, email alerts, distributed rate limiting, automatic retention, trusted sensor signatures or reliable parcel-recognition claim. Human confirmations can be mistaken. A notification permission grant and synthetic test success do not establish real-world alert delivery or model accuracy.

References: [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security), [browser notification behavior](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API).
