import { env, pipeline, RawImage, ZeroShotObjectDetectionPipeline } from '@huggingface/transformers'
import { Detection, PACKAGE_LABELS, validDetectionBatch } from '@/lib/package-detection'
import { DETECTOR_MODELS, DetectorModel, normalizeGroundedLabel } from '@/lib/detector-models'
import { InferenceBackend, loadInferenceRuntime, validInferenceFrame } from '@/lib/inference-runtime'
env.allowLocalModels = false
env.backends.onnx.wasm!.numThreads = 1
// Keep executable JS/WASM on our own origin; do not weaken CSP for a runtime CDN.
env.backends.onnx.wasm!.wasmPaths = new URL('/inference-runtime/', self.location.href).href
let detector: ZeroShotObjectDetectionPipeline | null = null
let busy = false
let modelKey: DetectorModel = 'owlvit'
let backend: InferenceBackend = 'wasm'
let dtype: 'q8' | 'fp32' = 'q8'
// Narrow the library's all-task union to avoid TS 5.3 union expansion limits.
const createDetector = pipeline as unknown as (task: 'zero-shot-object-detection', model: string, options: {
  dtype: 'q8' | 'fp32'; device: InferenceBackend; revision:string; progress_callback: (p: {status:string; file?:string; progress?:number}) => void
}) => Promise<ZeroShotObjectDetectionPipeline>
const create = (device: InferenceBackend) => createDetector('zero-shot-object-detection', DETECTOR_MODELS[modelKey].id, {
  revision: DETECTOR_MODELS[modelKey].revision, dtype, device,
  progress_callback: p => { if (p.status === 'progress') self.postMessage({ type:'progress', text:`Downloading ${p.file}: ${Math.round(p.progress || 0)}%` }) },
})
self.onmessage = async ({data}) => {
  if (busy) return
  if (!data || !['load','detect'].includes(data.type)) return
  busy = true
  try {
    if (data.type === 'detect' && !validInferenceFrame(data.width, data.height, data.pixels)) throw new Error('Invalid or oversized inference frame')
    if (!detector) {
      modelKey=data.modelKey==='grounding'?'grounding':'owlvit'
      dtype=data.dtype==='fp32'?'fp32':'q8'
      const loaded = await loadInferenceRuntime(create, data.runtime==='auto'?'auto':'wasm', 'gpu' in navigator)
      detector=loaded.detector; backend=loaded.backend
      self.postMessage({type:'runtime', backend, fallback:loaded.fallback})
    }
    if (data.type === 'load') self.postMessage({type:'ready',backend,modelKey,dtype})
    else if (data.type === 'detect') {
      const image = new RawImage(new Uint8ClampedArray(data.pixels), data.width, data.height, 4)
      const queries=[...PACKAGE_LABELS, 'a person', 'a plant pot', 'a doormat']
      const prompts=modelKey==='grounding'?[queries.join('. ')+'.']:queries
      // One RawImage produces a flat result; the library type also permits image batches.
      const options={threshold:DETECTOR_MODELS[modelKey].threshold, percentage:true, top_k:15}
      let raw: Detection[]
      try { raw = await detector(image, prompts, options) as Detection[] }
      catch (error) {
        if (backend!=='webgpu') throw error
        self.postMessage({type:'progress',text:'GPU inference failed. Retrying on CPU; the existing review stays unresolved.'})
        try { await detector.dispose() } catch { /* A lost GPU may also reject disposal. */ }
        detector=null; backend='wasm'; detector=await create('wasm')
        self.postMessage({type:'runtime',backend,fallback:true})
        raw=await detector(image,prompts,options) as Detection[]
      }
      if (!validDetectionBatch(raw)) throw new Error('Model returned malformed predictions')
      const results = modelKey==='grounding' ? raw.map(d=>({...d,rawLabel:d.label,label:normalizeGroundedLabel(d.label)})) : raw
      self.postMessage({type:'result', results, backend, modelKey, dtype, id:data.id, capturedAt:data.capturedAt, mediaTime:data.mediaTime})
    }
  } catch(e) {
    self.postMessage({type:'error', message:e instanceof Error ? e.message : 'Package model failed'})
  } finally { busy = false }
}
