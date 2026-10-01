const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
const exportsObject = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/account-policy.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: exportsObject, TextDecoder, URL })
const { sameSiteWrite, validEmail, validPassword, readSmallJson } = exportsObject
test('account writes require a same-site origin, including behind the hosting proxy', () => {
  assert.equal(sameSiteWrite(new Request('https://app.example/api/account', { headers: { origin: 'https://app.example' } })), true)
  assert.equal(sameSiteWrite(new Request('http://localhost:3000/api/account', { headers: { host: 'app.example', origin: 'https://app.example' } })), true)
  for (const headers of [{}, { origin: 'https://attacker.example' }, { origin: 'https://app.example', 'sec-fetch-site': 'cross-site' }]) assert.equal(sameSiteWrite(new Request('https://app.example/api/account', { headers })), false)
})
test('account inputs reject weak passwords, non-strings and oversized addresses', () => {
  assert.equal(validPassword('12345678'), false); assert.equal(validPassword('twelve-good-characters'), true)
  assert.equal(validPassword('x'.repeat(129)), false); assert.equal(validPassword({ length: 20 }), false)
  assert.equal(validEmail('user@example.com'), true); assert.equal(validEmail('not-an-email'), false); assert.equal(validEmail('x'.repeat(255) + '@a.com'), false)
})
test('bounded streaming parser rejects oversized or invalid JSON before processing credentials', async () => {
  assert.equal((await readSmallJson(new Request('https://a.example', { method: 'POST', body: '{"action":"signin"}' }))).action, 'signin')
  await assert.rejects(readSmallJson(new Request('https://a.example', { method: 'POST', body: 'x'.repeat(4097) })))
  await assert.rejects(readSmallJson(new Request('https://a.example', { method: 'POST', body: '[]' })))
})
test('identity checks use verified provider lookup, never trust decoded sessions alone', () => {
  const source = fs.readFileSync(path.join(__dirname, '../lib/account-auth.ts'), 'utf8')
  assert.match(source, /auth\.getUser\(\)/); assert.doesNotMatch(source, /auth\.getSession\(\)/)
  assert.match(source, /httpOnly: true/); assert.match(source, /sameSite: 'lax'/)
  const auth = fs.readFileSync(path.join(__dirname, '../lib/auth.ts'), 'utf8')
  assert.match(auth, /sessionToken\(request, ownerId\)/); assert.match(auth, /if \(ownerId\) throw/)
})
test('dangerous account operations recheck password and secret keys remain server-only', () => {
  const route = fs.readFileSync(path.join(__dirname, '../app/api/account/route.ts'), 'utf8')
  assert.match(route, /check\.data\.user\?\.id !== data\.user\.id/); assert.match(route, /admin\.deleteUser\(data\.user\.id\)/)
  assert.doesNotMatch(route, /NEXT_PUBLIC.*SECRET/)
  assert.match(route, /if \(!accountEnabled\(\)\)/); assert.match(route, /if \(!sameSiteWrite\(request\)\)/)
})
