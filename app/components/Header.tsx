'use client'
import Link from 'next/link'

interface HeaderProps {
  connected: boolean
  enabledCount: number
  simpleMode?: boolean
}

export function Header({ connected, enabledCount, simpleMode }: HeaderProps) {
  return (
    <header className="cd-app-header">
      <div className="flex items-center gap-3">
        <span className="text-teal-300 text-xl" aria-hidden="true">◈</span>
        <Link href="/" className="text-lg font-bold text-white">ClearDrop <span className="text-sm font-normal text-slate-400">Doorway watch</span></Link>
      </div>
      {simpleMode && <span className="text-xs text-slate-400">Local-first prototype</span>}
      {!simpleMode && (
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2 py-1 rounded-full ${connected ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
            {connected ? '● Connected' : '○ Disconnected'}
          </span>
          {enabledCount > 0 && (
            <span className="text-xs px-2 py-1 rounded-full bg-purple-900 text-purple-300">
              {enabledCount} processor{enabledCount > 1 ? 's' : ''} active
            </span>
          )}
        </div>
      )}
    </header>
  )
}
