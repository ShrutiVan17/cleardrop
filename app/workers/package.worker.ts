import { env, pipeline, RawImage, ZeroShotObjectDetectionPipeline } from '@huggingface/transformers'
import { Detection, PACKAGE_LABELS } from '@/lib/package-detection'
import { DETECTOR_MODELS, DetectorModel, normalizeGroundedLabel } from '@/lib/detector-models'
env.allowLocalModels = false
env.backends.onnx.wasm!.numThreads = 1
let detector: ZeroShotObjectDetectionPipeline | null = null
let busy = false
let modelKey: DetectorModel = 'owlvit'
// Narrow the library's all-task union to avoid TS 5.3 union expansion limits.
const createDetector = pipeline as unknown as (task: 'zero-shot-object-detection', model: string, options: {
  dtype: 'q8' | 'fp32'; device: 'wasm'; revision:string; progress_callback: (p: {status:string; file?:string; progress?:number}) => void
}) => Promise<ZeroShotObjectDetectionPipeline>
self.onmessage = async ({data}) => {
  if (busy) return
  busy = true
  try {
    if (!detector) {
      modelKey=data.modelKey==='grounding'?'grounding':'owlvit'
      const model=DETECTOR_MODELS[modelKey]
      detector = await createDetector('zero-shot-object-detection', model.id, {
        revision:model.revision,
        dtype: data.dtype === 'fp32' ? 'fp32' : 'q8', device: 'wasm',
        progress_callback: (p) => { if (p.status === 'progress') self.postMessage({type:'progress', text:`Downloading ${p.file}: ${Math.round(p.progress || 0)}%`}) },
      })
    }
    if (data.type === 'load') self.postMessage({type:'ready'})
    else if (data.type === 'detect') {
      const image = new RawImage(new Uint8ClampedArray(data.pixels), data.width, data.height, 4)
      const queries=[...PACKAGE_LABELS, 'a person', 'a plant pot', 'a doormat']
      const prompts=modelKey==='grounding'?[queries.join('. ')+'.']:queries
      // One RawImage produces a flat result; the library type also permits image batches.
      const raw = await detector(image, prompts, {threshold:DETECTOR_MODELS[modelKey].threshold, percentage:true, top_k:15}) as Detection[]
      const results = modelKey==='grounding' ? raw.map(d=>({...d,rawLabel:d.label,label:normalizeGroundedLabel(d.label)})) : raw
      self.postMessage({type:'result', results, id:data.id, capturedAt:data.capturedAt})
    }
  } catch(e) {
    self.postMessage({type:'error', message:e instanceof Error ? e.message : 'Package model failed'})
  } finally { busy = false }
}
