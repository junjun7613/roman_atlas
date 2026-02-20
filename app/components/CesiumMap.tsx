'use client'

import { useEffect, useRef, useState } from 'react'
import { queryInscriptionsByPlaceId, queryInscriptionDetails, queryMosaicsByPlaceId } from '../utils/sparql'

export default function CesiumMap() {
  const cesiumContainerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<any>(null)
  const eventListenersRef = useRef<Array<{element: HTMLElement, event: string, handler: EventListener}>>([])
  const cesiumRef = useRef<any>(null)

  // Time slider states
  const [timeStart, setTimeStart] = useState(-800)
  const [timeEnd, setTimeEnd] = useState(800)
  const [showTimeSlider, setShowTimeSlider] = useState(false)

  // Input field states (for editing)
  const [timeStartInput, setTimeStartInput] = useState('-800')
  const [timeEndInput, setTimeEndInput] = useState('800')

  // Store place event listeners in window for cleanup
  if (typeof window !== 'undefined' && !(window as any).cesiumPlaceEventListeners) {
    (window as any).cesiumPlaceEventListeners = []
  }

  useEffect(() => {
    const addEventListenerTracked = (elementId: string, eventType: string, handler: EventListener) => {
      const element = document.getElementById(elementId)
      if (element) {
        element.addEventListener(eventType, handler)
        eventListenersRef.current.push({ element, event: eventType, handler })
      }
    }
    // Cesium CSSを動的に読み込み
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = '/cesium/Widgets/widgets.css'
    document.head.appendChild(link)

    // Cesiumを動的にインポート
    const loadCesium = async () => {
      // @ts-ignore
      const Cesium = await import('cesium')
      cesiumRef.current = Cesium

      // Cesiumの静的アセットへのパスを設定
      ;(window as any).CESIUM_BASE_URL = '/cesium/'

      // Cesium Ion トークンの設定
      const cesiumToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN
      if (!cesiumToken) {
        console.error('NEXT_PUBLIC_CESIUM_ION_TOKEN is not set in environment variables')
        return
      }
      Cesium.Ion.defaultAccessToken = cesiumToken

      if (!cesiumContainerRef.current) return

      try {
        // Viewerの初期化
        const viewer = new Cesium.Viewer(cesiumContainerRef.current, {
          terrain: Cesium.Terrain.fromWorldTerrain(),
          baseLayerPicker: true,
          geocoder: false,
          homeButton: true,
          sceneModePicker: true,
          navigationHelpButton: false,
          animation: false,
          timeline: false,
          fullscreenButton: true
        })

        viewerRef.current = viewer

        // 標高カラーマップレイヤーを追加
        // Stadia Maps APIキーが設定されていればStamen Terrainを使用、なければOpenTopoMapにフォールバック
        const stadiaApiKey = process.env.NEXT_PUBLIC_STADIA_MAPS_API_KEY
        const useStadiaMaps = stadiaApiKey && stadiaApiKey !== 'your_stadia_maps_api_key_here'

        const elevationLayer = useStadiaMaps
          ? viewer.imageryLayers.addImageryProvider(
              new Cesium.UrlTemplateImageryProvider({
                url: `https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}.png?api_key=${stadiaApiKey}`,
                credit: 'Map tiles by Stamen Design, under CC BY 3.0. Data by OpenStreetMap, under ODbL.'
              })
            )
          : viewer.imageryLayers.addImageryProvider(
              new Cesium.UrlTemplateImageryProvider({
                url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
                credit: 'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)',
                subdomains: ['a', 'b', 'c']
              })
            )
        elevationLayer.alpha = 0.6
        elevationLayer.show = true

        // Provincesデータの読み込み
        // 環境変数が設定されている場合はAPI Route経由、そうでない場合はローカルファイル
        const provincesUrl = process.env.NEXT_PUBLIC_PROVINCES_URL
          ? '/api/data/provinces'
          : '/provinces.geojson'
        fetch(provincesUrl)
          .then(response => {
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`)
            }
            return response.json()
          })
          .then(geojsonData => {
            Cesium.GeoJsonDataSource.load(geojsonData, {
              stroke: Cesium.Color.WHITE,
              strokeWidth: 2,
              fill: Cesium.Color.BLUE.withAlpha(0.3),
              clampToGround: true
            }).then((dataSource: any) => {
              viewer.dataSources.add(dataSource)
              // @ts-ignore
              window.provincesDataSource = dataSource

              const entities = dataSource.entities.values
              for (let i = 0; i < entities.length; i++) {
                const entity = entities[i]
                if (entity.polygon) {
                  entity.polygon.material = Cesium.Color.CORNFLOWERBLUE.withAlpha(0.5)
                  entity.polygon.outline = false
                  entity.polygon.heightReference = Cesium.HeightReference.CLAMP_TO_GROUND

                  const hierarchy = entity.polygon.hierarchy.getValue()
                  const outerPositions = hierarchy.positions

                  if (outerPositions) {
                    dataSource.entities.add({
                      polyline: {
                        positions: outerPositions,
                        width: 3,
                        material: Cesium.Color.WHITE,
                        clampToGround: true,
                        arcType: Cesium.ArcType.GEODESIC
                      }
                    })

                    if (hierarchy.holes) {
                      for (let j = 0; j < hierarchy.holes.length; j++) {
                        const holePositions = hierarchy.holes[j].positions
                        dataSource.entities.add({
                          polyline: {
                            positions: holePositions,
                            width: 3,
                            material: Cesium.Color.WHITE,
                            clampToGround: true,
                            arcType: Cesium.ArcType.GEODESIC
                          }
                        })
                      }
                    }
                  }
                }

                if (entity.properties && entity.properties.name) {
                  entity.name = entity.properties.name._value
                  entity.description = `<div style="padding: 10px;">
                    <h3 style="margin: 0 0 10px 0; color: #333;">${entity.properties.name._value}</h3>
                    <p style="margin: 0; color: #666;">Province of the Roman Empire</p>
                  </div>`
                }
              }

              // Check initial checkbox state
              const provinceToggle = document.getElementById('toggleProvinces') as HTMLInputElement
              dataSource.show = provinceToggle ? provinceToggle.checked : true

              addEventListenerTracked('toggleProvinces', 'change', (e: any) => {
                dataSource.show = e.target.checked
              })

              viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(12.4964, 35.9028, 1500000),
                orientation: {
                  heading: Cesium.Math.toRadians(0.0),
                  pitch: Cesium.Math.toRadians(-45.0),
                  roll: 0.0
                },
                duration: 3.0
              })
            })
          })

        // ルートデータの読み込み
        loadRoutes(Cesium, viewer, addEventListenerTracked)

        // Pleiades Placesの読み込み
        loadPleiadesPlaces(Cesium, viewer, addEventListenerTracked)

        // カスタムプレイス（CSV）の読み込み
        loadCustomPlaces(Cesium, viewer, addEventListenerTracked)

        // 標高マップの表示/非表示の切り替え
        addEventListenerTracked('toggleElevation', 'change', (e: any) => {
          elevationLayer.show = e.target.checked
        })

        // クリックイベントハンドラー
        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
        const clickAction = async (click: any) => {
          const pickedObject = viewer.scene.pick(click.position)
          if (Cesium.defined(pickedObject) && Cesium.defined(pickedObject.id)) {
            viewer.selectedEntity = pickedObject.id

            // Try to fetch inscription data if entity has properties
            const entity = pickedObject.id
            if (entity.properties) {
              let placeId = ''
              let customId = ''
              const title = entity.properties.title ? entity.properties.title.getValue() : entity.name || 'Unnamed'

              // Try to get Pleiades ID from URI
              if (entity.properties.uri) {
                const uri = entity.properties.uri.getValue()
                const match = uri.match(/\/places\/(\d+)/)
                if (match) {
                  placeId = match[1]
                }
              }

              // Try to get custom place ID
              if (entity.properties.id) {
                customId = entity.properties.id.getValue()
              }

              // Fetch inscription data if Pleiades ID or custom ID exists
              if (placeId || customId) {
                const setInscriptionData = (window as any).setInscriptionData
                if (setInscriptionData) {
                  // Set loading state
                  setInscriptionData({
                    type: 'single',
                    placeName: title,
                    placeId: placeId || customId,
                    count: 0,
                    loading: true,
                    mosaicsLoading: true
                  })

                  // Query SPARQL endpoint with both Pleiades ID and custom location ID
                  // For custom places, use the ID as-is (e.g., "315247_002")
                  let customLocationId: string | undefined = undefined
                  if (customId) {
                    customLocationId = customId
                  }

                  // Query inscriptions
                  const count = await queryInscriptionsByPlaceId(
                    placeId || customId,
                    customLocationId
                  )
                  const inscriptions = await queryInscriptionDetails(
                    placeId || customId,
                    customLocationId
                  )

                  // Query mosaics
                  const mosaics = await queryMosaicsByPlaceId(placeId || customId)

                  // Update with results
                  setInscriptionData({
                    type: 'single',
                    placeName: title,
                    placeId: placeId || customId,
                    customLocationId: customLocationId,
                    count: count,
                    loading: false,
                    inscriptions: inscriptions,
                    mosaics: mosaics,
                    mosaicsLoading: false
                  })
                }
              }
            }
          }
        }
        handler.setInputAction(clickAction, Cesium.ScreenSpaceEventType.LEFT_CLICK)

        const mouseMoveAction = (movement: any) => {
          const pickedObject = viewer.scene.pick(movement.endPosition)
          if (Cesium.defined(pickedObject) && Cesium.defined(pickedObject.id)) {
            viewer.canvas.style.cursor = 'pointer'
          } else {
            viewer.canvas.style.cursor = 'default'
          }
        }
        handler.setInputAction(mouseMoveAction, Cesium.ScreenSpaceEventType.MOUSE_MOVE)

      } catch (error) {
        console.error('Cesium initialization error:', error)
      }
    }

    loadCesium()

    return () => {
      // Remove all tracked event listeners
      eventListenersRef.current.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler)
      })
      eventListenersRef.current = []

      // Destroy viewer
      if (viewerRef.current) {
        viewerRef.current.destroy()
        viewerRef.current = null
      }
    }
  }, [])

  // Function to load inscriptions for a selected place
  const loadInscriptionsForPlace = async (placeId: string, placeName: string, customLocationId?: string) => {
    const setInscriptionData = (window as any).setInscriptionData
    if (setInscriptionData) {
      // Set loading state
      setInscriptionData({
        type: 'single',
        placeName: placeName,
        placeId: placeId,
        customLocationId: customLocationId,
        count: 0,
        loading: true
      })

      // Query SPARQL endpoint for inscription details
      const count = await queryInscriptionsByPlaceId(placeId, customLocationId)
      const inscriptions = await queryInscriptionDetails(placeId, customLocationId)

      // Update with results
      setInscriptionData({
        type: 'single',
        placeName: placeName,
        placeId: placeId,
        customLocationId: customLocationId,
        count: count,
        loading: false,
        inscriptions: inscriptions
      })
    }
  }

  // Expose loadInscriptionsForPlace to window for ControlPanel to use
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).loadInscriptionsForPlace = loadInscriptionsForPlace
    }
  }, [])

  // Time slider effect - reload places when time range changes
  useEffect(() => {
    if (!viewerRef.current || !cesiumRef.current) return
    if (!showTimeSlider) return

    const viewer = viewerRef.current
    const Cesium = cesiumRef.current

    console.log('Cesium: Reloading places with time filter:', timeStart, 'to', timeEnd)

    // Save checkbox states before clearing
    const typeConfigs = [
      { key: 'settlement', toggle: 'toggleSettlements' },
      { key: 'villa', toggle: 'toggleVillas' },
      { key: 'fort', toggle: 'toggleForts' },
      { key: 'temple', toggle: 'toggleTemples' },
      { key: 'station', toggle: 'toggleStations' },
      { key: 'archaeological', toggle: 'toggleArchaeological' },
      { key: 'cemetery', toggle: 'toggleCemetery' },
      { key: 'sanctuary', toggle: 'toggleSanctuary' },
      { key: 'bridge', toggle: 'toggleBridge' },
      { key: 'aqueduct', toggle: 'toggleAqueduct' },
      { key: 'church', toggle: 'toggleChurch' },
      { key: 'bath', toggle: 'toggleBath' },
      { key: 'quarry', toggle: 'toggleQuarry' },
      { key: 'port', toggle: 'togglePort' },
      { key: 'theater', toggle: 'toggleTheater' },
      { key: 'amphitheatre', toggle: 'toggleAmphitheatre' }
    ]

    const checkboxStates: { [key: string]: boolean } = {}
    typeConfigs.forEach(config => {
      const checkbox = document.getElementById(config.toggle) as HTMLInputElement
      if (checkbox) {
        checkboxStates[config.key] = checkbox.checked
      }
    })

    // Clear existing place event listeners
    if ((window as any).cesiumPlaceEventListeners) {
      (window as any).cesiumPlaceEventListeners.forEach(({ element, event, handler }: any) => {
        element.removeEventListener(event, handler)
      })
      ;(window as any).cesiumPlaceEventListeners = []
    }

    // Remove existing place data sources using window global array
    if ((window as any).placeDataSources) {
      (window as any).placeDataSources.forEach((dataSource: any) => {
        viewer.dataSources.remove(dataSource)
      })
      // Clean up window references
      const windowObj = window as any
      const keys = Object.keys(windowObj).filter((key: string) => key.startsWith('pleiades') && key.endsWith('DataSource'))
      keys.forEach((key: string) => {
        delete windowObj[key]
      })
      windowObj.placeDataSources = []
    }

    // Create a function to track data sources
    const addEventListenerTracked = (elementId: string, eventType: string, handler: EventListener) => {
      const element = document.getElementById(elementId)
      if (element) {
        element.addEventListener(eventType, handler)
      }
    }

    // Reload places with time filter
    loadPleiadesPlaces(Cesium, viewer, addEventListenerTracked, timeStart, timeEnd)

    // Restore checkbox states - retry until data sources are loaded
    const restoreCheckboxes = (attempt: number = 0) => {
      if (attempt > 20) {
        console.log('Cesium: Failed to restore checkboxes after 20 attempts')
        console.log('Cesium: Final checkbox states were:', checkboxStates)
        return
      }

      let allLoaded = true
      const missingDataSources: string[] = []

      typeConfigs.forEach(config => {
        if (checkboxStates[config.key]) {
          const dataSource = (window as any)[`pleiades${config.key}DataSource`]
          if (!dataSource) {
            allLoaded = false
            missingDataSources.push(config.key)
          }
        }
      })

      if (!allLoaded) {
        console.log(`Cesium: Attempt ${attempt + 1}: Waiting for data sources: ${missingDataSources.join(', ')}`)
        setTimeout(() => restoreCheckboxes(attempt + 1), 200)
        return
      }

      console.log('Cesium: All data sources loaded, restoring checkbox states:', checkboxStates)

      typeConfigs.forEach(config => {
        const checkbox = document.getElementById(config.toggle) as HTMLInputElement
        const dataSource = (window as any)[`pleiades${config.key}DataSource`]

        if (checkbox && checkboxStates[config.key] && dataSource) {
          console.log(`Cesium: Restoring checkbox for ${config.key}, setting dataSource.show to true`)
          // Directly set the dataSource.show property instead of relying on event dispatch
          dataSource.show = true
          checkbox.checked = true
          console.log(`Cesium: DataSource ${config.key} show state:`, dataSource.show)
          console.log(`Cesium: DataSource ${config.key} entities count:`, dataSource.entities.values.length)
          console.log(`Cesium: DataSource ${config.key} in viewer:`, viewer.dataSources.contains(dataSource))
        } else if (checkbox && !checkboxStates[config.key]) {
          // Ensure unchecked items stay unchecked
          checkbox.checked = false
          if (dataSource) {
            dataSource.show = false
          }
        }
      })
    }

    restoreCheckboxes()
  }, [timeStart, timeEnd])

  return (
    <>
      {/* Top button group - aligned with 2D/3D switcher */}
      <div className="absolute top-4 left-[280px] z-[1000] flex gap-2">
        {/* Time filter toggle button */}
        <button
          onClick={() => setShowTimeSlider(!showTimeSlider)}
          className={`px-4 py-2 rounded-lg shadow-lg font-medium transition-colors ${
            showTimeSlider
              ? 'bg-purple-500 text-white hover:bg-purple-600'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
          title="Toggle Time Filter"
        >
          {showTimeSlider ? 'Hide Filter' : 'Time Filter'}
        </button>
      </div>

      {/* Time Filter */}
      {showTimeSlider && (
        <div className="absolute bottom-4 left-4 z-[1000] bg-white px-6 py-3 rounded-lg shadow-lg" style={{ width: '300px' }}>
          <div className="text-sm font-medium text-gray-700 mb-3">Time Range Filter</div>
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <label className="text-xs text-gray-600 block mb-1">Start Year</label>
              <input
                type="text"
                value={timeStartInput}
                onChange={(e) => {
                  setTimeStartInput(e.target.value)
                }}
                onBlur={(e) => {
                  const value = e.target.value
                  const newStart = parseInt(value)
                  if (!isNaN(newStart)) {
                    setTimeStart(newStart)
                    setTimeStartInput(newStart.toString())
                    console.log('Time range:', newStart, 'to', timeEnd)
                  } else {
                    // Reset to current value if invalid
                    setTimeStartInput(timeStart.toString())
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur()
                  }
                }}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                placeholder="-800"
              />
            </div>
            <div className="text-gray-500 mt-5">〜</div>
            <div className="flex-1">
              <label className="text-xs text-gray-600 block mb-1">End Year</label>
              <input
                type="text"
                value={timeEndInput}
                onChange={(e) => {
                  setTimeEndInput(e.target.value)
                }}
                onBlur={(e) => {
                  const value = e.target.value
                  const newEnd = parseInt(value)
                  if (!isNaN(newEnd)) {
                    setTimeEnd(newEnd)
                    setTimeEndInput(newEnd.toString())
                    console.log('Time range:', timeStart, 'to', newEnd)
                  } else {
                    // Reset to current value if invalid
                    setTimeEndInput(timeEnd.toString())
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur()
                  }
                }}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                placeholder="800"
              />
            </div>
          </div>
        </div>
      )}

      <div ref={cesiumContainerRef} className="w-full h-full" />
    </>
  )
}

function loadRoutes(Cesium: any, viewer: any, addEventListenerTracked: (elementId: string, eventType: string, handler: EventListener) => void) {
  // 環境変数が設定されている場合はAPI Route経由、そうでない場合はローカルファイル
  const routesUrl = process.env.NEXT_PUBLIC_ROUTES_URL
    ? '/api/data/routes'
    : '/route-segments-all.ndjson'
  fetch(routesUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      return response.text()
    })
    .then(ndjsonText => {
      const lines = ndjsonText.trim().split('\n')
      const features = lines.map(line => {
        try {
          return JSON.parse(line)
        } catch (e) {
          return null
        }
      }).filter(f => f !== null)

      const mainRoadFeatures = features.filter((f: any) => f.properties?.type === 'Main Road')
      const secondaryRoadFeatures = features.filter((f: any) => f.properties?.type === 'Secondary Road')
      const seaLaneFeatures = features.filter((f: any) => f.properties?.type === 'Sea Lane')
      const riverFeatures = features.filter((f: any) => f.properties?.type === 'River')

      // Main Road
      Cesium.GeoJsonDataSource.load({ type: 'FeatureCollection', features: mainRoadFeatures }, {
        stroke: Cesium.Color.DARKORANGE,
        strokeWidth: 3,
        clampToGround: false
      }).then((dataSource: any) => {
        // @ts-ignore
        window.mainRoadDataSource = dataSource
        viewer.dataSources.add(dataSource)

        const entities = dataSource.entities.values
        for (let i = 0; i < entities.length; i++) {
          const entity = entities[i]
          if (entity.polyline) {
            entity.polyline.material = Cesium.Color.DARKORANGE.withAlpha(0.8)
            entity.polyline.width = 4
            entity.polyline.clampToGround = true
            entity.polyline.arcType = Cesium.ArcType.GEODESIC
          }
          setupRouteEntity(entity, Cesium)
        }

        // Check initial checkbox state
        const mainRoadToggle = document.getElementById('toggleMainRoad') as HTMLInputElement
        dataSource.show = mainRoadToggle ? mainRoadToggle.checked : true

        addEventListenerTracked('toggleMainRoad', 'change', (e: any) => {
          dataSource.show = e.target.checked
        })
      })

      // Secondary Road
      Cesium.GeoJsonDataSource.load({ type: 'FeatureCollection', features: secondaryRoadFeatures }, {
        stroke: Cesium.Color.ORANGE,
        strokeWidth: 2,
        clampToGround: false
      }).then((dataSource: any) => {
        // @ts-ignore
        window.secondaryRoadDataSource = dataSource
        viewer.dataSources.add(dataSource)

        const entities = dataSource.entities.values
        for (let i = 0; i < entities.length; i++) {
          const entity = entities[i]
          if (entity.polyline) {
            entity.polyline.material = Cesium.Color.ORANGE.withAlpha(0.7)
            entity.polyline.width = 2
            entity.polyline.clampToGround = true
            entity.polyline.arcType = Cesium.ArcType.GEODESIC
          }
          setupRouteEntity(entity, Cesium)
        }

        // Check initial checkbox state
        const secondaryRoadToggle = document.getElementById('toggleSecondaryRoad') as HTMLInputElement
        dataSource.show = secondaryRoadToggle ? secondaryRoadToggle.checked : true

        addEventListenerTracked('toggleSecondaryRoad', 'change', (e: any) => {
          dataSource.show = e.target.checked
        })
      })

      // Sea Lane
      Cesium.GeoJsonDataSource.load({ type: 'FeatureCollection', features: seaLaneFeatures }, {
        stroke: Cesium.Color.CYAN,
        strokeWidth: 3,
        clampToGround: false
      }).then((dataSource: any) => {
        // @ts-ignore
        window.seaLaneDataSource = dataSource
        viewer.dataSources.add(dataSource)

        const entities = dataSource.entities.values
        for (let i = 0; i < entities.length; i++) {
          const entity = entities[i]
          if (entity.polyline) {
            entity.polyline.material = Cesium.Color.CYAN.withAlpha(0.8)
            entity.polyline.width = 3
            entity.polyline.clampToGround = true
            entity.polyline.arcType = Cesium.ArcType.GEODESIC
          }
          setupRouteEntity(entity, Cesium)
        }

        // Check initial checkbox state
        const seaLaneToggle = document.getElementById('toggleSeaLane') as HTMLInputElement
        dataSource.show = seaLaneToggle ? seaLaneToggle.checked : true

        addEventListenerTracked('toggleSeaLane', 'change', (e: any) => {
          dataSource.show = e.target.checked
        })
      })

      // River
      Cesium.GeoJsonDataSource.load({ type: 'FeatureCollection', features: riverFeatures }, {
        stroke: Cesium.Color.BLUE,
        strokeWidth: 3,
        clampToGround: false
      }).then((dataSource: any) => {
        // @ts-ignore
        window.riversDataSource = dataSource
        viewer.dataSources.add(dataSource)

        const entities = dataSource.entities.values
        for (let i = 0; i < entities.length; i++) {
          const entity = entities[i]
          if (entity.polyline) {
            entity.polyline.material = Cesium.Color.BLUE.withAlpha(0.8)
            entity.polyline.width = 3
            entity.polyline.clampToGround = true
            entity.polyline.arcType = Cesium.ArcType.GEODESIC
          }
          setupRouteEntity(entity, Cesium)
        }

        // Check initial checkbox state
        const riverToggle = document.getElementById('toggleRiver') as HTMLInputElement
        dataSource.show = riverToggle ? riverToggle.checked : true

        addEventListenerTracked('toggleRiver', 'change', (e: any) => {
          dataSource.show = e.target.checked
        })
      })
    })
    .catch(error => console.error('Route data loading error:', error))
}

function setupRouteEntity(entity: any, Cesium: any) {
  if (entity.properties && entity.properties.name) {
    const routeName = entity.properties.name.getValue()
    const routeType = entity.properties.type ? entity.properties.type.getValue() : 'Unknown'
    let routeId = null
    if (entity.properties._id) {
      routeId = entity.properties._id.getValue()
    } else if (entity.properties.id) {
      routeId = entity.properties.id.getValue()
    }

    entity.name = `Route: ${routeName}`
    let descriptionHtml = `<div style="padding: 10px;">
      <h3 style="margin: 0 0 10px 0; color: #333;">${routeName}</h3>
      <p style="margin: 5px 0; color: #666;">Type: ${routeType}</p>
      <p style="margin: 5px 0; color: #666;">Itiner-e ID: ${routeId}</p>`

    if (routeId) {
      descriptionHtml += `<p style="margin: 5px 0;">
        <a href="https://itiner-e.org/route-segment/${routeId}" target="_blank" style="color: #6688ff; text-decoration: none;">
          View on Itiner-e →
        </a>
      </p>`
    }
    descriptionHtml += `</div>`
    entity.description = descriptionHtml
  }
}

function loadPleiadesPlaces(Cesium: any, viewer: any, addEventListenerTracked: (elementId: string, eventType: string, handler: EventListener) => void, filterTimeStart?: number, filterTimeEnd?: number) {
  // 環境変数が設定されている場合はAPI Route経由、そうでない場合はローカルファイル
  const placesUrl = process.env.NEXT_PUBLIC_PLACES_URL
    ? '/api/data/places'
    : '/pleiades-places-filtered-expanded-with-dates.json'
  fetch(placesUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      return response.json()
    })
    .then(data => {
      const places = data['@graph']
      const placesByType: any = {
        settlement: [], villa: [], fort: [], temple: [], station: [], archaeological: [],
        cemetery: [], sanctuary: [], bridge: [], aqueduct: [], church: [], bath: [],
        quarry: [], port: [], theater: [], amphitheatre: []
      }

      places.forEach((place: any) => {
        const placeTypes = place.placeTypes || []
        const reprPoint = place.reprPoint
        if (!reprPoint) return

        // Time filtering logic
        if (filterTimeStart !== undefined && filterTimeEnd !== undefined) {
          const placeStart = place.start_date
          const placeEnd = place.end_date

          // If place has date information, check if it overlaps with filter range
          if (placeStart !== undefined || placeEnd !== undefined) {
            // Check if there's any overlap between place period and filter range
            const actualStart = placeStart !== undefined ? placeStart : -Infinity
            const actualEnd = placeEnd !== undefined ? placeEnd : Infinity

            // No overlap if place ends before filter starts or place starts after filter ends
            if (actualEnd < filterTimeStart || actualStart > filterTimeEnd) {
              return // Skip this place
            }
          }
          // If place has no date information, include it (as per requirement)
        }

        const feature = {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: reprPoint },
          properties: {
            title: place.title || 'Unnamed',
            description: place.description || '',
            placeTypes: placeTypes,
            uri: "https://pleiades.stoa.org/places/" + place.id || '',
            startDate: place.start_date,
            endDate: place.end_date
          }
        }

        if (placeTypes.includes('settlement')) placesByType.settlement.push(feature)
        if (placeTypes.includes('villa')) placesByType.villa.push(feature)
        if (placeTypes.includes('fort') || placeTypes.includes('fort-2')) placesByType.fort.push(feature)
        if (placeTypes.includes('temple-2') || placeTypes.includes('temple')) placesByType.temple.push(feature)
        if (placeTypes.includes('station')) placesByType.station.push(feature)
        if (placeTypes.includes('archaeological-site')) placesByType.archaeological.push(feature)
        if (placeTypes.includes('cemetery')) placesByType.cemetery.push(feature)
        if (placeTypes.includes('sanctuary')) placesByType.sanctuary.push(feature)
        if (placeTypes.includes('bridge')) placesByType.bridge.push(feature)
        if (placeTypes.includes('aqueduct')) placesByType.aqueduct.push(feature)
        if (placeTypes.includes('church')) placesByType.church.push(feature)
        if (placeTypes.includes('bath')) placesByType.bath.push(feature)
        if (placeTypes.includes('quarry')) placesByType.quarry.push(feature)
        if (placeTypes.includes('port')) placesByType.port.push(feature)
        if (placeTypes.includes('theater')) placesByType.theater.push(feature)
        if (placeTypes.includes('amphitheatre')) placesByType.amphitheatre.push(feature)
      })

      const typeConfigs = [
        { key: 'settlement', color: Cesium.Color.GOLD, name: 'Cities & Settlements', toggle: 'toggleSettlements' },
        { key: 'villa', color: Cesium.Color.LIGHTGREEN, name: 'Villas', toggle: 'toggleVillas' },
        { key: 'fort', color: Cesium.Color.RED, name: 'Forts', toggle: 'toggleForts' },
        { key: 'temple', color: Cesium.Color.PURPLE, name: 'Temples', toggle: 'toggleTemples' },
        { key: 'station', color: Cesium.Color.ORANGE, name: 'Stations', toggle: 'toggleStations' },
        { key: 'archaeological', color: Cesium.Color.BROWN, name: 'Archaeological Sites', toggle: 'toggleArchaeological' },
        { key: 'cemetery', color: Cesium.Color.GRAY, name: 'Cemeteries', toggle: 'toggleCemetery' },
        { key: 'sanctuary', color: Cesium.Color.VIOLET, name: 'Sanctuaries', toggle: 'toggleSanctuary' },
        { key: 'bridge', color: Cesium.Color.SILVER, name: 'Bridges', toggle: 'toggleBridge' },
        { key: 'aqueduct', color: Cesium.Color.CYAN, name: 'Aqueducts', toggle: 'toggleAqueduct' },
        { key: 'church', color: Cesium.Color.PINK, name: 'Churches', toggle: 'toggleChurch' },
        { key: 'bath', color: Cesium.Color.AQUA, name: 'Baths', toggle: 'toggleBath' },
        { key: 'quarry', color: Cesium.Color.SANDYBROWN, name: 'Quarries', toggle: 'toggleQuarry' },
        { key: 'port', color: Cesium.Color.NAVY, name: 'Harbors', toggle: 'togglePort' },
        { key: 'theater', color: Cesium.Color.CORAL, name: 'Theaters', toggle: 'toggleTheater' },
        { key: 'amphitheatre', color: Cesium.Color.CRIMSON, name: 'Amphitheaters', toggle: 'toggleAmphitheatre' }
      ]

      // Log filtering results
      if (filterTimeStart !== undefined && filterTimeEnd !== undefined) {
        console.log(`Cesium: Time filtering active (${filterTimeStart} to ${filterTimeEnd}). Places by type:`)
        typeConfigs.forEach(config => {
          const count = placesByType[config.key].length
          if (count > 0) {
            console.log(`  ${config.name} (${config.key}): ${count} places`)
          }
        })
      }

      typeConfigs.forEach(config => {
        const geojson = { type: 'FeatureCollection', features: placesByType[config.key] }
        if (geojson.features.length === 0) return

        Cesium.GeoJsonDataSource.load(geojson, {
          markerColor: config.color,
          markerSize: 24,
          clampToGround: true
        }).then((dataSource: any) => {
          console.log(`Cesium: Loaded ${config.key} dataSource with ${dataSource.entities.values.length} entities`)
          // @ts-ignore
          window[`pleiades${config.key}DataSource`] = dataSource
          // Store in global tracking array for time filtering
          if (!(window as any).placeDataSources) {
            (window as any).placeDataSources = []
          }
          (window as any).placeDataSources.push(dataSource)

          dataSource.show = false
          viewer.dataSources.add(dataSource)

          const entities = dataSource.entities.values
          console.log(`Cesium: Processing ${entities.length} entities for ${config.key}`)
          for (let i = 0; i < entities.length; i++) {
            const entity = entities[i]
            if (entity.billboard) {
              entity.billboard.show = true
              entity.billboard.color = config.color.withAlpha(0.8)
              entity.billboard.scale = 0.5
              entity.billboard.heightReference = Cesium.HeightReference.CLAMP_TO_GROUND
              if (i === 0) {
                console.log(`Cesium: First entity billboard configured for ${config.key}:`, {
                  show: entity.billboard.show ? entity.billboard.show.getValue() : 'undefined',
                  scale: entity.billboard.scale ? entity.billboard.scale.getValue() : 'undefined'
                })
              }
            } else if (i === 0) {
              console.log(`Cesium: Warning - First entity in ${config.key} has no billboard`)
            }

            if (entity.properties) {
              const title = entity.properties.title ? entity.properties.title.getValue() : 'Unnamed'
              const description = entity.properties.description ? entity.properties.description.getValue() : ''
              const uri = entity.properties.uri ? entity.properties.uri.getValue() : ''
              const placeTypesArray = entity.properties.placeTypes ? entity.properties.placeTypes.getValue() : []
              const startDate = entity.properties.startDate ? entity.properties.startDate.getValue() : undefined
              const endDate = entity.properties.endDate ? entity.properties.endDate.getValue() : undefined

              // Extract Pleiades ID from URI
              let placeId = ''
              if (uri) {
                const match = uri.match(/\/places\/(\d+)/)
                if (match) {
                  placeId = match[1]
                }
              }

              entity.name = title
              let descriptionHtml = `<div style="padding: 10px;">
                <h3 style="margin: 0 0 10px 0; color: #333;">${title}</h3>
                <p style="margin: 5px 0; color: #666;">Type: ${config.name} (${placeTypesArray.join(', ')})</p>`

              if (placeId) {
                descriptionHtml += `<p style="margin: 5px 0; color: #666;">Pleiades ID: ${placeId}</p>`
              }

              // Add date range if available
              if (startDate !== undefined || endDate !== undefined) {
                let dateStr = ''
                if (startDate !== undefined && endDate !== undefined) {
                  dateStr = `${startDate} - ${endDate}`
                } else if (startDate !== undefined) {
                  dateStr = `${startDate} -`
                } else if (endDate !== undefined) {
                  dateStr = `- ${endDate}`
                }
                if (dateStr) {
                  descriptionHtml += `<p style="margin: 5px 0; color: #666;">Dating: ${dateStr}</p>`
                }
              }

              if (description) {
                descriptionHtml += `<p style="margin: 5px 0; color: #666;">${description}</p>`
              }
              if (uri) {
                descriptionHtml += `<p style="margin: 5px 0;">
                  <a href="${uri}" target="_blank" style="color: #6688ff; text-decoration: none;">
                    View on Pleiades →
                  </a>
                </p>`
              }
              descriptionHtml += `</div>`
              entity.description = descriptionHtml
            }
          }

          // Track place event listeners separately for cleanup
          const handler = (e: any) => {
            console.log(`Cesium: Checkbox ${config.key} changed to:`, e.target.checked)
            dataSource.show = e.target.checked
            console.log(`Cesium: DataSource ${config.key} show set to:`, dataSource.show)
          }
          const element = document.getElementById(config.toggle)
          if (element) {
            console.log(`Cesium: Setting up event listener for ${config.key} toggle`)
            element.addEventListener('change', handler)
            if ((window as any).cesiumPlaceEventListeners) {
              (window as any).cesiumPlaceEventListeners.push({ element, event: 'change', handler })
            }
          } else {
            console.log(`Cesium: Warning - toggle element not found for ${config.key}`)
          }
        })
      })
    })
    .catch(error => console.error('Pleiades Places loading error:', error))
}

function parseCSV(csvText: string): any[] {
  const lines = csvText.trim().split('\n')
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim())
  const data: any[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim())
    const row: any = {}
    headers.forEach((header, index) => {
      row[header] = values[index] || ''
    })
    data.push(row)
  }

  return data
}

function loadCustomPlaces(Cesium: any, viewer: any, addEventListenerTracked: (elementId: string, eventType: string, handler: EventListener) => void) {
  const customPlacesUrl = '/api/data/custom-places'

  fetch(customPlacesUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      return response.text()
    })
    .then(csvText => {
      const places = parseCSV(csvText)
      const placesByType: any = {
        settlement: [], villa: [], fort: [], temple: [], station: [], archaeological: [],
        cemetery: [], sanctuary: [], bridge: [], aqueduct: [], church: [], bath: [],
        quarry: [], port: [], theater: [], amphitheatre: [], residence: [], forum: []
      }

      places.forEach((place: any) => {
        const lat = parseFloat(place.latitude)
        const lon = parseFloat(place.longitude)
        if (isNaN(lat) || isNaN(lon)) return

        const placeTypes = place.placeTypes ? place.placeTypes.split(';').map((t: string) => t.trim()) : []

        const feature = {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lon, lat] },
          properties: {
            id: place.id || '',
            title: place.title || 'Unnamed',
            description: place.description || '',
            placeTypes: placeTypes,
            uri: place.uri || '',
            modernName: place.modernName || '',
            period: place.period || '',
            source: place.source || ''
          }
        }

        // 各タイプに分類
        placeTypes.forEach((type: string) => {
          if (placesByType[type]) {
            placesByType[type].push(feature)
          }
        })
      })

      const typeConfigs = [
        { key: 'settlement', color: Cesium.Color.GOLD, name: 'Cities & Settlements', toggle: 'toggleSettlements' },
        { key: 'villa', color: Cesium.Color.LIGHTGREEN, name: 'Villas', toggle: 'toggleVillas' },
        { key: 'fort', color: Cesium.Color.RED, name: 'Forts', toggle: 'toggleForts' },
        { key: 'temple', color: Cesium.Color.PURPLE, name: 'Temples', toggle: 'toggleTemples' },
        { key: 'station', color: Cesium.Color.ORANGE, name: 'Stations', toggle: 'toggleStations' },
        { key: 'archaeological', color: Cesium.Color.BROWN, name: 'Archaeological Sites', toggle: 'toggleArchaeological' },
        { key: 'cemetery', color: Cesium.Color.GRAY, name: 'Cemeteries', toggle: 'toggleCemetery' },
        { key: 'sanctuary', color: Cesium.Color.VIOLET, name: 'Sanctuaries', toggle: 'toggleSanctuary' },
        { key: 'bridge', color: Cesium.Color.SILVER, name: 'Bridges', toggle: 'toggleBridge' },
        { key: 'aqueduct', color: Cesium.Color.CYAN, name: 'Aqueducts', toggle: 'toggleAqueduct' },
        { key: 'church', color: Cesium.Color.PINK, name: 'Churches', toggle: 'toggleChurch' },
        { key: 'bath', color: Cesium.Color.AQUA, name: 'Baths', toggle: 'toggleBath' },
        { key: 'quarry', color: Cesium.Color.SANDYBROWN, name: 'Quarries', toggle: 'toggleQuarry' },
        { key: 'port', color: Cesium.Color.NAVY, name: 'Harbors', toggle: 'togglePort' },
        { key: 'theater', color: Cesium.Color.CORAL, name: 'Theaters', toggle: 'toggleTheater' },
        { key: 'amphitheatre', color: Cesium.Color.CRIMSON, name: 'Amphitheaters', toggle: 'toggleAmphitheatre' },
        { key: 'residence', color: Cesium.Color.YELLOW, name: 'Residences', toggle: 'toggleResidence' },
        { key: 'forum', color: Cesium.Color.MAGENTA, name: 'Forums', toggle: 'toggleForum' }
      ]

      typeConfigs.forEach(config => {
        const geojson = { type: 'FeatureCollection', features: placesByType[config.key] }
        if (geojson.features.length === 0) return

        Cesium.GeoJsonDataSource.load(geojson, {
          markerColor: config.color,
          markerSize: 24,
          clampToGround: true
        }).then((dataSource: any) => {
          // Pleiadesと同じデータソース管理を使用
          // @ts-ignore
          window[`pleiades${config.key}DataSource`] = dataSource
          // カスタムプレイスもデフォルトでは非表示（Pleiades Placesと同じ）
          dataSource.show = false
          viewer.dataSources.add(dataSource)

          const entities = dataSource.entities.values
          for (let i = 0; i < entities.length; i++) {
            const entity = entities[i]
            if (entity.billboard) {
              entity.billboard.color = config.color.withAlpha(0.9)
              entity.billboard.scale = 0.6
              entity.billboard.heightReference = Cesium.HeightReference.CLAMP_TO_GROUND
            }

            if (entity.properties) {
              const id = entity.properties.id ? entity.properties.id.getValue() : ''
              const title = entity.properties.title ? entity.properties.title.getValue() : 'Unnamed'
              const description = entity.properties.description ? entity.properties.description.getValue() : ''
              const uri = entity.properties.uri ? entity.properties.uri.getValue() : ''
              const modernName = entity.properties.modernName ? entity.properties.modernName.getValue() : ''
              const period = entity.properties.period ? entity.properties.period.getValue() : ''
              const source = entity.properties.source ? entity.properties.source.getValue() : ''
              const placeTypesArray = entity.properties.placeTypes ? entity.properties.placeTypes.getValue() : []

              entity.name = title
              let descriptionHtml = `<div style="padding: 10px;">
                <h3 style="margin: 0 0 10px 0; color: #333;">${title}</h3>
                <p style="margin: 5px 0; color: #666;">Type: ${config.name} (${placeTypesArray.join(', ')})</p>`

              if (id) {
                descriptionHtml += `<p style="margin: 5px 0; color: #666;">ID: ${id}</p>`
              }
              if (modernName) {
                descriptionHtml += `<p style="margin: 5px 0; color: #666;">Modern: ${modernName}</p>`
              }
              if (period) {
                descriptionHtml += `<p style="margin: 5px 0; color: #666;">Period: ${period}</p>`
              }
              if (description) {
                descriptionHtml += `<p style="margin: 5px 0; color: #666;">${description}</p>`
              }
              if (source) {
                descriptionHtml += `<p style="margin: 5px 0; color: #666; font-size: 0.9em;">Source: ${source}</p>`
              }
              if (uri) {
                descriptionHtml += `<p style="margin: 5px 0;">
                  <a href="${uri}" target="_blank" style="color: #6688ff; text-decoration: none;">
                    More Info →
                  </a>
                </p>`
              }
              descriptionHtml += `</div>`
              entity.description = descriptionHtml
            }
          }

          // トグルボタンがあれば接続（新しいタイプの場合はまだないかもしれない）
          const toggleElement = document.getElementById(config.toggle)
          if (toggleElement) {
            const handler = (e: any) => {
              dataSource.show = e.target.checked
            }
            toggleElement.addEventListener('change', handler)
            if ((window as any).cesiumPlaceEventListeners) {
              (window as any).cesiumPlaceEventListeners.push({ element: toggleElement, event: 'change', handler })
            }
          }
        })
      })
    })
    .catch(error => console.error('Custom Places loading error:', error))
}
