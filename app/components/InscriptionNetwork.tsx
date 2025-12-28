'use client'

import { useEffect, useRef } from 'react'
import { Network } from 'vis-network/standalone'
import type { InscriptionNetworkData } from '../utils/sparql'

interface InscriptionNetworkProps {
  edcsId: string
  networkData: InscriptionNetworkData[]
  onClose: () => void
}

export default function InscriptionNetwork({ edcsId, networkData, onClose }: InscriptionNetworkProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const networkRef = useRef<Network | null>(null)
  const nodeInfoRef = useRef<HTMLDivElement>(null)

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

          edges.push({
            from: inscriptionId,
            to: personId,
            label: 'mentions',
            arrows: 'to',
            color: { color: '#95a5a6' },
            font: { size: 10 }
          })
        }

        // Career nodes
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

            edges.push({
              from: personId,
              to: careerId,
              label: 'hasCareer',
              arrows: 'to',
              color: { color: '#9b59b6' },
              font: { size: 9 }
            })
          }
        }

        // Benefaction nodes
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

            edges.push({
              from: personId,
              to: benefId,
              label: 'hasBenefaction',
              arrows: 'to',
              color: { color: '#f39c12' },
              font: { size: 9 }
            })
          }
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

          edges.push({
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
        edges.push({
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
      if (params.nodes.length > 0 && nodeInfoRef.current) {
        const nodeId = params.nodes[0]
        const node = nodes.find(n => n.id === nodeId)
        if (node) {
          showNodeInfo(node)
        }
      }
    })

    // Stop physics after stabilization
    network.once('stabilizationIterationsDone', function() {
      network.setOptions({ physics: false })
    })

    return () => {
      network.destroy()
    }
  }, [edcsId, networkData])

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
    return (
      <div className="mt-4 p-4 bg-yellow-100 border-2 border-yellow-500 rounded-lg">
        <div className="flex justify-between items-center mb-3">
          <h4 className="text-[16px] font-semibold text-[#333]">ネットワーク表示: {edcsId}</h4>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-[20px] font-bold"
          >
            ×
          </button>
        </div>
        <p className="text-[14px] text-[#666]">この碑文のネットワークデータはありません</p>
      </div>
    )
  }

  return (
    <div className="mt-4 p-4 bg-blue-50 border-4 border-blue-500 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-[16px] font-semibold text-[#333]">ネットワーク表示: {edcsId} (データ数: {networkData.length})</h4>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 text-[20px] font-bold"
        >
          ×
        </button>
      </div>
      <div
        ref={containerRef}
        className="w-full h-[400px] rounded bg-white"
      />
      <div
        ref={nodeInfoRef}
        className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded text-[13px] max-h-[200px] overflow-y-auto"
        style={{ display: 'none' }}
      />
    </div>
  )
}
