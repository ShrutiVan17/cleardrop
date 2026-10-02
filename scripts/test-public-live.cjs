// Anonymous HTTP checks; sends no credentials, camera tokens or email.
const assert=require('node:assert/strict')
const origin=new URL(process.argv[2]||'http://127.0.0.1:3000').origin
if(!['http://127.0.0.1:3000','https://cleardrop-production-d5f1.up.railway.app'].includes(origin))throw new Error('Use the configured local or hosted deployment.')
async function get(path,options={}){return fetch(origin+path,{redirect:'manual',signal:AbortSignal.timeout(60000),...options})}
;(async()=>{
  for(const path of ['/','/demo','/test','/phone','/account','/privacy','/manifest.webmanifest']){
    const res=await get(path);assert.equal(res.status,200,path);assert.equal(res.headers.get('www-authenticate'),null,path)
    const body=await res.text();if(path==='/'){assert.match(body,/Try the working demo/);assert.doesNotMatch(body,/type="password"|Your token will/)}
    console.log('Public without credentials:',path)
  }
  const doorway=await get('/doorway');assert.equal(doorway.status,307);assert.match(doorway.headers.get('location'),/\/account$/)
  for(const path of ['config','devices','token','events','stream']){
    const res=await get('/api/ring/'+path);assert.equal(res.status,401,path);assert.equal(res.headers.get('www-authenticate'),null,path)
    console.log('Camera access requires personal sign-in:',path)
  }
  const account=await get('/api/account');assert.equal(account.status,200)
  const info=await account.json();assert.equal(info.configured,true);assert.equal(info.email,null);assert.equal(info.signupAvailable,false)
  const crossSite=await get('/api/account',{method:'POST',headers:{origin:'https://attacker.example','Content-Type':'application/json'},body:'{"action":"signout"}'});assert.equal(crossSite.status,403)
  const signup=await get('/api/account',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({action:'signup',email:'public-check@example.invalid',password:'test-only-not-used-password'})});assert.equal(signup.status,503)
  console.log('Public account entry works; cross-site writes and unopened registration blocked.')
})().catch(error=>{console.error(error.message);process.exitCode=1})
