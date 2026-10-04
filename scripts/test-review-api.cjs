const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),path=require('node:path')
const root=path.resolve(__dirname,'..')
function fixture(){
 let user={id:'owner-one',email_confirmed_at:'verified'},storageError=null
 const rows=new Map()
 function query(){
  const conditions=[],q={operation:'read',payload:null,single:false}
  for(const method of ['select','order','limit'])q[method]=()=>q
  q.eq=(key,value)=>{conditions.push([key,value]);return q}
  q.maybeSingle=()=>{q.single=true;return q}
  q.insert=value=>{q.operation='insert';q.payload=value;return q}
  q.update=value=>{q.operation='update';q.payload=value;return q}
  q.delete=()=>{q.operation='delete';return q}
  q.then=(resolve,reject)=>Promise.resolve().then(()=>{
   if(storageError)return {data:null,error:{code:storageError,message:'private database diagnostic'}}
   const matches=[...rows.values()].filter(row=>row.owner_id===user?.id && conditions.every(([key,value])=>row[key]===value))
   if(q.operation==='insert'){
    if(rows.has(q.payload.id))return {data:null,error:{code:'23505'}}
    rows.set(q.payload.id,q.payload);return {data:null,error:null}
   }
   if(q.operation==='update'){for(const row of matches)rows.set(row.id,q.payload);return {data:matches.map(row=>({id:row.id})),error:null}}
   if(q.operation==='delete'){for(const row of matches)rows.delete(row.id);return {data:null,error:null}}
   return {data:q.single?(matches[0]||null):matches,error:null}
  }).then(resolve,reject)
  return q
 }
 const cache={}
 function load(relative){
  if(cache[relative])return cache[relative]
  const file=path.resolve(root,relative),exports={};cache[relative]=exports
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,Request,Response,TextDecoder,Date,URL,require(name){
   if(name==='next/server')return {NextResponse:{json:(body,init)=>Response.json(body,init)}}
   if(name==='@/lib/account-auth')return {accountEnabled:()=>true,accountClient:()=>({auth:{getUser:async()=>({data:{user},error:null})},from:()=>query()})}
   if(name.startsWith('@/'))return load(name.slice(2)+'.ts')
   throw Error(name)
  }})
  return exports
 }
 const api=load('app/api/reviews/route.ts'),domain=load('lib/delivery-review.ts')
 const request=(method,body,origin='https://app.example')=>new Request('https://app.example/api/reviews',{method,headers:{origin,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})})
 const review=domain.createReview('0a000000-0000-4000-8000-000000000001','ring','viewer-report',Date.now())
 return {api,domain,request,review,rows,setUser:value=>user=value,setError:value=>storageError=value}
}
test('all methods independently reject missing or unverified accounts',async()=>{
 const f=fixture()
 for(const user of [null,{id:'owner-one',email_confirmed_at:null}]){
  f.setUser(user)
  for(const method of ['GET','PUT','DELETE'])assert.equal((await f.api[method](f.request(method,method==='GET'?undefined:{review:f.review}))).status,401)
 }
 assert.equal(f.rows.size,0)
})
test('cross-site writes and unexpected private payloads are rejected before storage',async()=>{
 const f=fixture()
 assert.equal((await f.api.PUT(f.request('PUT',{review:f.review},'https://evil.example'))).status,403)
 for(const review of [{...f.review,token:'private'}, {...f.review,source:'generated-video'}, {...f.review,updatedAt:Date.now()+400000}])assert.equal((await f.api.PUT(f.request('PUT',{review}))).status,400)
 assert.equal((await f.api.PUT(f.request('PUT',{review:f.review,padding:'x'.repeat(5000)}))).status,400)
 assert.equal(f.rows.size,0)
})
test('owner-bound reads, idempotent retries and optimistic writes enforce a real ordered flow',async()=>{
 const f=fixture(),first=await f.api.PUT(f.request('PUT',{review:f.review}))
 assert.equal(first.status,200);assert.equal(f.rows.values().next().value.owner_id,'owner-one')
 assert.equal((await f.api.PUT(f.request('PUT',{review:f.review}))).status,200)
 assert.equal((await f.api.PUT(f.request('PUT',{review:{...f.review,view:'unknown'}}))).status,409)
 const ack=f.domain.advanceReview(f.review,{kind:'acknowledge'},f.review.updatedAt+1)
 assert.equal((await f.api.PUT(f.request('PUT',{review:{...ack,version:3}}))).status,409)
 assert.equal((await f.api.PUT(f.request('PUT',{review:ack}))).status,200)
 const result=await f.api.GET(f.request('GET'));assert.equal(result.headers.get('cache-control'),'private, no-store')
 const body=await result.json();assert.equal(body.reviews.length,1);assert.equal(body.reviews[0].phase,'acknowledged');assert.equal('owner_id' in body.reviews[0],false)
 f.setUser({id:'owner-two',email_confirmed_at:'verified'})
 assert.equal((await (await f.api.GET(f.request('GET'))).json()).reviews.length,0)
 assert.equal((await f.api.PUT(f.request('PUT',{review:ack}))).status,409)
 assert.equal((await f.api.PUT(f.request('PUT',{review:f.review}))).status,409)
 assert.equal(f.rows.values().next().value.owner_id,'owner-one')
})
test('deletion needs explicit consent, removes only own closed reviews and does not leak database errors',async()=>{
 const f=fixture();await f.api.PUT(f.request('PUT',{review:f.review}))
 assert.equal((await f.api.DELETE(f.request('DELETE',{}))).status,400)
 assert.equal((await f.api.DELETE(f.request('DELETE',{confirmDelete:true}))).status,200);assert.equal(f.rows.size,1)
 let review=f.review
 for(const command of [{kind:'acknowledge'},{kind:'check-removal'},{kind:'resolve',checkedEmpty:true,freshVideo:true,observation:{ready:true,blocked:false,unresolved:false,reportedParcel:false}}]){
  review=f.domain.advanceReview(review,command,review.updatedAt+1)
  assert.equal((await f.api.PUT(f.request('PUT',{review}))).status,200)
 }
 f.setUser({id:'owner-two',email_confirmed_at:'verified'});await f.api.DELETE(f.request('DELETE',{confirmDelete:true}));assert.equal(f.rows.size,1)
 f.setUser({id:'owner-one',email_confirmed_at:'verified'});await f.api.DELETE(f.request('DELETE',{confirmDelete:true}));assert.equal(f.rows.size,0)
 f.setError('42P01');const failure=await f.api.GET(f.request('GET'));assert.equal(failure.status,503);assert.doesNotMatch(await failure.text(),/private database diagnostic/)
})
