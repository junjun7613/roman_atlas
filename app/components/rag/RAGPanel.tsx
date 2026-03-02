'use client'

/**
 * RAG Panel Component
 * AI-powered inscription analysis using RAG (Retrieval-Augmented Generation)
 * This feature is only available in local development environment
 */
export default function RAGPanel() {
  return (
    <div className="mt-4">
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-lg border border-purple-200">
        <div className="flex items-center gap-3 mb-4">
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
            <p className="text-[12px] text-gray-600">AI-powered inscription insights</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <p className="text-[14px] text-gray-700 mb-3">
              Ask questions about the inscriptions in this location:
            </p>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-[14px]"
              rows={3}
              placeholder="e.g., What are the main themes in these inscriptions?"
              disabled
            />
          </div>

          <button
            className="w-full px-4 py-2 bg-gray-300 text-gray-500 rounded-lg font-medium cursor-not-allowed"
            disabled
          >
            Coming Soon - RAG Feature Under Development
          </button>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-[12px] text-blue-800">
              <strong>Note:</strong> This feature uses AI to analyze inscriptions.
              It is only available in local development environment to control API costs.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
