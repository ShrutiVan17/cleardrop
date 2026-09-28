'use client'
import Link from 'next/link'

type View = 'ring' | 'demo' | 'replay'
export function AppNavigation({active,onSelect}:{active:View;onSelect?:(view:'ring'|'replay')=>void}){
  return <nav aria-label="Main navigation" className="cd-navigation">
    {([{id:'ring',label:'Watch Ring',href:'/'},{id:'demo',label:'Try demo',href:'/demo'},{id:'replay',label:'Test a clip',href:'/?view=replay'}] as const).map(item=><Link key={item.id} href={item.href} aria-current={active===item.id?'page':undefined} onClick={event=>{if(onSelect&&item.id!=='demo'){event.preventDefault();onSelect(item.id)}}}>{item.label}</Link>)}
  </nav>
}
