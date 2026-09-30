const {test}=require('node:test'),assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript')
const root=path.resolve(__dirname,'..')
function setup(){
  const context=vm.createContext({Buffer,Date,Map,Request,Response,URL,AbortSignal,process:{env:{}},console:{error(){}},setTimeout,clearTimeout}),cache={}
  let reply={ok:true,json:async()=>({data:[{id:'fixture-camera'}]})},calls=0
  context.fetch=async()=>{calls++;return reply}
  class NextResponse extends Response {
    static json(data,options){const r=new NextResponse(JSON.stringify(data),options);r.cookieValues={};r.cookies={set(name,value,settings){r.cookieValues[name]={value,...settings}}};return r}
  }
  function load(relative){
    const file=path.resolve(root,relative);if(cache[file])return cache[file]
    const exports={};cache[file]=exports
    const requireModule=name=>name==='next/server'?{NextResponse}:name==='node:crypto'?require(name):load((name.startsWith('@/')?name.slice(2):path.relative(root,path.resolve(path.dirname(file),name)))+'.ts')
    const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
    vm.runInContext('(function(exports,require){'+code+'\n})',context)(exports,requireModule)
    return exports
  }
  const session=load('lib/ring-session.ts'),route=load('app/api/ring/connect/route.ts'),auth=load('lib/auth.ts')
  return {session,route,auth,context,setReply:value=>{reply=value},get calls(){return calls}}
}
const token=(seconds=1800)=>'fixture.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+seconds})).toString('base64url')+'.signature'
const request=(value,headers={})=>new Request('https://preview.example/api/ring/connect',{method:'POST',headers:{'content-type':'application/json',origin:'https://preview.example',...headers},body:JSON.stringify({token:value})})
test('Ring accepts before a private browser session is created; token not echoed',async()=>{
 const f=setup(),value=token(),response=await f.route.POST(request(value)),body=await response.text()
 assert.equal(response.status,200);assert.doesNotMatch(body,new RegExp(value.replaceAll('.','\\.')))
 const cookie=response.cookieValues[f.session.RING_COOKIE];assert.equal(cookie.httpOnly,true);assert.equal(cookie.sameSite,'strict');assert.equal(cookie.secure,true)
 const read=new Request('https://preview.example/api/ring/config',{headers:{cookie:f.session.RING_COOKIE+'='+cookie.value}})
 assert.equal(await f.auth.getAccessToken(read),value);assert.equal(f.auth.getAuthMode(read),'access_token')
})
test('rejected Ring token never creates a session',async()=>{
 const f=setup();f.setReply({ok:false,status:401});const r=await f.route.POST(request(token()));assert.equal(r.status,400);assert.deepEqual(r.cookieValues,{})
})
test('expired and malformed tokens are rejected before contacting Ring',async()=>{
 const f=setup();for(const value of ['not-a-token',token(-10)])assert.equal((await f.route.POST(request(value))).status,400);assert.equal(f.calls,0)
})
test('zero shared cameras cannot report connected',async()=>{
 const f=setup();f.setReply({ok:true,json:async()=>({data:[]})});const r=await f.route.POST(request(token()));assert.equal(r.status,400);assert.deepEqual(r.cookieValues,{})
})
test('cross-site connect and disconnect are rejected even locally',async()=>{
 const f=setup();for(const origin of ['https://attacker.example','invalid']){assert.equal((await f.route.POST(request(token(),{origin}))).status,403);assert.equal((await f.route.DELETE(request(token(),{origin}))).status,403)}assert.equal(f.calls,0)
})
test('sessions isolate browsers; disconnect never falls back to server credentials',async()=>{
 const f=setup(),otherToken=token(900),first=f.session.saveRingSession(token(),request('')),second=f.session.saveRingSession(otherToken,request(''))
 assert.notEqual(first.id,second.id)
 const read=new Request('https://preview.example/api/ring/config',{headers:{cookie:f.session.RING_COOKIE+'='+first.id}})
 f.session.forgetRingSession(read);f.context.process.env.RING_ACCESS_TOKEN=token()
 await assert.rejects(f.auth.getAccessToken(read),/session ended/)
 assert.equal(f.session.sessionToken(new Request('https://preview.example/api/ring/config',{headers:{cookie:f.session.RING_COOKIE+'='+second.id}})),otherToken)
})
