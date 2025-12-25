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

export default function Home() {
  const [mapType, setMapType] = useState<MapType>('2D')
  const [mapKey, setMapKey] = useState(0)

  const handleMapTypeChange = (newType: MapType) => {
    setMapType(newType)
    setMapKey(prev => prev + 1)

    // ControlPanelのチェックボックスをすべてリセット
    setTimeout(() => {
      resetControlPanel()
    }, 100)
  }

  const resetControlPanel = () => {
    // 基本レイヤー
    const provinceToggle = document.getElementById('toggleProvinces') as HTMLInputElement
    if (provinceToggle) provinceToggle.checked = true

    const elevationToggle = document.getElementById('toggleElevation') as HTMLInputElement
    if (elevationToggle) elevationToggle.checked = false

    // 道路・河川
    const mainRoadToggle = document.getElementById('toggleMainRoad') as HTMLInputElement
    if (mainRoadToggle) mainRoadToggle.checked = true

    const secondaryRoadToggle = document.getElementById('toggleSecondaryRoad') as HTMLInputElement
    if (secondaryRoadToggle) secondaryRoadToggle.checked = true

    const seaLaneToggle = document.getElementById('toggleSeaLane') as HTMLInputElement
    if (seaLaneToggle) seaLaneToggle.checked = true

    const riverToggle = document.getElementById('toggleRiver') as HTMLInputElement
    if (riverToggle) riverToggle.checked = true

    // Placesは全てオフ
    const placeToggles = [
      'toggleSettlements', 'toggleVillas', 'toggleForts', 'toggleTemples',
      'toggleStations', 'toggleArchaeological', 'toggleCemetery', 'toggleSanctuary',
      'toggleBridge', 'toggleAqueduct', 'toggleChurch', 'toggleBath',
      'toggleQuarry', 'togglePort', 'toggleTheater', 'toggleAmphitheatre',
      'toggleResidence', 'toggleForum'
    ]

    placeToggles.forEach(id => {
      const toggle = document.getElementById(id) as HTMLInputElement
      if (toggle) toggle.checked = false
    })
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
        {mapType === '2D' ? <LeafletMap key={`leaflet-${mapKey}`} /> : <CesiumMap key={`cesium-${mapKey}`} />}
      </div>

      {/* 右半分: インターフェイス */}
      <div className="w-1/2 h-screen bg-gray-50 overflow-y-auto">
        <ControlPanel />
      </div>
    </main>
  )
}
