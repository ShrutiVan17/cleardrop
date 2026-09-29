'use client'
import Link from 'next/link'

type View = 'ring' | 'demo' | 'replay'
export function AppNavigation({active,onSelect}:{active:View;onSelect?:(view:'ring'|'replay')=>void}){
  return <nav aria-label="Main navigation" className="cd-navigation">
    {([{id:'ring',label:'My doorway',href:'/'},{id:'demo',label:'Try a demo',href:'/demo'}] as const).map(item=><Link key={item.id} href={item.href} aria-current={active===item.id?'page':undefined} onClick={event=>{if(onSelect&&item.id==='ring'){event.preventDefault();onSelect(item.id)}}}>{item.label}</Link>)}
  </nav>
}

