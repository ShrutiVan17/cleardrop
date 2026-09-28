const {test}=require('node:test'),assert=require('node:assert/strict')
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ts=require('typescript')
const c={exports:{}}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/doorway-state.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,c)
const {initialDoorwayState:initial,observeDoorway:observe,pauseDoorway:pause,expireDoorway:expire}=c.exports
const blocked=()=>observe(initial(),{at:1000,candidate:true,persistent:true})
const missing=(state,at)=>observe(state,{at,candidate:false,persistent:false})
test('starts unknown, not clear',()=>assert.equal(initial().phase,'unknown'))
test('one missed detection does not clear an obstruction',()=>assert.equal(missing(blocked(),2000).phase,'checking-clear'))
test('three negative scans spanning five seconds resolve observation',()=>{
 let s=missing(blocked(),2000);s=missing(s,4000);s=missing(s,7000)
 assert.equal(s.phase,'observing');assert.equal(s.lastKnownObstruction,false)
})
test('fast repeated negatives are insufficient',()=>{
 let s=missing(blocked(),2000);s=missing(s,2100);s=missing(s,2200);assert.equal(s.phase,'checking-clear')
})
test('disconnect and stale evidence retain unresolved obstruction',()=>{
 assert.equal(pause(blocked()).phase,'unknown');assert.equal(pause(blocked()).lastKnownObstruction,true)
 assert.equal(expire(blocked(),17000).phase,'unknown');assert.equal(expire(blocked(),17000).lastKnownObstruction,true)
})
test('old and duplicate observations cannot alter state',()=>{
 const s=blocked();assert.equal(missing(s,900),s);assert.equal(missing(s,1000),s)
})
test('returning candidate resets removal checks',()=>{
 let s=missing(blocked(),2000);s=observe(s,{at:4000,candidate:true,persistent:false});s=missing(s,8000)
 assert.equal(s.phase,'checking-clear');assert.equal(s.clearScans,1)
})
test('observation gaps cannot count toward resolution',()=>{
 let s=missing(blocked(),2000);s=missing(s,4000);s=missing(s,30000)
 assert.equal(s.phase,'checking-clear');assert.equal(s.clearScans,1)
})
