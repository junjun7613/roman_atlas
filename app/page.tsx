'use client'

import dynamic from 'next/dynamic'
import ControlPanel from './components/ControlPanel'

const CesiumMap = dynamic(() => import('./components/CesiumMap'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center w-screen h-screen">Loading map...</div>
})

export default function Home() {
  return (
    <main className="relative w-screen h-screen overflow-hidden">
      <CesiumMap />
      <ControlPanel />
    </main>
  )
}
