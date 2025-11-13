'use client'

import dynamic from 'next/dynamic'
import ControlPanel from './components/ControlPanel'

const CesiumMap = dynamic(() => import('./components/CesiumMap'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center w-full h-screen">Loading map...</div>
})

export default function Home() {
  return (
    <main className="flex w-screen h-screen overflow-hidden">
      {/* 左半分: マップ */}
      <div className="w-1/2 h-screen relative">
        <CesiumMap />
      </div>

      {/* 右半分: インターフェイス */}
      <div className="w-1/2 h-screen bg-gray-50 overflow-y-auto">
        <ControlPanel />
      </div>
    </main>
  )
}
