'use client'

import { useEffect, useRef } from 'react'

export default function CesiumMap() {
  const cesiumContainerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<any>(null)

  useEffect(() => {
    // Cesium CSSを動的に読み込み
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = '/cesium/Widgets/widgets.css'
    document.head.appendChild(link)

    // Cesiumを動的にインポート
    const loadCesium = async () => {
      // @ts-ignore
      const Cesium = await import('cesium')

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
        const elevationLayer = viewer.imageryLayers.addImageryProvider(
          new Cesium.UrlTemplateImageryProvider({
            url: 'https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}.png',
            credit: 'Map tiles by Stamen Design, under CC BY 3.0. Data by OpenStreetMap, under ODbL.'
          })
        )
        elevationLayer.alpha = 0.6
        elevationLayer.show = false

        // Provincesデータの読み込み
        // 環境変数が設定されている場合はAPI Route経由、そうでない場合はローカルファイル
        const provincesUrl = process.env.NEXT_PUBLIC_PROVINCES_URL
          ? '/api/data/provinces'
          : '/provinces.geojson'
        fetch(provincesUrl)
          .then(response => response.json())
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

              document.getElementById('toggleProvinces')?.addEventListener('change', (e: any) => {
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
        loadRoutes(Cesium, viewer)

        // Pleiades Placesの読み込み
        loadPleiadesPlaces(Cesium, viewer)

        // 標高マップの表示/非表示の切り替え
        document.getElementById('toggleElevation')?.addEventListener('change', (e: any) => {
          elevationLayer.show = e.target.checked
        })

        // クリックイベントハンドラー
        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
        handler.setInputAction((click: any) => {
          const pickedObject = viewer.scene.pick(click.position)
          if (Cesium.defined(pickedObject) && Cesium.defined(pickedObject.id)) {
            viewer.selectedEntity = pickedObject.id
          }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

        handler.setInputAction((movement: any) => {
          const pickedObject = viewer.scene.pick(movement.endPosition)
          if (Cesium.defined(pickedObject) && Cesium.defined(pickedObject.id)) {
            viewer.canvas.style.cursor = 'pointer'
          } else {
            viewer.canvas.style.cursor = 'default'
          }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)

      } catch (error) {
        console.error('Cesium initialization error:', error)
      }
    }

    loadCesium()

    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy()
      }
    }
  }, [])

  return <div ref={cesiumContainerRef} className="w-screen h-screen" />
}

function loadRoutes(Cesium: any, viewer: any) {
  // 環境変数が設定されている場合はAPI Route経由、そうでない場合はローカルファイル
  const routesUrl = process.env.NEXT_PUBLIC_ROUTES_URL
    ? '/api/data/routes'
    : '/route-segments-all.ndjson'
  fetch(routesUrl)
    .then(response => response.text())
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

        document.getElementById('toggleMainRoad')?.addEventListener('change', (e: any) => {
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

        document.getElementById('toggleSecondaryRoad')?.addEventListener('change', (e: any) => {
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

        document.getElementById('toggleSeaLane')?.addEventListener('change', (e: any) => {
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

        document.getElementById('toggleRiver')?.addEventListener('change', (e: any) => {
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

function loadPleiadesPlaces(Cesium: any, viewer: any) {
  // 環境変数が設定されている場合はAPI Route経由、そうでない場合はローカルファイル
  const placesUrl = process.env.NEXT_PUBLIC_PLACES_URL
    ? '/api/data/places'
    : '/pleiades-places-filtered-expanded.json'
  fetch(placesUrl)
    .then(response => response.json())
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
        { key: 'settlement', color: Cesium.Color.GOLD, name: '都市・集落', toggle: 'toggleSettlements' },
        { key: 'villa', color: Cesium.Color.LIGHTGREEN, name: 'ヴィラ', toggle: 'toggleVillas' },
        { key: 'fort', color: Cesium.Color.RED, name: '要塞', toggle: 'toggleForts' },
        { key: 'temple', color: Cesium.Color.PURPLE, name: '神殿', toggle: 'toggleTemples' },
        { key: 'station', color: Cesium.Color.ORANGE, name: '駅', toggle: 'toggleStations' },
        { key: 'archaeological', color: Cesium.Color.BROWN, name: '遺跡', toggle: 'toggleArchaeological' },
        { key: 'cemetery', color: Cesium.Color.GRAY, name: '墓地', toggle: 'toggleCemetery' },
        { key: 'sanctuary', color: Cesium.Color.VIOLET, name: '聖域', toggle: 'toggleSanctuary' },
        { key: 'bridge', color: Cesium.Color.SILVER, name: '橋', toggle: 'toggleBridge' },
        { key: 'aqueduct', color: Cesium.Color.CYAN, name: '水道橋', toggle: 'toggleAqueduct' },
        { key: 'church', color: Cesium.Color.PINK, name: '教会', toggle: 'toggleChurch' },
        { key: 'bath', color: Cesium.Color.AQUA, name: '浴場', toggle: 'toggleBath' },
        { key: 'quarry', color: Cesium.Color.SANDYBROWN, name: '採石場', toggle: 'toggleQuarry' },
        { key: 'port', color: Cesium.Color.NAVY, name: '港', toggle: 'togglePort' },
        { key: 'theater', color: Cesium.Color.CORAL, name: '劇場', toggle: 'toggleTheater' },
        { key: 'amphitheatre', color: Cesium.Color.CRIMSON, name: '円形闘技場', toggle: 'toggleAmphitheatre' }
      ]

      typeConfigs.forEach(config => {
        const geojson = { type: 'FeatureCollection', features: placesByType[config.key] }
        if (geojson.features.length === 0) return

        Cesium.GeoJsonDataSource.load(geojson, {
          markerColor: config.color,
          markerSize: 24,
          clampToGround: true
        }).then((dataSource: any) => {
          // @ts-ignore
          window[`pleiades${config.key}DataSource`] = dataSource
          dataSource.show = false
          viewer.dataSources.add(dataSource)

          const entities = dataSource.entities.values
          for (let i = 0; i < entities.length; i++) {
            const entity = entities[i]
            if (entity.billboard) {
              entity.billboard.color = config.color.withAlpha(0.8)
              entity.billboard.scale = 0.5
              entity.billboard.heightReference = Cesium.HeightReference.CLAMP_TO_GROUND
            }

            if (entity.properties) {
              const title = entity.properties.title ? entity.properties.title.getValue() : 'Unnamed'
              const description = entity.properties.description ? entity.properties.description.getValue() : ''
              const uri = entity.properties.uri ? entity.properties.uri.getValue() : ''
              const placeTypesArray = entity.properties.placeTypes ? entity.properties.placeTypes.getValue() : []

              entity.name = title
              let descriptionHtml = `<div style="padding: 10px;">
                <h3 style="margin: 0 0 10px 0; color: #333;">${title}</h3>
                <p style="margin: 5px 0; color: #666;">Type: ${config.name} (${placeTypesArray.join(', ')})</p>`

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

          document.getElementById(config.toggle)?.addEventListener('change', (e: any) => {
            dataSource.show = e.target.checked
          })
        })
      })
    })
    .catch(error => console.error('Pleiades Places loading error:', error))
}
