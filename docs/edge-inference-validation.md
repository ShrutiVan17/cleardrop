# Edge inference release checks

## Implemented

- Optional live Grounding DINO Tiny or OWL-ViT recognition with single-flight inference.
- GPU negotiation and CPU fallback; actual backend and model configuration in live observations.
- Bounded portrait/landscape frame capture and strict prediction validation.
- A prior AI suggestion survives model misses, failure, hidden pages and shutdown. Only checked-empty calibration on a fresh visible view confirms it.
- Viewer-confirmed AI suggestions enter the existing human-report review flow. No automatic AI cause is fabricated and no database migration is required.

## Before claiming reliable recognition

Use short recordings you own or have permission to use. Set the expected category before running ReplayLab. Keep generated fixtures separate from real-camera evidence.

| Recording | Expected evaluation | Evidence to keep |
| --- | --- | --- |
| Empty doorway, changing light and passing person | No parcel candidate; false positives counted | Raw predictions and failures, not just successful frames |
| Box initially present in the marked area | Repeated parcel overlap without needing an empty reference | Model/runtime, frame times, latency and JSON observations |
| Box beside the marked area | Parcel may be recognized, but no overlap concern | Boxes, marked area and sampled results |
| Box arrives, remains, then is removed | Repeated overlap, human review, explicit fresh empty check | Both inference observations and human-review history |
| Camera freezes or loses connection during concern | Unknown view; concern remains unresolved | Pause status and open review |

Do not call generated-test success "Ring recognition accuracy." The current Ring Package simulator is a theft recording with a box initially present, not an empty-to-delivery sequence. Test its actual content, and use permissioned delivery footage for arrival evaluation. A phone test does not prove physical Ring device pairing.

No representative benchmark, false-positive rate, recall guarantee, injury-prevention certification, unattended/background monitoring or consumer Ring OAuth release is claimed. WebGPU may be unavailable or unsupported by a model/operator. Models remain optional and experimental until these recordings have been evaluated on the target browsers.
