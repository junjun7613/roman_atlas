/**
 * Feature flags for controlling optional features
 */

/**
 * Check if RAG feature is enabled
 * RAG feature is only available in local development environment
 */
export const isRAGEnabled = (): boolean => {
  // Client-side check
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_ENABLE_RAG === 'true'
  }

  // Server-side check - requires both flag and API key
  return (
    process.env.NEXT_PUBLIC_ENABLE_RAG === 'true' &&
    !!process.env.OPENAI_API_KEY
  )
}

/**
 * Check if running in local development environment
 */
export const isLocalDevelopment = (): boolean => {
  return (
    process.env.NODE_ENV === 'development' ||
    process.env.VERCEL_ENV === undefined
  )
}
