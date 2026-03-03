'use client'

import { useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * RAG Panel Component
 * AI-powered inscription analysis using RAG (Retrieval-Augmented Generation)
 * This feature is only available in local development environment
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

interface RAGPanelProps {
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

export default function RAGPanel({
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
}: RAGPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const previousPlaceIdsRef = useRef<string>('')

  // Debug: Log component lifecycle
  useEffect(() => {
    console.log('RAG: Component mounted/updated', {
      messageCount: messages.length,
      placeIds
    })

    return () => {
      console.log('RAG: Component unmounting', { messageCount: messages.length })
    }
  }, [])

  // Handle EDCS ID click
  const handleEdcsClick = (edcsId: string) => {
    if (onInscriptionClick) {
      onInscriptionClick(edcsId)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Clear messages only when placeIds actually change (new location selected)
  useEffect(() => {
    const currentPlaceIds = [...placeIds].sort().join(',')

    // Only clear if there was a previous value AND it's different
    if (previousPlaceIdsRef.current !== '' && previousPlaceIdsRef.current !== currentPlaceIds) {
      console.log('RAG: Location changed, clearing history', {
        previous: previousPlaceIdsRef.current,
        current: currentPlaceIds
      })
      setMessages([])
      setError(null)
    }

    // Update the reference
    previousPlaceIdsRef.current = currentPlaceIds
  }, [placeIds])

  // Clear history handler
  const handleClearHistory = () => {
    console.log('RAG: Manual history clear')
    setMessages([])
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setError(null)

    // Add user message to chat
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)

    try {
      const response = await fetch('/api/rag/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: userMessage,
          placeIds: placeIds,
          model: selectedModel,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to get response')
      }

      const data = await response.json()

      // Add assistant message to chat
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer,
          sources: data.sources,
        },
      ])
    } catch (err) {
      console.error('RAG Error:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')

      // Add error message to chat
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error processing your request. Please try again.',
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const locationText = placeName
    ? placeName
    : `${placeIds.length} selected location${placeIds.length > 1 ? 's' : ''}`

  return (
    <div className="mt-4">
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-lg border border-purple-200">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-[16px] font-semibold text-gray-900">RAG Analysis</h3>
              <p className="text-[12px] text-gray-600">
                AI-powered inscription insights for {locationText}
              </p>
            </div>
          </div>

          {/* Clear History Button */}
          {messages.length > 0 && (
            <button
              onClick={handleClearHistory}
              disabled={isLoading}
              className="px-3 py-1.5 text-[12px] text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
              title="Clear conversation history"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              履歴をクリア
            </button>
          )}
        </div>

        {/* Chat Messages */}
        <div className="bg-white rounded-lg border border-gray-200 mb-4">
          <div className="h-96 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <p className="text-[14px] mb-2">Ask questions about the inscriptions</p>
                  <p className="text-[12px] text-gray-400">
                    Example: "What are the main themes in these inscriptions?"
                  </p>
                </div>
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      message.role === 'user'
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    {message.role === 'user' ? (
                      <p className="text-[14px] whitespace-pre-wrap">{message.content}</p>
                    ) : (
                      <div className="text-[14px] prose prose-sm max-w-none prose-headings:text-gray-900 prose-h1:text-[16px] prose-h2:text-[15px] prose-h3:text-[14px] prose-h4:text-[13px] prose-p:text-[14px] prose-li:text-[14px] prose-strong:text-gray-900 prose-a:text-purple-600 hover:prose-a:text-purple-700">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            a: ({ node, href, children, ...props }) => {
                              // Check if this is an EDCS ID link
                              const text = children?.toString() || ''
                              const edcsMatch = text.match(/EDCS-(\d+)/)

                              if (edcsMatch && href?.startsWith('#edcs-') && onInscriptionClick) {
                                const edcsId = `EDCS-${edcsMatch[1]}`
                                return (
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault()
                                      handleEdcsClick(edcsId)
                                    }}
                                    className="text-purple-600 hover:text-purple-700 underline cursor-pointer bg-purple-50 px-1 rounded"
                                  >
                                    {children}
                                  </button>
                                )
                              }
                              return <a href={href} {...props}>{children}</a>
                            }
                          }}
                        >
                          {(() => {
                            // Pre-process content to convert [EDCS-ID] to markdown links
                            let processedContent = message.content
                            // Replace [EDCS-12345678] with [EDCS-12345678](#edcs-12345678)
                            processedContent = processedContent.replace(/\[EDCS-(\d+)\]/g, '[EDCS-$1](#edcs-$1)')
                            return processedContent
                          })()}
                        </ReactMarkdown>
                      </div>
                    )}

                    {/* Show sources for assistant messages */}
                    {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-300">
                        <p className="text-[12px] font-semibold mb-2">Sources:</p>
                        <div className="space-y-1">
                          {message.sources.slice(0, 5).map((source, idx) => (
                            <div key={idx} className="text-[11px] text-gray-600">
                              •{' '}
                              {onInscriptionClick ? (
                                <button
                                  onClick={() => handleEdcsClick(source.edcsId)}
                                  className="text-purple-600 hover:text-purple-700 underline cursor-pointer"
                                >
                                  {source.edcsId}
                                </button>
                              ) : (
                                source.edcsId
                              )}{' '}
                              ({source.placeName})
                              {source.score && ` - ${(source.score * 100).toFixed(1)}% match`}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg px-4 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                    <span className="text-[12px] text-gray-600">Analyzing...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Model Selection */}
          <div className="flex items-center gap-3">
            <label className="text-[13px] text-gray-700 font-medium">Model:</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value as 'gpt-4o-mini' | 'gemini-2.0-flash')}
              disabled={isLoading}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
            >
              <option value="gpt-4o-mini">GPT-4o Mini (OpenAI)</option>
              <option value="gemini-2.0-flash">Gemini 3.0 Flash (Google)</option>
            </select>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about the inscriptions..."
              disabled={isLoading}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-[14px] disabled:bg-gray-100"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Sending...' : 'Send'}
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-[12px] text-red-800">
                <strong>Error:</strong> {error}
              </p>
            </div>
          )}
        </form>

        {/* Info Note */}
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-[12px] text-blue-800">
            <strong>Note:</strong> This feature uses AI to analyze inscriptions using Pinecone vector search and your selected LLM (OpenAI GPT-4o Mini or Google Gemini 3.0 Flash).
            It is only available in local development environment to control API costs.
          </p>
        </div>
      </div>
    </div>
  )
}
