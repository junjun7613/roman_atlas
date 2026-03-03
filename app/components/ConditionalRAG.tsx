'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

/**
 * Conditional RAG Component Loader
 * Loads RAG panel only when the feature is enabled
 * Uses dynamic import to exclude from bundle when disabled
 */

interface Message {
  role: 'user' | 'assistant'
  content: string
  sources?: Array<{
    edcsId: string
    placeName: string
    score?: number
  }>
}

interface ConditionalRAGProps {
  placeIds: string[]
  placeName?: string
  onInscriptionClick?: (edcsId: string) => void
  // Lifted state from parent
  messages: Message[]
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  input: string
  setInput: React.Dispatch<React.SetStateAction<string>>
  isLoading: boolean
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>
  error: string | null
  setError: React.Dispatch<React.SetStateAction<string | null>>
  selectedModel: 'gpt-4o-mini' | 'gemini-2.0-flash'
  setSelectedModel: React.Dispatch<React.SetStateAction<'gpt-4o-mini' | 'gemini-2.0-flash'>>
}

// Dynamically import RAG panel
const RAGPanel = dynamic(() => import('./rag/RAGPanel'), {
  ssr: false,
  loading: () => (
    <div className="mt-4 p-4 bg-gray-50 rounded-lg animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-1/3 mb-3"></div>
      <div className="h-20 bg-gray-200 rounded"></div>
    </div>
  )
})

export default function ConditionalRAG({
  placeIds,
  placeName,
  onInscriptionClick,
  messages,
  setMessages,
  input,
  setInput,
  isLoading,
  setIsLoading,
  error,
  setError,
  selectedModel,
  setSelectedModel
}: ConditionalRAGProps) {
  const [isEnabled, setIsEnabled] = useState(false)

  useEffect(() => {
    // Check if RAG is enabled on client-side
    const enabled = process.env.NEXT_PUBLIC_ENABLE_RAG === 'true'
    console.log('ConditionalRAG - RAG enabled check:', {
      NEXT_PUBLIC_ENABLE_RAG: process.env.NEXT_PUBLIC_ENABLE_RAG,
      enabled,
      placeIds,
      placeName
    })
    setIsEnabled(enabled)
  }, [placeIds, placeName])

  console.log('ConditionalRAG render:', { isEnabled, placeIds, placeName })

  if (!isEnabled) {
    return (
      <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
        <p className="text-[14px] text-yellow-800">
          <strong>Debug:</strong> RAG is not enabled. NEXT_PUBLIC_ENABLE_RAG = {process.env.NEXT_PUBLIC_ENABLE_RAG}
        </p>
      </div>
    )
  }

  return (
    <RAGPanel
      placeIds={placeIds}
      placeName={placeName}
      onInscriptionClick={onInscriptionClick}
      messages={messages}
      setMessages={setMessages}
      input={input}
      setInput={setInput}
      isLoading={isLoading}
      setIsLoading={setIsLoading}
      error={error}
      setError={setError}
      selectedModel={selectedModel}
      setSelectedModel={setSelectedModel}
    />
  )
}
