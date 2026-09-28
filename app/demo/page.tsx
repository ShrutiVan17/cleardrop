'use client'
import { useState } from 'react'
import { Header } from '../components/Header'
import { AppNavigation } from '../components/AppNavigation'
import { DEMO_STEPS, demoState } from '@/lib/demo-scenario'
import { doorwayStatus } from '@/lib/doorway-state'

export default function DemoPage(){
  const [index,setIndex]=useState(0)
  const step=DEMO_STEPS[index],state=demoState(index)
  function download(){
    const report={project:'ClearDrop',source:'scripted-simulation',notModelAccuracyEvidence:true,steps:DEMO_STEPS.slice(0,index+1).map((s,i)=>({...s,state:demoState(i)}))}
    const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}))
    const a=document.createElement('a');a.href=url;a.download='cleardrop-simulation.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  return <><Header connected={false} enabledCount={0} simpleMode/><AppNavigation active="demo"/><main className="cd-shell">
    <section className="cd-hero"><h1>Keep the doorway clear.</h1><p>See how ClearDrop handles a parcel near the door, a lost connection, and removal.</p></section>
    <div className="cd-demo-notice"><strong>Simulation</strong> · Scripted examples using the app’s decision rules. Not live Ring video or proof of AI accuracy.</div>
    <div className="cd-demo-grid">
      <section className="cd-scene-card" aria-label="Simulated doorstep">
        <div className="cd-card-heading"><span>Front entrance / scenario preview</span><span>{step.kind==='offline'?'NO FRESH VIEW':'ILLUSTRATED SCENE'}</span></div>
        <svg viewBox="0 0 800 480" role="img" aria-label={`Illustrated doorway: ${step.kind==='offline'?'camera unavailable':step.kind==='inside'?'parcel inside zone':step.kind==='outside'?'parcel outside zone':'no parcel'}`}>
          <defs><linearGradient id="wall" x2="0" y2="1"><stop stopColor="#223e47"/><stop offset="1" stopColor="#12242e"/></linearGradient><pattern id="tiles" width="100" height="60" patternUnits="userSpaceOnUse"><rect width="100" height="60" fill="#1a3038" stroke="#31454d"/></pattern></defs>
          <rect width="800" height="480" fill="url(#wall)"/><rect y="270" width="800" height="210" fill="url(#tiles)"/>
          <rect x="248" y="22" width="304" height="270" rx="5" fill="#101e25" stroke="#49646b" strokeWidth="10"/><rect x="275" y="44" width="250" height="235" fill="#29484d"/><rect x="300" y="65" width="200" height="104" fill="#142e36"/><circle cx="490" cy="215" r="7" fill="#dcc68e"/><path d="M240 290h320l25 24H215z" fill="#6d7f7b"/>
          <rect x="240" y="240" width="320" height="192" rx="7" fill={state.lastKnownObstruction?'#fb923c15':'#5eead415'} stroke={state.lastKnownObstruction?'#fb923c':'#5eead4'} strokeWidth="2" strokeDasharray="8 6"/><text x="255" y="420" fill="#b1eadc" fontSize="13" letterSpacing="2">DOORWAY ZONE</text>
          <rect x="95" y="225" width="70" height="70" rx="8" fill="#71827b"/><path d="M130 225q-65-45-30-95q35 15 30 95q60-45 35-110q-45 30-35 110" fill="#467765"/>
          {(step.kind==='inside'||step.kind==='outside')&&<g transform={`translate(${step.kind==='inside'?320:624},298)`}><path d="M0 15l35-18 125 10-30 20z" fill="#dfbb83"/><path d="M0 15l130 12v70L0 77z" fill="#b88951"/><path d="M130 27l30-20v68l-30 22z" fill="#8e643c"/><path d="M62 5l20 2-30 19v63l-19-2V24z" fill="#f0d4a4"/></g>}
          {step.kind==='offline'&&<g><rect width="800" height="480" fill="#0b1720" opacity=".95"/><text x="400" y="225" textAnchor="middle" fill="#f1b06e" fontSize="25">View unavailable</text><text x="400" y="265" textAnchor="middle" fill="#a3b8c3" fontSize="16">Previous obstruction remains unresolved</text></g>}
        </svg>
        <div className="cd-card-heading"><span>ON-DEVICE RULES</span><span>No video uploaded · No identity recognition</span></div>
      </section>
      <section className="cd-decision-card"><p className="cd-eyebrow">{String(index+1).padStart(2,'0')} / 07 · DECISION WALKTHROUGH</p><h2>{step.title}</h2><p>{step.detail}</p><div className={`cd-verdict ${state.lastKnownObstruction?'cd-warning':''}`} role="status" aria-live="polite"><span>{state.phase.replace('-',' ').toUpperCase()}</span><p>{doorwayStatus(state)}</p></div><div className="flex flex-wrap gap-2"><button className="cd-button" disabled={index===0} onClick={()=>setIndex(i=>i-1)}>Previous</button><button className="cd-button cd-primary" disabled={index===DEMO_STEPS.length-1} onClick={()=>setIndex(i=>i+1)}>Next scenario</button>{index===6&&<button className="cd-button" onClick={()=>setIndex(0)}>Restart</button>}</div></section>
    </div>
    <details className="cd-details my-5"><summary>All steps and technical details</summary><nav className="cd-step-list" aria-label="Scenario steps">{DEMO_STEPS.map((s,i)=><button key={s.title} aria-current={index===i?'step':undefined} onClick={()=>setIndex(i)}><span>0{i+1}</span>{s.title}</button>)}</nav><p className="text-sm text-slate-400 mb-4">Repeated parcel overlap triggers review. Lost video keeps an earlier obstruction unresolved. Removal needs three non-overlapping scans across five seconds. This tests decision rules, not recognition accuracy.</p><button className="cd-button" onClick={download}>Download simulation report</button></details>
    <footer className="cd-footer"><p>Local processing · Human review required · Not a safety system</p></footer>
  </main></>
}
