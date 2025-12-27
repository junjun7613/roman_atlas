'use client'

import { useState } from 'react'

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

interface ControlPanelProps {
  inscriptionData?: InscriptionData | null
}

export default function ControlPanel({ inscriptionData }: ControlPanelProps) {
  const [activeTab, setActiveTab] = useState<'settings' | 'info'>('settings')
  const [selectedPlaceIndex, setSelectedPlaceIndex] = useState<number>(0)

  const toggleSection = (sectionId: string) => {
    const section = document.getElementById(sectionId)
    if (section) {
      section.style.display = section.style.display === 'none' ? 'block' : 'none'
    }
  }

  const toggleAll = (sectionId: string, checked: boolean) => {
    const checkboxes = document.querySelectorAll(`#${sectionId} input[type=checkbox]`)
    checkboxes.forEach((cb: any) => {
      cb.checked = checked
      cb.dispatchEvent(new Event('change'))
    })
  }

  return (
    <div className="w-full h-full bg-white font-sans flex flex-col">
      {/* タブヘッダー */}
      <div className="flex border-b border-gray-300">
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 px-6 py-4 text-[16px] font-semibold transition-colors ${
            activeTab === 'settings'
              ? 'text-[#6688ff] border-b-2 border-[#6688ff] bg-white'
              : 'text-[#888] bg-gray-50 hover:bg-gray-100'
          }`}
        >
          表示設定
        </button>
        <button
          onClick={() => setActiveTab('info')}
          className={`flex-1 px-6 py-4 text-[16px] font-semibold transition-colors ${
            activeTab === 'info'
              ? 'text-[#6688ff] border-b-2 border-[#6688ff] bg-white'
              : 'text-[#888] bg-gray-50 hover:bg-gray-100'
          }`}
        >
          情報
        </button>
      </div>

      {/* タブコンテンツ */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div style={{ display: activeTab === 'settings' ? 'block' : 'none' }}>
          {/* 基本レイヤー */}
          <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <h3
                  className="m-0 text-[#555] text-[18px] font-semibold cursor-pointer"
                  onClick={() => toggleSection('baseLayersContent')}
                >
                  ▼ 基本レイヤー
                </h3>
                <div className="text-[10px]">
                  <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); toggleAll('baseLayersContent', true) }}
                    className="text-[#6688ff] no-underline mr-1.5"
                  >
                    全選択
                  </a>
                  <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); toggleAll('baseLayersContent', false) }}
                    className="text-[#6688ff] no-underline"
                  >
                    全解除
                  </a>
                </div>
              </div>

              <div id="baseLayersContent" className="pl-4">
                <label className="flex items-center cursor-pointer mb-2">
                  <input type="checkbox" id="toggleProvinces" defaultChecked className="mr-3 cursor-pointer w-4 h-4" />
                  <span className="text-[14px] text-[#555]">Province</span>
                </label>

                {/* 道路・河川サブセクション */}
                <div className="mb-3">
                  <div className="flex justify-between items-center mb-2">
                    <h4
                      className="m-0 text-[#666] text-[15px] font-medium cursor-pointer"
                      onClick={() => toggleSection('routesContent')}
                    >
                      ▼ 道路・河川
                    </h4>
                    <div className="text-[10px]">
                      <a
                        href="#"
                        onClick={(e) => { e.preventDefault(); toggleAll('routesContent', true) }}
                        className="text-[#6688ff] no-underline mr-1.5"
                      >
                        全選択
                      </a>
                      <a
                        href="#"
                        onClick={(e) => { e.preventDefault(); toggleAll('routesContent', false) }}
                        className="text-[#6688ff] no-underline"
                      >
                        全解除
                      </a>
                    </div>
                  </div>

                  <div id="routesContent" className="pl-5">
                    <label className="flex items-center cursor-pointer mb-2">
                      <input type="checkbox" id="toggleMainRoad" defaultChecked className="mr-3 cursor-pointer w-4 h-4" />
                      <span className="text-[13px] text-[#666]">Main Road (5,929)</span>
                    </label>

                    <label className="flex items-center cursor-pointer mb-2">
                      <input type="checkbox" id="toggleSecondaryRoad" defaultChecked className="mr-3 cursor-pointer w-4 h-4" />
                      <span className="text-[13px] text-[#666]">Secondary Road (9,267)</span>
                    </label>

                    <label className="flex items-center cursor-pointer mb-2">
                      <input type="checkbox" id="toggleSeaLane" defaultChecked className="mr-3 cursor-pointer w-4 h-4" />
                      <span className="text-[13px] text-[#666]">Sea Lane (524)</span>
                    </label>

                    <label className="flex items-center cursor-pointer mb-2">
                      <input type="checkbox" id="toggleRiver" defaultChecked className="mr-3 cursor-pointer w-4 h-4" />
                      <span className="text-[13px] text-[#666]">River (834)</span>
                    </label>
                  </div>
                </div>

                <label className="flex items-center cursor-pointer mb-2">
                  <input type="checkbox" id="toggleElevation" className="mr-3 cursor-pointer w-4 h-4" />
                  <span className="text-[14px] text-[#555]">標高マップ</span>
                </label>
              </div>
            </div>

          {/* Pleiades Places */}
          <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <h3
                  className="m-0 text-[#555] text-[18px] font-semibold cursor-pointer"
                  onClick={() => toggleSection('pleiadesContent')}
                >
                  ▼ Places
                </h3>
                <div className="text-[10px]">
                  <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); toggleAll('pleiadesContent', true) }}
                    className="text-[#6688ff] no-underline mr-1.5"
                  >
                    全選択
                  </a>
                  <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); toggleAll('pleiadesContent', false) }}
                    className="text-[#6688ff] no-underline"
                  >
                    全解除
                  </a>
                </div>
              </div>

              <div id="pleiadesContent" className="pl-4">
                <label className="flex items-center cursor-pointer mb-2"><input type="checkbox" id="toggleSettlements" className="mr-3 cursor-pointer w-4 h-4" /><span className="text-[14px] text-[#555]">都市・集落</span></label>
                <label className="flex items-center cursor-pointer mb-2"><input type="checkbox" id="toggleVillas" className="mr-3 cursor-pointer w-4 h-4" /><span className="text-[14px] text-[#555]">ヴィラ</span></label>
                <label className="flex items-center cursor-pointer mb-2"><input type="checkbox" id="toggleForts" className="mr-3 cursor-pointer w-4 h-4" /><span className="text-[14px] text-[#555]">要塞</span></label>
                <label className="flex items-center cursor-pointer mb-2"><input type="checkbox" id="toggleTemples" className="mr-3 cursor-pointer w-4 h-4" /><span className="text-[14px] text-[#555]">神殿</span></label>
                <label className="flex items-center cursor-pointer mb-2"><input type="checkbox" id="toggleStations" className="mr-3 cursor-pointer w-4 h-4" /><span className="text-[14px] text-[#555]">駅</span></label>
                <label className="flex items-center cursor-pointer mb-2"><input type="checkbox" id="toggleArchaeological" className="mr-3 cursor-pointer w-4 h-4" /><span className="text-[14px] text-[#555]">遺跡</span></label>
                <label className="flex items-center cursor-pointer mb-2"><input type="checkbox" id="toggleCemetery" className="mr-3 cursor-pointer w-4 h-4" /><span className="text-[14px] text-[#555]">墓地</span></label>
                <label className="flex items-center cursor-pointer mb-2"><input type="checkbox" id="toggleSanctuary" className="mr-3 cursor-pointer w-4 h-4" /><span className="text-[14px] text-[#555]">聖域</span></label>
                <label className="flex items-center cursor-pointer mb-2"><input type="checkbox" id="toggleBridge" className="mr-3 cursor-pointer w-4 h-4" /><span className="text-[14px] text-[#555]">橋</span></label>
                <label className="flex items-center cursor-pointer mb-2"><input type="checkbox" id="toggleAqueduct" className="mr-3 cursor-pointer w-4 h-4" /><span className="text-[14px] text-[#555]">水道橋</span></label>
                <label className="flex items-center cursor-pointer mb-2"><input type="checkbox" id="toggleChurch" className="mr-3 cursor-pointer w-4 h-4" /><span className="text-[14px] text-[#555]">教会</span></label>
                <label className="flex items-center cursor-pointer mb-2"><input type="checkbox" id="toggleBath" className="mr-3 cursor-pointer w-4 h-4" /><span className="text-[14px] text-[#555]">浴場</span></label>
                <label className="flex items-center cursor-pointer mb-2"><input type="checkbox" id="toggleQuarry" className="mr-3 cursor-pointer w-4 h-4" /><span className="text-[14px] text-[#555]">採石場</span></label>
                <label className="flex items-center cursor-pointer mb-2"><input type="checkbox" id="togglePort" className="mr-3 cursor-pointer w-4 h-4" /><span className="text-[14px] text-[#555]">港</span></label>
                <label className="flex items-center cursor-pointer mb-2"><input type="checkbox" id="toggleTheater" className="mr-3 cursor-pointer w-4 h-4" /><span className="text-[14px] text-[#555]">劇場</span></label>
                <label className="flex items-center cursor-pointer mb-2"><input type="checkbox" id="toggleAmphitheatre" className="mr-3 cursor-pointer w-4 h-4" /><span className="text-[14px] text-[#555]">円形闘技場</span></label>
                <label className="flex items-center cursor-pointer mb-2"><input type="checkbox" id="toggleResidence" className="mr-3 cursor-pointer w-4 h-4" /><span className="text-[14px] text-[#555]">住居</span></label>
                <label className="flex items-center cursor-pointer mb-2"><input type="checkbox" id="toggleForum" className="mr-3 cursor-pointer w-4 h-4" /><span className="text-[14px] text-[#555]">フォルム</span></label>
              </div>
          </div>
        </div>
        <div style={{ display: activeTab === 'info' ? 'block' : 'none' }}>
          <div className="text-[16px] text-[#555]">
            {inscriptionData ? (
              <div>
                {inscriptionData.type === 'single' ? (
                  <div>
                    <h3 className="text-[18px] font-semibold mb-4 text-[#333]">
                      {inscriptionData.placeName}
                    </h3>
                    <div className="bg-gray-50 p-4 rounded-lg mb-4">
                      <p className="text-[14px] text-[#666] mb-2">
                        <strong>PLACE ID:</strong> {inscriptionData.placeId}
                      </p>
                      {inscriptionData.loading ? (
                        <p className="text-[14px] text-[#666]">
                          碑文データを読み込み中...
                        </p>
                      ) : (
                        <p className="text-[14px] text-[#666] mb-4">
                          <strong>碑文数:</strong> {inscriptionData.count}件
                        </p>
                      )}
                    </div>

                    {/* Display inscription details */}
                    {!inscriptionData.loading && inscriptionData.inscriptions && inscriptionData.inscriptions.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-[16px] font-semibold mb-3 text-[#333]">碑文一覧</h4>
                        <div className="grid grid-cols-2 gap-3 max-h-[600px] overflow-y-auto">
                          {inscriptionData.inscriptions.map((inscription, index) => (
                            <div key={index} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
                              <div className="mb-2">
                                <a
                                  href={inscription.edcsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[13px] font-semibold text-blue-600 hover:text-blue-800 no-underline"
                                >
                                  {inscription.edcsId}
                                </a>
                              </div>
                              {inscription.description && inscription.description.trim() !== '' && (
                                <p className="text-[12px] text-[#666] mb-2" style={{
                                  display: '-webkit-box',
                                  WebkitLineClamp: 3,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}>
                                  {inscription.description}
                                </p>
                              )}
                              {inscription.dating && inscription.dating.trim() !== '' && (
                                <p className="text-[11px] text-[#888]">
                                  <strong>年代:</strong> {inscription.dating}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <h3 className="text-[18px] font-semibold mb-4 text-[#333]">
                      選択された領域
                    </h3>
                    <div className="bg-gray-50 p-4 rounded-lg mb-4">
                      {inscriptionData.loading ? (
                        <p className="text-[14px] text-[#666]">
                          碑文データを読み込み中...
                        </p>
                      ) : (
                        <>
                          <p className="text-[14px] text-[#666] mb-4">
                            <strong>合計碑文数:</strong> {inscriptionData.count}件
                          </p>
                          <p className="text-[14px] text-[#666] mb-2">
                            <strong>選択され��地点:</strong> {inscriptionData.places?.length || 0}箇所
                          </p>

                          {/* Place selector for multiple places */}
                          {inscriptionData.places && inscriptionData.places.length > 0 && (
                            <div className="mt-4">
                              <label className="block text-[14px] font-semibold mb-2 text-[#333]">
                                地点を選択:
                              </label>
                              <select
                                value={selectedPlaceIndex}
                                onChange={(e) => {
                                  const index = parseInt(e.target.value, 10)
                                  setSelectedPlaceIndex(index)
                                  // Trigger loading of inscriptions for selected place
                                  const selectedPlace = inscriptionData.places![index]
                                  if (window && (window as any).loadInscriptionsForPlace) {
                                    (window as any).loadInscriptionsForPlace(selectedPlace.placeId, selectedPlace.placeName)
                                  }
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-[14px] text-[#555] bg-white"
                              >
                                {inscriptionData.places.map((place, index) => (
                                  <option key={index} value={index}>
                                    {place.placeName} ({place.count}件)
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Display inscription details for selected place */}
                    {!inscriptionData.loading && inscriptionData.inscriptions && inscriptionData.inscriptions.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-[16px] font-semibold mb-3 text-[#333]">碑文一覧</h4>
                        <div className="grid grid-cols-2 gap-3 max-h-[600px] overflow-y-auto">
                          {inscriptionData.inscriptions.map((inscription, index) => (
                            <div key={index} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
                              <div className="mb-2">
                                <a
                                  href={inscription.edcsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[13px] font-semibold text-blue-600 hover:text-blue-800 no-underline"
                                >
                                  {inscription.edcsId}
                                </a>
                              </div>
                              {inscription.description && inscription.description.trim() !== '' && (
                                <p className="text-[12px] text-[#666] mb-2" style={{
                                  display: '-webkit-box',
                                  WebkitLineClamp: 3,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}>
                                  {inscription.description}
                                </p>
                              )}
                              {inscription.dating && inscription.dating.trim() !== '' && (
                                <p className="text-[11px] text-[#888]">
                                  <strong>年代:</strong> {inscription.dating}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-[14px] text-[#666]">
                地名をクリック、または矩形選択で領域を指定すると、関連する碑文情報が表示されます
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
