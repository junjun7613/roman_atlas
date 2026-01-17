'use client'

import { useState, useRef, useMemo, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { queryInscriptionNetwork, queryMosaicsByPlaceId, type InscriptionNetworkData, type MosaicDetail } from '../utils/sparql'

const InscriptionNetwork = dynamic(() => import('./InscriptionNetwork'), {
  ssr: false
})

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
  iiifManifest3D?: string
  personCount?: number
  relationshipCount?: number
  careerCount?: number
  benefactionCount?: number
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
  mosaics?: MosaicDetail[]
  mosaicsLoading?: boolean
}

interface ControlPanelProps {
  inscriptionData?: InscriptionData | null
}

export default function ControlPanel({ inscriptionData }: ControlPanelProps) {
  const [activeTab, setActiveTab] = useState<'settings' | 'info'>('settings')
  const [infoSubTab, setInfoSubTab] = useState<'inscriptions' | 'mosaics'>('inscriptions')
  const [selectedPlaceIndex, setSelectedPlaceIndex] = useState<number>(0)
  const [networkEdcsId, setNetworkEdcsId] = useState<string | null>(null)
  const [networkData, setNetworkData] = useState<InscriptionNetworkData[]>([])
  const [networkLoading, setNetworkLoading] = useState(false)
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set())
  const inscriptionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})

  // Store multiple places data when switching to single place view
  const [savedMultiplePlacesData, setSavedMultiplePlacesData] = useState<InscriptionData | null>(null)

  // When inscriptionData changes from 'multiple' to 'single', save the multiple places data
  useEffect(() => {
    if (inscriptionData?.type === 'multiple' && inscriptionData.places && inscriptionData.places.length > 0) {
      setSavedMultiplePlacesData(inscriptionData)
    }
  }, [inscriptionData])

  // Function to return to multiple places list
  const returnToMultiplePlacesList = () => {
    if (savedMultiplePlacesData) {
      const setInscriptionData = (window as any).setInscriptionData
      if (setInscriptionData) {
        setInscriptionData(savedMultiplePlacesData)
      }
    }
  }

  // Filter states
  const [filterType, setFilterType] = useState<'SocialStatus' | 'RelationshipType'>('SocialStatus')
  const [selectedFilters, setSelectedFilters] = useState<Set<string>>(new Set())
  const [availableFilters, setAvailableFilters] = useState<{ [key: string]: string[] }>({})
  const [inscriptionFilterData, setInscriptionFilterData] = useState<{ [edcsId: string]: { socialStatuses: string[], relationshipTypes: string[] } }>({})


  // Load available filters from FilteringData.json
  useEffect(() => {
    const loadFilteringData = async () => {
      try {
        const response = await fetch('/FilteringData.json')
        const data = await response.json()
        setAvailableFilters(data)
      } catch (error) {
        console.error('Error loading FilteringData.json:', error)
      }
    }

    loadFilteringData()
  }, [])

  // Extract social statuses and relationship types from inscriptions when data changes
  useEffect(() => {
    const loadFilterData = async () => {
      if (!inscriptionData?.inscriptions || inscriptionData.inscriptions.length === 0) {
        setInscriptionFilterData({})
        return
      }

      const filterDataMap: { [edcsId: string]: { socialStatuses: string[], relationshipTypes: string[] } } = {}

      // Load data for all inscriptions in parallel
      const promises = inscriptionData.inscriptions.map(async (inscription) => {
        try {
          const networkData = await queryInscriptionNetwork(inscription.edcsId)
          const socialStatuses = new Set<string>()
          const relationshipTypes = new Set<string>()

          networkData.forEach(data => {
            if (data.social_status) {
              // Store full URI
              socialStatuses.add(data.social_status)
            }
            if (data.rel_type) {
              // Store full URI
              relationshipTypes.add(data.rel_type)
            }
          })

          return {
            edcsId: inscription.edcsId,
            socialStatuses: Array.from(socialStatuses),
            relationshipTypes: Array.from(relationshipTypes)
          }
        } catch (error) {
          console.error(`Error loading filter data for ${inscription.edcsId}:`, error)
          return { edcsId: inscription.edcsId, socialStatuses: [], relationshipTypes: [] }
        }
      })

      // Wait for all queries to complete
      const results = await Promise.all(promises)

      // Build filterDataMap from results
      results.forEach(result => {
        filterDataMap[result.edcsId] = {
          socialStatuses: result.socialStatuses,
          relationshipTypes: result.relationshipTypes
        }
      })

      setInscriptionFilterData(filterDataMap)
    }

    loadFilterData()
  }, [inscriptionData?.inscriptions])

  // Filter inscriptions based on selected filters
  const filteredInscriptions = useMemo(() => {
    if (!inscriptionData?.inscriptions) return []
    if (selectedFilters.size === 0) return inscriptionData.inscriptions

    return inscriptionData.inscriptions.filter(inscription => {
      const filterData = inscriptionFilterData[inscription.edcsId]
      if (!filterData) return false

      // Get the appropriate filter values based on filter type
      const values = filterType === 'SocialStatus'
        ? filterData.socialStatuses
        : filterData.relationshipTypes

      if (values.length === 0) return false

      // Show inscription if it has any of the selected filters
      return values.some(value => selectedFilters.has(value))
    })
  }, [inscriptionData?.inscriptions, inscriptionFilterData, selectedFilters, filterType])

  const toggleFilter = (value: string) => {
    setSelectedFilters(prev => {
      const newSet = new Set(prev)
      if (newSet.has(value)) {
        newSet.delete(value)
      } else {
        newSet.add(value)
      }
      return newSet
    })
  }

  // Reset filters when filter type changes
  useEffect(() => {
    setSelectedFilters(new Set())
  }, [filterType])

  const handleShowNetwork = async (edcsId: string) => {
    console.log('handleShowNetwork called with edcsId:', edcsId)
    setNetworkLoading(true)
    setNetworkEdcsId(edcsId)
    try {
      const data = await queryInscriptionNetwork(edcsId)
      console.log('Network data received:', data.length, 'items')
      setNetworkData(data)
    } catch (error) {
      console.error('Error loading network:', error)
      setNetworkData([])
    } finally {
      setNetworkLoading(false)
      console.log('Network loading complete. EdcsId:', edcsId, 'Data length:', networkData.length)
    }
  }

  const handleCloseNetwork = () => {
    const previousEdcsId = networkEdcsId
    setNetworkEdcsId(null)
    setNetworkData([])

    // Scroll to the inscription card after state update
    if (previousEdcsId) {
      setTimeout(() => {
        const element = inscriptionRefs.current[previousEdcsId]
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)
    }
  }

  const toggleDescription = (edcsId: string) => {
    setExpandedDescriptions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(edcsId)) {
        newSet.delete(edcsId)
      } else {
        newSet.add(edcsId)
      }
      return newSet
    })
  }

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
                  <input type="checkbox" id="toggleProvinces" className="mr-3 cursor-pointer w-4 h-4" />
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
                      <input type="checkbox" id="toggleMainRoad" className="mr-3 cursor-pointer w-4 h-4" />
                      <span className="text-[13px] text-[#666]">Main Road (5,929)</span>
                    </label>

                    <label className="flex items-center cursor-pointer mb-2">
                      <input type="checkbox" id="toggleSecondaryRoad" className="mr-3 cursor-pointer w-4 h-4" />
                      <span className="text-[13px] text-[#666]">Secondary Road (9,267)</span>
                    </label>

                    <label className="flex items-center cursor-pointer mb-2">
                      <input type="checkbox" id="toggleSeaLane" className="mr-3 cursor-pointer w-4 h-4" />
                      <span className="text-[13px] text-[#666]">Sea Lane (524)</span>
                    </label>

                    <label className="flex items-center cursor-pointer mb-2">
                      <input type="checkbox" id="toggleRiver" className="mr-3 cursor-pointer w-4 h-4" />
                      <span className="text-[13px] text-[#666]">River (834)</span>
                    </label>
                  </div>
                </div>

                <label className="flex items-center cursor-pointer mb-2">
                  <input type="checkbox" id="toggleElevation" defaultChecked className="mr-3 cursor-pointer w-4 h-4" />
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
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-[18px] font-semibold text-[#333]">
                        {inscriptionData.placeName}
                      </h3>
                      {savedMultiplePlacesData && (
                        <button
                          onClick={returnToMultiplePlacesList}
                          className="px-3 py-1 text-[13px] bg-gray-200 hover:bg-gray-300 text-gray-700 rounded transition-colors"
                        >
                          ← 一覧に戻る
                        </button>
                      )}
                    </div>

                    {/* Sub tabs for Inscriptions and Mosaics */}
                    {!networkEdcsId && !networkLoading && (
                      <div className="mb-3 flex gap-2 border-b border-gray-200">
                        <button
                          onClick={() => setInfoSubTab('inscriptions')}
                          className={`px-4 py-2 text-[14px] font-medium transition-colors ${
                            infoSubTab === 'inscriptions'
                              ? 'text-blue-600 border-b-2 border-blue-600'
                              : 'text-gray-600 hover:text-gray-800'
                          }`}
                        >
                          碑文 {inscriptionData.inscriptions ? `(${inscriptionData.inscriptions.length})` : '(0)'}
                        </button>
                        <button
                          onClick={() => setInfoSubTab('mosaics')}
                          className={`px-4 py-2 text-[14px] font-medium transition-colors ${
                            infoSubTab === 'mosaics'
                              ? 'text-blue-600 border-b-2 border-blue-600'
                              : 'text-gray-600 hover:text-gray-800'
                          }`}
                        >
                          モザイク {inscriptionData.mosaics ? `(${inscriptionData.mosaics.length})` : '(0)'}
                        </button>
                      </div>
                    )}

                    {/* Tab content for Inscriptions */}
                    {infoSubTab === 'inscriptions' && !networkEdcsId && !networkLoading && (
                      <div>
                        {/* 情報とフィルタを横並びに配置 */}
                        <div className="flex gap-4 mb-4">
                          {/* 左側: 基本情報 */}
                          <div className="flex-1 bg-gray-50 p-4 rounded-lg">
                            <p className="text-[14px] text-[#666] mb-2">
                              <strong>PLACE ID:</strong> {inscriptionData.placeId}
                            </p>
                            {inscriptionData.loading ? (
                              <p className="text-[14px] text-[#666]">
                                碑文データを読み込み中...
                              </p>
                            ) : (
                              <p className="text-[14px] text-[#666] mb-0">
                                <strong>碑文数:</strong> {inscriptionData.count}件
                              </p>
                            )}
                          </div>

                          {/* 右側: フィルタ */}
                          <div className="flex-1 bg-blue-50 p-4 rounded-lg">
                            {/* Filter type selector */}
                            <div className="mb-3">
                              <select
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value as 'SocialStatus' | 'RelationshipType')}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-[13px] bg-white"
                              >
                                <option value="SocialStatus">社会的身分で絞り込み</option>
                                <option value="RelationshipType">関係性で絞り込み</option>
                              </select>
                            </div>
                            {availableFilters[filterType]?.length > 0 ? (
                              <div className="space-y-2 max-h-[120px] overflow-y-auto">
                                {availableFilters[filterType].map(filterUri => {
                                  // Extract label from URI (e.g., "http://example.org/status/emperor" -> "emperor")
                                  const filterLabel = filterUri.split('/').pop() || filterUri
                                  return (
                                    <label key={filterUri} className="flex items-center cursor-pointer">
                                      <input
                                        type="checkbox"
                                        className="mr-2 cursor-pointer w-4 h-4"
                                        checked={selectedFilters.has(filterUri)}
                                        onChange={() => toggleFilter(filterUri)}
                                      />
                                      <span className="text-[13px] text-[#555]">{filterLabel}</span>
                                    </label>
                                  )
                                })}
                              </div>
                            ) : (
                              <p className="text-[12px] text-[#666]">フィルタデータがありません</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tab content for Mosaics */}
                    {infoSubTab === 'mosaics' && !networkEdcsId && !networkLoading && (
                      <div>
                        {/* 基本情報 */}
                        <div className="bg-gray-50 p-4 rounded-lg mb-4">
                          <p className="text-[14px] text-[#666] mb-2">
                            <strong>PLACE ID:</strong> {inscriptionData.placeId}
                          </p>
                          {inscriptionData.mosaicsLoading ? (
                            <p className="text-[14px] text-[#666]">
                              モザイクデータを読み込み中...
                            </p>
                          ) : (
                            <p className="text-[14px] text-[#666] mb-0">
                              <strong>モザイク数:</strong> {inscriptionData.mosaics?.length || 0}件
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Display inscription details */}
                    {infoSubTab === 'inscriptions' && !inscriptionData.loading && inscriptionData.inscriptions && inscriptionData.inscriptions.length > 0 && !networkEdcsId && !networkLoading && (
                      <div className="mt-4">
                        <h4 className="text-[16px] font-semibold mb-3 text-[#333]">
                          碑文一覧 ({filteredInscriptions.length}件{selectedFilters.size > 0 ? ` / ${inscriptionData.inscriptions.length}件中` : ''})
                        </h4>
                        <div className="grid grid-cols-2 gap-3 max-h-[600px] overflow-y-auto">
                          {filteredInscriptions.map((inscription, index) => (
                            <div
                              key={index}
                              ref={(el) => { inscriptionRefs.current[inscription.edcsId] = el }}
                              className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow"
                            >
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
                                <div className="mb-2">
                                  <p
                                    className="text-[12px] text-[#666] whitespace-pre-wrap"
                                    style={expandedDescriptions.has(inscription.edcsId) ? {} : {
                                      display: '-webkit-box',
                                      WebkitLineClamp: 3,
                                      WebkitBoxOrient: 'vertical',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis'
                                    }}
                                  >
                                    {inscription.description}
                                  </p>
                                  <button
                                    onClick={() => toggleDescription(inscription.edcsId)}
                                    className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline mt-1"
                                  >
                                    {expandedDescriptions.has(inscription.edcsId) ? '閉じる' : 'もっと見る'}
                                  </button>
                                </div>
                              )}
                              <p className="text-[11px] text-[#888] mb-2">
                                <strong>年代:</strong> {inscription.dating && inscription.dating.trim() !== '' ? inscription.dating : '-'}
                              </p>
                              <div className="grid grid-cols-2 gap-1 text-[10px] text-[#666] mb-2">
                                <div><strong>人物:</strong> {inscription.personCount || 0}</div>
                                <div><strong>関係性:</strong> {inscription.relationshipCount || 0}</div>
                                <div><strong>経歴:</strong> {inscription.careerCount || 0}</div>
                                <div><strong>恵与:</strong> {inscription.benefactionCount || 0}</div>
                              </div>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleShowNetwork(inscription.edcsId)}
                                  className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                                  title="ネットワーク表示"
                                  aria-label="ネットワーク表示"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }}>
                                    <circle cx="12" cy="12" r="2" />
                                    <circle cx="6" cy="6" r="2" />
                                    <circle cx="18" cy="6" r="2" />
                                    <circle cx="6" cy="18" r="2" />
                                    <circle cx="18" cy="18" r="2" />
                                    <line x1="7.5" y1="7.5" x2="10.5" y2="10.5" />
                                    <line x1="13.5" y1="10.5" x2="16.5" y2="7.5" />
                                    <line x1="7.5" y1="16.5" x2="10.5" y2="13.5" />
                                    <line x1="13.5" y1="13.5" x2="16.5" y2="16.5" />
                                  </svg>
                                </button>
                                {inscription.iiifManifest3D && (
                                  <a
                                    href={`https://3-d-annotation-viewer.vercel.app/?manifest=${encodeURIComponent(inscription.iiifManifest3D)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1 text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition-colors inline-flex"
                                    title="3Dモデル表示"
                                    aria-label="3Dモデル表示"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                                      <line x1="12" y1="22.08" x2="12" y2="12" />
                                    </svg>
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Display mosaics */}
                    {infoSubTab === 'mosaics' && !inscriptionData.mosaicsLoading && inscriptionData.mosaics && !networkEdcsId && !networkLoading && (
                      <div className="mt-4">
                        <h4 className="text-[16px] font-semibold mb-3 text-[#333]">
                          モザイク一覧 ({inscriptionData.mosaics.length}件)
                        </h4>
                        {inscriptionData.mosaics.length > 0 ? (
                          <div className="grid grid-cols-2 gap-3 max-h-[600px] overflow-y-auto">
                            {inscriptionData.mosaics.map((mosaic, index) => (
                              <div
                                key={index}
                                className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow"
                              >
                                {mosaic.thumbnail && (
                                  <div className="mb-2">
                                    <img
                                      src={mosaic.thumbnail}
                                      alt={mosaic.label || 'Mosaic thumbnail'}
                                      className="w-full h-auto rounded"
                                      style={{ maxHeight: '150px', objectFit: 'cover' }}
                                    />
                                  </div>
                                )}
                                <div className="mb-2">
                                  <h5 className="text-[13px] font-semibold text-[#333]">
                                    {mosaic.label || 'Untitled Mosaic'}
                                  </h5>
                                </div>
                                <div className="flex gap-1 items-center">
                                  <a
                                    href={mosaic.manifestUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 hover:opacity-70 transition-opacity inline-flex rounded hover:bg-gray-100"
                                    title="IIIF Manifest (クリックでJSONを表示、ドラッグでビューアに投げ込み)"
                                    aria-label="IIIF Manifest"
                                    draggable="true"
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData('text/uri-list', mosaic.manifestUrl)
                                      e.dataTransfer.effectAllowed = 'copy'
                                    }}
                                  >
                                    <img
                                      src="/img/IIIF.png"
                                      alt="IIIF"
                                      style={{ width: '24px', height: '24px' }}
                                    />
                                  </a>
                                  <a
                                    href={`/viewer?manifest=${encodeURIComponent(mosaic.manifestUrl)}&type=mirador`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 hover:opacity-70 transition-opacity inline-flex rounded hover:bg-gray-100"
                                    title="Mirador Viewerで表示"
                                    aria-label="Mirador Viewer"
                                  >
                                    <img
                                      src="/img/mirador.png"
                                      alt="Mirador"
                                      style={{ width: '24px', height: '24px' }}
                                    />
                                  </a>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[14px] text-[#666]">この地名にはモザイクデータがありません。</p>
                        )}
                      </div>
                    )}

                    {/* Display loading state for mosaics */}
                    {infoSubTab === 'mosaics' && inscriptionData.mosaicsLoading && (
                      <div className="mt-4">
                        <p className="text-[14px] text-[#666]">
                          モザイクデータを読み込み中...
                        </p>
                      </div>
                    )}

                    {/* Display network visualization when active */}
                    {networkEdcsId && !networkLoading && (
                      <InscriptionNetwork
                        edcsId={networkEdcsId}
                        networkData={networkData}
                        onClose={handleCloseNetwork}
                      />
                    )}
                    {networkLoading && (
                      <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                        <p className="text-[14px] text-[#666]">ネットワークデータを読み込み中...</p>
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
                            <strong>選択された地点:</strong> {inscriptionData.places?.length || 0}箇所
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
                    {!inscriptionData.loading && inscriptionData.inscriptions && inscriptionData.inscriptions.length > 0 && !networkEdcsId && !networkLoading && (
                      <div className="mt-4">
                        <h4 className="text-[16px] font-semibold mb-3 text-[#333]">
                          碑文一覧 ({filteredInscriptions.length}件{selectedFilters.size > 0 ? ` / ${inscriptionData.inscriptions.length}件中` : ''})
                        </h4>
                        <div className="grid grid-cols-2 gap-3 max-h-[600px] overflow-y-auto">
                          {filteredInscriptions.map((inscription, index) => (
                            <div
                              key={index}
                              ref={(el) => { inscriptionRefs.current[inscription.edcsId] = el }}
                              className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow"
                            >
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
                                <div className="mb-2">
                                  <p
                                    className="text-[12px] text-[#666] whitespace-pre-wrap"
                                    style={expandedDescriptions.has(inscription.edcsId) ? {} : {
                                      display: '-webkit-box',
                                      WebkitLineClamp: 3,
                                      WebkitBoxOrient: 'vertical',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis'
                                    }}
                                  >
                                    {inscription.description}
                                  </p>
                                  <button
                                    onClick={() => toggleDescription(inscription.edcsId)}
                                    className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline mt-1"
                                  >
                                    {expandedDescriptions.has(inscription.edcsId) ? '閉じる' : 'もっと見る'}
                                  </button>
                                </div>
                              )}
                              <p className="text-[11px] text-[#888] mb-2">
                                <strong>年代:</strong> {inscription.dating && inscription.dating.trim() !== '' ? inscription.dating : '-'}
                              </p>
                              <div className="grid grid-cols-2 gap-1 text-[10px] text-[#666] mb-2">
                                <div><strong>人物:</strong> {inscription.personCount || 0}</div>
                                <div><strong>関係性:</strong> {inscription.relationshipCount || 0}</div>
                                <div><strong>経歴:</strong> {inscription.careerCount || 0}</div>
                                <div><strong>恵与:</strong> {inscription.benefactionCount || 0}</div>
                              </div>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleShowNetwork(inscription.edcsId)}
                                  className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                                  title="ネットワーク表示"
                                  aria-label="ネットワーク表示"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }}>
                                    <circle cx="12" cy="12" r="2" />
                                    <circle cx="6" cy="6" r="2" />
                                    <circle cx="18" cy="6" r="2" />
                                    <circle cx="6" cy="18" r="2" />
                                    <circle cx="18" cy="18" r="2" />
                                    <line x1="7.5" y1="7.5" x2="10.5" y2="10.5" />
                                    <line x1="13.5" y1="10.5" x2="16.5" y2="7.5" />
                                    <line x1="7.5" y1="16.5" x2="10.5" y2="13.5" />
                                    <line x1="13.5" y1="13.5" x2="16.5" y2="16.5" />
                                  </svg>
                                </button>
                                {inscription.iiifManifest3D && (
                                  <a
                                    href={`https://3-d-annotation-viewer.vercel.app/?manifest=${encodeURIComponent(inscription.iiifManifest3D)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1 text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition-colors inline-flex"
                                    title="3Dモデル表示"
                                    aria-label="3Dモデル表示"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                                      <line x1="12" y1="22.08" x2="12" y2="12" />
                                    </svg>
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Display network visualization for multiple places */}
                    {(() => {
                      console.log('Network render check (multiple):', { networkEdcsId, networkLoading, dataLength: networkData.length })
                      return null
                    })()}
                    {networkEdcsId && !networkLoading && (
                      <InscriptionNetwork
                        edcsId={networkEdcsId}
                        networkData={networkData}
                        onClose={handleCloseNetwork}
                      />
                    )}
                    {networkLoading && (
                      <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                        <p className="text-[14px] text-[#666]">ネットワークデータを読み込み中...</p>
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
