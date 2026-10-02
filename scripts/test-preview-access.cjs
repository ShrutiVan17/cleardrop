const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.join(__dirname, '..')
const source = fs.readFileSync(path.join(root, 'lib/preview-access.ts'), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
function gate(env) {
  const exports = {}
  vm.runInNewContext(code, { exports, process: { env }, require(name) { if(name==='./public-access') return { publicDemoEnabled:()=>env.CLEARDROP_PUBLIC_DEMO==='1' }; if(name==='./account-auth') return { accountAccess:async()=>Response.json({error:'Sign in to continue.'},{status:401}) }; throw new Error(name) }, crypto: require('node:crypto').webcrypto, TextEncoder, Response, URL, atob })
  return exports.previewAccess
}
const password = 'test-only-password-at-least-24-characters'
function request(extra = {}) {
  return new Request('https://preview.example/api/ring/stream', extra)
}
const authorization = 'Basic ' + Buffer.from(`cleardrop:${password}`).toString('base64')
test('local workflow is unchanged', async () => assert.equal(await gate({})(request()), null))
test('public deployment never permits owner-token fallback or bypasses account checks',async()=>{
  assert.equal((await gate({CLEARDROP_PUBLIC_DEMO:'1'})(request())).status,503)
  const result=await gate({CLEARDROP_PUBLIC_DEMO:'1',CLEARDROP_ACCOUNT_AUTH:'1',CLEARDROP_HOSTED:'1'})(request())
  assert.equal(result.status,401);assert.equal(result.headers.get('www-authenticate'),null)
})
test('custom login and shorter passwords require explicit owner configuration', async () => {
  const env = {CLEARDROP_HOSTED:'1', CLEARDROP_PREVIEW_USERNAME:'test-owner', CLEARDROP_PREVIEW_PASSWORD:'fixture8'}
  const authorization = 'Basic ' + Buffer.from('test-owner:fixture8').toString('base64')
  assert.equal((await gate(env)(request({headers:{authorization}}))).status,503)
  const check = gate({...env,CLEARDROP_ALLOW_SHORT_PASSWORD:'1'})
  assert.equal(await check(request({headers:{authorization}})),null)
  assert.equal((await check(request({headers:{authorization:'Basic '+Buffer.from('cleardrop:fixture8').toString('base64')}}))).status,401)
  assert.equal((await gate({...env,CLEARDROP_ALLOW_SHORT_PASSWORD:'1',CLEARDROP_PREVIEW_PASSWORD:'short'})(request())).status,503)
})
test('hosted preview fails closed without a strong password', async () => {
  for (const env of [{CLEARDROP_HOSTED:'1'}, {RAILWAY_ENVIRONMENT_ID:'test'}, {CLEARDROP_HOSTED:'1',CLEARDROP_PREVIEW_PASSWORD:'short'}]) {
    assert.equal((await gate(env)(request())).status, 503)
  }
})

test('enabling accounts never opens hosted signup without the owner preview gate', async () => {
  assert.equal((await gate({CLEARDROP_HOSTED:'1',CLEARDROP_ACCOUNT_AUTH:'1'})(request())).status,503)
  assert.equal((await gate({CLEARDROP_HOSTED:'1',CLEARDROP_ACCOUNT_AUTH:'1',CLEARDROP_PREVIEW_PASSWORD:password})(request())).status,401)
})
test('missing, incorrect and malformed credentials are rejected', async () => {
  const check = gate({CLEARDROP_HOSTED:'1',CLEARDROP_PREVIEW_PASSWORD:password})
  for (const value of ['', 'Basic !!!', 'Basic '+Buffer.from('cleardrop:wrong').toString('base64')]) {
    const result = await check(request({headers:{authorization:value}}))
    assert.equal(result.status, 401)
    assert.match(result.headers.get('www-authenticate'), /^Basic/)
    assert.equal(result.headers.get('cache-control'), 'private, no-store')
  }
})
test('correct credentials allow access on Railway', async () => {
  assert.equal(await gate({RAILWAY_ENVIRONMENT_ID:'test',CLEARDROP_PREVIEW_PASSWORD:password})(request({headers:{authorization}})), null)
})
test('cross-site writes are blocked and same-origin writes allowed', async () => {
  const check = gate({CLEARDROP_HOSTED:'1',CLEARDROP_PREVIEW_PASSWORD:password})
  for (const headers of [{authorization,origin:'https://attacker.example'},{authorization,'sec-fetch-site':'cross-site'}]) {
    assert.equal((await check(request({method:'POST',headers}))).status,403)
  }
  assert.equal(await check(request({method:'POST',headers:{authorization,origin:'https://preview.example'}})),null)
  assert.equal(await check(new Request('http://localhost:3000/api/ring/stream', {method:'POST',headers:{authorization,host:'preview.example',origin:'https://preview.example'}})),null)
})
test('every Ring API handler checks access independently of middleware', () => {
  for (const name of ['config','devices','token','stream','events','connect']) {
    const content=fs.readFileSync(path.join(root,`app/api/ring/${name}/route.ts`),'utf8')
    const handlers=content.match(/export async function (GET|POST|DELETE)/g)||[]
    assert.ok(handlers.length>0)
    assert.equal((content.match(/const denied = await previewAccess\(request\)/g)||[]).length,handlers.length)
  }
  for (const name of ['webhook','webhook/test']) {
    const content=fs.readFileSync(path.join(root,`app/api/${name}/route.ts`),'utf8')
    const handlers=content.match(/export async function (GET|POST)/g)||[]
    assert.equal((content.match(/if \(hostedPreview\(\)\)/g)||[]).length,handlers.length)
  }
})
