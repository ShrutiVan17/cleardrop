// Pipeline mocks exercise orchestration and failure semantics, never model accuracy.
const {test}=require('node:test'),assert=require('node:assert/strict')
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ts=require('typescript')
const root=path.resolve(__dirname,'..')
function worker(factory,gpu=true){
 const messages=[],self={postMessage:value=>messages.push(value),location:{href:'https://example.test/_next/worker.js'}},calls=[]
 function load(file){
  const c={exports:{},self,navigator:gpu?{gpu:{}}:{},ArrayBuffer,Uint8ClampedArray,Error,URL,
   require(name){
    if(name==='@huggingface/transformers')return {env:{backends:{onnx:{wasm:{}}}},RawImage:class{},pipeline:async(_,model,options)=>{calls.push({model,...options});return factory(options.device)}}
    return load(path.join(root,name.replace('@/', '')+'.ts'))
   }}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,c)
  return c.exports
 }
 load(path.join(root,'app/workers/package.worker.ts'))
 return {messages,calls,send:data=>self.onmessage({data})}
}
const parcel={label:'cardboard box.',score:.6,box:{xmin:.2,ymin:.2,xmax:.4,ymax:.4}}
const frame=()=>({type:'detect',pixels:new ArrayBuffer(4),width:1,height:1,id:7,capturedAt:123,mediaTime:4})
function detector(run){const d=run||(async()=>[parcel]);d.dispose=async()=>{};return d}
test('worker preserves model/runtime/frame provenance and normalizes grounded labels',async()=>{
 const w=worker(()=>detector());await w.send({type:'load',modelKey:'grounding',runtime:'auto'});await w.send(frame())
 const result=w.messages.find(m=>m.type==='result')
 assert.equal(result.results[0].label,'a cardboard box');assert.equal(result.modelKey,'grounding');assert.equal(result.backend,'webgpu')
 assert.equal(result.id,7);assert.equal(result.capturedAt,123);assert.equal(result.mediaTime,4);assert.equal(w.calls.length,1)
})
test('GPU inference failure retries the same frame on CPU and reports fallback',async()=>{
 const w=worker(backend=>detector(backend==='webgpu'?async()=>{throw Error('GPU lost')}:undefined))
 await w.send({type:'load',modelKey:'grounding',runtime:'auto'});await w.send(frame())
 assert.deepEqual(w.calls.map(c=>c.device),['webgpu','wasm'])
 assert.equal(w.messages.find(m=>m.type==='result').backend,'wasm')
 assert.ok(w.messages.some(m=>m.type==='runtime'&&m.fallback))
})
test('malformed model result fails instead of pretending no parcel is present',async()=>{
 const w=worker(()=>detector(async()=>[{...parcel,box:null}]))
 await w.send({type:'load'});await w.send(frame())
 assert.ok(w.messages.some(m=>m.type==='error'));assert.equal(w.messages.some(m=>m.type==='result'),false)
})
test('invalid frames fail before model download',async()=>{
 const w=worker(()=>detector());await w.send({...frame(),width:641})
 assert.equal(w.calls.length,0);assert.ok(w.messages.some(m=>m.type==='error'))
})
test('a CPU inference exception is an error, never a successful negative',async()=>{
 const w=worker(()=>detector(async()=>{throw Error('CPU failed')}),false)
 await w.send({type:'load'});await w.send(frame())
 assert.equal(w.calls.length,1);assert.equal(w.messages.some(m=>m.type==='result'),false)
 assert.ok(w.messages.some(m=>m.type==='error'&&m.message==='CPU failed'))
})
