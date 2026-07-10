import type { Metadata } from 'next'
import {
  Instrument_Sans,
  EB_Garamond,
  Literata,
  IBM_Plex_Mono,
  Noto_Sans_JP,
  Noto_Serif_JP,
} from 'next/font/google'
import './globals.css'

// Latin UI / body sans-serif
const instrumentSans = Instrument_Sans({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-instrument-sans',
  display: 'swap',
})

// Classical serif (Greek + Latin) for headings and inscription text
const ebGaramond = EB_Garamond({
  subsets: ['latin', 'latin-ext', 'greek', 'greek-ext'],
  variable: '--font-eb-garamond',
  display: 'swap',
})

// Long-form reading serif
const literata = Literata({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-literata',
  display: 'swap',
})

// Monospace for data
const plexMono = IBM_Plex_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
})

// CJK gothic
const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  variable: '--font-noto-sans-jp',
  display: 'swap',
})

// CJK mincho (serif)
const notoSerifJP = Noto_Serif_JP({
  subsets: ['latin'],
  variable: '--font-noto-serif-jp',
  display: 'swap',
})

const fontVariables = [
  instrumentSans.variable,
  ebGaramond.variable,
  literata.variable,
  plexMono.variable,
  notoSansJP.variable,
  notoSerifJP.variable,
].join(' ')

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
    <html lang="ja" className={fontVariables}>
      <body>{children}</body>
    </html>
  )
}
