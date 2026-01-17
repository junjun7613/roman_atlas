'use client'

import { useSearchParams } from 'next/navigation'
import { useState, Suspense } from 'react'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

function ViewerContent() {
  const searchParams = useSearchParams()
  const manifestUrl = searchParams.get('manifest')
  const viewerType = searchParams.get('type') || 'uv' // 'uv' or 'mirador'
  const [showDebug, setShowDebug] = useState(false)

  if (!manifestUrl) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">IIIF Viewer</h1>
          <p className="text-gray-600">マニフェストURLが指定されていません</p>
        </div>
      </div>
    )
  }

  // Build viewer URL based on type
  let viewerUrl = ''

  if (viewerType === 'mirador') {
    viewerUrl = `https://projectmirador.org/embed/?iiif-content=${encodeURIComponent(manifestUrl)}`
  } else {
    // Universal Viewer - try the official demo site format
    viewerUrl = `https://universalviewer.io/#?manifest=${encodeURIComponent(manifestUrl)}`
  }

  return (
    <div className="w-screen h-screen overflow-hidden relative">
      {/* Debug toggle button */}
      <button
        onClick={() => setShowDebug(!showDebug)}
        className="absolute top-2 right-2 z-20 px-3 py-1 bg-gray-800 text-white text-xs rounded hover:bg-gray-700"
      >
        {showDebug ? 'デバッグ情報を隠す' : 'デバッグ情報'}
      </button>

      {/* Debug info panel */}
      {showDebug && (
        <div className="absolute top-12 right-2 z-20 bg-white p-4 rounded shadow-lg max-w-md text-xs">
          <h3 className="font-bold mb-2">デバッグ情報</h3>
          <p className="mb-1"><strong>Viewer Type:</strong> {viewerType}</p>
          <p className="mb-1"><strong>Manifest URL:</strong></p>
          <p className="break-all text-blue-600 mb-2">
            <a href={manifestUrl} target="_blank" rel="noopener noreferrer" className="underline">
              {manifestUrl}
            </a>
          </p>
          <p className="mb-1"><strong>Viewer URL:</strong></p>
          <p className="break-all text-gray-600">{viewerUrl}</p>
        </div>
      )}

      <iframe
        src={viewerUrl}
        className="w-full h-full border-0"
        title={viewerType === 'uv' ? 'Universal Viewer' : 'Mirador Viewer'}
        allow="fullscreen"
      />
    </div>
  )
}

export default function ViewerPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-700">読み込み中...</p>
        </div>
      </div>
    }>
      <ViewerContent />
    </Suspense>
  )
}
