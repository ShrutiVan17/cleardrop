const {test}=require('node:test'), assert=require('node:assert/strict')
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),path=require('node:path')
const exports_={}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/delivery-review.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:exports_})
const {createReview,advanceReview,reviewMetadata,validReviewReplacement,reviewView}=exports_
const id='0a000000-0000-4000-8000-000000000001'
const initial=()=>createReview(id,'ring','scene-change',1000)
const empty={ready:true,blocked:false,unresolved:false,reportedParcel:false}
const checking=()=>advanceReview(advanceReview(initial(),{kind:'acknowledge'},1100),{kind:'check-removal'},1200)
test('acknowledgement is not removal; legal sequence increments versions',()=>{
 const first=initial(),ack=advanceReview(first,{kind:'acknowledge'},1100),check=advanceReview(ack,{kind:'check-removal'},1200)
 assert.equal(ack.phase,'acknowledged');assert.equal(ack.resolvedAt,null)
 const done=advanceReview(check,{kind:'resolve',checkedEmpty:true,freshVideo:true,observation:empty},1300)
 assert.equal(done.phase,'resolved');assert.equal(done.version,4);assert.equal(done.resolvedAt,1300)
 for(const [a,b] of [[first,ack],[ack,check],[check,done]])assert.equal(validReviewReplacement(a,b),true)
 assert.throws(()=>advanceReview(done,{kind:'view',value:'concern'},1400),/already closed/)
})
test('missed, stale, disconnected and unconfirmed views cannot close a review',()=>{
 const review=checking()
 for(const changes of [{checkedEmpty:false},{freshVideo:false},{observation:{...empty,ready:false}},{observation:{...empty,blocked:true}},{observation:{...empty,unresolved:true}},{observation:{...empty,reportedParcel:true}}]){
  assert.throws(()=>advanceReview(review,{kind:'resolve',checkedEmpty:true,freshVideo:true,observation:empty,...changes},1300),/fresh, empty/)
 }
 assert.equal(review.phase,'checking-removal');assert.equal(review.resolvedAt,null)
 assert.throws(()=>advanceReview(initial(),{kind:'check-removal'},1100),/Acknowledge/)
 assert.throws(()=>advanceReview(initial(),{kind:'resolve',checkedEmpty:true,freshVideo:true,observation:empty},1100),/Start/)
})
test('restoration and video loss only update the view, never resolve automatically',()=>{
 const next=advanceReview(initial(),{kind:'view',value:reviewView(empty)},1100)
 assert.equal(next.phase,'needs-review');assert.equal(next.view,'reference-restored')
 const paused=advanceReview(next,{kind:'view',value:reviewView({...empty,ready:false})},1200)
 assert.equal(paused.view,'unknown');assert.equal(paused.phase,'needs-review')
 assert.equal(reviewView({...empty,reportedParcel:true}),'concern')
})
test('metadata boundary rejects secrets, invalid clocks and inconsistent states',()=>{
 const first=initial()
 for(const bad of [{...first,token:'private'},{...first,frames:[]},{...first,deviceId:'private'},{...first,updatedAt:999},{...first,createdAt:Infinity},{...first,version:0},{...first,acknowledgedAt:1000},{...first,phase:'resolved'},{...first,id:'not-uuid'},{...first,source:'arbitrary'}])assert.throws(()=>reviewMetadata(bad))
 const detached=reviewMetadata(first);detached.phase='resolved';assert.equal(first.phase,'needs-review')
 assert.throws(()=>advanceReview(first,{kind:'view',value:'unknown'},999),/backwards/)
})
test('replacement rejects skipped versions, changed identity, rewritten acknowledgement and downgraded human evidence',()=>{
 const first=initial(),ack=advanceReview(first,{kind:'acknowledge'},1100)
 for(const bad of [{...ack,version:3},{...ack,source:'phone'},{...ack,createdAt:900},{...ack,id:'0a000000-0000-4000-8000-000000000002'},{...ack,phase:'resolved'}])assert.equal(validReviewReplacement(first,bad),false)
 const human=advanceReview(ack,{kind:'view',value:'concern',humanReport:true},1200)
 assert.equal(human.cause,'viewer-report')
 assert.equal(validReviewReplacement(human,{...human,version:human.version+1,cause:'scene-change'}),false)
 assert.equal(validReviewReplacement(human,{...human,version:human.version+1,acknowledgedAt:1150}),false)
 assert.equal(advanceReview(ack,{kind:'acknowledge'},1200),ack)
})
