const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm')
const ts=require('typescript'),React=require('react')
const {renderToStaticMarkup:render}=require('react-dom/server')
const root=path.resolve(__dirname,'..')
function load(relative){
  const file=path.resolve(root,relative),exports={}
  const context={exports,require(name){
    if(name==='next/link')return {__esModule:true,default:({children,...props})=>React.createElement('a',props,children)}
    if(name.endsWith('/usePackageDetection'))return {usePackageDetection:()=>({alert:false,status:'off',boxes:[],message:'Optional model is off',scans:0,latency:null})}
    if(name.startsWith('.')||name.startsWith('@/')){
      const target=name.startsWith('@/')?path.join(root,name.slice(2)):path.resolve(path.dirname(file),name)
      const full=['.tsx','.ts'].map(ext=>target+ext).find(p=>fs.existsSync(p))
      return load(path.relative(root,full))
    }
    return require(name)
  }}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,context)
  return exports
}
test('phone mode is isolated from Ring and explicit about limits',()=>{
  const {default:Phone}=load('app/phone/page.tsx')
  const html=render(React.createElement(Phone))
  assert.match(html,/Start phone camera/);assert.match(html,/No Ring device or Ring token needed/);assert.match(html,/not a remote camera feed/)
  assert.equal((html.split('<details')[0].match(/<button /g)||[]).length,1)
  const source=fs.readFileSync(path.join(root,'app/phone/page.tsx'),'utf8')
  assert.doesNotMatch(source,/\/api\/ring/);assert.match(source,/visibilitychange/)
})
test('public home offers token-free demo and phone paths without camera fetching',()=>{
  const {default:Home}=load('app/page.tsx')
  const html=render(React.createElement(Home))
  assert.match(html,/href="\/test"[^>]*>Try the working demo/)
  assert.match(html,/href="\/phone"[^>]*>Use my phone camera/)
  assert.match(html,/not live Ring footage/);assert.match(html,/href="\/doorway"/)
  assert.doesNotMatch(fs.readFileSync(path.join(root,'app/page.tsx'),'utf8'),/fetch\(|RingConnection|useWebRTCStream/)
})
test('Ring connection asks only for a masked developer token and discloses hardware limits',()=>{
  const {RingConnection}=load('app/components/RingConnection.tsx')
  const html=render(React.createElement(RingConnection,{onConnected:()=>{}}))
  assert.match(html,/type="password"/);assert.match(html,/Connect Ring/);assert.match(html,/Never enter your Amazon password/);assert.match(html,/does not yet provide that sign-in flow/)
})

test('main navigation offers only doorway and demo',()=>{
  const {AppNavigation}=load('app/components/AppNavigation.tsx')
  const html=render(React.createElement(AppNavigation,{active:'demo'}))
  assert.equal((html.match(/<a /g)||[]).length,2)
  assert.match(html,/My doorway/)
  assert.match(html,/aria-current="page"[^>]*>Try a demo/)
  assert.doesNotMatch(html,/Test a clip/)
})
test('demo clearly labels simulation and starts with two visible action buttons',()=>{
  const {default:Demo}=load('app/demo/page.tsx')
  const html=render(React.createElement(Demo))
  assert.match(html,/Demo only/)
  assert.match(html,/not live camera footage/)
  assert.equal((html.match(/<option /g)||[]).length,3)
  assert.match(html,/id="main-content"/)
  const mainActions=html.split('<details')[0]
  assert.equal((mainActions.match(/<button /g)||[]).length,2)
  assert.match(mainActions,/<button[^>]*disabled=""[^>]*>Back/)
  assert.match(html,/aria-live="polite" aria-atomic="true"/)
})
test('paused camera hides unavailable setup actions',()=>{
  const {ClearDrop}=load('app/components/ClearDrop.tsx')
  const html=render(React.createElement(ClearDrop,{videoRef:{current:null},active:false}))
  assert.match(html,/Start the camera to begin/)
  assert.doesNotMatch(html.split('<details')[0],/<button/)
  assert.match(html,/Experimental parcel recognition/)
})
test('camera setup offers a manual existing-parcel path and gates empty calibration',()=>{
 const {ClearDrop}=load('app/components/ClearDrop.tsx')
 const html=render(React.createElement(ClearDrop,{videoRef:{current:null},active:true}))
 assert.match(html,/A parcel is already here/)
 assert.match(html,/I visually checked that the marked area is empty/)
 assert.match(html,/<button[^>]*disabled=""[^>]*>Area is empty — start watching/)
 const source=fs.readFileSync(path.join(root,'app/components/ClearDrop.tsx'),'utf8')
 assert.match(source,/This is your visual report, not an AI detection/)
 assert.match(source,/reportedParcelRemoved/)
})

test('monitoring uses one shared adapter and keeps review-history export in advanced controls',()=>{
 const {ClearDrop}=load('app/components/ClearDrop.tsx')
 const html=render(React.createElement(ClearDrop,{videoRef:{current:null},active:false}))
 assert.doesNotMatch(html.split('<details')[0],/Download review history/)
 assert.match(html,/Download review history/);assert.match(html,/not a tamper-proof audit log/)
 const source=fs.readFileSync(path.join(root,'app/components/ClearDrop.tsx'),'utf8')
 assert.match(source,/useChangeMonitor/);assert.doesNotMatch(source,/setReady|setBlocked|setUnresolved|setInterval/)
 const adapter=fs.readFileSync(path.join(root,'app/hooks/useChangeMonitor.ts'),'utf8')
 assert.match(adapter,/visibilitychange/);assert.match(adapter,/clearInterval/);assert.match(adapter,/frame-stalled/)
 assert.doesNotMatch(adapter,/fetch\(|localStorage|sessionStorage/)
})
test('primary and secondary text colors meet normal-text contrast',()=>{
  function luminance(hex){const rgb=hex.match(/\w\w/g).map(c=>parseInt(c,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]}
  for(const [foreground,background] of [['ffffff','126b58'],['526761','f7f8f4'],['203a36','ffffff'],['805319','fff2dc']]){
    const values=[luminance(foreground),luminance(background)].sort((a,b)=>b-a)
    assert.ok((values[0]+.05)/(values[1]+.05)>=4.5,`${foreground} on ${background}`)
  }
})
