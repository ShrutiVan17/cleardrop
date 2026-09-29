const {test}=require('node:test'),assert=require('node:assert/strict')
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ts=require('typescript')
function load(name){
 const c={exports:{},require:relative=>load(relative.replace('./',''))}
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib',name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,c)
 return c.exports
}
const {demoState,DEMO_STEPS}=load('demo-scenario')
const {normalizeGroundedLabel:normalize}=load('detector-models')
test('scripted walkthrough exercises live decision rules',()=>{
 assert.equal(DEMO_STEPS.map((_,i)=>demoState(i).phase).join(','),'observing,verifying,obstructed,unknown,checking-clear,checking-clear,observing')
})
test('disconnect preserves unresolved obstruction in the demonstration',()=>{
 assert.equal(demoState(3).lastKnownObstruction,true)
 assert.equal(demoState(4).lastKnownObstruction,true)
 assert.equal(demoState(6).lastKnownObstruction,false)
})
test('Grounding DINO aliases normalize only explicit parcel phrases',()=>{
 assert.equal(normalize('a cardboard box.'),'a cardboard box')
 assert.equal(normalize('BOX'),'a cardboard box')
 assert.equal(normalize('mailing envelope'),'a padded mailing envelope')
 assert.equal(normalize('a person'),'a person')
 assert.equal(normalize('a doormat'),'a doormat')
 assert.equal(normalize('a person cardboard box'),'a person cardboard box')
})

