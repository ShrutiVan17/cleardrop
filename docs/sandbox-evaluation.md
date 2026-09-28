# Ring package sandbox evaluation — September 27, 2026

Source: locally recorded first approximately 11.5 seconds of the Ring Playground Package scenario. Not representative real-world validation. The opening frame visibly contains a brown parcel on a snowy doormat. Later frames may change state, so the run was intentionally unlabeled rather than given an incorrect whole-clip accuracy score.

Configuration: OWL-ViT base patch32, q8, WASM, 640-wide input, 2-second sampling, existing score/geometry filters unchanged.

Six samples (0, 2, 4, 6, 8, 10 seconds) completed with no inference errors. Accepted parcel detections: zero at every sample. Inference milliseconds: 5742, 4758, 5098, 4561, 4484, 4515. This is evidence of a recognition failure on at least the visible opening parcel, not evidence of a working package detector.

Raw opening prediction: padded mailing envelope, score approximately 0.1198, with a box spanning nearly the entire frame. The geometry and score filters correctly rejected it. Lowering thresholds would not fix the incorrect location. Next diagnostic: compare the full-precision model on the exact same recorded frames, without changing prompts or decision thresholds. This is a development comparison, not held-out validation.

Source attribution: “Thief stealing our package” by frollard, CC BY 4.0, clipped by the Ring sandbox. Original: https://www.youtube.com/watch?v=TfTFu8lGrwk ; license: https://creativecommons.org/licenses/by/4.0/ . No footage is included in this repository.

## Full-precision comparison

The exact same six recorded timestamps were evaluated with fp32, unchanged prompts, image size and score/geometry thresholds. All six samples completed without inference errors; all six again had zero accepted parcel candidates. The opening raw output was an empty list at the model's 0.1 output threshold. Inference milliseconds: 7245, 7186, 7301, 6877, 7304, 7231 (p95 7304 ms).

Conclusion: changing precision alone did not solve this failure. This does not prove the model can never recognize packages, nor establish recall over this changing clip; it does show that the currently configured detector cannot be called reliable. Do not lower the geometry filter to accept a whole-scene box or present these runs as successful package recognition. Keep fp32 as an explicit diagnostic option rather than increasing the default download fourfold.

Next development gate: compare a parcel-focused or stronger open-vocabulary detector on recorded positive and negative scenes, with fixed ground truth and model revision. The current Ring-to-replay path removes the need to manually supply footage for initial sandbox diagnosis. Representative permissioned footage is still needed before broader accuracy claims.

## September 28 release smoke check

Grounding DINO Tiny q8 (pinned revision in `lib/detector-models.ts`) loaded in the browser replay worker. On the generated synthetic diagnostic clip, its first frame exceeded the 60-second inference timeout. The run remained incomplete with a failed sample, not a true negative. This is not a real-parcel evaluation and establishes no recognition accuracy. Grounding DINO remains an experimental replay-only option. The live model default was not changed.
