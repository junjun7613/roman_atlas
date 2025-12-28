'use client'

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet.markercluster'
import { queryInscriptionsByPlaceId, queryInscriptionsByPlaceIds, queryCustomPlaces, queryInscriptionDetails } from '../utils/sparql'

// Leafletのデフォルトマーカーアイコンの修正
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

export default function LeafletMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const isMountedRef = useRef(true)
  const layersRef = useRef<{
    provinces?: L.LayerGroup
    mainRoad?: L.LayerGroup
    secondaryRoad?: L.LayerGroup
    seaLane?: L.LayerGroup
    river?: L.LayerGroup
    [key: string]: L.LayerGroup | undefined
  }>({})

  // Rectangle selection state
  const [isDrawingMode, setIsDrawingMode] = useState(false)
  const rectangleLayerRef = useRef<L.Rectangle | null>(null)
  const drawingStartRef = useRef<L.LatLng | null>(null)

  // イベントリスナーを保存するref
  const eventListenersRef = useRef<Array<{element: HTMLElement, event: string, handler: EventListener}>>([])

  // イベントリスナーを登録するヘルパー関数
  const addEventListenerTracked = (elementId: string, eventType: string, handler: EventListener) => {
    const element = document.getElementById(elementId)
    if (element) {
      element.addEventListener(eventType, handler)
      eventListenersRef.current.push({ element, event: eventType, handler })
    }
  }

  useEffect(() => {
    isMountedRef.current = true
    if (!mapContainerRef.current || mapRef.current) return

    // マップの初期化
    let map: L.Map | null = null
    try {
      map = L.map(mapContainerRef.current, {
        center: [35.9028, 12.4964],
        zoom: 5,
        zoomControl: true
      })
      mapRef.current = map
    } catch (error) {
      console.error('Map initialization error:', error)
      return
    }

    if (!map) return

    // OpenStreetMapタイルレイヤーの追加
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map)

    // 標高マップレイヤー（オプション）
    const elevationLayer = L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}.png', {
      attribution: 'Map tiles by Stamen Design, under CC BY 3.0. Data by OpenStreetMap, under ODbL.',
      opacity: 0.6,
      maxZoom: 18
    })

    // 標高マップをデフォルトで追加
    elevationLayer.addTo(map)

    // 標高マップトグルのイベントリスナー
    addEventListenerTracked('toggleElevation', 'change', (e: any) => {
      const currentMap = mapRef.current
      if (!currentMap) return
      if (e.target.checked) {
        elevationLayer.addTo(currentMap)
      } else {
        currentMap.removeLayer(elevationLayer)
      }
    })

    // Provincesデータの読み込み
    loadProvinces(map)

    // ルートデータの読み込み
    loadRoutes(map)

    // Pleiades Placesの読み込み
    loadPleiadesPlaces(map)

    // カスタムプレイスの読み込み
    loadCustomPlaces(map)

    return () => {
      isMountedRef.current = false

      // すべてのイベントリスナーを削除
      eventListenersRef.current.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler)
      })
      eventListenersRef.current = []

      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  const loadProvinces = (map: L.Map) => {
    if (!map) return

    const provincesUrl = process.env.NEXT_PUBLIC_PROVINCES_URL
      ? '/api/data/provinces'
      : '/provinces.geojson'

    fetch(provincesUrl)
      .then(response => response.json())
      .then(geojsonData => {
        if (!isMountedRef.current || !map || !mapRef.current) return

        const provincesLayer = L.geoJSON(geojsonData, {
          style: {
            color: '#ffffff',
            weight: 2,
            fillColor: '#6495ED',
            fillOpacity: 0.3
          },
          onEachFeature: (feature, layer) => {
            if (feature.properties && feature.properties.name) {
              layer.bindPopup(`
                <div style="padding: 10px;">
                  <h3 style="margin: 0 0 10px 0; color: #333;">${feature.properties.name}</h3>
                  <p style="margin: 0; color: #666;">Province of the Roman Empire</p>
                </div>
              `)
            }
          }
        })

        if (isMountedRef.current && mapRef.current) {
          // Check initial checkbox state
          const provinceToggle = document.getElementById('toggleProvinces') as HTMLInputElement
          const isChecked = provinceToggle ? provinceToggle.checked : true

          if (isChecked) {
            provincesLayer.addTo(mapRef.current)
          }

          layersRef.current.provinces = provincesLayer
          ;(window as any).provincesLayer = provincesLayer

          // トグルイベント
          addEventListenerTracked('toggleProvinces', 'change', (e: any) => {
            const currentMap = mapRef.current
            if (!currentMap) return
            if (e.target.checked) {
              currentMap.addLayer(provincesLayer)
            } else {
              currentMap.removeLayer(provincesLayer)
            }
          })
        }
      })
      .catch(error => console.error('Provinces loading error:', error))
  }

  const loadRoutes = (map: L.Map) => {
    if (!map) return

    const routesUrl = process.env.NEXT_PUBLIC_ROUTES_URL
      ? '/api/data/routes'
      : '/route-segments-all.ndjson'

    fetch(routesUrl)
      .then(response => response.text())
      .then(ndjsonText => {
        if (!isMountedRef.current || !map || !mapRef.current) return

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
        const mainRoadLayer = L.geoJSON({ type: 'FeatureCollection', features: mainRoadFeatures } as any, {
          style: {
            color: '#FF8C00',
            weight: 4,
            opacity: 0.8
          },
          onEachFeature: (feature, layer) => {
            setupRoutePopup(feature, layer)
          }
        })
        if (isMountedRef.current && mapRef.current) {
          const mainRoadToggle = document.getElementById('toggleMainRoad') as HTMLInputElement
          if (!mainRoadToggle || mainRoadToggle.checked) {
            mainRoadLayer.addTo(mapRef.current)
          }
        }
        layersRef.current.mainRoad = mainRoadLayer
        ;(window as any).mainRoadLayer = mainRoadLayer

        addEventListenerTracked('toggleMainRoad', 'change', (e: any) => {
          const currentMap = mapRef.current
          if (!currentMap) return
          if (e.target.checked) {
            currentMap.addLayer(mainRoadLayer)
          } else {
            currentMap.removeLayer(mainRoadLayer)
          }
        })

        // Secondary Road
        const secondaryRoadLayer = L.geoJSON({ type: 'FeatureCollection', features: secondaryRoadFeatures } as any, {
          style: {
            color: '#FFA500',
            weight: 2,
            opacity: 0.7
          },
          onEachFeature: (feature, layer) => {
            setupRoutePopup(feature, layer)
          }
        })
        if (isMountedRef.current && mapRef.current) {
          const secondaryRoadToggle = document.getElementById('toggleSecondaryRoad') as HTMLInputElement
          if (!secondaryRoadToggle || secondaryRoadToggle.checked) {
            secondaryRoadLayer.addTo(mapRef.current)
          }
        }
        layersRef.current.secondaryRoad = secondaryRoadLayer
        ;(window as any).secondaryRoadLayer = secondaryRoadLayer

        addEventListenerTracked('toggleSecondaryRoad', 'change', (e: any) => {
          const currentMap = mapRef.current
          if (!currentMap) return
          if (e.target.checked) {
            currentMap.addLayer(secondaryRoadLayer)
          } else {
            currentMap.removeLayer(secondaryRoadLayer)
          }
        })

        // Sea Lane
        const seaLaneLayer = L.geoJSON({ type: 'FeatureCollection', features: seaLaneFeatures } as any, {
          style: {
            color: '#00FFFF',
            weight: 3,
            opacity: 0.8
          },
          onEachFeature: (feature, layer) => {
            setupRoutePopup(feature, layer)
          }
        })
        if (isMountedRef.current && mapRef.current) {
          const seaLaneToggle = document.getElementById('toggleSeaLane') as HTMLInputElement
          if (!seaLaneToggle || seaLaneToggle.checked) {
            seaLaneLayer.addTo(mapRef.current)
          }
        }
        layersRef.current.seaLane = seaLaneLayer
        ;(window as any).seaLaneLayer = seaLaneLayer

        addEventListenerTracked('toggleSeaLane', 'change', (e: any) => {
          const currentMap = mapRef.current
          if (!currentMap) return
          if (e.target.checked) {
            currentMap.addLayer(seaLaneLayer)
          } else {
            currentMap.removeLayer(seaLaneLayer)
          }
        })

        // River
        const riverLayer = L.geoJSON({ type: 'FeatureCollection', features: riverFeatures } as any, {
          style: {
            color: '#0000FF',
            weight: 3,
            opacity: 0.8
          },
          onEachFeature: (feature, layer) => {
            setupRoutePopup(feature, layer)
          }
        })
        if (isMountedRef.current && mapRef.current) {
          const riverToggle = document.getElementById('toggleRiver') as HTMLInputElement
          if (!riverToggle || riverToggle.checked) {
            riverLayer.addTo(mapRef.current)
          }
        }
        layersRef.current.river = riverLayer
        ;(window as any).riverLayer = riverLayer

        addEventListenerTracked('toggleRiver', 'change', (e: any) => {
          const currentMap = mapRef.current
          if (!currentMap) return
          if (e.target.checked) {
            currentMap.addLayer(riverLayer)
          } else {
            currentMap.removeLayer(riverLayer)
          }
        })
      })
      .catch(error => console.error('Route data loading error:', error))
  }

  const setupRoutePopup = (feature: any, layer: L.Layer) => {
    if (feature.properties && feature.properties.name) {
      const routeName = feature.properties.name
      const routeType = feature.properties.type || 'Unknown'
      const routeId = feature.properties._id || feature.properties.id

      let popupHtml = `<div style="padding: 10px;">
        <h3 style="margin: 0 0 10px 0; color: #333;">${routeName}</h3>
        <p style="margin: 5px 0; color: #666;">Type: ${routeType}</p>
        <p style="margin: 5px 0; color: #666;">Itiner-e ID: ${routeId}</p>`

      if (routeId) {
        popupHtml += `<p style="margin: 5px 0;">
          <a href="https://itiner-e.org/route-segment/${routeId}" target="_blank" style="color: #6688ff; text-decoration: none;">
            View on Itiner-e →
          </a>
        </p>`
      }
      popupHtml += `</div>`
      layer.bindPopup(popupHtml)
    }
  }

  const loadPleiadesPlaces = (map: L.Map) => {
    if (!map) return

    const placesUrl = process.env.NEXT_PUBLIC_PLACES_URL
      ? '/api/data/places'
      : '/pleiades-places-filtered-expanded.json'

    fetch(placesUrl)
      .then(response => response.json())
      .then(data => {
        if (!isMountedRef.current || !map || !mapRef.current) return
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

          const feature = {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: reprPoint },
            properties: {
              title: place.title || 'Unnamed',
              description: place.description || '',
              placeTypes: placeTypes,
              uri: "https://pleiades.stoa.org/places/" + place.id || ''
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
          { key: 'settlement', color: '#FFD700', name: '都市・集落', toggle: 'toggleSettlements' },
          { key: 'villa', color: '#90EE90', name: 'ヴィラ', toggle: 'toggleVillas' },
          { key: 'fort', color: '#FF0000', name: '要塞', toggle: 'toggleForts' },
          { key: 'temple', color: '#800080', name: '神殿', toggle: 'toggleTemples' },
          { key: 'station', color: '#FFA500', name: '駅', toggle: 'toggleStations' },
          { key: 'archaeological', color: '#A52A2A', name: '遺跡', toggle: 'toggleArchaeological' },
          { key: 'cemetery', color: '#808080', name: '墓地', toggle: 'toggleCemetery' },
          { key: 'sanctuary', color: '#EE82EE', name: '聖域', toggle: 'toggleSanctuary' },
          { key: 'bridge', color: '#C0C0C0', name: '橋', toggle: 'toggleBridge' },
          { key: 'aqueduct', color: '#00FFFF', name: '水道橋', toggle: 'toggleAqueduct' },
          { key: 'church', color: '#FFC0CB', name: '教会', toggle: 'toggleChurch' },
          { key: 'bath', color: '#00FFFF', name: '浴場', toggle: 'toggleBath' },
          { key: 'quarry', color: '#F4A460', name: '採石場', toggle: 'toggleQuarry' },
          { key: 'port', color: '#000080', name: '港', toggle: 'togglePort' },
          { key: 'theater', color: '#FF7F50', name: '劇場', toggle: 'toggleTheater' },
          { key: 'amphitheatre', color: '#DC143C', name: '円形闘技場', toggle: 'toggleAmphitheatre' }
        ]

        typeConfigs.forEach(config => {
          const geojson = { type: 'FeatureCollection', features: placesByType[config.key] }
          if (geojson.features.length === 0) return

          const icon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="background-color: ${config.color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`,
            iconSize: [12, 12],
            iconAnchor: [6, 6]
          })

          // MarkerClusterGroupを作成
          const clusterGroup = (L as any).markerClusterGroup({
            maxClusterRadius: 50,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true
          })

          const layer = L.geoJSON(geojson as any, {
            pointToLayer: (feature, latlng) => {
              return L.marker(latlng, { icon })
            },
            onEachFeature: (feature, layer) => {
              if (feature.properties) {
                const title = feature.properties.title || 'Unnamed'
                const description = feature.properties.description || ''
                const uri = feature.properties.uri || ''
                const placeTypesArray = feature.properties.placeTypes || []

                // Extract Pleiades ID from URI
                let placeId = ''
                if (uri) {
                  const match = uri.match(/\/places\/(\d+)/)
                  if (match) {
                    placeId = match[1]
                  }
                }

                let popupHtml = `<div style="padding: 10px;">
                  <h3 style="margin: 0 0 10px 0; color: #333;">${title}</h3>
                  <p style="margin: 5px 0; color: #666;">Type: ${config.name} (${placeTypesArray.join(', ')})</p>`

                if (placeId) {
                  popupHtml += `<p style="margin: 5px 0; color: #666;">Pleiades ID: ${placeId}</p>`
                }
                if (description) {
                  popupHtml += `<p style="margin: 5px 0; color: #666;">${description}</p>`
                }
                if (uri) {
                  popupHtml += `<p style="margin: 5px 0;">
                    <a href="${uri}" target="_blank" style="color: #6688ff; text-decoration: none;">
                      View on Pleiades →
                    </a>
                  </p>`
                }
                popupHtml += `</div>`
                layer.bindPopup(popupHtml)

                // Add click handler to fetch inscription data
                if (placeId) {
                  layer.on('click', async () => {
                    const setInscriptionData = (window as any).setInscriptionData
                    if (setInscriptionData) {
                      // Set loading state
                      setInscriptionData({
                        type: 'single',
                        placeName: title,
                        placeId: placeId,
                        count: 0,
                        loading: true
                      })

                      // Query SPARQL endpoint for count and details
                      const count = await queryInscriptionsByPlaceId(placeId)
                      const inscriptions = await queryInscriptionDetails(placeId)

                      // Update with results
                      setInscriptionData({
                        type: 'single',
                        placeName: title,
                        placeId: placeId,
                        count: count,
                        loading: false,
                        inscriptions: inscriptions
                      })
                    }
                  })
                }
              }
            }
          })

          // geoJSONレイヤーのマーカーをクラスターグループに追加
          layer.eachLayer((l: any) => {
            clusterGroup.addLayer(l)
          })

          layersRef.current[`pleiades${config.key}`] = clusterGroup
          ;(window as any)[`pleiades${config.key}Layer`] = clusterGroup

          // デフォルトでは非表示
          addEventListenerTracked(config.toggle, 'change', (e: any) => {
            const currentMap = mapRef.current
            if (!currentMap) return
            if (e.target.checked) {
              currentMap.addLayer(clusterGroup)
            } else {
              currentMap.removeLayer(clusterGroup)
            }
          })
        })
      })
      .catch(error => console.error('Pleiades Places loading error:', error))
  }

  const parseCSV = (csvText: string): any[] => {
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

  const loadCustomPlaces = async (map: L.Map) => {
    if (!map) return

    try {
      const places = await queryCustomPlaces()

      if (!isMountedRef.current || !map || !mapRef.current) return
      if (places.length === 0) {
        console.log('No custom places found from SPARQL')
        return
      }
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

          placeTypes.forEach((type: string) => {
            if (placesByType[type]) {
              placesByType[type].push(feature)
            }
          })
        })

        const typeConfigs = [
          { key: 'settlement', color: '#FFD700', name: '都市・集落', toggle: 'toggleSettlements' },
          { key: 'villa', color: '#90EE90', name: 'ヴィラ', toggle: 'toggleVillas' },
          { key: 'fort', color: '#FF0000', name: '要塞', toggle: 'toggleForts' },
          { key: 'temple', color: '#800080', name: '神殿', toggle: 'toggleTemples' },
          { key: 'station', color: '#FFA500', name: '駅', toggle: 'toggleStations' },
          { key: 'archaeological', color: '#A52A2A', name: '遺跡', toggle: 'toggleArchaeological' },
          { key: 'cemetery', color: '#808080', name: '墓地', toggle: 'toggleCemetery' },
          { key: 'sanctuary', color: '#EE82EE', name: '聖域', toggle: 'toggleSanctuary' },
          { key: 'bridge', color: '#C0C0C0', name: '橋', toggle: 'toggleBridge' },
          { key: 'aqueduct', color: '#00FFFF', name: '水道橋', toggle: 'toggleAqueduct' },
          { key: 'church', color: '#FFC0CB', name: '教会', toggle: 'toggleChurch' },
          { key: 'bath', color: '#00FFFF', name: '浴場', toggle: 'toggleBath' },
          { key: 'quarry', color: '#F4A460', name: '採石場', toggle: 'toggleQuarry' },
          { key: 'port', color: '#000080', name: '港', toggle: 'togglePort' },
          { key: 'theater', color: '#FF7F50', name: '劇場', toggle: 'toggleTheater' },
          { key: 'amphitheatre', color: '#DC143C', name: '円形闘技場', toggle: 'toggleAmphitheatre' },
          { key: 'residence', color: '#FFFF00', name: '住居', toggle: 'toggleResidence' },
          { key: 'forum', color: '#FF00FF', name: 'フォルム', toggle: 'toggleForum' }
        ]

        typeConfigs.forEach(config => {
          const geojson = { type: 'FeatureCollection', features: placesByType[config.key] }
          if (geojson.features.length === 0) return

          const icon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="background-color: ${config.color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7]
          })

          // MarkerClusterGroupを作成
          const clusterGroup = (L as any).markerClusterGroup({
            maxClusterRadius: 50,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true
          })

          const layer = L.geoJSON(geojson as any, {
            pointToLayer: (feature, latlng) => {
              return L.marker(latlng, { icon })
            },
            onEachFeature: (feature, layer) => {
              if (feature.properties) {
                const id = feature.properties.id || ''
                const title = feature.properties.title || 'Unnamed'
                const description = feature.properties.description || ''
                const uri = feature.properties.uri || ''
                const modernName = feature.properties.modernName || ''
                const period = feature.properties.period || ''
                const source = feature.properties.source || ''
                const placeTypesArray = feature.properties.placeTypes || []

                // Try to extract Pleiades ID from URI if available
                let placeId = ''
                if (uri) {
                  const match = uri.match(/pleiades\.stoa\.org\/places\/(\d+)/)
                  if (match) {
                    placeId = match[1]
                  }
                }

                let popupHtml = `<div style="padding: 10px;">
                  <h3 style="margin: 0 0 10px 0; color: #333;">${title}</h3>
                  <p style="margin: 5px 0; color: #666;">Type: ${config.name} (${placeTypesArray.join(', ')})</p>`

                if (id) {
                  popupHtml += `<p style="margin: 5px 0; color: #666;">ID: ${id}</p>`
                }
                if (placeId) {
                  popupHtml += `<p style="margin: 5px 0; color: #666;">Pleiades ID: ${placeId}</p>`
                }
                if (modernName) {
                  popupHtml += `<p style="margin: 5px 0; color: #666;">Modern: ${modernName}</p>`
                }
                if (period) {
                  popupHtml += `<p style="margin: 5px 0; color: #666;">Period: ${period}</p>`
                }
                if (description) {
                  popupHtml += `<p style="margin: 5px 0; color: #666;">${description}</p>`
                }
                if (source) {
                  popupHtml += `<p style="margin: 5px 0; color: #666; font-size: 0.9em;">Source: ${source}</p>`
                }
                if (uri) {
                  popupHtml += `<p style="margin: 5px 0;">
                    <a href="${uri}" target="_blank" style="color: #6688ff; text-decoration: none;">
                      More Info →
                    </a>
                  </p>`
                }
                popupHtml += `</div>`
                layer.bindPopup(popupHtml)

                // Add click handler to fetch inscription data
                // Check if either Pleiades ID or custom ID exists
                if (placeId || id) {
                  layer.on('click', async () => {
                    const setInscriptionData = (window as any).setInscriptionData
                    if (setInscriptionData) {
                      // Set loading state
                      setInscriptionData({
                        type: 'single',
                        placeName: title,
                        placeId: placeId || id,
                        count: 0,
                        loading: true
                      })

                      // Query SPARQL endpoint with both Pleiades ID and custom location ID
                      // For custom places, use the ID as-is (e.g., "315247_002")
                      let customLocationId: string | undefined = undefined
                      if (id) {
                        customLocationId = id
                      }

                      const count = await queryInscriptionsByPlaceId(
                        placeId || id,
                        customLocationId
                      )
                      const inscriptions = await queryInscriptionDetails(
                        placeId || id,
                        customLocationId
                      )

                      // Update with results
                      setInscriptionData({
                        type: 'single',
                        placeName: title,
                        placeId: placeId || id,
                        customLocationId: customLocationId,
                        count: count,
                        loading: false,
                        inscriptions: inscriptions
                      })
                    }
                  })
                }
              }
            }
          })

          // geoJSONレイヤーのマーカーをクラスターグループに追加
          layer.eachLayer((l: any) => {
            clusterGroup.addLayer(l)
          })

          // カスタムプレイスも同じデータソース名を使用してPleiadesと統合
          layersRef.current[`pleiades${config.key}`] = clusterGroup
          ;(window as any)[`pleiades${config.key}Layer`] = clusterGroup

          addEventListenerTracked(config.toggle, 'change', (e: any) => {
            const currentMap = mapRef.current
            if (!currentMap) return
            if (e.target.checked) {
              currentMap.addLayer(clusterGroup)
            } else {
              currentMap.removeLayer(clusterGroup)
            }
          })
        })
    } catch (error) {
      console.error('Custom Places loading error:', error)
    }
  }

  // Toggle rectangle selection mode
  const toggleDrawingMode = () => {
    const newMode = !isDrawingMode
    setIsDrawingMode(newMode)

    if (!newMode && rectangleLayerRef.current && mapRef.current) {
      mapRef.current.removeLayer(rectangleLayerRef.current)
      rectangleLayerRef.current = null
    }
  }

  // Handle rectangle selection
  useEffect(() => {
    if (!mapRef.current || !isDrawingMode) return

    const map = mapRef.current
    let isDrawing = false
    let startLatLng: L.LatLng | null = null
    let currentRectangle: L.Rectangle | null = null

    const onMouseDown = (e: L.LeafletMouseEvent) => {
      if (!isDrawingMode) return
      isDrawing = true
      startLatLng = e.latlng
      drawingStartRef.current = e.latlng

      // Remove previous rectangle if exists
      if (currentRectangle) {
        map.removeLayer(currentRectangle)
      }
      if (rectangleLayerRef.current) {
        map.removeLayer(rectangleLayerRef.current)
      }
    }

    const onMouseMove = (e: L.LeafletMouseEvent) => {
      if (!isDrawing || !startLatLng) return

      // Remove previous temp rectangle
      if (currentRectangle) {
        map.removeLayer(currentRectangle)
      }

      // Create new rectangle
      const bounds = L.latLngBounds(startLatLng, e.latlng)
      currentRectangle = L.rectangle(bounds, {
        color: '#3388ff',
        weight: 2,
        fillOpacity: 0.1
      })
      currentRectangle.addTo(map)
    }

    const onMouseUp = async (e: L.LeafletMouseEvent) => {
      if (!isDrawing || !startLatLng) return
      isDrawing = false

      // Create final rectangle
      const bounds = L.latLngBounds(startLatLng, e.latlng)

      if (currentRectangle) {
        map.removeLayer(currentRectangle)
      }

      rectangleLayerRef.current = L.rectangle(bounds, {
        color: '#3388ff',
        weight: 2,
        fillOpacity: 0.2
      })
      rectangleLayerRef.current.addTo(map)

      // Find all places within bounds
      await queryPlacesInBounds(bounds)

      // Exit drawing mode
      setIsDrawingMode(false)
    }

    map.on('mousedown', onMouseDown)
    map.on('mousemove', onMouseMove)
    map.on('mouseup', onMouseUp)

    // Change cursor when in drawing mode
    if (mapContainerRef.current) {
      mapContainerRef.current.style.cursor = 'crosshair'
    }

    return () => {
      map.off('mousedown', onMouseDown)
      map.off('mousemove', onMouseMove)
      map.off('mouseup', onMouseUp)
      if (mapContainerRef.current) {
        mapContainerRef.current.style.cursor = ''
      }
    }
  }, [isDrawingMode])

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

  // Query all places within bounds
  const queryPlacesInBounds = async (bounds: L.LatLngBounds) => {
    const placesInBounds: Array<{ name: string; id: string; latlng: L.LatLng }> = []

    // Check all place layers
    Object.keys(layersRef.current).forEach(layerKey => {
      if (!layerKey.startsWith('pleiades')) return

      const layer = layersRef.current[layerKey]
      if (!layer) return

      // Check if layer is on map (visible)
      if (!mapRef.current?.hasLayer(layer)) return

      layer.eachLayer((marker: any) => {
        if (marker instanceof L.Marker) {
          const markerLatLng = marker.getLatLng()
          if (bounds.contains(markerLatLng)) {
            // Extract place info from marker
            const popup = marker.getPopup()
            if (popup) {
              const content = popup.getContent() as string
              // Extract place name and ID from popup HTML
              const nameMatch = content.match(/<h3[^>]*>([^<]+)<\/h3>/)
              const idMatch = content.match(/Pleiades ID:\s*(\d+)/)

              if (nameMatch && idMatch) {
                placesInBounds.push({
                  name: nameMatch[1],
                  id: idMatch[1],
                  latlng: markerLatLng
                })
              }
            }
          }
        }
      })
    })

    console.log('Places in bounds:', placesInBounds)

    if (placesInBounds.length === 0) {
      const setInscriptionData = (window as any).setInscriptionData
      if (setInscriptionData) {
        setInscriptionData({
          type: 'multiple',
          count: 0,
          loading: false,
          places: []
        })
      }
      return
    }

    // Set loading state
    const setInscriptionData = (window as any).setInscriptionData
    if (setInscriptionData) {
      setInscriptionData({
        type: 'multiple',
        count: 0,
        loading: true,
        places: []
      })

      // Query inscriptions for all places
      const placeIds = placesInBounds.map(p => p.id)
      const results = await queryInscriptionsByPlaceIds(placeIds)

      // Create place details with counts
      const placeDetails = placesInBounds.map(place => {
        const result = results.find(r => r.placeId === place.id)
        return {
          placeName: place.name,
          placeId: place.id,
          count: result ? result.count : 0
        }
      })

      // Calculate total count
      const totalCount = placeDetails.reduce((sum, place) => sum + place.count, 0)

      // Update with results
      setInscriptionData({
        type: 'multiple',
        count: totalCount,
        loading: false,
        places: placeDetails
      })
    }
  }

  return (
    <>
      {/* Rectangle selection button */}
      <button
        onClick={toggleDrawingMode}
        className={`absolute top-20 left-4 z-[1000] px-4 py-2 rounded-lg shadow-lg font-medium transition-colors ${
          isDrawingMode
            ? 'bg-blue-500 text-white'
            : 'bg-white text-gray-700 hover:bg-gray-100'
        }`}
        title="矩形選択モード"
      >
        {isDrawingMode ? '選択中...' : '矩形選択'}
      </button>
      <div ref={mapContainerRef} className="w-full h-full" />
    </>
  )
}
