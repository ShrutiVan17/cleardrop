import './globals.css'

export const metadata = {
  title: 'ClearDrop — Doorway Watch',
  description: 'Ring video with local doorway-zone obstruction monitoring',
  appleWebApp: { capable: true, title: 'ClearDrop', statusBarStyle: 'default' },
}

export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#126b58' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <a href="#main-content" className="cd-skip-link">Skip to content</a>
        {children}
      </body>
    </html>
  )
}
