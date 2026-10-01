'use client'
import { useState } from 'react'
import { Header } from '../components/Header'
import { AppNavigation } from '../components/AppNavigation'
import { DEMO_CASES, demoState } from '@/lib/demo-scenario'

export default function DemoPage(){
  const [index,setIndex]=useState(0)
  const [caseIndex,setCaseIndex]=useState(1)
  const scenario=DEMO_CASES[caseIndex],steps=scenario.steps
  const step=steps[index],state=demoState(index,steps)
  const status = {unknown:'Camera offline',observing:'No zone obstruction in the scripted observations',verifying:'Taking another look',obstructed:'Please check your doorway','checking-clear':'Checking that the parcel is gone'}[state.phase]
  function download(){
    const report={project:'ClearDrop',source:'scripted-simulation',scenario:scenario.id,expected:scenario.expected,notModelAccuracyEvidence:true,steps:steps.slice(0,index+1).map((s,i)=>({...s,state:demoState(i,steps)}))}
    const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}))
    const a=document.createElement('a');a.href=url;a.download='cleardrop-simulation.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  return <><Header connected={false} enabledCount={0} simpleMode/><AppNavigation active="demo"/><main id="main-content" className="cd-shell" tabIndex={-1}>
    <section className="cd-hero"><p className="cd-eyebrow">A QUICK LOOK</p><h1>Not every delivery blocks your way.</h1><p>Three tests of what matters: where a parcel sits, whether it stays, and what we know when video disappears.</p></section>
    <div className="cd-demo-notice"><strong>Demo only</strong><span>Illustrated examples, not live camera footage or an AI accuracy test.</span></div>
    <label className="block mb-5">Choose a test<select className="cd-input" value={caseIndex} onChange={event=>{setCaseIndex(Number(event.target.value));setIndex(0)}}>{DEMO_CASES.map((item,i)=><option key={item.id} value={i}>{item.title}</option>)}</select></label>
    <p className="cd-help mb-5">Expected behavior: {scenario.expected}</p>
    <div className="cd-demo-grid">
      <section className="cd-scene-card" aria-label="Simulated doorstep">
        <div className="cd-card-heading"><span>Front entrance</span><span>{step.kind==='offline'?'Camera offline':'Illustrated demo'}</span></div>
        <svg viewBox="0 0 800 480" role="img" aria-label={`Illustrated doorway: ${step.kind==='offline'?'camera unavailable':step.kind==='inside'?'parcel inside zone':step.kind==='outside'?'parcel outside zone':'no parcel'}`}>
          <defs><linearGradient id="wall" x2="0" y2="1"><stop stopColor="#223e47"/><stop offset="1" stopColor="#12242e"/></linearGradient><pattern id="tiles" width="100" height="60" patternUnits="userSpaceOnUse"><rect width="100" height="60" fill="#1a3038" stroke="#31454d"/></pattern></defs>
          <rect width="800" height="480" fill="url(#wall)"/><rect y="270" width="800" height="210" fill="url(#tiles)"/>
          <rect x="248" y="22" width="304" height="270" rx="5" fill="#101e25" stroke="#49646b" strokeWidth="10"/><rect x="275" y="44" width="250" height="235" fill="#29484d"/><rect x="300" y="65" width="200" height="104" fill="#142e36"/><circle cx="490" cy="215" r="7" fill="#dcc68e"/><path d="M240 290h320l25 24H215z" fill="#6d7f7b"/>
          <rect x="240" y="240" width="320" height="192" rx="7" fill={state.lastKnownObstruction?'#fb923c15':'#5eead415'} stroke={state.lastKnownObstruction?'#fb923c':'#5eead4'} strokeWidth="2" strokeDasharray="8 6"/><text x="255" y="420" fill="#b1eadc" fontSize="13" letterSpacing="2">DOORWAY ZONE</text>
          <rect x="95" y="225" width="70" height="70" rx="8" fill="#71827b"/><path d="M130 225q-65-45-30-95q35 15 30 95q60-45 35-110q-45 30-35 110" fill="#467765"/>
          {(step.kind==='inside'||step.kind==='outside')&&<g transform={`translate(${step.kind==='inside'?320:624},298)`}><path d="M0 15l35-18 125 10-30 20z" fill="#dfbb83"/><path d="M0 15l130 12v70L0 77z" fill="#b88951"/><path d="M130 27l30-20v68l-30 22z" fill="#8e643c"/><path d="M62 5l20 2-30 19v63l-19-2V24z" fill="#f0d4a4"/></g>}
          {step.kind==='offline'&&<g><rect width="800" height="480" fill="#0b1720" opacity=".95"/><text x="400" y="225" textAnchor="middle" fill="#f1b06e" fontSize="25">View unavailable</text><text x="400" y="265" textAnchor="middle" fill="#a3b8c3" fontSize="16">Previous obstruction remains unresolved</text></g>}
        </svg>
        <div className="cd-card-heading"><span>The outlined area is the space to keep clear.</span></div>
      </section>
      <section className="cd-decision-card"><p className="cd-eyebrow">STEP {index+1} OF {steps.length}</p><div className="cd-progress" aria-hidden="true">{steps.map((_,i)=><span key={i} className={i<=index?'is-complete':''}/>)}</div><div aria-live="polite" aria-atomic="true"><h2>{step.title}</h2><p className="cd-step-description">{step.detail}</p><div className={`cd-verdict ${state.lastKnownObstruction?'cd-warning':''}`}><span>{state.lastKnownObstruction?'NEEDS YOUR ATTENTION':'DOORWAY UPDATE'}</span><p>{status}</p></div></div><div className="cd-demo-actions"><button className="cd-button" disabled={index===0} onClick={()=>setIndex(i=>Math.max(0,i-1))}>Back</button><button className="cd-button cd-primary" onClick={()=>setIndex(i=>i===steps.length-1?0:i+1)}>{index===steps.length-1?'Start again':'Next step'}<span aria-hidden="true"> →</span></button></div></section>
    </div>
    <details className="cd-details cd-extra-tools"><summary>How this demo works</summary><p className="mb-4">These scripted examples use the app’s decision rules. It waits for repeated observations before raising or clearing an alert. Losing the video does not mean a parcel is gone. These use scripted observations and simulated timing, not Ring footage or measured parcel dimensions. Real cameras and recognition models can miss things.</p><button className="cd-button" onClick={download}>Download demo report</button></details>
    <p className="cd-help mt-5"><a className="cd-text-link" href="/test">Run the actual camera-processing tests</a> · <a className="cd-text-link" href="/phone">Try a physical box with your phone</a> · <a className="cd-text-link" href="/">Connect Ring preview</a></p>
    <footer className="cd-footer"><p>Always check the doorway yourself. ClearDrop is a prototype, not a safety system.</p></footer>
  </main></>
}
