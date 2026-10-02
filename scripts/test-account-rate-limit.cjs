const {test}=require('node:test'),assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript')
const exportsObject={}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/account-rate-limit.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:exportsObject,Map,Date})
test('repeated account attempts are capped and recover after the window',()=>{
  let now=0;const allow=exportsObject.createAccountLimiter(()=>now)
  for(let n=0;n<8;n++)assert.equal(allow('signin:fixture@example.invalid'),true)
  assert.equal(allow('signin:fixture@example.invalid'),false)
  now=60000;assert.equal(allow('signin:fixture@example.invalid'),true)
})
test('changing email addresses cannot bypass the bounded global window',()=>{
  let now=0;const allow=exportsObject.createAccountLimiter(()=>now)
  for(let n=0;n<60;n++)assert.equal(allow('signin:'+n),true)
  assert.equal(allow('signin:new'),false)
  now=60000;assert.equal(allow('signin:new'),true)
})
