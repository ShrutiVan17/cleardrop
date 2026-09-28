import './globals.css'

export const metadata = {
  title: 'ClearDrop — Doorway Watch',
  description: 'Ring video with local doorway-zone obstruction monitoring',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-dash-dark text-slate-200">
        {children}
      </body>
    </html>
  )
}
