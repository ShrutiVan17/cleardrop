const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ts=require('typescript')
const c={exports:{}}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/package-detection.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,c)
const {packagesInZone,trackPackage,PACKAGE_LABELS,validDetectionBatch}=c.exports
const zone={x:.3,y:.3,w:.4,h:.4}
const parcel={label:PACKAGE_LABELS[0],score:.6,box:{xmin:.35,ymin:.35,xmax:.55,ymax:.55}}
test('keeps parcel but not person or low-score predictions',()=>{
 assert.equal(packagesInZone([parcel,{...parcel,label:'a person'},{...parcel,score:.05}],zone).length,1)
})
test('suppresses duplicate boxes across package prompts',()=>{
 assert.equal(packagesInZone([parcel,{...parcel,label:PACKAGE_LABELS[1],score:.5}],zone).length,1)
})
test('parcel outside zone does not alert',()=>{
 const boxes=packagesInZone([{...parcel,box:{xmin:0,ymin:0,xmax:.1,ymax:.1}}],zone)
 assert.equal(trackPackage(null,boxes,0),null)
})
test('requires consistent boxes and three seconds, resets on removal',()=>{
 const boxes=packagesInZone([parcel],zone)
 let t=trackPackage(null,boxes,0);assert.equal(t.alert,false)
 t=trackPackage(t,boxes,2000);assert.equal(t.alert,false)
 t=trackPackage(t,boxes,4000);assert.equal(t.alert,true)
 assert.equal(trackPackage(t,[],5000),null)
})
test('old observations and different objects cannot accumulate persistence',()=>{
 const boxes=packagesInZone([parcel],zone)
 let t=trackPackage(null,boxes,0)
 assert.equal(trackPackage(t,boxes,16000).alert,false)
 const other=packagesInZone([{...parcel,box:{xmin:.56,ymin:.56,xmax:.69,ymax:.69}}],zone)
 assert.equal(trackPackage(t,other,4000).alert,false)
})
test('invalid boxes and enormous scene-wide predictions are rejected',()=>{
 assert.equal(packagesInZone([{...parcel,box:{xmin:NaN,ymin:0,xmax:1,ymax:1}},{...parcel,box:{xmin:0,ymin:0,xmax:1,ymax:1}}],zone).length,0)
})
test('duplicate and backwards timestamps cannot manufacture persistence',()=>{
 const boxes=packagesInZone([parcel],zone),previous=trackPackage(null,boxes,1000)
 for(const time of [1000,999,NaN,-1])assert.equal(trackPackage(previous,boxes,time),previous)
})
test('malformed prediction batches fail the boundary',()=>{
 assert.equal(validDetectionBatch([parcel]),true);assert.equal(validDetectionBatch([]),true)
 for(const value of [null,{},[null],[{...parcel,box:null}],[{...parcel,score:Infinity}],[{...parcel,score:1.1}],Array(65).fill(parcel)])assert.equal(validDetectionBatch(value),false)
})
