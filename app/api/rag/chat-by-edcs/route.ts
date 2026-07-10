import { NextRequest, NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'

// RAG over the current epigraphy search result set.
//
// Unlike the legacy /api/rag/chat route (which filters Pinecone by Pleiades
// place id), this route filters by the EDCS ids of the rows currently in the
// search/region result set, so the AI answers strictly within what the user
// is looking at.
//
// Only the inscriptions that have been embedded into Pinecone are eligible —
// the rest of the result set is invisible to RAG. The caller is told how many
// of its ids were actually searchable via `searchableCount`.

// Pinecone caps a single $in filter at 1000 values. When the result set is
// larger we drop the filter and post-filter the matches against the id set
// instead (querying a larger topK to compensate).
const PINECONE_IN_LIMIT = 1000

export async function POST(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_ENABLE_RAG !== 'true') {
    return NextResponse.json(
      { error: 'RAG feature is not enabled' },
      { status: 403 },
    )
  }

  if (!process.env.OPENAI_API_KEY || !process.env.PINECONE_API_KEY) {
    return NextResponse.json({ error: 'API keys not configured' }, { status: 500 })
  }

  try {
    const {
      query,
      edcsIds,
      model = 'gpt-4o-mini',
      // Optional pre-formatted block of literature references for the
      // inscription(s) in scope. Supplied by the client only in single-
      // inscription mode, where the cost of fetching references is bounded.
      // The block embeds [REF-N] tokens; `refLinks` maps each token to its
      // external URL + label so the client can render them as deep links. We
      // pass refLinks straight back through — the model never sees it.
      literatureContext,
      refLinks,
    } = await request.json()

    if (!query || !Array.isArray(edcsIds)) {
      return NextResponse.json(
        { error: 'Invalid request: query and edcsIds are required' },
        { status: 400 },
      )
    }

    if (edcsIds.length === 0) {
      return NextResponse.json({
        answer:
          'There are no inscriptions in the current result set to analyze. Run a search first.',
        sources: [],
        searchableCount: 0,
      })
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY })
    const indexName = process.env.PINECONE_INDEX_NAME || 'roman-inscriptions'
    const index = pinecone.index(indexName)

    // Embed the user query.
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    })
    const queryEmbedding = embeddingResponse.data[0].embedding

    const idSet = new Set<string>(edcsIds)

    // Query Pinecone. Use the metadata filter when the id set is within
    // Pinecone's $in limit; otherwise query broadly and post-filter.
    let matches
    if (edcsIds.length <= PINECONE_IN_LIMIT) {
      const r = await index.query({
        vector: queryEmbedding,
        topK: 20,
        includeMetadata: true,
        filter: { edcs_id: { $in: edcsIds } },
      })
      matches = r.matches
    } else {
      // No server-side filter possible for >1000 ids. Pull a wide slice and
      // keep only the ids that belong to the current result set.
      const r = await index.query({
        vector: queryEmbedding,
        topK: 200,
        includeMetadata: true,
      })
      matches = r.matches
        .filter((m) => {
          const id = (m.metadata as any)?.edcs_id
          return id && idSet.has(id)
        })
        .slice(0, 20)
    }

    if (!matches || matches.length === 0) {
      return NextResponse.json({
        answer:
          'No relevant inscriptions were found within the current result set. Note that only inscriptions that have been embedded for AI search are eligible — the rest of your results cannot be analyzed.',
        sources: [],
        searchableCount: 0,
      })
    }

    const inscriptionContext = matches
      .map((match) => {
        const m = match.metadata as any
        return `Inscription ID: ${m.edcs_id || 'unknown'}
Location: ${m.place || 'unknown'}
Province: ${m.province || 'unknown'}
Citation: ${m.citation || 'unknown'}
Text: ${m.text || 'No text available'}
Commentary: ${m.comment || 'No commentary available'}
---`
      })
      .join('\n\n')

    // Append the scholarly literature block when the client provided one
    // (single-inscription mode). This lets the model ground its answer in how
    // modern research has discussed the inscription, not just its raw text.
    const context =
      typeof literatureContext === 'string' && literatureContext.trim()
        ? `${inscriptionContext}\n\n=== Modern scholarly references discussing the inscription(s) above ===\n\n${literatureContext.trim()}`
        : inscriptionContext

    const systemPrompt = `You are an expert in Roman epigraphy and ancient history. Answer questions about Roman inscriptions based ONLY on the provided context, which is restricted to the inscriptions the user is currently viewing.

CRITICAL FORMATTING RULE: When citing inscription IDs, you MUST wrap them in square brackets like this: [EDCS-12345678]. This makes them clickable for users.

Examples of correct citation format:
- "According to [EDCS-12345678], the emperor..."
- "The inscription [EDCS-12345678] shows..."

Cite inscription IDs frequently throughout your answer. If the context doesn't contain enough information to answer the question, say so.

If the context includes a "Modern scholarly references" section, use it to inform your answer about how researchers have interpreted, transcribed, dated, or discussed the inscription, and mention the relevant work (by author/title) where helpful.

Each scholarly work in that section is labelled with a reference token like [REF-1]. When you draw on a particular work, cite it by appending its token, e.g. "as transcribed by Smith [REF-1]". Use the tokens EXACTLY as given — do not invent new ones. These tokens are turned into clickable links to the exact passage in the publication.`

    let answer: string | null = null

    if (model === 'gemini-2.0-flash') {
      if (!process.env.GEMINI_API_KEY) {
        return NextResponse.json(
          { error: 'Gemini API key not configured' },
          { status: 500 },
        )
      }
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
      const geminiModel = genAI.getGenerativeModel({
        model: 'gemini-3-flash-preview',
      })
      const result = await geminiModel.generateContent(
        `${systemPrompt}\n\nContext from inscriptions:\n\n${context}\n\nQuestion: ${query}`,
      )
      answer = result.response.text()
    } else {
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Context from inscriptions:\n\n${context}\n\nQuestion: ${query}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      })
      answer = completion.choices[0].message.content
    }

    const sources = matches.map((match) => {
      const m = match.metadata as any
      return {
        edcsId: m.edcs_id || 'unknown',
        placeName: m.place || 'unknown',
        score: match.score,
      }
    })

    return NextResponse.json({
      answer,
      sources,
      searchableCount: matches.length,
      // Pass the client's reference-link map straight back so it can resolve
      // the [REF-N] tokens the model emitted into deep links.
      refLinks: refLinks ?? null,
    })
  } catch (error) {
    console.error('RAG (by-edcs) API Error:', error)
    return NextResponse.json(
      { error: 'Failed to process RAG request' },
      { status: 500 },
    )
  }
}
