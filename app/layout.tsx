import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Roman Atlas — 碑文検索',
  description: 'ローマ碑文の座標ベース検索・マッピング・ネットワーク分析',
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
