const {test}=require('node:test'),assert=require('node:assert/strict')
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ts=require('typescript')
const c={exports:{},ArrayBuffer}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/inference-runtime.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,c)
const {loadInferenceRuntime:load,inferenceFrameSize:size,validInferenceFrame:valid,canConfirmInferenceConcern:confirm}=c.exports
test('only a checked, fresh, visible, unedited camera can confirm a prior AI concern',()=>{
 const value={checkedEmpty:true,freshVideo:true,active:true,editing:false,hidden:false}
 assert.equal(confirm(value),true)
 for(const patch of [{checkedEmpty:false},{freshVideo:false},{active:false},{editing:true},{hidden:true}])assert.equal(confirm({...value,...patch}),false)
})
test('auto chooses available GPU and reports actual runtime',async()=>{
 const calls=[];const result=await load(async backend=>{calls.push(backend);return backend},'auto',true)
 assert.equal(result.backend,'webgpu');assert.equal(result.fallback,false);assert.deepEqual(calls,['webgpu'])
})
test('GPU load failure falls back once to CPU',async()=>{
 const calls=[];const result=await load(async backend=>{calls.push(backend);if(backend==='webgpu')throw Error('unsupported operator');return {}},'auto',true)
 assert.equal(result.backend,'wasm');assert.equal(result.fallback,true);assert.deepEqual(calls,['webgpu','wasm'])
})
test('compatibility mode and missing GPU do not attempt GPU',async()=>{
 for(const [preference,gpu] of [['wasm',true],['auto',false]]){
  const calls=[];await load(async backend=>{calls.push(backend);return {}},preference,gpu);assert.deepEqual(calls,['wasm'])
 }
})
test('failure of both backends is an error, not ready or an empty detection',async()=>{
 await assert.rejects(load(async()=>{throw Error('not available')},'auto',true),/not available/)
})
test('portrait and landscape inference frames bound both axes',()=>{
 assert.equal(JSON.stringify(size(1920,1080)),JSON.stringify({width:640,height:360}))
 assert.equal(JSON.stringify(size(1080,1920)),JSON.stringify({width:360,height:640}))
 assert.equal(JSON.stringify(size(320,240)),JSON.stringify({width:320,height:240}))
 for(const dimensions of [[0,1],[NaN,1],[1,Infinity],[2.5,4]])assert.throws(()=>size(...dimensions))
})
test('worker frame boundary rejects incomplete or oversized pixel buffers',()=>{
 assert.equal(valid(10,10,new ArrayBuffer(400)),true)
 for(const args of [[10,10,new ArrayBuffer(399)],[641,1,new ArrayBuffer(2564)],[1.5,2,new ArrayBuffer(12)],[1,1,{}]])assert.equal(valid(...args),false)
})
