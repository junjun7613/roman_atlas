import { NextRequest, NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'
import OpenAI from 'openai'

// This API route is only functional in local development
// It will return an error if called in production deployment

export async function POST(request: NextRequest) {
  // Check if RAG is enabled
  if (process.env.NEXT_PUBLIC_ENABLE_RAG !== 'true') {
    return NextResponse.json(
      { error: 'RAG feature is not enabled' },
      { status: 403 }
    )
  }

  // Check if required API keys are present
  if (!process.env.OPENAI_API_KEY || !process.env.PINECONE_API_KEY) {
    return NextResponse.json(
      { error: 'API keys not configured' },
      { status: 500 }
    )
  }

  try {
    const { query, placeIds } = await request.json()

    console.log('RAG API - Received request:', { query, placeIds })

    if (!query || !placeIds || !Array.isArray(placeIds)) {
      return NextResponse.json(
        { error: 'Invalid request: query and placeIds are required' },
        { status: 400 }
      )
    }

    // Initialize OpenAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    // Initialize Pinecone
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    })

    const indexName = process.env.PINECONE_INDEX_NAME || 'roman-inscriptions'
    console.log('RAG API - Using Pinecone index:', indexName)
    const index = pinecone.index(indexName)

    // Generate embedding for the user query
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    })

    const queryEmbedding = embeddingResponse.data[0].embedding
    console.log('RAG API - Generated embedding, dimension:', queryEmbedding.length)

    // Query Pinecone for similar inscriptions
    // First, try without filter to see if we get any results
    console.log('RAG API - Querying Pinecone WITHOUT filter (test)')
    const testResponse = await index.query({
      vector: queryEmbedding,
      topK: 3,
      includeMetadata: true
    })
    console.log('RAG API - Test query (no filter) returned:', {
      matchCount: testResponse.matches.length,
      sampleMetadata: testResponse.matches[0]?.metadata
    })

    // Now query with filter by placeIds to only search within selected locations
    // Note: Pinecone uses 'pleiades' field name, not 'placeId'
    console.log('RAG API - Querying Pinecone WITH filter:', { pleiades: { $in: placeIds } })
    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK: 20,
      includeMetadata: true,
      filter: {
        pleiades: { $in: placeIds }
      }
    })

    console.log('RAG API - Pinecone response:', {
      matchCount: queryResponse.matches.length,
      matches: queryResponse.matches.map(m => ({
        id: m.id,
        score: m.score,
        metadata: m.metadata
      }))
    })

    // Extract relevant context from matches
    const context = queryResponse.matches
      .map(match => {
        const metadata = match.metadata as any
        return `Inscription ID: ${metadata.edcs_id || metadata.edcsId || 'unknown'}
Location: ${metadata.place || metadata.placeName || 'unknown'}
Province: ${metadata.province || 'unknown'}
Citation: ${metadata.citation || 'unknown'}
Text: ${metadata.text || 'No text available'}
Commentary: ${metadata.comment || 'No commentary available'}
---`
      })
      .join('\n\n')

    console.log('RAG API - Context length:', context.length, 'characters')

    if (!context || queryResponse.matches.length === 0) {
      console.log('RAG API - No matches found, returning empty response')
      return NextResponse.json({
        answer: 'No relevant inscriptions found for your query in the selected locations.',
        sources: [],
        debug: {
          placeIds,
          matchCount: queryResponse.matches.length
        }
      })
    }

    // Generate answer using OpenAI with the context
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert in Roman epigraphy and ancient history. Answer questions about Roman inscriptions based on the provided context. Be specific and cite the inscription IDs when relevant. If the context doesn't contain enough information to answer the question, say so.`
        },
        {
          role: 'user',
          content: `Context from inscriptions:\n\n${context}\n\nQuestion: ${query}`
        }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    })

    const answer = completion.choices[0].message.content

    // Extract sources (inscription IDs and locations)
    const sources = queryResponse.matches.map(match => {
      const metadata = match.metadata as any
      return {
        edcsId: metadata.edcs_id || metadata.edcsId || 'unknown',
        placeName: metadata.place || metadata.placeName || 'unknown',
        score: match.score
      }
    })

    return NextResponse.json({
      answer,
      sources,
      matchCount: queryResponse.matches.length
    })

  } catch (error) {
    console.error('RAG API Error:', error)
    return NextResponse.json(
      { error: 'Failed to process RAG request' },
      { status: 500 }
    )
  }
}
