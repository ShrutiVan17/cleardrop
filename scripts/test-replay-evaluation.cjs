const {test}=require('node:test'),assert=require('node:assert/strict')
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ts=require('typescript')
function load(name){const context={exports:{},require:(n)=>load(n.replace('./',''))};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,`../lib/${name}.ts`),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,context);return context.exports}
const {sampleTimes,summarizeReplay}=load('replay-evaluation')
const zone={x:.3,y:.3,w:.4,h:.4}
const parcel={label:'a cardboard box',score:.7,box:{xmin:.35,ymin:.35,xmax:.55,ymax:.55}}
const sample=(detections,error)=>({time:0,latencyMs:100,detections,error})
test('samples predictably without requesting the ended frame',()=>{assert.equal(JSON.stringify(sampleTimes(5)), '[0,2,4]');assert.equal(JSON.stringify(sampleTimes(4)),'[0,2]')})
test('rejects unbounded or invalid runs',()=>{for(const d of [NaN,Infinity,-1,0,121])assert.throws(()=>sampleTimes(d));assert.throws(()=>sampleTimes(10,0))})
test('unlabeled clips do not generate accuracy metrics',()=>{const r=summarizeReplay([sample([parcel])],'unlabeled',zone);assert.equal(r.parcel,null);assert.equal(r.overlap,null)})
test('positive and missed detections yield explicit TP/FN counts',()=>{const r=summarizeReplay([sample([parcel]),sample([])],'parcel-overlapping',zone);assert.equal(r.parcel.tp,1);assert.equal(r.parcel.fn,1);assert.equal(r.parcel.recall,.5)})
test('negative clip with a parcel produces a false positive',()=>{const r=summarizeReplay([sample([parcel])],'no-parcel',zone);assert.equal(r.parcel.fp,1);assert.equal(r.parcel.precision,0);assert.equal(r.parcel.recall,null)})
test('recognition and doorway overlap are separate metrics',()=>{const outside={...parcel,box:{xmin:0,ymin:0,xmax:.1,ymax:.1}};const r=summarizeReplay([sample([outside])],'parcel-outside',zone);assert.equal(r.parcel.tp,1);assert.equal(r.overlap.tn,1)})
test('errors are excluded, not counted as correct negatives',()=>{const r=summarizeReplay([sample([],'timeout')],'no-parcel',zone);assert.equal(r.failed,1);assert.equal(r.successful,0);assert.equal(r.parcel.tn,0);assert.equal(r.parcel.precision,null);assert.equal(r.p95InferenceMs,null)})
