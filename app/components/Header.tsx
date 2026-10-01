'use client'
import Link from 'next/link'

interface HeaderProps {
  connected: boolean
  enabledCount: number
  simpleMode?: boolean
}

export function Header(_props: HeaderProps) {
  return (
    <header className="cd-app-header">
      <Link href="/" className="cd-brand"><span className="cd-brand-mark" aria-hidden="true">⌂</span>ClearDrop</Link>
      <div className="flex items-center gap-5"><span className="cd-brand-caption">A little more room at your door.</span><Link href="/account" className="cd-text-link">Account</Link></div>
    </header>
  )
}
