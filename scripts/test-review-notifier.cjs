const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),path=require('node:path')
const exports_={}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/review-notifier.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:exports_})
const {ReviewNotifier}=exports_
test('notifications require opt-in and attempt each review only once',async()=>{
 let asked=0,shown=0,closed=0
 const notices=new ReviewNotifier({available:()=>true,permission:()=> 'default',request:async()=>{asked++;return 'granted'},show:()=>{shown++;return {close:()=>closed++}}})
 assert.equal(notices.notify('one'),'not-requested');assert.equal(asked,0)
 assert.equal(await notices.enable(),'enabled')
 // Revoked permission is checked independently from the enable response.
 assert.equal(notices.notify('one'),'denied');assert.equal(shown,0)
 const allowed=new ReviewNotifier({available:()=>true,permission:()=> 'granted',request:async()=>{throw Error('should not request')},show:()=>{shown++;return {close:()=>closed++}}})
 await allowed.enable();assert.equal(allowed.notify('one'),'presented');assert.equal(allowed.notify('one'),'not-requested')
 allowed.notify('two');allowed.disable();assert.equal(closed,2);assert.equal(allowed.notify('three'),'not-requested')
})
test('unsupported, blocked, rejected permission and constructor failure are honest outcomes',async()=>{
 for(const [port,expected] of [[{available:()=>false},'unsupported'],[{available:()=>true,permission:()=> 'denied',request:async()=> 'denied'},'denied'],[{available:()=>true,permission:()=> 'default',request:async()=>{throw Error('blocked')}},'failed']])assert.equal(await new ReviewNotifier(port).enable(),expected)
 const failing=new ReviewNotifier({available:()=>true,permission:()=> 'granted',show:()=>{throw Error('mobile constructor')}})
 await failing.enable();assert.equal(failing.notify('one'),'failed');assert.equal(failing.notify('one'),'not-requested')
})
