const {test}=require('node:test'),assert=require('node:assert/strict')
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ts=require('typescript')
function load(name){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib',name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,Uint8ClampedArray,require:relative=>load(relative.replace('./',''))});return exports}
const {CameraTestEvidence}=load('camera-test-evidence'),{ChangeMonitor}=load('change-monitor')
const initial={ready:true,blocked:false,unresolved:false,ratio:0,scans:0}
function frame(placement='empty'){
 const width=100,height=100,data=new Uint8ClampedArray(width*height*4).fill(40)
 if(placement!=='empty')for(let y=60;y<80;y++)for(let x=placement==='inside'?40:80;x<(placement==='inside'?60:100);x++){const i=(y*width+x)*4;data[i]=data[i+1]=data[i+2]=200}
 return{width,height,data}
}
function productionRun(mutate=(sample)=>sample){
 const monitor=new ChangeMonitor();monitor.calibrate(frame(),{x:.3,y:.5,w:.4,h:.4},0,{checkedEmpty:true})
 const evidence=new CameraTestEvidence(0,initial)
 for(let at=250;at<19500;at+=250){const placement=at<4500?'beside':at<10000?'inside':at<14000?'empty':'inside';evidence.observe(mutate(monitor.observe(frame(placement),at),at),at)}
 evidence.observe(mutate(monitor.pause(),19750),19750)
 return evidence
}
test('all three cases require production pixel observations and measured phase coverage',()=>{
 const report=productionRun().report(21000)
 assert.equal(report.cases.every(item=>item.result==='Passed'),true)
 assert.equal(report.completed,true);assert.equal(report.phases.outside.samples,17)
 assert.equal(report.phases.restored.samples,16);assert.equal(report.source,'generated-video')
 assert.ok(report.transitions.some(item=>item.phase==='lost'&&!item.ready&&item.unresolved))
})
test('old scans and repeated snapshots cannot stand in for fresh video',()=>{
 const evidence=new CameraTestEvidence(0,{...initial,scans:900})
 for(let at=250;at<21000;at+=250)evidence.observe({...initial,scans:900},at)
 assert.equal(evidence.report(21000).cases.every(item=>item.result==='Failed'),true)
 assert.equal(evidence.report(21000).phases.outside.samples,0)
})
test('an outside-zone alert cannot disappear from the result when later samples clear',()=>{
 const report=productionRun((sample,at)=>at===2000?{...sample,blocked:true,unresolved:true}:sample).report(21000)
 assert.equal(report.cases[0].result,'Failed')
})
test('recalibration or an observation gap fails rather than reusing prior evidence',()=>{
 const reset=productionRun((sample,at)=>at===11000?{...sample,scans:0}:sample).report(21000)
 assert.equal(reset.cases.every(item=>item.result==='Failed'),true);assert.match(reset.failure,/reference/)
 const evidence=new CameraTestEvidence(0,initial);evidence.observe({...initial,scans:1},2000)
 assert.match(evidence.report(21000).failure,/interrupted/)
})
test('premature alerts and premature clearing cannot pass persistence tests',()=>{
 assert.match(productionRun((sample,at)=>at===5000?{...sample,blocked:true,unresolved:true}:sample).report(21000).failure,/persistence/)
 assert.match(productionRun((sample,at)=>at===10500?{...sample,blocked:false,unresolved:false}:sample).report(21000).failure,/too early/)
})
test('video loss without retained concern fails; reports expose no accuracy or credentials',()=>{
 const report=productionRun((sample,at)=>at===19750?{...sample,unresolved:false}:sample).report(21000)
 assert.equal(report.cases[2].result,'Failed')
 assert.doesNotMatch(JSON.stringify(report),/token|password|precision|recall|accuracyPercent/i)
})
test('invalid starts cannot produce green results and reports copy internal evidence',()=>{
 const evidence=new CameraTestEvidence(0,{...initial,unresolved:true})
 assert.equal(evidence.results(21000).every(item=>item==='Failed'),true)
 const valid=productionRun(),first=valid.report(21000);first.phases.outside.samples=99999;first.transitions.length=0
 assert.equal(valid.report(21000).phases.outside.samples,17);assert.ok(valid.report(21000).transitions.length>0)
})
test('callback jitter cannot shorten the source-clock persistence interval',()=>{
 const monitor=new ChangeMonitor();monitor.calibrate(frame(),{x:.3,y:.5,w:.4,h:.4},0,{checkedEmpty:true})
 const evidence=new CameraTestEvidence(0,initial)
 for(let at=250;at<19500;at+=250)evidence.observe(monitor.observe(frame(at<4500?'beside':at<10000?'inside':at<14000?'empty':'inside'),at),at+(at%500===0?12:2))
 evidence.observe(monitor.pause(),19750)
 assert.equal(evidence.report(21000).cases.every(item=>item.result==='Passed'),true)
})
