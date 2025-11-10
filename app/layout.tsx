import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Roman Provinces 3D Map',
  description: 'Interactive 3D map of Roman provinces with Pleiades Places data',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}
