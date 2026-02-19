'use client'

import { useState, useRef, useMemo, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { queryInscriptionNetwork, queryInscriptionsFilterData, queryInscriptionByEdcsId, queryMosaicsByPlaceId, queryAverageAgeAtDeath, queryNomenFrequency, queryBenefactionTypeFrequency, queryBenefactionObjectTypeFrequency, queryDivinityTypeFrequency, queryBenefactionCostStatistics, queryBenefactionObjectCostStatistics, queryTopBenefactionsByCost, queryInscriptionsByCostRange, queryInscriptionsByNomen, queryInscriptionsByBenefactionType, queryInscriptionsByBenefactionObjectType, queryInscriptionsByDivinityType, type InscriptionNetworkData, type MosaicDetail, type AgeAtDeathData, type NomenFrequency, type BenefactionTypeFrequency, type BenefactionObjectTypeFrequency, type DivinityTypeFrequency, type BenefactionCostStatistics, type BenefactionObjectCostStatistics, type TopBenefaction } from '../utils/sparql'

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
  iiifManifest2D?: string
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
  const [infoSubTab, setInfoSubTab] = useState<'inscriptions' | 'mosaics' | 'statistics'>('inscriptions')
  const [statisticsTab, setStatisticsTab] = useState<'age' | 'clan' | 'benefaction' | 'divinity'>('age')
  const [selectedPlaceIndex, setSelectedPlaceIndex] = useState<number>(0)
  const [networkEdcsId, setNetworkEdcsId] = useState<string | null>(null)
  const [networkData, setNetworkData] = useState<InscriptionNetworkData[]>([])
  const [networkLoading, setNetworkLoading] = useState(false)
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set())
  const inscriptionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})

  // Inscription detail view (similar to network view)
  const [detailViewEdcsId, setDetailViewEdcsId] = useState<string | null>(null)
  const [detailViewData, setDetailViewData] = useState<{
    edcsId: string
    text: string
    comment: string
    bibliographicCitation: string
    datingFrom: number | null
    datingTo: number | null
    province: string
    place: string
  } | null>(null)
  const [detailViewLoading, setDetailViewLoading] = useState(false)

  // Store multiple places data when switching to single place view
  const [savedMultiplePlacesData, setSavedMultiplePlacesData] = useState<InscriptionData | null>(null)

  // Store statistics data
  const [ageAtDeathData, setAgeAtDeathData] = useState<AgeAtDeathData | null>(null)
  const [ageAtDeathLoading, setAgeAtDeathLoading] = useState(false)
  const [nomenFrequencyData, setNomenFrequencyData] = useState<NomenFrequency[]>([])
  const [nomenFrequencyLoading, setNomenFrequencyLoading] = useState(false)
  const [benefactionTypeData, setBenefactionTypeData] = useState<BenefactionTypeFrequency[]>([])
  const [benefactionTypeLoading, setBenefactionTypeLoading] = useState(false)
  const [selectedBenefactionType, setSelectedBenefactionType] = useState<string | null>(null)
  const [benefactionObjectTypeData, setBenefactionObjectTypeData] = useState<BenefactionObjectTypeFrequency[]>([])
  const [benefactionObjectTypeLoading, setBenefactionObjectTypeLoading] = useState(false)
  const [divinityTypeData, setDivinityTypeData] = useState<DivinityTypeFrequency[]>([])
  const [divinityTypeLoading, setDivinityTypeLoading] = useState(false)

  // Cost statistics data
  const [benefactionCostData, setBenefactionCostData] = useState<BenefactionCostStatistics[]>([])
  const [benefactionCostLoading, setBenefactionCostLoading] = useState(false)
  const [benefactionObjectCostData, setBenefactionObjectCostData] = useState<BenefactionObjectCostStatistics[]>([])
  const [benefactionObjectCostLoading, setBenefactionObjectCostLoading] = useState(false)
  const [topBenefactionsData, setTopBenefactionsData] = useState<TopBenefaction[]>([])
  const [topBenefactionsLoading, setTopBenefactionsLoading] = useState(false)

  // Cost filter
  const [costFilter, setCostFilter] = useState<{ min: number | null; max: number | null }>({ min: null, max: null })

  // Statistics filter
  const [statisticsFilter, setStatisticsFilter] = useState<{
    type: 'nomen' | 'benefactionType' | 'objectType' | 'divinityType' | 'costRange' | null
    value: string | { min: number | null; max: number | null } | null
    benefactionTypeForObjectType?: string | null
  }>({ type: null, value: null, benefactionTypeForObjectType: null })
  const [statisticsFilteredEdcsIds, setStatisticsFilteredEdcsIds] = useState<string[]>([])
  const [statisticsFilterLoading, setStatisticsFilterLoading] = useState(false)

  // When inscriptionData changes from 'multiple' to 'single', save the multiple places data
  useEffect(() => {
    if (inscriptionData?.type === 'multiple' && inscriptionData.places && inscriptionData.places.length > 0) {
      setSavedMultiplePlacesData(inscriptionData)
    }
  }, [inscriptionData])

  // Load statistics data when places are selected
  useEffect(() => {
    const loadData = async () => {
      if (!inscriptionData) return

      let pleiadesIds: string[] = []
      if (inscriptionData.type === 'single' && inscriptionData.placeId) {
        pleiadesIds = [inscriptionData.placeId]
      } else if (inscriptionData.type === 'multiple' && inscriptionData.places && inscriptionData.places.length > 0) {
        pleiadesIds = inscriptionData.places.map(p => p.placeId)
      }

      if (pleiadesIds.length === 0) return

      // Load age data
      setAgeAtDeathLoading(true)
      const ageData = await queryAverageAgeAtDeath(pleiadesIds)
      setAgeAtDeathData(ageData)
      setAgeAtDeathLoading(false)

      // Load nomen data
      setNomenFrequencyLoading(true)
      const nomenData = await queryNomenFrequency(pleiadesIds)
      setNomenFrequencyData(nomenData)
      setNomenFrequencyLoading(false)

      // Load benefaction data
      setBenefactionTypeLoading(true)
      const benefData = await queryBenefactionTypeFrequency(pleiadesIds)
      setBenefactionTypeData(benefData)
      setBenefactionTypeLoading(false)

      // Load divinity data
      setDivinityTypeLoading(true)
      const divinityData = await queryDivinityTypeFrequency(pleiadesIds)
      setDivinityTypeData(divinityData)
      setDivinityTypeLoading(false)

      // Load benefaction cost statistics
      setBenefactionCostLoading(true)
      const costData = await queryBenefactionCostStatistics(pleiadesIds)
      console.log('Benefaction cost data:', costData)
      setBenefactionCostData(costData)
      setBenefactionCostLoading(false)

      // Load top benefactions by cost
      setTopBenefactionsLoading(true)
      const topData = await queryTopBenefactionsByCost(pleiadesIds, 10)
      setTopBenefactionsData(topData)
      setTopBenefactionsLoading(false)
    }

    loadData()
  }, [inscriptionData?.type, inscriptionData?.placeId, inscriptionData?.places])

  // Load object types when benefaction type selected
  useEffect(() => {
    const loadObjectTypes = async () => {
      if (!selectedBenefactionType || !inscriptionData) return

      let pleiadesIds: string[] = []
      if (inscriptionData.type === 'single' && inscriptionData.placeId) {
        pleiadesIds = [inscriptionData.placeId]
      } else if (inscriptionData.type === 'multiple' && inscriptionData.places && inscriptionData.places.length > 0) {
        pleiadesIds = inscriptionData.places.map(p => p.placeId)
      }

      if (pleiadesIds.length === 0) return

      setBenefactionObjectTypeLoading(true)
      const data = await queryBenefactionObjectTypeFrequency(pleiadesIds, selectedBenefactionType)
      setBenefactionObjectTypeData(data)
      setBenefactionObjectTypeLoading(false)

      // Load object cost statistics
      setBenefactionObjectCostLoading(true)
      const costData = await queryBenefactionObjectCostStatistics(pleiadesIds, selectedBenefactionType)
      setBenefactionObjectCostData(costData)
      setBenefactionObjectCostLoading(false)
    }

    loadObjectTypes()
  }, [selectedBenefactionType, inscriptionData?.type, inscriptionData?.placeId, inscriptionData?.places])

  // Load filtered inscriptions
  useEffect(() => {
    const loadFiltered = async () => {
      if (!statisticsFilter.type || !statisticsFilter.value || !inscriptionData) {
        setStatisticsFilteredEdcsIds([])
        return
      }

      let pleiadesIds: string[] = []
      if (inscriptionData.type === 'single' && inscriptionData.placeId) {
        pleiadesIds = [inscriptionData.placeId]
      } else if (inscriptionData.type === 'multiple' && inscriptionData.places && inscriptionData.places.length > 0) {
        pleiadesIds = inscriptionData.places.map(p => p.placeId)
      }

      if (pleiadesIds.length === 0) return

      setStatisticsFilterLoading(true)
      let ids: string[] = []

      if (statisticsFilter.type === 'nomen' && typeof statisticsFilter.value === 'string') {
        ids = await queryInscriptionsByNomen(pleiadesIds, statisticsFilter.value)
      } else if (statisticsFilter.type === 'benefactionType' && typeof statisticsFilter.value === 'string') {
        ids = await queryInscriptionsByBenefactionType(pleiadesIds, statisticsFilter.value)
      } else if (statisticsFilter.type === 'objectType' && statisticsFilter.benefactionTypeForObjectType && typeof statisticsFilter.value === 'string') {
        ids = await queryInscriptionsByBenefactionObjectType(pleiadesIds, statisticsFilter.benefactionTypeForObjectType, statisticsFilter.value)
      } else if (statisticsFilter.type === 'divinityType' && typeof statisticsFilter.value === 'string') {
        ids = await queryInscriptionsByDivinityType(pleiadesIds, statisticsFilter.value)
      } else if (statisticsFilter.type === 'costRange' && (costFilter.min !== null || costFilter.max !== null)) {
        ids = await queryInscriptionsByCostRange(pleiadesIds, costFilter.min ?? undefined, costFilter.max ?? undefined)
      }

      setStatisticsFilteredEdcsIds(ids)
      setStatisticsFilterLoading(false)
    }

    loadFiltered()
  }, [statisticsFilter, costFilter.min, costFilter.max, inscriptionData?.type, inscriptionData?.placeId, inscriptionData?.places])

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
  const [filterDataLoading, setFilterDataLoading] = useState(false)
  const [filterDataProgress, setFilterDataProgress] = useState({ current: 0, total: 0 })


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
        setFilterDataLoading(false)
        setFilterDataProgress({ current: 0, total: 0 })
        return
      }

      const inscriptions = inscriptionData.inscriptions
      setFilterDataLoading(true)
      setFilterDataProgress({ current: 0, total: inscriptions.length })
      console.log(`Loading filter data for ${inscriptions.length} inscriptions using bulk query`)

      try {
        // Query all inscriptions at once with bulk query - much faster!
        const batchSize = 100 // Process 100 inscriptions per SPARQL query
        let allFilterData: { [edcsId: string]: { socialStatuses: string[], relationshipTypes: string[] } } = {}

        for (let i = 0; i < inscriptions.length; i += batchSize) {
          const batch = inscriptions.slice(i, i + batchSize)
          const edcsIds = batch.map(ins => ins.edcsId)

          console.log(`Querying batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(inscriptions.length / batchSize)} (${edcsIds.length} inscriptions)`)

          const batchData = await queryInscriptionsFilterData(edcsIds)

          // Merge batch data into all filter data
          Object.assign(allFilterData, batchData)

          // Update progress
          const processedCount = Math.min(i + batchSize, inscriptions.length)
          setFilterDataProgress({ current: processedCount, total: inscriptions.length })
          console.log(`Processed ${processedCount} / ${inscriptions.length} inscriptions`)

          // Small delay between batches to avoid overwhelming the endpoint
          if (i + batchSize < inscriptions.length) {
            await new Promise(resolve => setTimeout(resolve, 500))
          }
        }

        console.log('Filter data loading complete')
        setInscriptionFilterData(allFilterData)
      } catch (error) {
        console.error('Error loading filter data:', error)
        setInscriptionFilterData({})
      } finally {
        setFilterDataLoading(false)
      }
    }

    loadFilterData()
  }, [inscriptionData?.inscriptions])

  // Filter inscriptions based on selected filters
  const filteredInscriptions = useMemo(() => {
    if (!inscriptionData?.inscriptions) return []

    let inscriptions = inscriptionData.inscriptions

    // Apply statistics filter first
    if (statisticsFilteredEdcsIds.length > 0) {
      const edcsIdSet = new Set(statisticsFilteredEdcsIds)
      inscriptions = inscriptions.filter(inscription => edcsIdSet.has(inscription.edcsId))
    }

    // Then apply social status/relationship filters
    if (selectedFilters.size === 0) return inscriptions

    return inscriptions.filter(inscription => {
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
  }, [inscriptionData?.inscriptions, inscriptionFilterData, selectedFilters, filterType, statisticsFilteredEdcsIds])

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

  const handleShowInscriptionDetail = async (edcsId: string) => {
    setDetailViewLoading(true)
    setDetailViewEdcsId(edcsId)
    setDetailViewData(null)

    try {
      const data = await queryInscriptionByEdcsId(edcsId)
      setDetailViewData(data)
    } catch (error) {
      console.error('Error loading inscription detail:', error)
      setDetailViewData(null)
    } finally {
      setDetailViewLoading(false)
    }
  }

  const handleCloseInscriptionDetail = () => {
    const previousEdcsId = detailViewEdcsId
    setDetailViewEdcsId(null)
    setDetailViewData(null)

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
                        <button
                          onClick={() => setInfoSubTab('statistics')}
                          className={`px-4 py-2 text-[14px] font-medium transition-colors ${
                            infoSubTab === 'statistics'
                              ? 'text-blue-600 border-b-2 border-blue-600'
                              : 'text-gray-600 hover:text-gray-800'
                          }`}
                        >
                          統計
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
                                disabled={filterDataLoading}
                              >
                                <option value="SocialStatus">社会的身分で絞り込み</option>
                                <option value="RelationshipType">関係性で絞り込み</option>
                              </select>
                            </div>
                            {filterDataLoading ? (
                              <div className="text-[13px] text-gray-600">
                                <p className="mb-1">フィルタデータを読み込み中...</p>
                                <p className="text-[12px] text-gray-500">
                                  {filterDataProgress.current} / {filterDataProgress.total} 件処理済み
                                </p>
                                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${filterDataProgress.total > 0 ? (filterDataProgress.current / filterDataProgress.total) * 100 : 0}%` }}
                                  />
                                </div>
                              </div>
                            ) : availableFilters[filterType]?.length > 0 ? (
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
                    {infoSubTab === 'inscriptions' && !inscriptionData.loading && inscriptionData.inscriptions && inscriptionData.inscriptions.length > 0 && !networkEdcsId && !networkLoading && !detailViewEdcsId && !detailViewLoading && (
                      <div className="mt-4">
                        <h4 className="text-[16px] font-semibold mb-3 text-[#333]">
                          碑文一覧 ({filteredInscriptions.length}件{selectedFilters.size > 0 || statisticsFilteredEdcsIds.length > 0 ? ` / ${inscriptionData.inscriptions.length}件中` : ''})
                        </h4>

                        {/* Statistics filter indicator */}
                        {statisticsFilter.type && statisticsFilter.value && (
                          <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded flex items-center justify-between">
                            <div className="text-[13px]">
                              <span className="text-gray-600">統計フィルタ: </span>
                              <span className="font-medium text-gray-900">
                                {statisticsFilter.type === 'nomen' && `氏族名: ${statisticsFilter.value}`}
                                {statisticsFilter.type === 'benefactionType' && `恵与行為タイプ: ${statisticsFilter.value}`}
                                {statisticsFilter.type === 'objectType' && `対象物: ${statisticsFilter.value}`}
                                {statisticsFilter.type === 'divinityType' && `神格タイプ: ${statisticsFilter.value}`}
                                {statisticsFilter.type === 'costRange' && (() => {
                                  if (costFilter.min !== null && costFilter.max !== null) {
                                    return `コスト範囲: ${costFilter.min.toLocaleString()} - ${costFilter.max.toLocaleString()} HS`
                                  } else if (costFilter.min !== null) {
                                    return `コスト範囲: ${costFilter.min.toLocaleString()} HS以上`
                                  } else if (costFilter.max !== null) {
                                    return `コスト範囲: ${costFilter.max.toLocaleString()} HS以下`
                                  }
                                  return ''
                                })()}
                              </span>
                              {statisticsFilterLoading && (
                                <span className="ml-2 text-gray-500">読み込み中...</span>
                              )}
                            </div>
                            <button
                              onClick={() => {
                                setStatisticsFilter({ type: null, value: null })
                              }}
                              className="px-2 py-1 text-[12px] text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded"
                            >
                              解除
                            </button>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-3 max-h-[600px] overflow-y-auto">
                          {filteredInscriptions.map((inscription, index) => (
                            <div
                              key={index}
                              ref={(el) => { inscriptionRefs.current[inscription.edcsId] = el }}
                              className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow"
                            >
                              <div className="mb-2">
                                <button
                                  onClick={() => handleShowInscriptionDetail(inscription.edcsId)}
                                  className="text-[13px] font-semibold text-blue-600 hover:text-blue-800 no-underline cursor-pointer bg-transparent border-none p-0"
                                >
                                  {inscription.edcsId}
                                </button>
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
                                {inscription.iiifManifest2D && (
                                  <a
                                    href={`/viewer?manifest=${encodeURIComponent(inscription.iiifManifest2D)}&type=mirador`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1 hover:opacity-70 transition-opacity inline-flex"
                                    title="Mirador Viewerで表示"
                                    aria-label="Mirador Viewer"
                                  >
                                    <img src="/img/mirador.png" alt="Mirador" style={{ width: '16px', height: '16px' }} />
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

                    {/* Statistics tab content */}
                    {infoSubTab === 'statistics' && !networkEdcsId && !networkLoading && (
                      <div>
                        {/* Statistics sub-tabs */}
                        <div className="mb-3 flex gap-2 border-b border-gray-200">
                          <button
                            onClick={() => setStatisticsTab('age')}
                            className={`px-4 py-2 text-[13px] font-medium transition-colors ${
                              statisticsTab === 'age'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-600 hover:text-gray-800'
                            }`}
                          >
                            年齢
                          </button>
                          <button
                            onClick={() => setStatisticsTab('clan')}
                            className={`px-4 py-2 text-[13px] font-medium transition-colors ${
                              statisticsTab === 'clan'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-600 hover:text-gray-800'
                            }`}
                          >
                            氏族名
                          </button>
                          <button
                            onClick={() => setStatisticsTab('benefaction')}
                            className={`px-4 py-2 text-[13px] font-medium transition-colors ${
                              statisticsTab === 'benefaction'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-600 hover:text-gray-800'
                            }`}
                          >
                            恵与行為
                          </button>
                          <button
                            onClick={() => setStatisticsTab('divinity')}
                            className={`px-4 py-2 text-[13px] font-medium transition-colors ${
                              statisticsTab === 'divinity'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-600 hover:text-gray-800'
                            }`}
                          >
                            神格
                          </button>
                        </div>

                        {/* Age statistics */}
                        {statisticsTab === 'age' && (
                          <div className="mt-4">
                            {ageAtDeathLoading ? (
                              <p className="text-[14px] text-[#666]">データを読み込み中...</p>
                            ) : ageAtDeathData ? (
                              <div className="space-y-3">
                                <div className="p-3 bg-gray-50 rounded">
                                  <p className="text-[13px] text-gray-600 mb-1">平均死亡年齢</p>
                                  <p className="text-[24px] font-bold text-gray-900">{ageAtDeathData.averageAge.toFixed(1)}歳</p>
                                  <p className="text-[12px] text-gray-500">({ageAtDeathData.count}件)</p>
                                </div>
                                <div className="p-3 bg-gray-50 rounded">
                                  <p className="text-[13px] text-gray-600 mb-1">10歳未満の割合</p>
                                  <p className="text-[24px] font-bold text-gray-900">{ageAtDeathData.under10Percentage.toFixed(1)}%</p>
                                  <p className="text-[12px] text-gray-500">({ageAtDeathData.under10Count}件)</p>
                                </div>
                              </div>
                            ) : (
                              <p className="text-[14px] text-[#666]">データがありません</p>
                            )}
                          </div>
                        )}

                        {/* Clan statistics */}
                        {statisticsTab === 'clan' && (
                          <div className="mt-4">
                            {nomenFrequencyLoading ? (
                              <p className="text-[14px] text-[#666]">データを読み込み中...</p>
                            ) : nomenFrequencyData.length > 0 ? (
                              <div>
                                <div className="mb-3">
                                  <p className="text-[13px] font-medium text-gray-700">氏族名の出現頻度（上位20件、クリックでフィルタ）</p>
                                  <p className="text-[12px] text-gray-500 mt-1">
                                    氏族名を持つ碑文: {nomenFrequencyData.reduce((sum, d) => sum + d.count, 0)}件 / ユニークな氏族名: {nomenFrequencyData.length}件
                                  </p>
                                </div>
                                <div className="bg-white border border-gray-200 rounded-lg p-4 max-h-[400px] overflow-y-auto shadow-sm">
                                  <div className="space-y-3">
                                    {nomenFrequencyData.slice(0, 20).map((item, index) => {
                                      const totalNomenInscriptions = nomenFrequencyData.reduce((sum, d) => sum + d.count, 0)
                                      const percentage = (item.count / totalNomenInscriptions) * 100
                                      const barPercentage = (item.count / Math.max(...nomenFrequencyData.map(d => d.count))) * 100
                                      const isActive = statisticsFilter.type === 'nomen' && statisticsFilter.value === item.nomen
                                      const label = item.nomen.split('/').pop() || item.nomen
                                      return (
                                        <div
                                          key={index}
                                          className={`py-2.5 px-3 rounded-md cursor-pointer transition-all border ${
                                            isActive
                                              ? 'bg-blue-50 border-blue-300 shadow-sm'
                                              : 'bg-gray-50 border-transparent hover:bg-gray-100 hover:border-gray-200'
                                          }`}
                                          onClick={() => {
                                            if (isActive) {
                                              setStatisticsFilter({ type: null, value: null })
                                            } else {
                                              setStatisticsFilter({ type: 'nomen', value: item.nomen })
                                              if (inscriptionData?.type === 'single') {
                                                setInfoSubTab('inscriptions')
                                              }
                                            }
                                          }}
                                        >
                                          <div className="flex items-center justify-between mb-1.5">
                                            <span className={`text-[13px] font-semibold ${isActive ? 'text-blue-700' : 'text-gray-800'}`}>
                                              {label}
                                            </span>
                                            <span className={`text-[12px] font-semibold ${isActive ? 'text-blue-600' : 'text-gray-600'}`}>
                                              {item.count}件 ({percentage.toFixed(1)}%)
                                            </span>
                                          </div>
                                          <div className="relative w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                              className={`absolute left-0 top-0 h-full rounded-full transition-all duration-300 ${
                                                isActive ? 'bg-blue-500' : 'bg-blue-400'
                                              }`}
                                              style={{ width: `${barPercentage}%` }}
                                            />
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <p className="text-[14px] text-[#666]">データがありません</p>
                            )}
                          </div>
                        )}

                        {/* Benefaction statistics */}
                        {statisticsTab === 'benefaction' && (
                          <div className="mt-4">
                            {benefactionTypeLoading ? (
                              <p className="text-[14px] text-[#666]">データを読み込み中...</p>
                            ) : benefactionTypeData.length > 0 ? (
                              <div className="space-y-4">
                                {/* Overall cost statistics */}
                                {benefactionCostData.length > 0 && (() => {
                                  const totalBenefactions = benefactionCostData.reduce((sum, d) => sum + d.count, 0)
                                  const totalWithCost = benefactionCostData.reduce((sum, d) => sum + d.countWithCost, 0)
                                  const allCosts = benefactionCostData.filter(d => d.totalCost !== null)
                                  const grandTotal = allCosts.reduce((sum, d) => sum + (d.totalCost || 0), 0)
                                  const overallAvg = totalWithCost > 0 ? grandTotal / totalWithCost : 0
                                  const allMinCosts = benefactionCostData.filter(d => d.minCost !== null).map(d => d.minCost!)
                                  const allMaxCosts = benefactionCostData.filter(d => d.maxCost !== null).map(d => d.maxCost!)
                                  const minCost = allMinCosts.length > 0 ? Math.min(...allMinCosts) : null
                                  const maxCost = allMaxCosts.length > 0 ? Math.max(...allMaxCosts) : null

                                  console.log('Cost calculation:', {
                                    totalBenefactions,
                                    totalWithCost,
                                    allCostsCount: allCosts.length,
                                    grandTotal,
                                    overallAvg,
                                    sampleData: benefactionCostData.slice(0, 3)
                                  })

                                  return totalWithCost > 0 ? (
                                    <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                                      <p className="text-[13px] font-semibold text-green-800 mb-2">コスト統計概要</p>
                                      <div className="grid grid-cols-2 gap-2 text-[12px]">
                                        <div>
                                          <span className="text-gray-600">総恵与行為数:</span>
                                          <span className="ml-1 font-semibold text-gray-900">{totalBenefactions.toLocaleString()}件</span>
                                        </div>
                                        <div>
                                          <span className="text-gray-600">コストデータあり:</span>
                                          <span className="ml-1 font-semibold text-gray-900">{totalWithCost.toLocaleString()}件</span>
                                        </div>
                                        <div>
                                          <span className="text-gray-600">総コスト:</span>
                                          <span className="ml-1 font-semibold text-gray-900">{Math.round(grandTotal).toLocaleString()} HS</span>
                                        </div>
                                        <div>
                                          <span className="text-gray-600">平均コスト:</span>
                                          <span className="ml-1 font-semibold text-gray-900">{Math.round(overallAvg).toLocaleString()} HS</span>
                                        </div>
                                        {minCost !== null && (
                                          <div>
                                            <span className="text-gray-600">最小:</span>
                                            <span className="ml-1 font-semibold text-gray-900">{Math.round(minCost).toLocaleString()} HS</span>
                                          </div>
                                        )}
                                        {maxCost !== null && (
                                          <div>
                                            <span className="text-gray-600">最大:</span>
                                            <span className="ml-1 font-semibold text-gray-900">{Math.round(maxCost).toLocaleString()} HS</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ) : null
                                })()}

                                {/* Cost range filter */}
                                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                                  <p className="text-[13px] font-semibold text-blue-800 mb-2">コスト範囲でフィルタ</p>
                                  <div className="flex gap-2 items-center">
                                    <input
                                      type="number"
                                      placeholder="最小 (HS)"
                                      value={costFilter.min ?? ''}
                                      onChange={(e) => setCostFilter(prev => ({ ...prev, min: e.target.value ? Number(e.target.value) : null }))}
                                      className="flex-1 px-2 py-1 text-[12px] border border-gray-300 rounded"
                                    />
                                    <span className="text-gray-500">〜</span>
                                    <input
                                      type="number"
                                      placeholder="最大 (HS)"
                                      value={costFilter.max ?? ''}
                                      onChange={(e) => setCostFilter(prev => ({ ...prev, max: e.target.value ? Number(e.target.value) : null }))}
                                      className="flex-1 px-2 py-1 text-[12px] border border-gray-300 rounded"
                                    />
                                    <button
                                      onClick={() => {
                                        if (costFilter.min !== null || costFilter.max !== null) {
                                          setStatisticsFilter({ type: 'costRange', value: costFilter })
                                          if (inscriptionData?.type === 'single') {
                                            setInfoSubTab('inscriptions')
                                          }
                                        }
                                      }}
                                      disabled={costFilter.min === null && costFilter.max === null}
                                      className="px-3 py-1 text-[12px] bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                                    >
                                      適用
                                    </button>
                                    {statisticsFilter.type === 'costRange' && (
                                      <button
                                        onClick={() => {
                                          setStatisticsFilter({ type: null, value: null })
                                          setCostFilter({ min: null, max: null })
                                        }}
                                        className="px-3 py-1 text-[12px] bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                                      >
                                        解除
                                      </button>
                                    )}
                                  </div>
                                  {statisticsFilter.type === 'costRange' && (
                                    <p className="text-[11px] text-blue-700 mt-1">
                                      フィルタ中: {costFilter.min ?? '最小値なし'} 〜 {costFilter.max ?? '最大値なし'} HS
                                    </p>
                                  )}
                                </div>

                                {/* Top benefactions ranking */}
                                {topBenefactionsLoading ? (
                                  <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                                    <p className="text-[13px] text-gray-600">高額恵与行為を読み込み中...</p>
                                  </div>
                                ) : topBenefactionsData.length > 0 ? (
                                  <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                                    <p className="text-[13px] font-semibold text-yellow-800 mb-2">高額恵与行為トップ10</p>
                                    <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                                      {topBenefactionsData.map((item, index) => (
                                        <div
                                          key={index}
                                          className="bg-white p-2 rounded border border-yellow-200 hover:border-yellow-400 transition-colors"
                                        >
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1">
                                              <div className="flex items-center gap-2">
                                                <span className="text-[11px] font-bold text-yellow-700">#{index + 1}</span>
                                                <button
                                                  onClick={() => {
                                                    const inscription = filteredInscriptions.find(i => i.edcsId === item.edcsId)
                                                    if (inscription) {
                                                      setSelectedInscription(inscription)
                                                      setShowInscriptionDetail(true)
                                                    }
                                                  }}
                                                  className="text-[12px] text-blue-600 hover:text-blue-800 hover:underline font-medium"
                                                >
                                                  {item.edcsId}
                                                </button>
                                                <span className="text-[11px] text-gray-600">{item.personName}</span>
                                              </div>
                                              <div className="text-[11px] text-gray-600 mt-0.5">
                                                {item.benefactionType} → {item.objectType}
                                              </div>
                                              {item.description && (
                                                <div className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">
                                                  {item.description}
                                                </div>
                                              )}
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                              <div className="text-[13px] font-bold text-yellow-700">
                                                {Math.round(item.cost).toLocaleString()} HS
                                              </div>
                                              {item.costOriginalText && (
                                                <div className="text-[10px] text-gray-500">
                                                  ({item.costOriginalText})
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}

                                <div>
                                  <p className="text-[13px] text-gray-600 mb-3">恵与行為タイプの割合（クリックで詳細）</p>
                                  {/* Pie chart and legend side by side */}
                                  <div className="flex gap-4 items-center mb-3">
                                    {/* Pie chart */}
                                    <div className="flex-shrink-0">
                                      <svg width="180" height="180" viewBox="0 0 200 200" className="transform -rotate-90">
                                        {(() => {
                                          const totalCount = benefactionTypeData.reduce((sum, d) => sum + d.count, 0)
                                          const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']
                                          let currentAngle = 0
                                          return benefactionTypeData.map((item, index) => {
                                            const percentage = (item.count / totalCount) * 100
                                            const angle = (percentage / 100) * 360
                                            const startAngle = currentAngle
                                            const endAngle = currentAngle + angle
                                            currentAngle = endAngle

                                            const startRad = (startAngle * Math.PI) / 180
                                            const endRad = (endAngle * Math.PI) / 180
                                            const x1 = 100 + 90 * Math.cos(startRad)
                                            const y1 = 100 + 90 * Math.sin(startRad)
                                            const x2 = 100 + 90 * Math.cos(endRad)
                                            const y2 = 100 + 90 * Math.sin(endRad)
                                            const largeArcFlag = angle > 180 ? 1 : 0

                                            const isActive = selectedBenefactionType === item.benefactionType

                                            return (
                                              <path
                                                key={index}
                                                d={`M 100 100 L ${x1} ${y1} A 90 90 0 ${largeArcFlag} 1 ${x2} ${y2} Z`}
                                                fill={colors[index % colors.length]}
                                                stroke="white"
                                                strokeWidth="2"
                                                className="cursor-pointer transition-opacity hover:opacity-80"
                                                style={{ opacity: isActive ? 1 : 0.9 }}
                                                onClick={() => {
                                                  if (isActive) {
                                                    setSelectedBenefactionType(null)
                                                    if (statisticsFilter.type === 'benefactionType' && statisticsFilter.value === item.benefactionType) {
                                                      setStatisticsFilter({ type: null, value: null })
                                                    }
                                                  } else {
                                                    setSelectedBenefactionType(item.benefactionType)
                                                  }
                                                }}
                                              />
                                            )
                                          })
                                        })()}
                                      </svg>
                                    </div>
                                    {/* Legend */}
                                    <div className="flex-1 space-y-1">
                                      {benefactionTypeData.map((item, index) => {
                                        const totalCount = benefactionTypeData.reduce((sum, d) => sum + d.count, 0)
                                        const percentage = (item.count / totalCount) * 100
                                        const isActive = selectedBenefactionType === item.benefactionType
                                        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']
                                        const costData = benefactionCostData.find(c => c.benefactionType === item.benefactionType)
                                        return (
                                          <div
                                            key={index}
                                            className={`p-2 rounded cursor-pointer transition-colors ${
                                              isActive ? 'bg-blue-100 border border-blue-300' : 'hover:bg-gray-50'
                                            }`}
                                            onClick={() => {
                                              if (isActive) {
                                                setSelectedBenefactionType(null)
                                                if (statisticsFilter.type === 'benefactionType' && statisticsFilter.value === item.benefactionType) {
                                                  setStatisticsFilter({ type: null, value: null })
                                                }
                                              } else {
                                                setSelectedBenefactionType(item.benefactionType)
                                              }
                                            }}
                                          >
                                            <div className="flex items-center justify-between mb-1">
                                              <div className="flex items-center gap-2">
                                                <div
                                                  className="w-3 h-3 rounded-sm flex-shrink-0"
                                                  style={{ backgroundColor: colors[index % colors.length] }}
                                                />
                                                <span className="text-[13px] font-medium text-gray-900">{item.benefactionType}</span>
                                              </div>
                                              <span className="text-[12px] text-gray-600">{item.count}件 ({percentage.toFixed(1)}%)</span>
                                            </div>
                                            {costData && costData.countWithCost > 0 && (
                                              <div className="ml-5 text-[11px] text-gray-500">
                                                平均: {costData.avgCost ? `${Math.round(costData.avgCost).toLocaleString()} HS` : '-'}
                                                {costData.totalCost && ` (合計: ${Math.round(costData.totalCost).toLocaleString()} HS)`}
                                                <span className="ml-1">({costData.countWithCost}件にデータあり)</span>
                                              </div>
                                            )}
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                  {/* Filter button */}
                                  {selectedBenefactionType && !statisticsFilter.type && (
                                    <button
                                      onClick={() => {
                                        setStatisticsFilter({ type: 'benefactionType', value: selectedBenefactionType })
                                        if (inscriptionData?.type === 'single') {
                                          setInfoSubTab('inscriptions')
                                        }
                                      }}
                                      className="w-full px-3 py-2 text-[13px] bg-blue-50 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                                    >
                                      この恵与行為タイプでフィルタ
                                    </button>
                                  )}
                                  {statisticsFilter.type === 'benefactionType' && statisticsFilter.value === selectedBenefactionType && (
                                    <button
                                      onClick={() => {
                                        setStatisticsFilter({ type: null, value: null })
                                      }}
                                      className="w-full px-3 py-2 text-[13px] bg-gray-50 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                                    >
                                      フィルタ解除
                                    </button>
                                  )}
                                </div>

                                {/* Object types for selected benefaction type */}
                                {selectedBenefactionType && (
                                  <div className="pt-3 border-t border-gray-200">
                                    <p className="text-[13px] text-gray-600 mb-3">
                                      {selectedBenefactionType}の対象物（クリックでフィルタ）
                                    </p>
                                    {benefactionObjectTypeLoading ? (
                                      <p className="text-[14px] text-[#666]">データを読み込み中...</p>
                                    ) : benefactionObjectTypeData.length > 0 ? (
                                      <div className="flex gap-4 items-center">
                                        {/* Pie chart */}
                                        <div className="flex-shrink-0">
                                          <svg width="180" height="180" viewBox="0 0 200 200" className="transform -rotate-90">
                                            {(() => {
                                              const totalCount = benefactionObjectTypeData.reduce((sum, d) => sum + d.count, 0)
                                              const colors = ['#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#3b82f6', '#10b981', '#f59e0b', '#ef4444']
                                              let currentAngle = 0
                                              return benefactionObjectTypeData.map((item, index) => {
                                                const percentage = (item.count / totalCount) * 100
                                                const angle = (percentage / 100) * 360
                                                const startAngle = currentAngle
                                                const endAngle = currentAngle + angle
                                                currentAngle = endAngle

                                                const startRad = (startAngle * Math.PI) / 180
                                                const endRad = (endAngle * Math.PI) / 180
                                                const x1 = 100 + 90 * Math.cos(startRad)
                                                const y1 = 100 + 90 * Math.sin(startRad)
                                                const x2 = 100 + 90 * Math.cos(endRad)
                                                const y2 = 100 + 90 * Math.sin(endRad)
                                                const largeArcFlag = angle > 180 ? 1 : 0

                                                const isActive = statisticsFilter.type === 'objectType' && statisticsFilter.value === item.objectType

                                                return (
                                                  <path
                                                    key={index}
                                                    d={`M 100 100 L ${x1} ${y1} A 90 90 0 ${largeArcFlag} 1 ${x2} ${y2} Z`}
                                                    fill={colors[index % colors.length]}
                                                    stroke="white"
                                                    strokeWidth="2"
                                                    className="cursor-pointer transition-opacity hover:opacity-80"
                                                    style={{ opacity: isActive ? 1 : 0.9 }}
                                                    onClick={() => {
                                                      if (isActive) {
                                                        setStatisticsFilter({ type: null, value: null })
                                                      } else {
                                                        setStatisticsFilter({
                                                          type: 'objectType',
                                                          value: item.objectType,
                                                          benefactionTypeForObjectType: selectedBenefactionType
                                                        })
                                                        if (inscriptionData?.type === 'single') {
                                                          setInfoSubTab('inscriptions')
                                                        }
                                                      }
                                                    }}
                                                  />
                                                )
                                              })
                                            })()}
                                          </svg>
                                        </div>
                                        {/* Legend */}
                                        <div className="flex-1 space-y-1">
                                          {benefactionObjectTypeData.map((item, index) => {
                                            const totalCount = benefactionObjectTypeData.reduce((sum, d) => sum + d.count, 0)
                                            const percentage = (item.count / totalCount) * 100
                                            const isActive = statisticsFilter.type === 'objectType' && statisticsFilter.value === item.objectType
                                            const colors = ['#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#3b82f6', '#10b981', '#f59e0b', '#ef4444']
                                            const costData = benefactionObjectCostData.find(c => c.objectType === item.objectType)
                                            return (
                                              <div
                                                key={index}
                                                className={`p-2 rounded cursor-pointer transition-colors ${
                                                  isActive ? 'bg-blue-100 border border-blue-300' : 'hover:bg-gray-50'
                                                }`}
                                                onClick={() => {
                                                  if (isActive) {
                                                    setStatisticsFilter({ type: null, value: null })
                                                  } else {
                                                    setStatisticsFilter({
                                                      type: 'objectType',
                                                      value: item.objectType,
                                                      benefactionTypeForObjectType: selectedBenefactionType
                                                    })
                                                    if (inscriptionData?.type === 'single') {
                                                      setInfoSubTab('inscriptions')
                                                    }
                                                  }
                                                }}
                                              >
                                                <div className="flex items-center justify-between mb-1">
                                                  <div className="flex items-center gap-2">
                                                    <div
                                                      className="w-3 h-3 rounded-sm flex-shrink-0"
                                                      style={{ backgroundColor: colors[index % colors.length] }}
                                                    />
                                                    <span className="text-[13px] font-medium text-gray-900">{item.objectType}</span>
                                                  </div>
                                                  <span className="text-[12px] text-gray-600">{item.count}件 ({percentage.toFixed(1)}%)</span>
                                                </div>
                                                {costData && costData.countWithCost > 0 && (
                                                  <div className="ml-5 text-[11px] text-gray-500">
                                                    平均: {costData.avgCost ? `${Math.round(costData.avgCost).toLocaleString()} HS` : '-'}
                                                    {costData.totalCost && ` (合計: ${Math.round(costData.totalCost).toLocaleString()} HS)`}
                                                    <span className="ml-1">({costData.countWithCost}件にデータあり)</span>
                                                  </div>
                                                )}
                                              </div>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="text-[14px] text-[#666]">データがありません</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="text-[14px] text-[#666]">データがありません</p>
                            )}
                          </div>
                        )}

                        {/* Divinity statistics */}
                        {statisticsTab === 'divinity' && (
                          <div className="mt-4">
                            {divinityTypeLoading ? (
                              <p className="text-[14px] text-[#666]">データを読み込み中...</p>
                            ) : divinityTypeData.length > 0 ? (
                              <div>
                                <p className="text-[13px] text-gray-600 mb-3">神格タイプの割合（クリックでフィルタ）</p>
                                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                                  <div className="space-y-2">
                                    {divinityTypeData.map((item, index) => {
                                      const totalCount = divinityTypeData.reduce((sum, d) => sum + d.count, 0)
                                      const percentage = (item.count / totalCount) * 100
                                      const barPercentage = (item.count / Math.max(...divinityTypeData.map(d => d.count))) * 100
                                      const isActive = statisticsFilter.type === 'divinityType' && statisticsFilter.value === item.divinityType
                                      const label = item.divinityType.split('/').pop() || item.divinityType
                                      return (
                                        <div
                                          key={index}
                                          className={`py-2.5 px-3 rounded-md cursor-pointer transition-all border ${
                                            isActive
                                              ? 'bg-green-50 border-green-300 shadow-sm'
                                              : 'bg-gray-50 border-transparent hover:bg-gray-100 hover:border-gray-200'
                                          }`}
                                          onClick={() => {
                                            if (isActive) {
                                              setStatisticsFilter({ type: null, value: null })
                                            } else {
                                              setStatisticsFilter({ type: 'divinityType', value: item.divinityType })
                                              setInfoSubTab('inscriptions')
                                            }
                                          }}
                                        >
                                          <div className="flex items-center justify-between mb-1.5">
                                            <span className={`text-[13px] font-semibold ${isActive ? 'text-green-700' : 'text-gray-800'}`}>
                                              {label}
                                            </span>
                                            <span className={`text-[12px] font-semibold ${isActive ? 'text-green-600' : 'text-gray-600'}`}>
                                              {item.count}件 ({percentage.toFixed(1)}%)
                                            </span>
                                          </div>
                                          <div className="relative w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                              className={`absolute left-0 top-0 h-full rounded-full transition-all duration-300 ${
                                                isActive ? 'bg-green-500' : 'bg-green-400'
                                              }`}
                                              style={{ width: `${barPercentage}%` }}
                                            />
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <p className="text-[14px] text-[#666]">データがありません</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Display inscription detail view when active */}
                    {detailViewEdcsId && !detailViewLoading && detailViewData && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-[16px] font-semibold text-[#333]">碑文詳細</h4>
                          <button
                            onClick={handleCloseInscriptionDetail}
                            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded transition-colors text-[13px]"
                          >
                            一覧に戻る
                          </button>
                        </div>

                        <div className="space-y-4">
                          {/* Metadata Section */}
                          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                            <h5 className="font-semibold text-gray-900 mb-3 text-[14px]">メタデータ</h5>

                            <div className="flex text-[13px]">
                              <span className="font-medium text-gray-700 w-24">EDCS ID:</span>
                              <span className="text-gray-600">{detailViewData.edcsId}</span>
                            </div>

                            {detailViewData.datingFrom !== null && detailViewData.datingTo !== null && (
                              <div className="flex text-[13px]">
                                <span className="font-medium text-gray-700 w-24">年代:</span>
                                <span className="text-gray-600">
                                  {detailViewData.datingFrom} - {detailViewData.datingTo}
                                </span>
                              </div>
                            )}

                            {detailViewData.province && (
                              <div className="flex text-[13px]">
                                <span className="font-medium text-gray-700 w-24">属州:</span>
                                <span className="text-gray-600">{detailViewData.province}</span>
                              </div>
                            )}

                            {detailViewData.place && (
                              <div className="flex text-[13px]">
                                <span className="font-medium text-gray-700 w-24">場所:</span>
                                <span className="text-gray-600">{detailViewData.place}</span>
                              </div>
                            )}

                            {detailViewData.bibliographicCitation && (
                              <div className="flex text-[13px]">
                                <span className="font-medium text-gray-700 w-24">出典:</span>
                                <span className="text-gray-600">{detailViewData.bibliographicCitation}</span>
                              </div>
                            )}
                          </div>

                          {/* Text Section */}
                          {detailViewData.text && (
                            <div>
                              <h5 className="font-semibold text-gray-900 mb-3 text-[14px]">碑文テキスト</h5>
                              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                {detailViewData.text.split('//').map((block: string, blockIndex: number) => (
                                  <div key={blockIndex} className="mb-4 last:mb-0">
                                    {block.split('/').map((line: string, lineIndex: number) => (
                                      <div key={lineIndex} className="text-gray-800 leading-relaxed text-[13px]">
                                        {line.trim()}
                                      </div>
                                    ))}
                                    {blockIndex < detailViewData.text.split('//').length - 1 && (
                                      <div className="border-t border-blue-300 my-3"></div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Comment Section */}
                          {detailViewData.comment && (
                            <div>
                              <h5 className="font-semibold text-gray-900 mb-3 text-[14px]">コメント</h5>
                              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-[13px]">
                                  {detailViewData.comment}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {detailViewLoading && (
                      <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                        <p className="text-[14px] text-[#666]">碑文データを読み込み中...</p>
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

                    {/* Sub tabs for multiple places */}
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
                          碑文
                        </button>
                        <button
                          onClick={() => setInfoSubTab('statistics')}
                          className={`px-4 py-2 text-[14px] font-medium transition-colors ${
                            infoSubTab === 'statistics'
                              ? 'text-blue-600 border-b-2 border-blue-600'
                              : 'text-gray-600 hover:text-gray-800'
                          }`}
                        >
                          統計
                        </button>
                      </div>
                    )}

                    {/* Display inscription details for selected place */}
                    {infoSubTab === 'inscriptions' && !inscriptionData.loading && inscriptionData.inscriptions && inscriptionData.inscriptions.length > 0 && !networkEdcsId && !networkLoading && !detailViewEdcsId && !detailViewLoading && (
                      <div className="mt-4">
                        {/* Statistics filter indicator */}
                        {statisticsFilter.type && statisticsFilter.value && (
                          <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded flex items-center justify-between">
                            <div className="text-[13px]">
                              <span className="text-gray-600">統計フィルタ: </span>
                              <span className="font-medium text-gray-900">
                                {statisticsFilter.type === 'nomen' && `氏族名: ${statisticsFilter.value}`}
                                {statisticsFilter.type === 'benefactionType' && `恵与行為タイプ: ${statisticsFilter.value}`}
                                {statisticsFilter.type === 'objectType' && `対象物: ${statisticsFilter.value}`}
                                {statisticsFilter.type === 'divinityType' && `神格タイプ: ${statisticsFilter.value}`}
                                {statisticsFilter.type === 'costRange' && (() => {
                                  if (costFilter.min !== null && costFilter.max !== null) {
                                    return `コスト範囲: ${costFilter.min.toLocaleString()} - ${costFilter.max.toLocaleString()} HS`
                                  } else if (costFilter.min !== null) {
                                    return `コスト範囲: ${costFilter.min.toLocaleString()} HS以上`
                                  } else if (costFilter.max !== null) {
                                    return `コスト範囲: ${costFilter.max.toLocaleString()} HS以下`
                                  }
                                  return ''
                                })()}
                              </span>
                              {statisticsFilterLoading && (
                                <span className="ml-2 text-gray-500">読み込み中...</span>
                              )}
                            </div>
                            <button
                              onClick={() => {
                                setStatisticsFilter({ type: null, value: null })
                              }}
                              className="px-2 py-1 text-[12px] text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded"
                            >
                              解除
                            </button>
                          </div>
                        )}

                        <h4 className="text-[16px] font-semibold mb-3 text-[#333]">
                          碑文一覧 ({filteredInscriptions.length}件{selectedFilters.size > 0 || statisticsFilteredEdcsIds.length > 0 ? ` / ${inscriptionData.inscriptions.length}件中` : ''})
                        </h4>
                        <div className="grid grid-cols-2 gap-3 max-h-[600px] overflow-y-auto">
                          {filteredInscriptions.map((inscription, index) => (
                            <div
                              key={index}
                              ref={(el) => { inscriptionRefs.current[inscription.edcsId] = el }}
                              className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow"
                            >
                              <div className="mb-2">
                                <button
                                  onClick={() => handleShowInscriptionDetail(inscription.edcsId)}
                                  className="text-[13px] font-semibold text-blue-600 hover:text-blue-800 no-underline cursor-pointer bg-transparent border-none p-0"
                                >
                                  {inscription.edcsId}
                                </button>
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
                                {inscription.iiifManifest2D && (
                                  <a
                                    href={`/viewer?manifest=${encodeURIComponent(inscription.iiifManifest2D)}&type=mirador`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1 hover:opacity-70 transition-opacity inline-flex"
                                    title="Mirador Viewerで表示"
                                    aria-label="Mirador Viewer"
                                  >
                                    <img src="/img/mirador.png" alt="Mirador" style={{ width: '16px', height: '16px' }} />
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Statistics tab content for multiple places */}
                    {infoSubTab === 'statistics' && !networkEdcsId && !networkLoading && (
                      <div>
                        {/* Statistics sub-tabs */}
                        <div className="mb-3 flex gap-2 border-b border-gray-200">
                          <button
                            onClick={() => setStatisticsTab('age')}
                            className={`px-4 py-2 text-[13px] font-medium transition-colors ${
                              statisticsTab === 'age'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-600 hover:text-gray-800'
                            }`}
                          >
                            年齢
                          </button>
                          <button
                            onClick={() => setStatisticsTab('clan')}
                            className={`px-4 py-2 text-[13px] font-medium transition-colors ${
                              statisticsTab === 'clan'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-600 hover:text-gray-800'
                            }`}
                          >
                            氏族名
                          </button>
                          <button
                            onClick={() => setStatisticsTab('benefaction')}
                            className={`px-4 py-2 text-[13px] font-medium transition-colors ${
                              statisticsTab === 'benefaction'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-600 hover:text-gray-800'
                            }`}
                          >
                            恵与行為
                          </button>
                          <button
                            onClick={() => setStatisticsTab('divinity')}
                            className={`px-4 py-2 text-[13px] font-medium transition-colors ${
                              statisticsTab === 'divinity'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-600 hover:text-gray-800'
                            }`}
                          >
                            神格
                          </button>
                        </div>

                        {/* Age statistics */}
                        {statisticsTab === 'age' && (
                          <div className="mt-4">
                            {ageAtDeathLoading ? (
                              <p className="text-[14px] text-[#666]">データを読み込み中...</p>
                            ) : ageAtDeathData ? (
                              <div className="space-y-3">
                                <div className="p-3 bg-gray-50 rounded">
                                  <p className="text-[13px] text-gray-600 mb-1">平均死亡年齢</p>
                                  <p className="text-[24px] font-bold text-gray-900">{ageAtDeathData.averageAge.toFixed(1)}歳</p>
                                  <p className="text-[12px] text-gray-500">({ageAtDeathData.count}件)</p>
                                </div>
                                <div className="p-3 bg-gray-50 rounded">
                                  <p className="text-[13px] text-gray-600 mb-1">10歳未満の割合</p>
                                  <p className="text-[24px] font-bold text-gray-900">{ageAtDeathData.under10Percentage.toFixed(1)}%</p>
                                  <p className="text-[12px] text-gray-500">({ageAtDeathData.under10Count}件)</p>
                                </div>
                              </div>
                            ) : (
                              <p className="text-[14px] text-[#666]">データがありません</p>
                            )}
                          </div>
                        )}

                        {/* Clan statistics */}
                        {statisticsTab === 'clan' && (
                          <div className="mt-4">
                            {nomenFrequencyLoading ? (
                              <p className="text-[14px] text-[#666]">データを読み込み中...</p>
                            ) : nomenFrequencyData.length > 0 ? (
                              <div>
                                <div className="mb-3">
                                  <p className="text-[13px] text-gray-600">氏族名の出現頻度（上位20件、クリックでフィルタ）</p>
                                  <p className="text-[12px] text-gray-500 mt-1">全{nomenFrequencyData.length}件</p>
                                </div>
                                <div className="bg-white border border-gray-200 rounded-lg p-3 max-h-[400px] overflow-y-auto">
                                  <div className="space-y-2">
                                    {nomenFrequencyData.slice(0, 20).map((item, index) => {
                                      const totalCount = nomenFrequencyData.reduce((sum, d) => sum + d.count, 0)
                                      const percentage = (item.count / totalCount) * 100
                                      const barPercentage = (item.count / Math.max(...nomenFrequencyData.map(d => d.count))) * 100
                                      const isActive = statisticsFilter.type === 'nomen' && statisticsFilter.value === item.nomen
                                      const label = item.nomen.split('/').pop() || item.nomen
                                      return (
                                        <div
                                          key={index}
                                          className={`py-2 px-2 rounded cursor-pointer transition-all ${
                                            isActive
                                              ? 'bg-blue-50'
                                              : 'hover:bg-gray-50'
                                          }`}
                                          onClick={() => {
                                            if (isActive) {
                                              setStatisticsFilter({ type: null, value: null })
                                            } else {
                                              setStatisticsFilter({ type: 'nomen', value: item.nomen })
                                              setInfoSubTab('inscriptions')
                                            }
                                          }}
                                        >
                                          <div className="flex items-center justify-between mb-1">
                                            <span className={`text-[13px] font-semibold ${isActive ? 'text-blue-700' : 'text-gray-800'}`}>
                                              {label}
                                            </span>
                                            <span className={`text-[12px] font-medium ${isActive ? 'text-blue-600' : 'text-gray-600'}`}>
                                              {item.count}件 ({percentage.toFixed(1)}%)
                                            </span>
                                          </div>
                                          <div className="relative w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                              className={`absolute left-0 top-0 h-full rounded-full transition-all duration-300 ${
                                                isActive ? 'bg-blue-500' : 'bg-blue-400'
                                              }`}
                                              style={{ width: `${barPercentage}%` }}
                                            />
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <p className="text-[14px] text-[#666]">データがありません</p>
                            )}
                          </div>
                        )}

                        {/* Benefaction statistics */}
                        {statisticsTab === 'benefaction' && (
                          <div className="mt-4">
                            {benefactionTypeLoading ? (
                              <p className="text-[14px] text-[#666]">データを読み込み中...</p>
                            ) : benefactionTypeData.length > 0 ? (
                              <div className="space-y-4">
                                {/* Overall cost statistics */}
                                {benefactionCostData.length > 0 && (() => {
                                  const totalBenefactions = benefactionCostData.reduce((sum, d) => sum + d.count, 0)
                                  const totalWithCost = benefactionCostData.reduce((sum, d) => sum + d.countWithCost, 0)
                                  const allCosts = benefactionCostData.filter(d => d.totalCost !== null)
                                  const grandTotal = allCosts.reduce((sum, d) => sum + (d.totalCost || 0), 0)
                                  const overallAvg = totalWithCost > 0 ? grandTotal / totalWithCost : 0
                                  const allMinCosts = benefactionCostData.filter(d => d.minCost !== null).map(d => d.minCost!)
                                  const allMaxCosts = benefactionCostData.filter(d => d.maxCost !== null).map(d => d.maxCost!)
                                  const minCost = allMinCosts.length > 0 ? Math.min(...allMinCosts) : null
                                  const maxCost = allMaxCosts.length > 0 ? Math.max(...allMaxCosts) : null

                                  console.log('Cost calculation:', {
                                    totalBenefactions,
                                    totalWithCost,
                                    allCostsCount: allCosts.length,
                                    grandTotal,
                                    overallAvg,
                                    sampleData: benefactionCostData.slice(0, 3)
                                  })

                                  return totalWithCost > 0 ? (
                                    <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                                      <p className="text-[13px] font-semibold text-green-800 mb-2">コスト統計概要</p>
                                      <div className="grid grid-cols-2 gap-2 text-[12px]">
                                        <div>
                                          <span className="text-gray-600">総恵与行為数:</span>
                                          <span className="ml-1 font-semibold text-gray-900">{totalBenefactions.toLocaleString()}件</span>
                                        </div>
                                        <div>
                                          <span className="text-gray-600">コストデータあり:</span>
                                          <span className="ml-1 font-semibold text-gray-900">{totalWithCost.toLocaleString()}件</span>
                                        </div>
                                        <div>
                                          <span className="text-gray-600">総コスト:</span>
                                          <span className="ml-1 font-semibold text-gray-900">{Math.round(grandTotal).toLocaleString()} HS</span>
                                        </div>
                                        <div>
                                          <span className="text-gray-600">平均コスト:</span>
                                          <span className="ml-1 font-semibold text-gray-900">{Math.round(overallAvg).toLocaleString()} HS</span>
                                        </div>
                                        {minCost !== null && (
                                          <div>
                                            <span className="text-gray-600">最小:</span>
                                            <span className="ml-1 font-semibold text-gray-900">{Math.round(minCost).toLocaleString()} HS</span>
                                          </div>
                                        )}
                                        {maxCost !== null && (
                                          <div>
                                            <span className="text-gray-600">最大:</span>
                                            <span className="ml-1 font-semibold text-gray-900">{Math.round(maxCost).toLocaleString()} HS</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ) : null
                                })()}

                                {/* Cost range filter */}
                                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                                  <p className="text-[13px] font-semibold text-blue-800 mb-2">コスト範囲でフィルタ</p>
                                  <div className="flex gap-2 items-center">
                                    <input
                                      type="number"
                                      placeholder="最小 (HS)"
                                      value={costFilter.min ?? ''}
                                      onChange={(e) => setCostFilter(prev => ({ ...prev, min: e.target.value ? Number(e.target.value) : null }))}
                                      className="flex-1 px-2 py-1 text-[12px] border border-gray-300 rounded"
                                    />
                                    <span className="text-gray-500">〜</span>
                                    <input
                                      type="number"
                                      placeholder="最大 (HS)"
                                      value={costFilter.max ?? ''}
                                      onChange={(e) => setCostFilter(prev => ({ ...prev, max: e.target.value ? Number(e.target.value) : null }))}
                                      className="flex-1 px-2 py-1 text-[12px] border border-gray-300 rounded"
                                    />
                                    <button
                                      onClick={() => {
                                        if (costFilter.min !== null || costFilter.max !== null) {
                                          setStatisticsFilter({ type: 'costRange', value: costFilter })
                                          if (inscriptionData?.type === 'single') {
                                            setInfoSubTab('inscriptions')
                                          }
                                        }
                                      }}
                                      disabled={costFilter.min === null && costFilter.max === null}
                                      className="px-3 py-1 text-[12px] bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                                    >
                                      適用
                                    </button>
                                    {statisticsFilter.type === 'costRange' && (
                                      <button
                                        onClick={() => {
                                          setStatisticsFilter({ type: null, value: null })
                                          setCostFilter({ min: null, max: null })
                                        }}
                                        className="px-3 py-1 text-[12px] bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                                      >
                                        解除
                                      </button>
                                    )}
                                  </div>
                                  {statisticsFilter.type === 'costRange' && (
                                    <p className="text-[11px] text-blue-700 mt-1">
                                      フィルタ中: {costFilter.min ?? '最小値なし'} 〜 {costFilter.max ?? '最大値なし'} HS
                                    </p>
                                  )}
                                </div>

                                {/* Top benefactions ranking */}
                                {topBenefactionsLoading ? (
                                  <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                                    <p className="text-[13px] text-gray-600">高額恵与行為を読み込み中...</p>
                                  </div>
                                ) : topBenefactionsData.length > 0 ? (
                                  <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                                    <p className="text-[13px] font-semibold text-yellow-800 mb-2">高額恵与行為トップ10</p>
                                    <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                                      {topBenefactionsData.map((item, index) => (
                                        <div
                                          key={index}
                                          className="bg-white p-2 rounded border border-yellow-200 hover:border-yellow-400 transition-colors"
                                        >
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1">
                                              <div className="flex items-center gap-2">
                                                <span className="text-[11px] font-bold text-yellow-700">#{index + 1}</span>
                                                <button
                                                  onClick={() => {
                                                    const inscription = filteredInscriptions.find(i => i.edcsId === item.edcsId)
                                                    if (inscription) {
                                                      setSelectedInscription(inscription)
                                                      setShowInscriptionDetail(true)
                                                    }
                                                  }}
                                                  className="text-[12px] text-blue-600 hover:text-blue-800 hover:underline font-medium"
                                                >
                                                  {item.edcsId}
                                                </button>
                                                <span className="text-[11px] text-gray-600">{item.personName}</span>
                                              </div>
                                              <div className="text-[11px] text-gray-600 mt-0.5">
                                                {item.benefactionType} → {item.objectType}
                                              </div>
                                              {item.description && (
                                                <div className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">
                                                  {item.description}
                                                </div>
                                              )}
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                              <div className="text-[13px] font-bold text-yellow-700">
                                                {Math.round(item.cost).toLocaleString()} HS
                                              </div>
                                              {item.costOriginalText && (
                                                <div className="text-[10px] text-gray-500">
                                                  ({item.costOriginalText})
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}

                                <div>
                                  <p className="text-[13px] text-gray-600 mb-3">恵与行為タイプの割合（クリックで詳細）</p>
                                  {/* Pie chart and legend side by side */}
                                  <div className="flex gap-4 items-center mb-3">
                                    {/* Pie chart */}
                                    <div className="flex-shrink-0">
                                      <svg width="180" height="180" viewBox="0 0 200 200" className="transform -rotate-90">
                                        {(() => {
                                          const totalCount = benefactionTypeData.reduce((sum, d) => sum + d.count, 0)
                                          const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']
                                          let currentAngle = 0
                                          return benefactionTypeData.map((item, index) => {
                                            const percentage = (item.count / totalCount) * 100
                                            const angle = (percentage / 100) * 360
                                            const startAngle = currentAngle
                                            const endAngle = currentAngle + angle
                                            currentAngle = endAngle

                                            const startRad = (startAngle * Math.PI) / 180
                                            const endRad = (endAngle * Math.PI) / 180
                                            const x1 = 100 + 90 * Math.cos(startRad)
                                            const y1 = 100 + 90 * Math.sin(startRad)
                                            const x2 = 100 + 90 * Math.cos(endRad)
                                            const y2 = 100 + 90 * Math.sin(endRad)
                                            const largeArcFlag = angle > 180 ? 1 : 0

                                            const isActive = selectedBenefactionType === item.benefactionType

                                            return (
                                              <path
                                                key={index}
                                                d={`M 100 100 L ${x1} ${y1} A 90 90 0 ${largeArcFlag} 1 ${x2} ${y2} Z`}
                                                fill={colors[index % colors.length]}
                                                stroke="white"
                                                strokeWidth="2"
                                                className="cursor-pointer transition-opacity hover:opacity-80"
                                                style={{ opacity: isActive ? 1 : 0.9 }}
                                                onClick={() => {
                                                  if (isActive) {
                                                    setSelectedBenefactionType(null)
                                                    if (statisticsFilter.type === 'benefactionType' && statisticsFilter.value === item.benefactionType) {
                                                      setStatisticsFilter({ type: null, value: null })
                                                    }
                                                  } else {
                                                    setSelectedBenefactionType(item.benefactionType)
                                                  }
                                                }}
                                              />
                                            )
                                          })
                                        })()}
                                      </svg>
                                    </div>
                                    {/* Legend */}
                                    <div className="flex-1 space-y-1">
                                      {benefactionTypeData.map((item, index) => {
                                        const totalCount = benefactionTypeData.reduce((sum, d) => sum + d.count, 0)
                                        const percentage = (item.count / totalCount) * 100
                                        const isActive = selectedBenefactionType === item.benefactionType
                                        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']
                                        const costData = benefactionCostData.find(c => c.benefactionType === item.benefactionType)
                                        return (
                                          <div
                                            key={index}
                                            className={`p-2 rounded cursor-pointer transition-colors ${
                                              isActive ? 'bg-blue-100 border border-blue-300' : 'hover:bg-gray-50'
                                            }`}
                                            onClick={() => {
                                              if (isActive) {
                                                setSelectedBenefactionType(null)
                                                if (statisticsFilter.type === 'benefactionType' && statisticsFilter.value === item.benefactionType) {
                                                  setStatisticsFilter({ type: null, value: null })
                                                }
                                              } else {
                                                setSelectedBenefactionType(item.benefactionType)
                                              }
                                            }}
                                          >
                                            <div className="flex items-center justify-between mb-1">
                                              <div className="flex items-center gap-2">
                                                <div
                                                  className="w-3 h-3 rounded-sm flex-shrink-0"
                                                  style={{ backgroundColor: colors[index % colors.length] }}
                                                />
                                                <span className="text-[13px] font-medium text-gray-900">{item.benefactionType}</span>
                                              </div>
                                              <span className="text-[12px] text-gray-600">{item.count}件 ({percentage.toFixed(1)}%)</span>
                                            </div>
                                            {costData && costData.countWithCost > 0 && (
                                              <div className="ml-5 text-[11px] text-gray-500">
                                                平均: {costData.avgCost ? `${Math.round(costData.avgCost).toLocaleString()} HS` : '-'}
                                                {costData.totalCost && ` (合計: ${Math.round(costData.totalCost).toLocaleString()} HS)`}
                                                <span className="ml-1">({costData.countWithCost}件にデータあり)</span>
                                              </div>
                                            )}
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                  {/* Filter button */}
                                  {selectedBenefactionType && !statisticsFilter.type && (
                                    <button
                                      onClick={() => {
                                        setStatisticsFilter({ type: 'benefactionType', value: selectedBenefactionType })
                                        setInfoSubTab('inscriptions')
                                      }}
                                      className="w-full px-3 py-2 text-[13px] bg-blue-50 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                                    >
                                      この恵与行為タイプでフィルタ
                                    </button>
                                  )}
                                  {statisticsFilter.type === 'benefactionType' && statisticsFilter.value === selectedBenefactionType && (
                                    <button
                                      onClick={() => {
                                        setStatisticsFilter({ type: null, value: null })
                                      }}
                                      className="w-full px-3 py-2 text-[13px] bg-gray-50 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                                    >
                                      フィルタ解除
                                    </button>
                                  )}
                                </div>

                                {/* Object types for selected benefaction type */}
                                {selectedBenefactionType && (
                                  <div className="pt-3 border-t border-gray-200">
                                    <p className="text-[13px] text-gray-600 mb-3">
                                      {selectedBenefactionType}の対象物（クリックでフィルタ）
                                    </p>
                                    {benefactionObjectTypeLoading ? (
                                      <p className="text-[14px] text-[#666]">データを読み込み中...</p>
                                    ) : benefactionObjectTypeData.length > 0 ? (
                                      <div className="flex gap-4 items-center">
                                        {/* Pie chart */}
                                        <div className="flex-shrink-0">
                                          <svg width="180" height="180" viewBox="0 0 200 200" className="transform -rotate-90">
                                            {(() => {
                                              const totalCount = benefactionObjectTypeData.reduce((sum, d) => sum + d.count, 0)
                                              const colors = ['#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#3b82f6', '#10b981', '#f59e0b', '#ef4444']
                                              let currentAngle = 0
                                              return benefactionObjectTypeData.map((item, index) => {
                                                const percentage = (item.count / totalCount) * 100
                                                const angle = (percentage / 100) * 360
                                                const startAngle = currentAngle
                                                const endAngle = currentAngle + angle
                                                currentAngle = endAngle

                                                const startRad = (startAngle * Math.PI) / 180
                                                const endRad = (endAngle * Math.PI) / 180
                                                const x1 = 100 + 90 * Math.cos(startRad)
                                                const y1 = 100 + 90 * Math.sin(startRad)
                                                const x2 = 100 + 90 * Math.cos(endRad)
                                                const y2 = 100 + 90 * Math.sin(endRad)
                                                const largeArcFlag = angle > 180 ? 1 : 0

                                                const isActive = statisticsFilter.type === 'objectType' && statisticsFilter.value === item.objectType

                                                return (
                                                  <path
                                                    key={index}
                                                    d={`M 100 100 L ${x1} ${y1} A 90 90 0 ${largeArcFlag} 1 ${x2} ${y2} Z`}
                                                    fill={colors[index % colors.length]}
                                                    stroke="white"
                                                    strokeWidth="2"
                                                    className="cursor-pointer transition-opacity hover:opacity-80"
                                                    style={{ opacity: isActive ? 1 : 0.9 }}
                                                    onClick={() => {
                                                      if (isActive) {
                                                        setStatisticsFilter({ type: null, value: null })
                                                      } else {
                                                        setStatisticsFilter({
                                                          type: 'objectType',
                                                          value: item.objectType,
                                                          benefactionTypeForObjectType: selectedBenefactionType
                                                        })
                                                        setInfoSubTab('inscriptions')
                                                      }
                                                    }}
                                                  />
                                                )
                                              })
                                            })()}
                                          </svg>
                                        </div>
                                        {/* Legend */}
                                        <div className="flex-1 space-y-1">
                                          {benefactionObjectTypeData.map((item, index) => {
                                            const totalCount = benefactionObjectTypeData.reduce((sum, d) => sum + d.count, 0)
                                            const percentage = (item.count / totalCount) * 100
                                            const isActive = statisticsFilter.type === 'objectType' && statisticsFilter.value === item.objectType
                                            const colors = ['#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#3b82f6', '#10b981', '#f59e0b', '#ef4444']
                                            const costData = benefactionObjectCostData.find(c => c.objectType === item.objectType)
                                            return (
                                              <div
                                                key={index}
                                                className={`p-2 rounded cursor-pointer transition-colors ${
                                                  isActive ? 'bg-blue-100 border border-blue-300' : 'hover:bg-gray-50'
                                                }`}
                                                onClick={() => {
                                                  if (isActive) {
                                                    setStatisticsFilter({ type: null, value: null })
                                                  } else {
                                                    setStatisticsFilter({
                                                      type: 'objectType',
                                                      value: item.objectType,
                                                      benefactionTypeForObjectType: selectedBenefactionType
                                                    })
                                                    setInfoSubTab('inscriptions')
                                                  }
                                                }}
                                              >
                                                <div className="flex items-center justify-between mb-1">
                                                  <div className="flex items-center gap-2">
                                                    <div
                                                      className="w-3 h-3 rounded-sm flex-shrink-0"
                                                      style={{ backgroundColor: colors[index % colors.length] }}
                                                    />
                                                    <span className="text-[13px] font-medium text-gray-900">{item.objectType}</span>
                                                  </div>
                                                  <span className="text-[12px] text-gray-600">{item.count}件 ({percentage.toFixed(1)}%)</span>
                                                </div>
                                                {costData && costData.countWithCost > 0 && (
                                                  <div className="ml-5 text-[11px] text-gray-500">
                                                    平均: {costData.avgCost ? `${Math.round(costData.avgCost).toLocaleString()} HS` : '-'}
                                                    {costData.totalCost && ` (合計: ${Math.round(costData.totalCost).toLocaleString()} HS)`}
                                                    <span className="ml-1">({costData.countWithCost}件にデータあり)</span>
                                                  </div>
                                                )}
                                              </div>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="text-[14px] text-[#666]">データがありません</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="text-[14px] text-[#666]">データがありません</p>
                            )}
                          </div>
                        )}

                        {/* Divinity statistics */}
                        {statisticsTab === 'divinity' && (
                          <div className="mt-4">
                            {divinityTypeLoading ? (
                              <p className="text-[14px] text-[#666]">データを読み込み中...</p>
                            ) : divinityTypeData.length > 0 ? (
                              <div>
                                <p className="text-[13px] text-gray-600 mb-3">神格タイプの割合（クリックでフィルタ）</p>
                                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                                  <div className="space-y-2">
                                    {divinityTypeData.map((item, index) => {
                                      const totalCount = divinityTypeData.reduce((sum, d) => sum + d.count, 0)
                                      const percentage = (item.count / totalCount) * 100
                                      const barPercentage = (item.count / Math.max(...divinityTypeData.map(d => d.count))) * 100
                                      const isActive = statisticsFilter.type === 'divinityType' && statisticsFilter.value === item.divinityType
                                      const label = item.divinityType.split('/').pop() || item.divinityType
                                      return (
                                        <div
                                          key={index}
                                          className={`py-2.5 px-3 rounded-md cursor-pointer transition-all border ${
                                            isActive
                                              ? 'bg-green-50 border-green-300 shadow-sm'
                                              : 'bg-gray-50 border-transparent hover:bg-gray-100 hover:border-gray-200'
                                          }`}
                                          onClick={() => {
                                            if (isActive) {
                                              setStatisticsFilter({ type: null, value: null })
                                            } else {
                                              setStatisticsFilter({ type: 'divinityType', value: item.divinityType })
                                              setInfoSubTab('inscriptions')
                                            }
                                          }}
                                        >
                                          <div className="flex items-center justify-between mb-1.5">
                                            <span className={`text-[13px] font-semibold ${isActive ? 'text-green-700' : 'text-gray-800'}`}>
                                              {label}
                                            </span>
                                            <span className={`text-[12px] font-semibold ${isActive ? 'text-green-600' : 'text-gray-600'}`}>
                                              {item.count}件 ({percentage.toFixed(1)}%)
                                            </span>
                                          </div>
                                          <div className="relative w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                              className={`absolute left-0 top-0 h-full rounded-full transition-all duration-300 ${
                                                isActive ? 'bg-green-500' : 'bg-green-400'
                                              }`}
                                              style={{ width: `${barPercentage}%` }}
                                            />
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <p className="text-[14px] text-[#666]">データがありません</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Display inscription detail view when active (multiple places) */}
                    {detailViewEdcsId && !detailViewLoading && detailViewData && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-[16px] font-semibold text-[#333]">碑文詳細</h4>
                          <button
                            onClick={handleCloseInscriptionDetail}
                            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded transition-colors text-[13px]"
                          >
                            一覧に戻る
                          </button>
                        </div>

                        <div className="space-y-4">
                          {/* Metadata Section */}
                          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                            <h5 className="font-semibold text-gray-900 mb-3 text-[14px]">メタデータ</h5>

                            <div className="flex text-[13px]">
                              <span className="font-medium text-gray-700 w-24">EDCS ID:</span>
                              <span className="text-gray-600">{detailViewData.edcsId}</span>
                            </div>

                            {detailViewData.datingFrom !== null && detailViewData.datingTo !== null && (
                              <div className="flex text-[13px]">
                                <span className="font-medium text-gray-700 w-24">年代:</span>
                                <span className="text-gray-600">
                                  {detailViewData.datingFrom} - {detailViewData.datingTo}
                                </span>
                              </div>
                            )}

                            {detailViewData.province && (
                              <div className="flex text-[13px]">
                                <span className="font-medium text-gray-700 w-24">属州:</span>
                                <span className="text-gray-600">{detailViewData.province}</span>
                              </div>
                            )}

                            {detailViewData.place && (
                              <div className="flex text-[13px]">
                                <span className="font-medium text-gray-700 w-24">場所:</span>
                                <span className="text-gray-600">{detailViewData.place}</span>
                              </div>
                            )}

                            {detailViewData.bibliographicCitation && (
                              <div className="flex text-[13px]">
                                <span className="font-medium text-gray-700 w-24">出典:</span>
                                <span className="text-gray-600">{detailViewData.bibliographicCitation}</span>
                              </div>
                            )}
                          </div>

                          {/* Text Section */}
                          {detailViewData.text && (
                            <div>
                              <h5 className="font-semibold text-gray-900 mb-3 text-[14px]">碑文テキスト</h5>
                              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                {detailViewData.text.split('//').map((block: string, blockIndex: number) => (
                                  <div key={blockIndex} className="mb-4 last:mb-0">
                                    {block.split('/').map((line: string, lineIndex: number) => (
                                      <div key={lineIndex} className="text-gray-800 leading-relaxed text-[13px]">
                                        {line.trim()}
                                      </div>
                                    ))}
                                    {blockIndex < detailViewData.text.split('//').length - 1 && (
                                      <div className="border-t border-blue-300 my-3"></div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Comment Section */}
                          {detailViewData.comment && (
                            <div>
                              <h5 className="font-semibold text-gray-900 mb-3 text-[14px]">コメント</h5>
                              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-[13px]">
                                  {detailViewData.comment}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {detailViewLoading && (
                      <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                        <p className="text-[14px] text-[#666]">碑文データを読み込み中...</p>
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
