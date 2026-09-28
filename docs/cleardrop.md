# ClearDrop prototype

## Using doorway watch

1. Start the Ring live stream.
2. Click **Edit doorway zone**. Drag a rectangle on the video or use the four percentage inputs. Click **Save zone**. The zone is saved per device in this browser.
3. While the marked area is empty, click **Doorway is empty — calibrate**.
4. Watch for a possible-obstruction alert. Use **Confirm package** only after visually verifying a package. **Dismiss & pause** requires a new empty reference; it does not silently treat an obstruction as safe.

The reference resets when video stops or the zone changes. Live sandbox samples are short, so calibration must be done promptly after starting each sample. Activity is in-memory only (last 20 events); it clears on page reload. Frames and references are never uploaded or persisted.

## What the detector does and does not do

This version implements background comparison, **not semantic package recognition**. It samples at 4 fps, downscales to 240 pixels wide, compensates for uniform exposure shifts, and measures pixel changes within a normalized rectangle. A changed-area fraction of at least 12% persisting for three seconds raises an alert; below 6% for two seconds clears it. The percentage shown is changed area, not model confidence.

People, shadows, moving cameras, and nonuniform lighting can trigger alerts. Objects already present in the reference are not detected. Changes between sparsely sampled frames may be missed. Use a fixed camera and verify the reference is empty. This is a prototype, not a safety or accessibility guarantee.

## Experimental automatic parcel recognition

Click **Load package model** before starting the short live sample. OWL-ViT (`Xenova/owlvit-base-patch32`, q8, Transformers.js 3.8.1) downloads approximately 155 MB of weights plus runtime/tokenizer files from Hugging Face/CDN. Browser caching is used when available. Inference runs locally in a Web Worker using single-thread WASM; camera frames are not sent to these services. Use **Cancel model loading** or **Disable package AI** to stop the worker.

The model queries cardboard boxes, padded mailing envelopes and plastic delivery parcels, alongside person/plant/doormat distractors. Package results below score 0.15 are rejected; overlapping duplicates are suppressed. Scores are not calibrated probabilities. Orange boxes overlap the doorway by at least 25% of the detected box area; purple boxes do not. An alert requires spatially matching detections spanning at least three seconds. Empty scans reset this evidence; results older than 15 seconds are discarded. Scans are serialized and speed depends on your machine. No empty-scene calibration is required for AI mode.

This is a general-purpose text-conditioned model, **not a validated parcel-specific classifier**. It can mistake other cardboard boxes for deliveries and miss small, occluded, or unusual packages. A 2D overlap does not prove a physical obstruction. The manual confirmation button remains a human decision. Evaluate on labeled camera footage (safe delivery, blocking delivery, people, shadows, removal) before claiming accuracy. No paid inference API is configured.

## Verification

Run `node scripts/test-obstruction.cjs` for deterministic detector tests and `node node_modules/typescript/bin/tsc --noEmit` for type checking. Detector tests cover identical frames, exposure shifts, inside/outside-zone objects, invalid dimensions, persistence, and clearing. Synthetic tests do not establish real-world detection accuracy.

Run `node scripts/test-package-detection.cjs` for parcel filtering, duplicate suppression, overlap, persistence, disappearance, stale tracking and invalid-box tests. These test decision logic, not model accuracy. Model documentation: https://huggingface.co/Xenova/owlvit-base-patch32

## Test a clip

Choose **Test a clip** at the top of the app. It is available even when Ring credentials are expired. This mode does not call Ring for video and is clearly labeled as local replay.

1. Choose an MP4/WebM or other browser-supported video you own or have permission to use (maximum 120 seconds and 250 MB). The file is opened using a local blob URL, not uploaded.
2. Set the doorway test rectangle with the percentage inputs. Preview the clip to check it.
3. Select a ground-truth label **before** running: no parcel, parcel outside the zone, parcel overlapping the zone, or unlabeled. Use a clip whose expected state is constant throughout; trim changing scenes into separate clips. Labels refer to visibility/2D overlap, not proof of physical obstruction.
4. Load the evaluation model and run. The video is paused and sequentially sampled every two seconds. This measures the model on planned frames, not real-time throughput. Inference latency is measured separately.
5. Export the JSON report. It contains clip name/size, run time, source label, zone, configuration, detections, sample errors and metrics. No images, video data, Ring token or local file path are included. Filenames may be personal; review before sharing.

The report separately scores parcel presence and doorway overlap. TP/FP/TN/FN are **sampled-frame** counts, not event counts. Undefined precision/recall is N/A, not 100%. Failed or unprocessed samples are not counted as true negatives. Interrupted runs remain incomplete. Unlabeled clips and the built-in synthetic pipeline check have no accuracy metrics.

The synthetic pipeline check creates a four-second text-only clip in the browser. Use it to verify decoding, model execution and report output. It is deliberately marked synthetic and cannot validate package recognition. The model revision is currently `main` (unpinned), explicitly recorded in reports; pin an evaluated revision before a reproducible release.

Run `node scripts/test-replay-evaluation.cjs` for report tests, and `node scripts/test-doorway-state.cjs` for lifecycle tests. All four suites together currently contain 27 tests.

### Footage needed next

Start with three fixed-camera, permissioned clips (10–20 seconds each): a box overlapping the chosen doorway zone, the same box outside it, and an empty doorway. Keep each clip's state constant. Avoid including faces, private addresses or bystanders where unnecessary. Later add people, shadows, unusual parcels and placement/removal sequences to broaden evaluation. Record failures honestly; don't tune thresholds on the held-out test set.

### Recording a Ring sandbox test without uploading a file

Select **Package** in Ring's playground first (the selected sandbox scenario affects the video). In ClearDrop's **Watch Ring** tab, click **Record next Ring session for replay**, then **Start Live Stream**. Up to 12 seconds of the received video track are recorded in browser memory, without microphone audio. Click **Evaluate recorded Ring clip** to reuse it in the replay lab. The recording survives tab-mode switches but not a full page reload; use **Discard recording from memory** to release the parent copy. Navigating away/unmounting the recorder stops recording.

The report identifies the source as a Ring recording and marks its duration as estimated. A half-second margin is excluded from sampling because MediaRecorder WebM may lack finite duration metadata. Keep a recording of changing scenes **unlabeled** unless you establish appropriate ground truth for each sampled frame; the current scorer only supports constant whole-clip labels.

The replay lab also offers an fp32 model comparison (approximately 612 MB, more RAM). Changing precision clears the previous in-memory report, so export before switching if needed. Full precision did not fix the initial sandbox parcel miss; see `sandbox-evaluation.md`. Per-frame results include raw model outputs and a preview button for reviewing the exact sampled frame. These diagnostic controls make failures inspectable rather than hiding them.

For the playground's package sample, the displayed attribution is: “Thief stealing our package” by frollard, CC BY 4.0, clipped by the sandbox. Original: https://www.youtube.com/watch?v=TfTFu8lGrwk ; license: https://creativecommons.org/licenses/by/4.0/ . Preserve attribution if sharing that footage. Do not apply this attribution to other Ring scenarios or real device recordings.
