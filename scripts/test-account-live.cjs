// Explicit, opt-in integration test. Creates and removes one reserved-domain fixture.
// It does not test email delivery or claim signup email verification was exercised.
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict')
const {createClient}=require('@supabase/supabase-js')
if(!process.argv.includes('--live')){console.error('Opt-in required: node scripts/test-account-live.cjs --live');process.exit(1)}
const settings={}
for(const line of fs.readFileSync('.env.production.local','utf8').split(/\r?\n/)){
 const match=line.match(/^([A-Z_]+)=(.*)$/);if(match)settings[match[1]]=match[2]
}
const site=new URL(settings.CLEARDROP_SITE_URL)
if(!['127.0.0.1','localhost'].includes(site.hostname)||site.username||site.password)throw Error('This test is restricted to the local app.')
if(settings.CLEARDROP_ACCOUNT_AUTH!=='1'||!settings.SUPABASE_SECRET_KEY)throw Error('Live account configuration is required.')
const admin=createClient(settings.SUPABASE_URL,settings.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}})
const email=`cleardrop-e2e-${crypto.randomUUID()}@example.invalid`
const password=crypto.randomBytes(24).toString('base64url')+'Aa1!'
const newPassword=crypto.randomBytes(24).toString('base64url')+'Bb2!'
const jar=new Map()
let fixtureId=null,removed=false,passed=0
async function request(path,body,origin=site.origin){
 const headers={};if(jar.size)headers.Cookie=Array.from(jar,([k,v])=>`${k}=${v}`).join('; ')
 if(body){headers['Content-Type']='application/json';headers.Origin=origin}
 const response=await fetch(site.origin+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,redirect:'manual',signal:AbortSignal.timeout(20000)})
 for(const cookie of response.headers.getSetCookie()){
  const first=cookie.split(';')[0],split=first.indexOf('='),name=first.slice(0,split),value=first.slice(split+1)
  if(!value||/max-age=0(?:;|$)/i.test(cookie))jar.delete(name);else jar.set(name,value)
 }
 return response
}
function pass(label){passed++;console.log(`PASS ${label}`)}
async function run(){
 assert.equal((await request('/api/account')).status,200)
 const accountState=await (await request('/api/account')).json();assert.equal(accountState.configured,true);assert.equal(accountState.deletionAvailable,true)
 assert.equal((await request('/api/account',{action:'signin',email,password},'https://outside.example')).status,403)
 pass('Cross-site account writes blocked')
 const created=await admin.auth.admin.createUser({email,password,email_confirm:true})
 if(created.error)throw Error('Could not create controlled integration fixture.')
 fixtureId=created.data.user.id
 assert.equal(created.data.user.email,email)
 pass('Reserved-domain confirmed test fixture created; no email sent')
 assert.equal((await request('/api/account',{action:'signin',email,password:newPassword})).status,401)
 pass('Wrong password rejected')
 assert.equal((await request('/api/account',{action:'signin',email,password})).status,200)
 assert.equal((await (await request('/api/account')).json()).email,email)
 assert.equal((await request('/phone')).status,200)
 pass('Real provider login, verified session and private camera route')
 assert.equal((await request('/api/account',{action:'signout'})).status,200)
 assert.equal((await (await request('/api/account')).json()).email,null)
 assert.ok([302,303,307,308].includes((await request('/phone')).status))
 pass('Logout clears access to the private camera route')
 assert.equal((await request('/api/account',{action:'signin',email,password})).status,200)
 assert.equal((await request('/api/account',{action:'reset-password',password:newPassword})).status,200)
 assert.equal((await request('/api/account',{action:'signin',email,password})).status,401)
 assert.equal((await request('/api/account',{action:'signin',email,password:newPassword})).status,200)
 pass('Authenticated password change rejects old password and accepts new one')
 assert.equal((await request('/api/account',{action:'delete',password})).status,401)
 const retained=await admin.auth.admin.getUserById(fixtureId);assert.equal(retained.data.user?.email,email)
 pass('Deletion requires current-password reauthentication')
 assert.equal((await request('/api/account',{action:'delete',password:newPassword})).status,200)
 const gone=await admin.auth.admin.getUserById(fixtureId);assert.ok(gone.error);removed=true
 assert.equal((await (await request('/api/account')).json()).email,null)
 pass('Account deleted and session cleared')
 console.log(`${passed} live checks passed. Signup email delivery/recovery-email links and physical Ring playback were not tested.`)
}
run().catch(()=>{console.error('Live account integration check failed. Credentials and provider response bodies are not logged.');process.exitCode=1}).finally(async()=>{
 if(fixtureId&&!removed){
  const existing=await admin.auth.admin.getUserById(fixtureId)
  if(existing.data.user?.email!==email){console.error('Cleanup requires review; fixture identity no longer matches.');process.exitCode=1;return}
  const result=await admin.auth.admin.deleteUser(fixtureId)
  if(result.error){console.error('Fixture cleanup failed; remove only the reserved cleardrop-e2e account created by this run.');process.exitCode=1}
  else console.log('Temporary integration fixture removed.')
 }
})
