# Verification — October 2, 2026

## Already-present parcel setup

The supplied Ring recording showed a parcel already in view when its frame was marked as an empty reference. This establishes streaming, not successful recognition of that parcel. Ring tokens authorize the video connection; they do not provide parcel detection.

Added a manual **A parcel is already here** setup path shared by Ring, phone and controlled video. It creates an explicitly viewer-reported unresolved concern without calibrating occupied pixels. The report survives monitor pause/video loss and cannot be dismissed by unchanged or empty-looking samples. Saving a reference requires an explicit human empty-area check; resolving a reported parcel additionally requires an explicit removal check. The UI labels this as a visual report, not an AI detection.

98 deterministic tests, TypeScript checking and the production build passed, including five new monitoring regressions and one interface regression. In the local browser, initial calibration and manual-report clearing were disabled until their respective visual-check checkbox was selected. The manual report showed a clearly labelled viewer-reported concern with zero frame samples, not an AI detection. Explicit removal confirmation restored monitoring, and all three measured generated-video cases subsequently passed with 79 sampled frames at completion. Anonymous local access checks also passed. Hosted deployment is checked separately.

This does not fix the documented experimental recognition misses, make an automatically verified empty-reference claim, or prove reliable semantic detection of an already-visible parcel. A user can still incorrectly attest that an occupied area is empty; no reliable model-based occupancy gate has been validated.
