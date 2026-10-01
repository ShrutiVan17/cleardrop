const {test}=require('node:test'),assert=require('node:assert/strict')
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ts=require('typescript')
const context={exports:{}}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/inference-evidence.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,context)
const valid=context.exports.validInferenceSample
const sample={capturedAt:1000,now:6000,mediaTime:1,currentMediaTime:6,lastVideoAdvanceAt:6000,generation:2,currentGeneration:2,active:true,editing:false}
test('accepts a model result only while source video advances',()=>{assert.equal(valid(sample),true);assert.equal(valid({...sample,currentMediaTime:1}),false)})
test('short-latency results do not require another decoded frame',()=>assert.equal(valid({...sample,now:1100,lastVideoAdvanceAt:1000,currentMediaTime:1}),true))
test('a video freezing after one new frame cannot validate a delayed result',()=>assert.equal(valid({...sample,currentMediaTime:1.5,lastVideoAdvanceAt:1500}),false))
test('expired results and results from another stream generation are rejected',()=>{assert.equal(valid({...sample,now:16001}),false);assert.equal(valid({...sample,currentGeneration:3}),false)})
test('paused, edited, rewound or invalid input cannot become live evidence',()=>{for(const patch of [{active:false},{editing:true},{currentMediaTime:0},{capturedAt:NaN},{now:0}])assert.equal(valid({...sample,...patch}),false)})
