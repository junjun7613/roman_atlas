'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import ControlPanel from './components/ControlPanel'

const CesiumMap = dynamic(() => import('./components/CesiumMap'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center w-full h-screen">Loading 3D map...</div>
})

const LeafletMap = dynamic(() => import('./components/LeafletMap'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center w-full h-screen">Loading 2D map...</div>
})

type MapType = '2D' | '3D'

interface PlaceDetail {
  placeName: string
  placeId: string
  count: number
}

interface InscriptionDetailData {
  edcsId: string
  description: string
  dating: string
  edcsUrl: string
}

interface InscriptionData {
  type: 'single' | 'multiple'
  placeName?: string
  placeId?: string
  customLocationId?: string
  count: number
  loading: boolean
  places?: PlaceDetail[]
  inscriptions?: InscriptionDetailData[]
}

export default function Home() {
  const [mapType, setMapType] = useState<MapType>('2D')
  const [inscriptionData, setInscriptionData] = useState<InscriptionData | null>(null)

  // Expose setInscriptionData to window for map components to use
  if (typeof window !== 'undefined') {
    (window as any).setInscriptionData = setInscriptionData
  }

  const handleMapTypeChange = (newType: MapType) => {
    setMapType(newType)
    // Reset inscription data when switching maps
    setInscriptionData(null)
  }

  return (
    <main className="flex w-screen h-screen overflow-hidden">
      {/* 左半分: マップ */}
      <div className="w-1/2 h-screen relative">
        {/* マップタイプ切り替えボタン */}
        <div className="absolute top-4 left-20 z-[1000] bg-white rounded-lg shadow-lg">
          <div className="flex">
            <button
              onClick={() => handleMapTypeChange('2D')}
              className={`px-4 py-2 rounded-l-lg font-medium transition-colors ${
                mapType === '2D'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              2D Map
            </button>
            <button
              onClick={() => handleMapTypeChange('3D')}
              className={`px-4 py-2 rounded-r-lg font-medium transition-colors ${
                mapType === '3D'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              3D Map
            </button>
          </div>
        </div>

        {/* マップ表示 */}
        {mapType === '2D' ? <LeafletMap key="leaflet" /> : <CesiumMap key="cesium" />}
      </div>

      {/* 右半分: インターフェイス */}
      <div className="w-1/2 h-screen bg-gray-50 overflow-y-auto">
        <ControlPanel inscriptionData={inscriptionData} />
      </div>
    </main>
  )
}
