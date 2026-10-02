const {test}=require('node:test'),assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript')
function policy(env){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/public-access.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,process:{env}});return exports}
test('public demonstrations are explicit and exclude personal cameras',()=>{
  const p=policy({});assert.equal(p.publicDemoEnabled(),false)
  for(const route of ['/','/test','/demo','/phone','/privacy','/account','/auth/confirm','/api/account','/_next/static/a.js']) assert.equal(p.publicDemoPath(route),true,route)
  for(const route of ['/doorway','/doorway/','/api/ring/config','/api/ring/devices','/api/ring/connect','/api/ring/token','/api/ring/stream','/api/webhook','/api/account/extra','/test/private']) assert.equal(p.publicDemoPath(route),false,route)
})
test('public registration requires separate explicit release approval',()=>{
  assert.equal(policy({CLEARDROP_PUBLIC_DEMO:'1'}).publicSignupEnabled(),false)
  assert.equal(policy({CLEARDROP_PUBLIC_DEMO:'1',CLEARDROP_PUBLIC_SIGNUP:'1'}).publicSignupEnabled(),true)
  assert.equal(policy({}).publicSignupEnabled(),true)
})
test('middleware authenticates non-public routes or fails closed',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../middleware.ts'),'utf8')
  assert.match(source,/if \(publicDemoPath\(request.nextUrl.pathname\)\) return NextResponse.next\(\)/)
  assert.match(source,/if \(!accountEnabled\(\)\).*status: 503/)
  assert.match(source,/return accountMiddleware\(request\)/)
})
