const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),path=require('node:path')
const exports_={}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/review-sync.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:exports_})
const {ReviewSync}=exports_,tick=()=>new Promise(resolve=>setImmediate(resolve))
test('snapshot writes are ordered, detached and duplicates do not skip versions',async()=>{
 let release;const written=[],states=[]
 const sync=new ReviewSync(async r=>{written.push(r.version);if(r.version===1)await new Promise(resolve=>release=resolve)},s=>states.push(s))
 const first={id:'one',version:1};sync.enqueue(first);first.version=99
 sync.enqueue({id:'one',version:2});sync.enqueue({id:'one',version:2});sync.enqueue({id:'one',version:3})
 assert.deepEqual(written,[1]);release();await tick();assert.deepEqual(written,[1,2,3]);assert.equal(states.at(-1),'saved')
})
test('failure pauses updates; only explicit retry resends the same version',async()=>{
 let fail=true;const writes=[],states=[]
 const sync=new ReviewSync(async r=>{writes.push(r.version);if(fail)throw Error('offline')},(s,d)=>states.push([s,d]))
 sync.enqueue({id:'one',version:1});await tick();sync.enqueue({id:'one',version:2});await tick()
 assert.deepEqual(writes,[1]);assert.equal(states.at(-1)[0],'error')
 fail=false;sync.retry();await tick();assert.deepEqual(writes,[1,1,2])
})
test('disposing prevents pending writes and late success messages',async()=>{
 let release;const writes=[],states=[]
 const sync=new ReviewSync(async r=>{writes.push(r.version);await new Promise(resolve=>release=resolve)},s=>states.push(s))
 sync.enqueue({id:'one',version:1});sync.enqueue({id:'one',version:2});sync.dispose();release();await tick();sync.retry()
 assert.deepEqual(writes,[1]);assert.deepEqual(states,['saving'])
})
test('bounded overflow is terminal; retry must not hide missing versions',async()=>{
 const states=[];let writes=0
 const sync=new ReviewSync(async()=>{writes++;throw Error('offline')},(s,d)=>states.push([s,d]))
 sync.enqueue({id:'one',version:1});await tick()
 for(let version=2;version<=70;version++)sync.enqueue({id:'one',version})
 sync.retry();await tick();assert.equal(writes,1);assert.match(states.at(-1)[1],/reload/)
})
