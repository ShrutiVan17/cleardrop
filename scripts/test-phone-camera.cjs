const {test}=require('node:test'),assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript')
function setup(getMedia){
  const exports={},timers=new Map(),states=[];let sequence=0,clock=0,constraints
  const track={onended:null,onmute:null,stopped:0,stop(){this.stopped++}}
  const stream={getTracks:()=>[track],getVideoTracks:()=>[track]}
  const video={srcObject:null,readyState:4,videoWidth:1280,currentTime:0,paused:false,play:async()=>{},pause(){}}
  const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/phone-camera.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  vm.runInNewContext(code,{exports,setInterval:fn=>{timers.set(++sequence,fn);return sequence},clearInterval:id=>timers.delete(id)})
  const camera=new exports.PhoneCamera({video:()=>video,getMedia:async value=>{constraints=value;return getMedia?getMedia():stream},onState:s=>states.push(s),now:()=>clock})
  return {camera,video,stream,track,states,timers,get constraints(){return constraints},tick(ms=500){clock+=ms;for(const fn of [...timers.values()])fn()},get status(){return states.at(-1)?.status}}
}
test('requests rear camera without audio and waits for video',async()=>{
  const f=setup();f.video.readyState=0;await f.camera.start();assert.equal(f.constraints.audio,false);assert.equal(f.constraints.video.facingMode.ideal,'environment')
  f.tick();assert.equal(f.status,'requesting');f.video.readyState=4;f.tick();assert.equal(f.status,'live');f.camera.dispose()
})
test('stop releases all tracks and timers',async()=>{
  const f=setup();await f.camera.start();f.tick();f.camera.stop();assert.equal(f.track.stopped,1);assert.equal(f.video.srcObject,null);assert.equal(f.timers.size,0);assert.equal(f.status,'idle')
})
test('late permission success after cancel cannot restart camera',async()=>{
  let resolve;const f=setup(()=>new Promise(r=>resolve=r));const start=f.camera.start();f.camera.stop();resolve(f.stream);await start
  assert.equal(f.track.stopped,1);assert.equal(f.status,'idle');assert.equal(f.video.srcObject,null)
})
test('late permission rejection preserves cancellation',async()=>{
  let reject;const f=setup(()=>new Promise((_,r)=>reject=r));const start=f.camera.start();f.camera.stop();reject({name:'NotAllowedError'});await start;assert.equal(f.status,'idle')
})
test('permission denial is recoverable',async()=>{
  const f=setup(()=>Promise.reject({name:'NotAllowedError'}));await f.camera.start();assert.equal(f.status,'error');assert.match(f.states.at(-1).message,/site settings/)
})
test('frozen frames stop monitoring and mark status unknown',async()=>{
  const f=setup();await f.camera.start();f.tick();assert.equal(f.status,'live');f.tick(8000);assert.equal(f.status,'error');assert.match(f.states.at(-1).message,/unknown/);assert.equal(f.track.stopped,1)
})
test('two simulated hours of advancing frames need no Ring token',async()=>{
  const f=setup();await f.camera.start();for(let i=1;i<=14400;i++){f.video.currentTime=i/2;f.tick()};assert.equal(f.status,'live');assert.equal(f.track.stopped,0);f.camera.dispose()
})
test('camera interruption requires restart and recalibration',async()=>{
  const f=setup();await f.camera.start();f.tick();f.track.onended();assert.equal(f.status,'error');assert.match(f.states.at(-1).message,/reference/);assert.equal(f.track.stopped,1)
})
test('unmount releases late streams without state updates',async()=>{
  let resolve;const f=setup(()=>new Promise(r=>resolve=r));const start=f.camera.start();f.camera.dispose();const count=f.states.length;resolve(f.stream);await start;assert.equal(f.track.stopped,1);assert.equal(f.states.length,count)
})
test('playback failure releases acquired tracks',async()=>{
  const f=setup();f.video.play=async()=>{throw {name:'NotAllowedError'}};await f.camera.start();assert.equal(f.status,'error');assert.equal(f.track.stopped,1);assert.equal(f.timers.size,0)
})
