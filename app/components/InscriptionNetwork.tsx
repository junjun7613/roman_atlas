'use client'

import { useEffect, useRef } from 'react'
import { Network } from 'vis-network/standalone'
import type { InscriptionNetworkData } from '../utils/sparql'

interface InscriptionNetworkProps {
  edcsId: string
  networkData: InscriptionNetworkData[]
  onClose: () => void
  // "inline" (default): self-contained card with header + fixed-height graph,
  // used in legacy panels. "dialog": chrome-less, graph fills the parent so a
  // surrounding modal controls the layout/header.
  variant?: 'inline' | 'dialog'
  // Called with a node's URI when the user clicks it in the graph (null when
  // they click empty canvas). Lets the parent highlight the linked text range.
  onNodeSelect?: (nodeUri: string | null) => void
  // Node URIs that have at least one text linking. These get a ring so the user
  // can tell which nodes will highlight text when clicked.
  linkedNodeUris?: string[]
  // Programmatically select/focus a node (e.g. when the user hovers a text
  // range). null clears the selection.
  activeNodeUri?: string | null
}

export default function InscriptionNetwork({
  edcsId,
  networkData,
  onClose,
  variant = 'inline',
  onNodeSelect,
  linkedNodeUris,
  activeNodeUri,
}: InscriptionNetworkProps) {
  const isDialog = variant === 'dialog'
  const containerRef = useRef<HTMLDivElement>(null)
  const networkRef = useRef<Network | null>(null)
  const nodeInfoRef = useRef<HTMLDivElement>(null)
  // Latest onNodeSelect, read from the vis click handler without making the
  // network-building effect depend on it (which would rebuild the graph).
  const onNodeSelectRef = useRef(onNodeSelect)
  onNodeSelectRef.current = onNodeSelect

  console.log('InscriptionNetwork rendered:', { edcsId, networkDataLength: networkData.length })

  useEffect(() => {
    if (!containerRef.current) {
      console.log('Container ref not ready')
      return
    }
    if (networkData.length === 0) {
      console.log('No network data available')
      return
    }

    console.log('Building network graph...')

    // Extract label from URI helper
    const extractLabelFromUri = (uri: string | undefined): string => {
      if (!uri) return ''
      if (uri.includes('://') || uri.includes('/')) {
        return uri.split('/').pop()?.split('#').pop() || ''
      }
      return uri
    }

    // Build nodes and edges
    const nodes: any[] = []
    const edges: any[] = []
    const nodeMap = new Map()
    // Track edges we've already added so the same person→statement link isn't
    // duplicated across rows. A single statement (e.g. a benefaction) can now
    // carry several agents/subjects, arriving as multiple rows that share the
    // statement URI — each distinct (from,to) pair must still get its own edge.
    const edgeSet = new Set<string>()
    const addEdge = (edge: any) => {
      const key = `${edge.from}|${edge.to}|${edge.label ?? ''}`
      if (edgeSet.has(key)) return
      edgeSet.add(key)
      edges.push(edge)
    }

    // Add inscription node (center)
    const inscriptionId = `inscription_${edcsId}`
    nodes.push({
      id: inscriptionId,
      label: edcsId,
      shape: 'box',
      color: { background: '#e74c3c', border: '#c0392b' },
      font: { color: 'white', size: 14, bold: true },
      group: 'inscription'
    })

    networkData.forEach(row => {
      // Person nodes
      if (row.person) {
        const personId = row.person
        if (!nodeMap.has(personId)) {
          const label = row.normalized_name || row.person_name || row.person_label || personId.split('/').pop() || ''
          nodes.push({
            id: personId,
            label: label,
            shape: 'dot',
            color: { background: '#3498db', border: '#2980b9' },
            font: { size: 12 },
            group: 'person',
            data: { type: 'person', label: label, uri: personId }
          })
          nodeMap.set(personId, true)

          addEdge({
            from: inscriptionId,
            to: personId,
            label: 'mentions',
            arrows: 'to',
            color: { color: '#95a5a6' },
            font: { size: 10 }
          })
        }

        // Career nodes. Create the node once, but connect the edge for every
        // person the statement names (a statement may have several subjects).
        if (row.career_position) {
          const careerId = row.career_position
          if (!nodeMap.has(careerId)) {
            const posLabel = row.position || '役職'
            const careerData = {
              type: 'career',
              label: posLabel,
              uri: careerId,
              position: row.position,
              positionAbstract: row.position_abstract,
              positionNormalized: row.position_normalized,
              positionType: row.position_type,
              order: row.position_order,
              description: row.position_desc
            }
            nodes.push({
              id: careerId,
              label: posLabel,
              shape: 'box',
              color: { background: '#9b59b6', border: '#8e44ad' },
              font: { size: 10, color: 'white' },
              group: 'career',
              data: careerData
            })
            nodeMap.set(careerId, true)
          }

          addEdge({
            from: personId,
            to: careerId,
            label: 'hasCareer',
            arrows: 'to',
            color: { color: '#9b59b6' },
            font: { size: 9 }
          })
        }

        // Benefaction nodes. A benefaction can now be a single statement shared
        // by several agents (arriving as multiple rows with the same URI): make
        // the node once, then draw an edge from each agent to it.
        if (row.benefaction) {
          const benefId = row.benefaction
          if (!nodeMap.has(benefId)) {
            const benefLabel = row.benef_type || '恵与'
            const benefData = {
              type: 'benefaction',
              label: benefLabel,
              uri: benefId,
              benefactionType: row.benef_type,
              object: row.benef_object,
              objectType: row.benef_objectType
            }
            nodes.push({
              id: benefId,
              label: benefLabel,
              shape: 'diamond',
              color: { background: '#f39c12', border: '#e67e22' },
              font: { size: 10 },
              group: 'benefaction',
              data: benefData
            })
            nodeMap.set(benefId, true)
          }

          addEdge({
            from: personId,
            to: benefId,
            label: 'hasBenefaction',
            arrows: 'to',
            color: { color: '#f39c12' },
            font: { size: 9 }
          })
        }
      }

      // Community nodes
      if (row.community) {
        const commId = row.community
        if (!nodeMap.has(commId)) {
          const commLabel = row.community_label || commId.split('/').pop() || ''
          nodes.push({
            id: commId,
            label: commLabel,
            shape: 'ellipse',
            color: { background: '#1abc9c', border: '#16a085' },
            font: { size: 11, color: 'white' },
            group: 'community',
            data: { type: 'community', label: commLabel }
          })
          nodeMap.set(commId, true)

          addEdge({
            from: inscriptionId,
            to: commId,
            label: 'mentions',
            arrows: 'to',
            color: { color: '#95a5a6' },
            font: { size: 10 }
          })
        }
      }

      // Relationship edges
      if (row.relationship && row.rel_source && row.rel_target) {
        const relType = extractLabelFromUri(row.rel_type) || 'relationship'
        const relProperty = extractLabelFromUri(row.rel_property)
        const edgeLabel = relProperty ? `${relType} (${relProperty})` : relType
        addEdge({
          from: row.rel_source,
          to: row.rel_target,
          label: edgeLabel,
          arrows: 'to',
          color: { color: '#e74c3c' },
          font: { size: 9 },
          dashes: true
        })
      }
    })

    // Mark nodes that have a text linking with a colored ring so the user can
    // see which nodes will highlight text when clicked.
    if (linkedNodeUris && linkedNodeUris.length > 0) {
      const linkedSet = new Set(linkedNodeUris)
      for (const n of nodes) {
        if (linkedSet.has(n.id)) {
          n.borderWidth = 3
          n.borderWidthSelected = 4
          n.color = { ...(n.color ?? {}), border: '#f39c12' }
          n.shadow = { enabled: true, color: 'rgba(243,156,18,0.6)', size: 12, x: 0, y: 0 }
        }
      }
    }

    // Create network
    const data = { nodes, edges }
    const options = {
      nodes: {
        borderWidth: 2,
        shadow: true,
        font: { face: 'Arial' }
      },
      edges: {
        width: 2,
        shadow: true,
        smooth: {
          enabled: true,
          type: 'continuous',
          roundness: 0.5
        }
      },
      physics: {
        enabled: true,
        stabilization: {
          iterations: 200
        },
        barnesHut: {
          gravitationalConstant: -2000,
          centralGravity: 0.3,
          springLength: 150,
          springConstant: 0.04
        }
      },
      interaction: {
        hover: true,
        tooltipDelay: 200
      },
      layout: {
        improvedLayout: true
      }
    }

    console.log('Creating network with nodes:', nodes.length, 'edges:', edges.length)
    const network = new Network(containerRef.current, data, options)
    networkRef.current = network
    console.log('Network created successfully')

    // Node click handler
    network.on('click', function(params) {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0] as string
        const node = nodes.find(n => n.id === nodeId)
        if (node && nodeInfoRef.current) {
          showNodeInfo(node)
        }
        onNodeSelectRef.current?.(nodeId)
      } else {
        // Clicked empty canvas → clear the text highlight.
        onNodeSelectRef.current?.(null)
      }
    })

    // Stop physics after stabilization
    network.once('stabilizationIterationsDone', function() {
      network.setOptions({ physics: false })
    })

    // Keep the canvas matched to its container as it's resized (e.g. dragging
    // the dialog's split divider). vis-network only listens to window resize,
    // not to its own container changing size, so observe it explicitly.
    const container = containerRef.current
    const ro = new ResizeObserver(() => {
      network.setSize('100%', '100%')
      network.redraw()
    })
    ro.observe(container)

    return () => {
      ro.disconnect()
      network.destroy()
      networkRef.current = null
    }
  }, [edcsId, networkData, linkedNodeUris])

  // Reflect the parent's activeNodeUri (e.g. hovering a linked text range) into
  // the graph's selection, without rebuilding the network.
  useEffect(() => {
    const network = networkRef.current
    if (!network) return
    if (!activeNodeUri) {
      network.unselectAll()
      return
    }
    try {
      network.selectNodes([activeNodeUri], false)
    } catch {
      // Node may not exist in this graph (linking points to an entity the KG
      // query didn't surface) — ignore.
    }
  }, [activeNodeUri])

  const showNodeInfo = (node: any) => {
    if (!nodeInfoRef.current) return

    let html = `<h4 class="text-[14px] font-semibold mb-2 text-[#2c3e50]">${node.label}</h4><dl class="text-[12px]">`
    html += `<dt class="font-bold text-[#34495e] mt-1">タイプ</dt><dd class="ml-3 text-[#555]">${node.group}</dd>`

    if (node.data) {
      html += `<dt class="font-bold text-[#34495e] mt-1">URI</dt><dd class="ml-3 text-[#555] text-[11px] break-all">${node.data.uri || node.id}</dd>`

      // Career node details
      if (node.data.type === 'career') {
        if (node.data.position) {
          html += `<dt class="font-bold text-[#34495e] mt-1">Position</dt><dd class="ml-3 text-[#555]">${node.data.position}</dd>`
        }
        if (node.data.positionAbstract) {
          html += `<dt class="font-bold text-[#34495e] mt-1">Abstract</dt><dd class="ml-3 text-[#555]">${node.data.positionAbstract}</dd>`
        }
        if (node.data.positionNormalized) {
          html += `<dt class="font-bold text-[#34495e] mt-1">Normalized</dt><dd class="ml-3 text-[#555]">${node.data.positionNormalized}</dd>`
        }
        if (node.data.positionType) {
          html += `<dt class="font-bold text-[#34495e] mt-1">Type</dt><dd class="ml-3 text-[#555]">${node.data.positionType}</dd>`
        }
        if (node.data.order) {
          html += `<dt class="font-bold text-[#34495e] mt-1">Order</dt><dd class="ml-3 text-[#555]">${node.data.order}</dd>`
        }
        if (node.data.description) {
          html += `<dt class="font-bold text-[#34495e] mt-1">Description</dt><dd class="ml-3 text-[#555]">${node.data.description}</dd>`
        }
      }

      // Benefaction node details
      if (node.data.type === 'benefaction') {
        if (node.data.benefactionType) {
          html += `<dt class="font-bold text-[#34495e] mt-1">Benefaction Type</dt><dd class="ml-3 text-[#555]">${node.data.benefactionType}</dd>`
        }
        if (node.data.object) {
          html += `<dt class="font-bold text-[#34495e] mt-1">Object</dt><dd class="ml-3 text-[#555]">${node.data.object}</dd>`
        }
        if (node.data.objectType) {
          html += `<dt class="font-bold text-[#34495e] mt-1">Object Type</dt><dd class="ml-3 text-[#555]">${node.data.objectType}</dd>`
        }
      }
    }

    html += '</dl>'
    nodeInfoRef.current.innerHTML = html
    nodeInfoRef.current.style.display = 'block'
  }

  console.log('InscriptionNetwork render decision:', networkData.length === 0 ? 'No data' : 'Has data')

  if (networkData.length === 0) {
    if (isDialog) {
      return (
        <div className="flex h-full items-center justify-center p-4">
          <p className="text-[14px] text-[#666]">この碑文のネットワークデータはありません</p>
        </div>
      )
    }
    return (
      <div className="mt-4 p-4 bg-yellow-100 border-2 border-yellow-500 rounded-lg">
        <div className="flex justify-between items-center mb-3">
          <h4 className="text-[16px] font-semibold text-[#333]">ネットワーク表示: {edcsId}</h4>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-[20px] font-bold"
          >
            ×
          </button>
        </div>
        <p className="text-[14px] text-[#666]">この碑文のネットワークデータはありません</p>
      </div>
    )
  }

  // Dialog variant: no card chrome, graph fills the parent pane. The
  // surrounding modal owns the header and close affordance.
  if (isDialog) {
    return (
      <div className="flex flex-col h-full min-h-0">
        <div ref={containerRef} className="flex-1 min-h-0 w-full rounded bg-card" />
        <div
          ref={nodeInfoRef}
          className="mt-2 p-3 bg-muted border border-border rounded text-[13px] max-h-[200px] overflow-y-auto shrink-0"
          style={{ display: 'none' }}
        />
      </div>
    )
  }

  return (
    <div className="mt-4 p-4 bg-primary/10 border-4 border-primary rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-[16px] font-semibold text-[#333]">ネットワーク表示: {edcsId} (データ数: {networkData.length})</h4>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-[20px] font-bold"
        >
          ×
        </button>
      </div>
      <div
        ref={containerRef}
        className="w-full h-[400px] rounded bg-card"
      />
      <div
        ref={nodeInfoRef}
        className="mt-3 p-3 bg-muted border border-border rounded text-[13px] max-h-[200px] overflow-y-auto"
        style={{ display: 'none' }}
      />
    </div>
  )
}
