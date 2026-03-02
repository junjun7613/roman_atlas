'use client'

import dynamic from 'next/dynamic'

/**
 * Conditional RAG Component Loader
 * Loads RAG panel only when the feature is enabled
 * Uses dynamic import to exclude from bundle when disabled
 */

// Check if RAG is enabled (client-side only)
const isRAGEnabled = typeof window !== 'undefined' &&
                     process.env.NEXT_PUBLIC_ENABLE_RAG === 'true'

// Dynamically import RAG panel only if enabled
const RAGPanel = isRAGEnabled
  ? dynamic(() => import('./rag/RAGPanel'), {
      ssr: false,
      loading: () => (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-3"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      )
    })
  : () => null

export default RAGPanel
