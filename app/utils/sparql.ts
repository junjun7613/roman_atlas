export interface PlaceInscriptionCount {
  placeId: string
  count: number
}

// EDCS link building lives in the external-database registry; re-export so
// existing SPARQL consumers keep importing it from here.
import { buildEdcsUrl } from '@/app/lib/epigraphy/external-links'
export { buildEdcsUrl }

export interface CustomPlace {
  id: string
  title: string
  latitude: number
  longitude: number
  placeTypes: string
  description: string
  uri: string
  modernName: string
  period: string
  source: string
  IIIF3D?: string
}

export interface InscriptionDetail {
  edcsId: string
  description: string
  dating: string
  edcsUrl: string
  iiifManifest3D?: string
  iiifManifest2D?: string
  personCount?: number
  relationshipCount?: number
  careerCount?: number
  benefactionCount?: number
}

export interface InscriptionNetworkData {
  inscription: string
  person?: string
  person_name?: string
  person_label?: string
  normalized_name?: string
  social_status?: string
  community?: string
  community_label?: string
  relationship?: string
  rel_type?: string
  rel_property?: string
  rel_source?: string
  rel_target?: string
  career_position?: string
  position?: string
  position_abstract?: string
  position_normalized?: string
  position_type?: string
  position_order?: string
  position_desc?: string
  benefaction?: string
  benef_type?: string
  benef_object?: string
  benef_objectType?: string
}

// A single excerpt from a publication describing the inscription, keyed by the
// kind of statement it makes (transcription, translation, dating, ...).
export interface LiteratureExcerpt {
  // The relationType local name, e.g. "transcription", "translation".
  relType: string
  // The body text of that statement.
  text: string
  // The raw citation string the publication used for this excerpt
  // (e.g. "CIL, VIII, 26274"). The same paper may cite an inscription under
  // several corpus references, so this is carried per-excerpt.
  rawRef?: string
  // Where in the publication the mention occurs: "body" (running text) or
  // "note" (footnote). Lets the UI — and SPARQL analysis — separate in-text
  // discussion from footnote citations.
  locationType?: "body" | "note"
  // Position within the body, as paragraph numbers (1-based). Present only for
  // body mentions. endParagraph is omitted when the mention is a single
  // paragraph.
  startParagraph?: number
  endParagraph?: number
  // Footnote number. Present only for note mentions.
  noteNumber?: number
  // For note mentions: the body paragraph the footnote is attached to, resolved
  // via ns:inFootnote → (ns:containsFootnote)⁻¹ → ns:paragraphNumber. Lets the
  // UI show and link the footnote's parent paragraph.
  noteParentParagraph?: number
}

// A research publication that mentions the inscription, with its bibliographic
// metadata and every excerpt in which it discusses the inscription. This is the
// grouping unit of the 文献 tab: "which work cites this inscription, and how".
export interface LiteratureReference {
  // Document URI (stable id within the graph).
  uri: string
  // Title of the work (book section / article).
  title?: string
  // Author / editor.
  creator?: string
  // Title of the containing volume, if this is a chapter/section.
  containerTitle?: string
  // Page range within the volume, e.g. "59-118".
  pages?: string
  // External URL (publisher / OpenEdition) and DOI, if present.
  source?: string
  doi?: string
  // The excerpts in which this work discusses the inscription, grouped here.
  excerpts: LiteratureExcerpt[]
}

export interface MosaicDetail {
  manifestUrl: string
  place?: string
  label?: string
  thumbnail?: string
}

export interface AgeAtDeathData {
  averageAge: number
  count: number
  under10Count: number
  under10Percentage: number
}

export interface NomenFrequency {
  nomen: string
  count: number
}

export interface BenefactionTypeFrequency {
  benefactionType: string
  count: number
}

export interface BenefactionObjectTypeFrequency {
  objectType: string
  count: number
}

export interface DivinityTypeFrequency {
  divinityType: string
  count: number
}

export interface BenefactionCostStatistics {
  benefactionType: string
  count: number
  countWithCost: number
  avgCost: number | null
  totalCost: number | null
  minCost: number | null
  maxCost: number | null
}

export interface BenefactionObjectCostStatistics {
  objectType: string
  count: number
  countWithCost: number
  avgCost: number | null
  totalCost: number | null
  minCost: number | null
  maxCost: number | null
}

export interface TopBenefaction {
  edcsId: string
  personName: string
  benefactionType: string
  objectType: string
  cost: number
  costOriginalText: string
  description: string
}

/**
 * Query inscriptions by Pleiades ID and/or custom location from SPARQL endpoint
 * This function searches for inscriptions linked via:
 * 1. epig:pleiadesId (standard Pleiades ID)
 * 2. epig:foundLocation (custom location URI with location: prefix)
 */
export async function queryInscriptionsByPlaceId(pleiadesId: string, customLocationId?: string): Promise<number> {
  const endpoint = 'https://dydra.com/junjun7613/inscriptions_llm/sparql'

  const query = `
    PREFIX epig: <http://example.org/epigraphy/>
    PREFIX location: <http://example.org/location/>

    SELECT (COUNT(DISTINCT ?inscription) as ?count)
    WHERE {
      ?inscription a epig:Inscription .
      {
        ?inscription epig:pleiadesId "${pleiadesId}" .
      }
      ${customLocationId ? `UNION {
        ?inscription epig:foundLocation location:${customLocationId} .
      }` : ''}
    }
  `

  console.log('Querying SPARQL endpoint for Pleiades ID:', pleiadesId)
  console.log('Query:', query)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/sparql-results+json'
      },
      body: `query=${encodeURIComponent(query)}`
    })

    console.log('Response status:', response.status, response.statusText)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('SPARQL error response:', errorText)
      throw new Error(`SPARQL query failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    console.log('SPARQL response data:', data)

    if (data.results && data.results.bindings && data.results.bindings.length > 0) {
      const count = parseInt(data.results.bindings[0].count.value, 10)
      console.log('Inscription count:', count)
      return count
    }

    console.log('No results found in response')
    return 0
  } catch (error) {
    console.error('Error querying SPARQL endpoint:', error)
    return 0
  }
}

/**
 * Query inscriptions for multiple Pleiades IDs from SPARQL endpoint
 * This function searches for inscriptions linked via epig:pleiadesId only
 * (foundLocation search requires specific location URIs which are handled separately)
 */
export async function queryInscriptionsByPlaceIds(pleiadesIds: string[]): Promise<PlaceInscriptionCount[]> {
  const endpoint = 'https://dydra.com/junjun7613/inscriptions_llm/sparql'

  // Create VALUES clause for multiple IDs
  const values = pleiadesIds.map(id => `"${id}"`).join(' ')

  const query = `
    PREFIX epig: <http://example.org/epigraphy/>

    SELECT ?placeId (COUNT(DISTINCT ?inscription) as ?count)
    WHERE {
      VALUES ?placeId { ${values} }
      ?inscription a epig:Inscription ;
                   epig:pleiadesId ?placeId .
    }
    GROUP BY ?placeId
  `

  console.log('Querying SPARQL endpoint for multiple Pleiades IDs:', pleiadesIds)
  console.log('Query:', query)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/sparql-results+json'
      },
      body: `query=${encodeURIComponent(query)}`
    })

    console.log('Response status:', response.status, response.statusText)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('SPARQL error response:', errorText)
      throw new Error(`SPARQL query failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    console.log('SPARQL response data:', data)

    if (data.results && data.results.bindings && data.results.bindings.length > 0) {
      const results: PlaceInscriptionCount[] = data.results.bindings.map((binding: any) => ({
        placeId: binding.placeId.value,
        count: parseInt(binding.count.value, 10)
      }))
      console.log('Inscription counts:', results)
      return results
    }

    console.log('No results found in response')
    return []
  } catch (error) {
    console.error('Error querying SPARQL endpoint:', error)
    return []
  }
}

/**
 * Query detailed inscription information by Pleiades ID and/or custom location from SPARQL endpoint
 * This function retrieves individual inscription details including EDCS ID, description, dating, and URL
 */
export async function queryInscriptionDetails(pleiadesId: string, customLocationId?: string): Promise<InscriptionDetail[]> {
  const endpoint = 'https://dydra.com/junjun7613/inscriptions_llm/sparql'

  const query = `
    PREFIX epig: <http://example.org/epigraphy/>
    PREFIX location: <http://example.org/location/>
    PREFIX dcterms: <http://purl.org/dc/terms/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>

    SELECT ?inscription ?text ?comment ?datingFrom ?datingTo ?iiifManifest3D ?iiifManifest2D
      (COALESCE(?personCount, 0) AS ?personCount)
      (COALESCE(?relationshipCount, 0) AS ?relationshipCount)
      (COALESCE(?careerCount, 0) AS ?careerCount)
      (COALESCE(?benefactionCount, 0) AS ?benefactionCount)
    WHERE {
      ?inscription a epig:Inscription .

      {
        ?inscription epig:pleiadesId "${pleiadesId}" .
      }
      ${customLocationId ? `UNION {
        ?inscription epig:foundLocation location:${customLocationId} .
      }` : ''}

      OPTIONAL { ?inscription epig:text ?text }
      OPTIONAL { ?inscription rdfs:comment ?comment }
      OPTIONAL { ?inscription epig:datingFrom ?datingFrom }
      OPTIONAL { ?inscription epig:datingTo ?datingTo }
      OPTIONAL { ?inscription epig:IIIFManifest3D ?iiifManifest3D }
      OPTIONAL { ?inscription epig:IIIFManifest2D ?iiifManifest2D }

      OPTIONAL {
        SELECT ?inscription (COUNT(DISTINCT ?person) AS ?personCount)
        WHERE {
          { ?inscription epig:mainSubject ?person . }
          UNION
          { ?inscription epig:mentions ?person . }
          ?person a foaf:Person .
        }
        GROUP BY ?inscription
      }

      OPTIONAL {
        SELECT ?inscription (COUNT(DISTINCT ?relationship) AS ?relationshipCount)
        WHERE {
          ?inscription epig:mentions ?relationship .
          ?relationship a epig:Relationship .
        }
        GROUP BY ?inscription
      }

      OPTIONAL {
        SELECT ?inscription (COUNT(DISTINCT ?career) AS ?careerCount)
        WHERE {
          {
            { ?inscription epig:mainSubject ?personForCareer . }
            UNION
            { ?inscription epig:mentions ?personForCareer . }
            ?personForCareer a foaf:Person .
            ?personForCareer epig:hasCareerPosition ?career .
          }
        }
        GROUP BY ?inscription
      }

      OPTIONAL {
        SELECT ?inscription (COUNT(DISTINCT ?benefaction) AS ?benefactionCount)
        WHERE {
          {
            { ?inscription epig:mainSubject ?personForBenef . }
            UNION
            { ?inscription epig:mentions ?personForBenef . }
            ?personForBenef a foaf:Person .
            ?personForBenef epig:hasBenefaction ?benefaction .
          }
        }
        GROUP BY ?inscription
      }
    }
    ORDER BY ?inscription
  `

  console.log('Querying inscription details for Pleiades ID:', pleiadesId)
  console.log('Query:', query)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/sparql-results+json'
      },
      body: `query=${encodeURIComponent(query)}`
    })

    console.log('Response status:', response.status, response.statusText)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('SPARQL error response:', errorText)
      throw new Error(`SPARQL query failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    console.log('SPARQL inscription details response:', data)

    if (data.results && data.results.bindings && data.results.bindings.length > 0) {
      const inscriptions: InscriptionDetail[] = data.results.bindings.map((binding: any) => {
        // Extract EDCS ID from inscription URI
        // URI format: http://example.org/epigraphy/EDCS-12345678
        const inscriptionUri = binding.inscription.value
        const edcsId = inscriptionUri.split('/').pop() || inscriptionUri

        // Combine text and comment for description
        // Prefer comment (descriptive commentary) over text (raw inscription)
        const text = binding.text ? binding.text.value : ''
        const comment = binding.comment ? binding.comment.value : ''
        const description = comment || text

        // Format dating from datingFrom and datingTo
        let dating = ''
        const datingFrom = binding.datingFrom ? binding.datingFrom.value : ''
        const datingTo = binding.datingTo ? binding.datingTo.value : ''

        if (datingFrom && datingTo) {
          dating = `${datingFrom} - ${datingTo}`
        } else if (datingFrom) {
          dating = `${datingFrom} -`
        } else if (datingTo) {
          dating = `- ${datingTo}`
        }

        // Extract counts
        const personCount = binding.personCount ? parseInt(binding.personCount.value, 10) : 0
        const relationshipCount = binding.relationshipCount ? parseInt(binding.relationshipCount.value, 10) : 0
        const careerCount = binding.careerCount ? parseInt(binding.careerCount.value, 10) : 0
        const benefactionCount = binding.benefactionCount ? parseInt(binding.benefactionCount.value, 10) : 0

        // Extract IIIF Manifest 3D and 2D URLs
        const iiifManifest3D = binding.iiifManifest3D ? binding.iiifManifest3D.value : undefined
        const iiifManifest2D = binding.iiifManifest2D ? binding.iiifManifest2D.value : undefined

        return {
          edcsId: edcsId,
          description: description,
          dating: dating,
          edcsUrl: buildEdcsUrl(edcsId),
          iiifManifest3D: iiifManifest3D,
          iiifManifest2D: iiifManifest2D,
          personCount: personCount,
          relationshipCount: relationshipCount,
          careerCount: careerCount,
          benefactionCount: benefactionCount
        }
      })
      console.log('Inscription details count:', inscriptions.length)
      return inscriptions
    }

    console.log('No inscription details found')
    return []
  } catch (error) {
    console.error('Error querying inscription details from SPARQL endpoint:', error)
    return []
  }
}

/**
 * Query custom places (locations) from SPARQL endpoint
 */
export async function queryCustomPlaces(): Promise<CustomPlace[]> {
  const endpoint = 'https://dydra.com/junjun7613/inscriptions_llm/sparql'

  const query = `
    PREFIX epig: <http://example.org/epigraphy/>
    PREFIX location: <http://example.org/location/>
    PREFIX geo1: <http://www.w3.org/2003/01/geo/wgs84_pos#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX dcterms: <http://purl.org/dc/terms/>

    SELECT ?id ?title ?lat ?long ?placeType ?description ?uri ?modernName ?period ?source ?iiif3d
    WHERE {
      ?location a epig:Location ;
                dcterms:identifier ?id ;
                dcterms:title ?title ;
                geo1:lat ?lat ;
                geo1:long ?long ;
                epig:placeType ?placeType ;
                dcterms:description ?description ;
                epig:modernName ?modernName ;
                epig:period ?period ;
                dcterms:source ?source .
      OPTIONAL { ?location rdfs:seeAlso ?uri }
      OPTIONAL { ?location epig:IIIFManifest3D ?iiif3d }
    }
    ORDER BY ?id
  `

  console.log('Querying custom places from SPARQL endpoint')

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/sparql-results+json'
      },
      body: `query=${encodeURIComponent(query)}`
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('SPARQL error response:', errorText)
      throw new Error(`SPARQL query failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    console.log('SPARQL custom places response:', data)

    if (data.results && data.results.bindings && data.results.bindings.length > 0) {
      const places: CustomPlace[] = data.results.bindings.map((binding: any) => ({
        id: binding.id.value,
        title: binding.title.value,
        latitude: parseFloat(binding.lat.value),
        longitude: parseFloat(binding.long.value),
        placeTypes: binding.placeType.value,
        description: binding.description.value,
        uri: binding.uri ? binding.uri.value : '',
        modernName: binding.modernName.value,
        period: binding.period.value,
        source: binding.source.value,
        IIIF3D: binding.iiif3d ? binding.iiif3d.value : ''
      }))
      console.log('Custom places count:', places.length)
      return places
    }

    console.log('No custom places found')
    return []
  } catch (error) {
    console.error('Error querying custom places from SPARQL endpoint:', error)
    return []
  }
}

/**
 * Query all unique relationship types from SPARQL endpoint
 */
export async function queryAllRelationshipTypes(): Promise<string[]> {
  const endpoint = 'https://dydra.com/junjun7613/inscriptions_llm/sparql'

  const query = `
    PREFIX epig: <http://example.org/epigraphy/>

    SELECT DISTINCT ?relationshipType
    WHERE {
      ?relationship a epig:Relationship .
      ?relationship epig:relationshipType ?relationshipType .
    }
    ORDER BY ?relationshipType
  `

  console.log('Querying all relationship types from SPARQL endpoint')

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/sparql-results+json'
      },
      body: `query=${encodeURIComponent(query)}`
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('SPARQL error response:', errorText)
      throw new Error(`SPARQL query failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    console.log('SPARQL relationship types response:', data)

    if (data.results && data.results.bindings && data.results.bindings.length > 0) {
      const types = data.results.bindings.map((binding: any) => binding.relationshipType?.value).filter(Boolean)
      console.log('Relationship types count:', types.length)
      return types
    }

    console.log('No relationship types found')
    return []
  } catch (error) {
    console.error('Error querying relationship types from SPARQL endpoint:', error)
    return []
  }
}

/**
 * Query detailed inscription data by EDCS ID
 */
export async function queryInscriptionByEdcsId(edcsId: string): Promise<{
  edcsId: string
  text: string
  comment: string
  bibliographicCitation: string
  datingFrom: number | null
  datingTo: number | null
  province: string
  place: string
} | null> {
  const endpoint = 'https://dydra.com/junjun7613/inscriptions_llm/sparql'

  const query = `
    PREFIX epig: <http://example.org/epigraphy/>
    PREFIX dcterms: <http://purl.org/dc/terms/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

    SELECT ?text ?comment ?bibliographicCitation ?datingFrom ?datingTo ?province ?place
    WHERE {
      ?inscription a epig:Inscription ;
                   dcterms:identifier "${edcsId}" .

      OPTIONAL { ?inscription epig:text ?text }
      OPTIONAL { ?inscription rdfs:comment ?comment }
      OPTIONAL { ?inscription dcterms:bibliographicCitation ?bibliographicCitation }
      OPTIONAL { ?inscription epig:datingFrom ?datingFrom }
      OPTIONAL { ?inscription epig:datingTo ?datingTo }
      OPTIONAL { ?inscription epig:province ?province }
      OPTIONAL { ?inscription epig:place ?place }
    }
  `

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/sparql-results+json'
      },
      body: `query=${encodeURIComponent(query)}`
    })

    if (!response.ok) {
      throw new Error(`SPARQL query failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    if (data.results && data.results.bindings && data.results.bindings.length > 0) {
      const binding = data.results.bindings[0]

      // Helper function to extract and decode URI components
      const extractLabel = (uri: string): string => {
        if (!uri) return ''
        // Get the last part of the URI
        const lastPart = uri.split('/').pop() || uri
        // Decode URI encoding (%20 -> space, etc.)
        const decoded = decodeURIComponent(lastPart)
        // Replace remaining encoded spaces with actual spaces
        return decoded.replace(/%20/g, ' ')
      }

      return {
        edcsId,
        text: binding.text?.value || '',
        comment: binding.comment?.value || '',
        bibliographicCitation: binding.bibliographicCitation?.value || '',
        datingFrom: binding.datingFrom?.value ? parseInt(binding.datingFrom.value) : null,
        datingTo: binding.datingTo?.value ? parseInt(binding.datingTo.value) : null,
        province: binding.province?.value ? extractLabel(binding.province.value) : '',
        place: binding.place?.value ? extractLabel(binding.place.value) : ''
      }
    }

    return null
  } catch (error) {
    console.error('Error querying inscription by EDCS ID:', error)
    return null
  }
}

/**
 * Query filter data (social statuses and relationship types) for multiple inscriptions at once
 * This is much more efficient than querying each inscription individually
 */
export async function queryInscriptionsFilterData(edcsIds: string[]): Promise<{ [edcsId: string]: { socialStatuses: string[], relationshipTypes: string[] } }> {
  const endpoint = 'https://dydra.com/junjun7613/inscriptions_llm/sparql'

  // Build VALUES clause for EDCS IDs
  const valuesClause = edcsIds.map(id => `"${id}"`).join(' ')

  const query = `
    PREFIX base: <http://example.org/inscription/>
    PREFIX epig: <http://example.org/epigraphy/>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    PREFIX dcterms: <http://purl.org/dc/terms/>

    SELECT DISTINCT ?edcsId ?social_status ?rel_type
    WHERE {
      VALUES ?edcsId { ${valuesClause} }

      ?inscription a epig:Inscription ;
                   dcterms:identifier ?edcsId .

      OPTIONAL {
        ?inscription epig:mentions ?person .
        ?person a foaf:Person .
        OPTIONAL { ?person epig:socialStatus ?social_status . }
      }

      OPTIONAL {
        ?inscription epig:mentions ?relationship .
        ?relationship a epig:Relationship .
        OPTIONAL { ?relationship epig:relationshipType ?rel_type . }
      }
    }
  `

  console.log(`Querying filter data for ${edcsIds.length} inscriptions`)

  try {
    // Add timeout to fetch request
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 second timeout for bulk query

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/sparql-results+json'
      },
      body: `query=${encodeURIComponent(query)}`,
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('SPARQL error response:', errorText)
      throw new Error(`SPARQL query failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    console.log(`Received filter data for ${edcsIds.length} inscriptions`)

    // Group results by EDCS ID
    const filterDataMap: { [edcsId: string]: { socialStatuses: string[], relationshipTypes: string[] } } = {}

    // Initialize all EDCS IDs with empty arrays
    edcsIds.forEach(id => {
      filterDataMap[id] = { socialStatuses: [], relationshipTypes: [] }
    })

    if (data.results && data.results.bindings && data.results.bindings.length > 0) {
      data.results.bindings.forEach((binding: any) => {
        const edcsId = binding.edcsId?.value
        if (edcsId) {
          if (!filterDataMap[edcsId]) {
            filterDataMap[edcsId] = { socialStatuses: [], relationshipTypes: [] }
          }
          if (binding.social_status?.value && !filterDataMap[edcsId].socialStatuses.includes(binding.social_status.value)) {
            filterDataMap[edcsId].socialStatuses.push(binding.social_status.value)
          }
          if (binding.rel_type?.value && !filterDataMap[edcsId].relationshipTypes.includes(binding.rel_type.value)) {
            filterDataMap[edcsId].relationshipTypes.push(binding.rel_type.value)
          }
        }
      })
    }

    return filterDataMap
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`Timeout querying filter data for ${edcsIds.length} inscriptions`)
    } else {
      console.error('Error querying filter data from SPARQL endpoint:', error)
    }
    // Return empty map to avoid breaking the UI
    const emptyMap: { [edcsId: string]: { socialStatuses: string[], relationshipTypes: string[] } } = {}
    edcsIds.forEach(id => {
      emptyMap[id] = { socialStatuses: [], relationshipTypes: [] }
    })
    return emptyMap
  }
}

/**
 * Query inscription network data (persons, communities, relationships, careers, benefactions) from SPARQL endpoint
 */
export async function queryInscriptionNetwork(edcsId: string): Promise<InscriptionNetworkData[]> {
  // The network data lives on the himiko Fuseki endpoint (full 51,941-inscription
  // dataset), which is plain HTTP. We go through the /api/sparql server-side
  // proxy to avoid CORS / mixed-content issues, and to keep the endpoint URL off
  // the client.
  //
  // himiko schema (epig: = http://epigraphic-careers.org/ontology#,
  //                p:   = urn:himiko:ontology:physical:,
  //                intr: = urn:himiko:ontology:intrinsic:):
  //   Inscription     <.../inscription/EDCS-ID>  p:mentions ?statement
  //   PersonReference <.../entityref/EDCS-ID/person/N> ; epig:personName /
  //                   intr:surfaceForm / epig:socialStatus (all direct literals)
  //   CareerStatement       epig:subject ?person ; epig:position*/order
  //   BenefactionStatement  epig:agent ?person ; epig:benefactionType/objectText/objectType
  //   RelationshipStatement epig:source/epig:target ?person ; epig:relationshipType/Property
  //   CommunityReference    intr:surfaceForm ; epig:communityType
  //
  // IMPORTANT graph layout: himiko has union-default-graph DISABLED and splits
  // triples across named graphs by source — the `p:mentions` edge lives in the
  // `edcs`-source graph while statement bodies and PersonReferences live in the
  // `claude`-source graph. So EVERY triple pattern must sit in its OWN
  // `GRAPH ?gN {}`; wrapping the whole thing in one graph returns nothing.
  const inscriptionUri = `http://epigraphic-careers.org/inscription/${edcsId}`

  const query = `
    PREFIX epig: <http://epigraphic-careers.org/ontology#>
    PREFIX p: <urn:himiko:ontology:physical:>
    PREFIX intr: <urn:himiko:ontology:intrinsic:>

    SELECT DISTINCT
        ?inscription
        ?person
        ?person_name
        ?person_label
        ?normalized_name
        ?social_status
        ?community
        ?community_label
        ?relationship
        ?rel_type
        ?rel_property
        ?rel_source
        ?rel_target
        ?career_position
        ?position
        ?position_abstract
        ?position_normalized
        ?position_type
        ?position_order
        ?position_desc
        ?benefaction
        ?benef_type
        ?benef_object
        ?benef_objectType
    WHERE {
        BIND(<${inscriptionUri}> AS ?inscription)
        {
            # PersonReferences for this inscription. They aren't linked back to
            # the inscription by a triple, so match on the id embedded in the URI
            # (.../entityref/EDCS-ID/person/N).
            GRAPH ?pg {
                ?person a epig:PersonReference .
                FILTER(STRSTARTS(STR(?person), "http://epigraphic-careers.org/entityref/${edcsId}/"))
                OPTIONAL { ?person epig:personName ?person_name . }
                OPTIONAL { ?person intr:surfaceForm ?person_label . }
                OPTIONAL { ?person epig:normalizedName ?normalized_name . }
                OPTIONAL { ?person epig:socialStatus ?social_status . }
            }
        }
        UNION {
            GRAPH ?mg { ?inscription p:mentions ?career_position . }
            GRAPH ?cg {
                ?career_position a epig:CareerStatement ;
                                 epig:subject ?person .
                OPTIONAL { ?career_position epig:positionText ?position . }
                OPTIONAL { ?career_position epig:positionAbstract ?position_abstract . }
                OPTIONAL { ?career_position epig:positionNormalized ?position_normalized . }
                OPTIONAL { ?career_position epig:positionType ?position_type . }
                OPTIONAL { ?career_position epig:order ?position_order . }
                OPTIONAL { ?career_position epig:positionDescription ?position_desc . }
            }
        }
        UNION {
            GRAPH ?mg { ?inscription p:mentions ?benefaction . }
            GRAPH ?bg {
                ?benefaction a epig:BenefactionStatement ;
                             epig:agent ?person .
                OPTIONAL { ?benefaction epig:benefactionType ?benef_type . }
                OPTIONAL { ?benefaction epig:objectText ?benef_object . }
                OPTIONAL { ?benefaction epig:objectType ?benef_objectType . }
            }
        }
        UNION {
            GRAPH ?mg { ?inscription p:mentions ?community . }
            GRAPH ?commg {
                ?community a epig:CommunityReference .
                OPTIONAL { ?community intr:surfaceForm ?community_label . }
            }
        }
        UNION {
            GRAPH ?mg { ?inscription p:mentions ?relationship . }
            GRAPH ?rg {
                ?relationship a epig:RelationshipStatement ;
                              epig:source ?rel_source ;
                              epig:target ?rel_target .
                OPTIONAL { ?relationship epig:relationshipType ?rel_type . }
                OPTIONAL { ?relationship epig:relationshipProperty ?rel_property . }
            }
        }
    }
  `

  console.log('Querying inscription network for EDCS ID:', edcsId)

  try {
    // Add timeout to fetch request
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    const response = await fetch('/api/sparql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/sparql-results+json'
      },
      body: JSON.stringify({ query }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('SPARQL error response:', errorText)
      throw new Error(`SPARQL query failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    console.log('SPARQL network response:', data)

    if (data.results && data.results.bindings && data.results.bindings.length > 0) {
      const networkData: InscriptionNetworkData[] = data.results.bindings.map((binding: any) => ({
        inscription: binding.inscription?.value || '',
        person: binding.person?.value,
        person_name: binding.person_name?.value,
        person_label: binding.person_label?.value,
        normalized_name: binding.normalized_name?.value,
        social_status: binding.social_status?.value,
        community: binding.community?.value,
        community_label: binding.community_label?.value,
        relationship: binding.relationship?.value,
        rel_type: binding.rel_type?.value,
        rel_property: binding.rel_property?.value,
        rel_source: binding.rel_source?.value,
        rel_target: binding.rel_target?.value,
        career_position: binding.career_position?.value,
        position: binding.position?.value,
        position_abstract: binding.position_abstract?.value,
        position_normalized: binding.position_normalized?.value,
        position_type: binding.position_type?.value,
        position_order: binding.position_order?.value,
        position_desc: binding.position_desc?.value,
        benefaction: binding.benefaction?.value,
        benef_type: binding.benef_type?.value,
        benef_object: binding.benef_object?.value,
        benef_objectType: binding.benef_objectType?.value
      }))
      console.log('Inscription network data count:', networkData.length)
      return networkData
    }

    console.log('No network data found')
    return []
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`Timeout querying inscription network for EDCS ID ${edcsId}`)
    } else {
      console.error('Error querying inscription network from SPARQL endpoint:', error)
    }
    // Return empty array to avoid breaking the UI
    return []
  }
}

// ---------------------------------------------------------------------------
// ATAG annotated text
//
// The ATAG endpoint stores each inscription as a p:Text (p: =
// urn:himiko:ontology:physical:) with:
//   - p:textContent            the raw string
//   - p:firstChar → p:next*    a linked list of per-character nodes, each with
//                              a p:offset and its own URI
//   - p:hasAnnotation          spans over the text (line numbers, expansions,
//                              abbreviations, supplied/gap markup); the kind and
//                              line number sit under the tei: namespace
//                              (tei:kind / tei:n), start/end stay on p:
// This mirrors the data the standalone viewer_epigraph.html consumes, so we can
// render the same annotated-text view inside the network dialog. Text URIs are
// urn:himiko:resource:text:<EDCS-ID>.
// ---------------------------------------------------------------------------

// One annotation span. `kind` drives the styling ("line", "expan", "abbr",
// "ex", "supplied", "gap"). `n` is the line number for kind === "line".
export interface AtagAnnotation {
  kind: string
  n: string | null
  start: number
  end: number
  annotText: string | null
}

export interface AtagText {
  edcsId: string
  content: string
  // Per-character URIs, sorted by offset — index i corresponds to content[i].
  charURIs: { uri: string; offset: number }[]
  annotations: AtagAnnotation[]
}

/**
 * Query the ATAG annotated text for an inscription by EDCS ID: the raw text,
 * the per-character URI list, and every annotation span. Returns null when the
 * inscription has no p:Text record in the ATAG graph (many EDCS ids won't).
 *
 * Goes through the /api/sparql proxy with dataset="atag" so the plain-HTTP
 * endpoint isn't hit directly from an https client (CORS / mixed content).
 */
export async function queryAtagText(edcsId: string): Promise<AtagText | null> {
  const textUri = `urn:himiko:resource:text:${edcsId}`

  const PREFIX = `
    PREFIX p: <urn:himiko:ontology:physical:>
    PREFIX tei: <urn:himiko:ontology:physical:tei:>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
  `

  const contentQuery = PREFIX + `
    SELECT ?content WHERE { <${textUri}> p:textContent ?content . }
  `

  const charQuery = PREFIX + `
    SELECT ?char ?offset WHERE {
      <${textUri}> p:firstChar ?firstChar .
      ?firstChar p:next* ?char .
      ?char p:offset ?offset .
    }
    ORDER BY xsd:integer(?offset)
  `

  // The kind / line-number predicates moved under the tei: namespace
  // (p:kind → tei:kind, p:n → tei:n). The old p:annotatedText (the covered
  // substring) is gone from structural annotations — that text now lives only
  // on the himiko_atag_linking annotations — so annotText is always null here.
  const annotQuery = PREFIX + `
    SELECT ?annot ?kind ?n ?start ?end WHERE {
      <${textUri}> p:hasAnnotation ?annot .
      ?annot a p:Annotation ;
             tei:kind ?kind ;
             p:start ?start ;
             p:end ?end .
      OPTIONAL { ?annot tei:n ?n }
    }
    ORDER BY xsd:integer(?start)
  `

  const run = async (query: string, signal: AbortSignal) => {
    const response = await fetch('/api/sparql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/sparql-results+json',
      },
      body: JSON.stringify({ query, dataset: 'atag' }),
      signal,
    })
    if (!response.ok) {
      throw new Error(`ATAG SPARQL query failed: ${response.status} ${response.statusText}`)
    }
    const data = await response.json()
    return data.results?.bindings ?? []
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  try {
    const [contentRows, charRows, annotRows] = await Promise.all([
      run(contentQuery, controller.signal),
      run(charQuery, controller.signal),
      run(annotQuery, controller.signal),
    ])

    clearTimeout(timeoutId)

    // No p:Text for this inscription → nothing annotated to show.
    if (contentRows.length === 0) {
      return null
    }

    const content: string = contentRows[0].content?.value ?? ''

    const charURIs = charRows.map((r: any) => ({
      uri: r.char.value as string,
      offset: parseInt(r.offset.value, 10),
    }))

    const annotations: AtagAnnotation[] = annotRows.map((r: any) => ({
      kind: r.kind.value,
      n: r.n ? r.n.value : null,
      start: parseInt(r.start.value, 10),
      end: parseInt(r.end.value, 10),
      // No longer carried by structural annotations in the updated ATAG data.
      annotText: null,
    }))

    return { edcsId, content, charURIs, annotations }
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`Timeout querying ATAG text for EDCS ID ${edcsId}`)
    } else {
      console.error('Error querying ATAG text from SPARQL endpoint:', error)
    }
    return null
  }
}

// ---------------------------------------------------------------------------
// Text ↔ network-node linkings (himiko_atag_linking)
//
// A linking is a p:Annotation on the inscription's p:Text whose p:refersToEntity
// points at a node in the network graph, with p:start / p:end marking the
// character range it covers. The standalone viewer_epigraph.html uses these to
// highlight the text span when its node is clicked (and vice-versa). Here we
// only READ them — no create / edit / delete.
//
// Linkings carry a provenance chain (hmkia:generatedBy an interpretation Act
// in the interpretation graph); a linking is "deleted" when its Act has been
// critiqued by a deletion Act. We filter those out so removed linkings don't
// reappear. `matcher` ("manual" vs an automatic matcher id) is derived from the
// Act's criterion / agent, mirroring the viewer.
// ---------------------------------------------------------------------------

export interface AtagLinking {
  // Annotation URI — stable id for this linking.
  id: string
  // The network node it points at (matches InscriptionNetworkData person /
  // career / benefaction / community URIs, i.e. vis-network node ids).
  nodeUri: string
  // Character range in the text: [startOffset, endOffset).
  startOffset: number
  endOffset: number
  // The linked substring (for tooltips / list display).
  rangeText: string
  // "manual" for human-authored, otherwise the automatic matcher id ("" if
  // unknown).
  matcher: string
}

const INTERPRETATION_GRAPH = 'urn:himiko:graph:interpretation'

/**
 * Query every (non-deleted) text↔entity linking for an inscription, by EDCS ID.
 * Returns [] when the inscription has no linkings. Read-only; goes through the
 * /api/sparql proxy with dataset="linking".
 */
export async function queryAtagLinkings(edcsId: string): Promise<AtagLinking[]> {
  const textUri = `urn:himiko:resource:text:${edcsId}`

  // One round-trip. The endpoint is in Tokyo while the Vercel function runs in
  // iad1 (US East) — every extra request pays the cross-region RTT, so a second
  // parallel query was making the pair time out (504). We combine the linkings
  // with the deletion filter into a single query.
  //
  // Cost breakdown from measurement: the bare linkings (~0.5s) plus the
  // `FILTER NOT EXISTS { GRAPH <interpretation> { ...deletion... } }` (~0.3s)
  // stay well under a second. What we DELIBERATELY OMIT is the old `matcher`
  // derivation (per-act hmkia:hasCriterion / associatedWith): those two
  // GRAPH-crossing OPTIONALs alone cost ~2s and were what blew the budget.
  // matcher is display-only (a "[manual]" tag) and irrelevant to this
  // read-only highlight, so linkings now always report matcher = "".
  const query = `
    PREFIX hmkp:  <urn:himiko:ontology:physical:>
    PREFIX hmkia: <urn:himiko:ontology:interpretation:>
    SELECT ?linking ?node ?startOffset ?endOffset
           (SAMPLE(?rangeTextV) AS ?rangeText)
    WHERE {
      <${textUri}> hmkp:hasAnnotation ?linking .
      ?linking hmkp:refersToEntity ?node ;
               hmkp:start ?startOffset ;
               hmkp:end ?endOffset ;
               hmkia:generatedBy ?act .
      OPTIONAL { ?linking hmkp:annotatedText ?rangeTextV . }
      FILTER NOT EXISTS {
        GRAPH <${INTERPRETATION_GRAPH}> {
          ?critique hmkia:critiques ?act ; hmkia:hasType "deletion" .
        }
      }
    }
    GROUP BY ?linking ?node ?startOffset ?endOffset
  `

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 20000)

  try {
    const response = await fetch('/api/sparql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/sparql-results+json',
      },
      body: JSON.stringify({ query, dataset: 'linking' }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    if (!response.ok) {
      // Surface the proxy's error detail (timeout vs unreachable) rather than a
      // bare status — helps diagnose cross-region failures.
      let detail = ''
      try {
        detail = JSON.stringify(await response.json())
      } catch {
        /* body not JSON */
      }
      throw new Error(
        `Linking SPARQL query failed: ${response.status} ${response.statusText} ${detail}`,
      )
    }
    const data = await response.json()
    const rows = data.results?.bindings ?? []

    // De-dupe by linking URI (GROUP BY should already collapse, but be safe).
    const byId = new Map<string, AtagLinking>()
    for (const b of rows) {
      const id = b.linking.value as string
      if (byId.has(id)) continue
      byId.set(id, {
        id,
        nodeUri: b.node.value,
        startOffset: parseInt(b.startOffset.value, 10),
        endOffset: parseInt(b.endOffset.value, 10),
        rangeText: b.rangeText ? b.rangeText.value : '',
        matcher: '',
      })
    }
    return Array.from(byId.values())
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`Timeout querying linkings for EDCS ID ${edcsId}`)
    } else {
      console.error('Error querying linkings from SPARQL endpoint:', error)
    }
    return []
  }
}

/**
 * Query the literature references for an inscription, grouped by the research
 * publication that cites it: which work mentions the inscription, and through
 * what kind of "citation relation" (transcription, translation, dating, ...).
 *
 * The data lives in a separate graph (INSCRIPTION_REF_SPARQL_ENDPOINT), reached
 * through the /api/sparql proxy with dataset="inscription-ref". Inscriptions
 * there are linked to EDCS via owl:sameAs to the EDCS detail URL, so we match
 * by the id embedded in that URL rather than relying on a literal id triple.
 *
 * Schema (ns: = https://example.org/inscription-ref/ns#):
 *   ?doc a bibo:BookSection ; dct:title / dct:creator / bibo:pages /
 *        dct:source / dct:isPartOf ?container
 *   ?container a bibo:Book ; dct:title / bibo:doi
 *   ?insc a ns:Inscription ; owl:sameAs <https://db.edcs.eu/...p_edcs_id=EDCS-ID>
 *   ?mention ns:refersTo ?insc ; dct:isPartOf ?doc ; ns:rawRef "CIL, VIII, 26274" ;
 *            ns:hasRelation ?rel ; ns:locationType "body"|"note" ;
 *            # body mentions: ns:startParagraph / ns:endParagraph
 *            # note mentions: ns:noteNumber
 *   ?rel ns:relationType ns:rel_transcription ; oa:hasBody ?b
 *   ?b rdf:value "..."
 *
 * NOTE on grouping: each mention links to its source document via
 * `?mention dct:isPartOf ?doc` (?doc a bibo:BookSection). We group by that edge,
 * so when the graph holds several documents each one keeps only the excerpts that
 * actually cite the inscription from within it — documents no longer share one
 * another's excerpts.
 */
export async function queryLiteratureReferences(edcsId: string): Promise<LiteratureReference[]> {
  // The graph links inscriptions to EDCS via the public detail URL. The stored
  // value uses s_language=en; match on the id substring to stay robust to
  // parameter ordering / language differences.
  const query = `
    PREFIX ns: <https://example.org/inscription-ref/ns#>
    PREFIX oa: <http://www.w3.org/ns/oa#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    PREFIX dct: <http://purl.org/dc/terms/>
    PREFIX bibo: <http://purl.org/ontology/bibo/>

    SELECT DISTINCT ?doc ?title ?creator ?pages ?source ?doi ?containerTitle
                    ?mention ?rawRef ?locationType ?startParagraph ?endParagraph
                    ?noteNumber ?noteParentParagraph ?relType ?val
    WHERE {
      ?insc a ns:Inscription ;
            owl:sameAs ?edcs .
      FILTER(CONTAINS(STR(?edcs), "${edcsId}"))
      ?mention ns:refersTo ?insc .
      OPTIONAL { ?mention ns:rawRef ?rawRef . }
      # Where the mention occurs — "body" (running text, has paragraph numbers)
      # or "note" (footnote, has a note number).
      OPTIONAL { ?mention ns:locationType ?locationType . }
      OPTIONAL { ?mention ns:startParagraph ?startParagraph . }
      OPTIONAL { ?mention ns:endParagraph ?endParagraph . }
      OPTIONAL { ?mention ns:noteNumber ?noteNumber . }
      # For footnote mentions, resolve the body paragraph that the footnote is
      # attached to: mention → footnote ← paragraph(containsFootnote).
      OPTIONAL {
        ?mention ns:inFootnote ?footnote .
        ?parentPara ns:containsFootnote ?footnote ;
                    ns:paragraphNumber ?noteParentParagraph .
      }
      OPTIONAL {
        ?mention ns:hasRelation ?rel .
        ?rel ns:relationType ?relTypeUri ;
             oa:hasBody ?b .
        ?b rdf:value ?val .
        BIND(REPLACE(STR(?relTypeUri), "^.*#rel_", "") AS ?relType)
      }
      # The citing publication, linked explicitly from the mention via
      # dct:isPartOf, so each mention attaches to its own document.
      OPTIONAL {
        ?mention dct:isPartOf ?doc .
        ?doc a bibo:BookSection .
        OPTIONAL { ?doc dct:title ?title }
        OPTIONAL { ?doc dct:creator ?creator }
        OPTIONAL { ?doc bibo:pages ?pages }
        OPTIONAL { ?doc dct:source ?source }
        OPTIONAL { ?doc bibo:doi ?docDoi }
        OPTIONAL {
          ?doc dct:isPartOf ?container .
          OPTIONAL { ?container dct:title ?containerTitle }
          OPTIONAL { ?container bibo:doi ?containerDoi }
        }
        BIND(COALESCE(?docDoi, ?containerDoi) AS ?doi)
      }
    }
    ORDER BY ?doc ?mention
  `

  console.log('Querying literature references for EDCS ID:', edcsId)

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    const response = await fetch('/api/sparql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/sparql-results+json'
      },
      body: JSON.stringify({ query, dataset: 'inscription-ref' }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Literature reference SPARQL error response:', errorText)
      throw new Error(`SPARQL query failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    // Group rows by document, accumulating de-duplicated excerpts under each.
    // Rows without a ?doc (no bibliographic record in the graph) fall under a
    // synthetic "unknown document" bucket so excerpts are never dropped.
    const UNKNOWN = "__unknown__"
    const byDoc = new Map<string, LiteratureReference>()
    if (data.results?.bindings?.length > 0) {
      for (const b of data.results.bindings) {
        const docUri: string = b.doc?.value || UNKNOWN
        let entry = byDoc.get(docUri)
        if (!entry) {
          entry = {
            uri: docUri,
            title: b.title?.value,
            creator: b.creator?.value,
            containerTitle: b.containerTitle?.value,
            pages: b.pages?.value,
            source: b.source?.value,
            doi: b.doi?.value,
            excerpts: [],
          }
          byDoc.set(docUri, entry)
        }
        const relType = b.relType?.value
        const text = b.val?.value
        const rawRef = b.rawRef?.value
        const lt = b.locationType?.value
        const locationType =
          lt === "body" || lt === "note" ? lt : undefined
        const startParagraph = b.startParagraph?.value
          ? parseInt(b.startParagraph.value, 10)
          : undefined
        const endParagraph = b.endParagraph?.value
          ? parseInt(b.endParagraph.value, 10)
          : undefined
        const noteNumber = b.noteNumber?.value
          ? parseInt(b.noteNumber.value, 10)
          : undefined
        const noteParentParagraph = b.noteParentParagraph?.value
          ? parseInt(b.noteParentParagraph.value, 10)
          : undefined
        // Dedupe on the full identity of the excerpt, including position, so
        // the same text quoted at two places in the work is kept separate.
        if (
          relType &&
          text &&
          !entry.excerpts.some(
            (e) =>
              e.relType === relType &&
              e.text === text &&
              e.rawRef === rawRef &&
              e.startParagraph === startParagraph &&
              e.endParagraph === endParagraph &&
              e.noteNumber === noteNumber,
          )
        ) {
          entry.excerpts.push({
            relType,
            text,
            rawRef,
            locationType,
            startParagraph,
            endParagraph,
            noteNumber,
            noteParentParagraph,
          })
        }
      }
    }

    const refs = Array.from(byDoc.values())
    console.log('Literature reference documents count:', refs.length)
    return refs
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`Timeout querying literature references for EDCS ID ${edcsId}`)
    } else {
      console.error('Error querying literature references from SPARQL endpoint:', error)
    }
    return []
  }
}

/**
 * Query mosaics by Pleiades ID from SPARQL endpoint
 * This function retrieves mosaic IIIF manifests linked to a specific place
 */
export async function queryMosaicsByPlaceId(pleiadesId: string): Promise<MosaicDetail[]> {
  const endpoint = 'https://dydra.com/junjun7613/mosaic_llm/sparql'

  const query = `
    PREFIX epig: <http://example.org/epigraphy/>

    SELECT ?mosaic ?place
    WHERE {
      ?mosaic a epig:Mosaic ;
              epig:pleiadesId "${pleiadesId}" .
      OPTIONAL { ?mosaic epig:place ?place }
    }
  `

  console.log('Querying mosaics for Pleiades ID:', pleiadesId)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/sparql-results+json'
      },
      body: `query=${encodeURIComponent(query)}`
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Mosaic SPARQL error response:', errorText)
      throw new Error(`Mosaic SPARQL query failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    console.log('Mosaic SPARQL response:', data)

    if (data.results && data.results.bindings && data.results.bindings.length > 0) {
      const mosaics: MosaicDetail[] = await Promise.all(
        data.results.bindings.map(async (binding: any) => {
          const manifestUrl = binding.mosaic.value
          let label: string | undefined = undefined
          let thumbnail: string | undefined = undefined

          // Fetch manifest to get label and thumbnail
          try {
            const manifestResponse = await fetch(manifestUrl)
            if (manifestResponse.ok) {
              const manifest = await manifestResponse.json()

              // Extract label from manifest (IIIF Presentation API format)
              if (manifest.label) {
                if (typeof manifest.label === 'string') {
                  label = manifest.label
                } else if (manifest.label.none && Array.isArray(manifest.label.none)) {
                  label = manifest.label.none[0]
                } else if (manifest.label['@value']) {
                  label = manifest.label['@value']
                } else {
                  // Try to get first available language
                  const firstLang = Object.keys(manifest.label)[0]
                  if (firstLang && Array.isArray(manifest.label[firstLang])) {
                    label = manifest.label[firstLang][0]
                  }
                }
              }

              // Extract thumbnail from manifest
              if (manifest.thumbnail) {
                if (Array.isArray(manifest.thumbnail)) {
                  // IIIF Presentation API 3.0 format
                  if (manifest.thumbnail[0].id) {
                    thumbnail = manifest.thumbnail[0].id
                  } else if (manifest.thumbnail[0]['@id']) {
                    thumbnail = manifest.thumbnail[0]['@id']
                  }
                } else if (typeof manifest.thumbnail === 'object') {
                  // Single thumbnail object
                  if (manifest.thumbnail.id) {
                    thumbnail = manifest.thumbnail.id
                  } else if (manifest.thumbnail['@id']) {
                    thumbnail = manifest.thumbnail['@id']
                  }
                } else if (typeof manifest.thumbnail === 'string') {
                  thumbnail = manifest.thumbnail
                }
              }

              // If no thumbnail at manifest level, try to get from first canvas
              if (!thumbnail && manifest.items && Array.isArray(manifest.items) && manifest.items.length > 0) {
                const firstCanvas = manifest.items[0]
                if (firstCanvas.thumbnail) {
                  if (Array.isArray(firstCanvas.thumbnail)) {
                    if (firstCanvas.thumbnail[0].id) {
                      thumbnail = firstCanvas.thumbnail[0].id
                    } else if (firstCanvas.thumbnail[0]['@id']) {
                      thumbnail = firstCanvas.thumbnail[0]['@id']
                    }
                  } else if (typeof firstCanvas.thumbnail === 'object') {
                    if (firstCanvas.thumbnail.id) {
                      thumbnail = firstCanvas.thumbnail.id
                    } else if (firstCanvas.thumbnail['@id']) {
                      thumbnail = firstCanvas.thumbnail['@id']
                    }
                  }
                }
                // If still no thumbnail, try to construct from first image
                if (!thumbnail && firstCanvas.items && Array.isArray(firstCanvas.items)) {
                  const annotationPage = firstCanvas.items[0]
                  if (annotationPage.items && Array.isArray(annotationPage.items)) {
                    const annotation = annotationPage.items[0]
                    if (annotation.body && annotation.body.id) {
                      // Use IIIF Image API to get a thumbnail
                      const imageUrl = annotation.body.id
                      if (imageUrl.includes('/full/')) {
                        thumbnail = imageUrl.replace('/full/', '/full/400,/')
                      }
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.error(`Error fetching manifest ${manifestUrl}:`, error)
          }

          return {
            manifestUrl,
            place: binding.place?.value,
            label,
            thumbnail
          }
        })
      )
      console.log('Mosaic details count:', mosaics.length)
      console.log('Mosaic details:', mosaics)
      return mosaics
    }

    console.log('No mosaics found for Pleiades ID:', pleiadesId)
    return []
  } catch (error) {
    console.error('Error querying mosaics from SPARQL endpoint:', error)
    return []
  }
}

/**
 * Query average age at death for selected places from SPARQL endpoint
 */
export async function queryAverageAgeAtDeath(pleiadesIds: string[]): Promise<AgeAtDeathData | null> {
  const endpoint = 'https://dydra.com/junjun7613/inscriptions_llm/sparql'
  if (pleiadesIds.length === 0) return null

  const valuesClause = pleiadesIds.map(id => `"${id}"`).join(' ')
  const query = `
    PREFIX epig: <http://example.org/epigraphy/>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

    SELECT (AVG(?age) AS ?averageAge) (COUNT(?age) AS ?count) (SUM(IF(?age <= 10, 1, 0)) AS ?under10Count)
    WHERE {
      VALUES ?pleiadesId { ${valuesClause} }
      ?inscription a epig:Inscription ; epig:pleiadesId ?pleiadesId ; epig:mentions ?person .
      ?person a foaf:Person ; epig:ageAtDeath ?age .
      FILTER(DATATYPE(?age) = xsd:integer)
    }
  `

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/sparql-results+json' },
      body: `query=${encodeURIComponent(query)}`
    })
    if (!response.ok) throw new Error(`SPARQL query failed: ${response.status}`)
    
    const data = await response.json()
    if (data.results?.bindings?.[0]) {
      const b = data.results.bindings[0]
      if (b.averageAge && b.count) {
        const count = parseInt(b.count.value, 10)
        const under10Count = b.under10Count ? parseInt(b.under10Count.value, 10) : 0
        return {
          averageAge: parseFloat(b.averageAge.value),
          count,
          under10Count,
          under10Percentage: count > 0 ? (under10Count / count) * 100 : 0
        }
      }
    }
    return null
  } catch (error) {
    console.error('Error querying age at death:', error)
    return null
  }
}

/**
 * Query nomen frequency for selected places
 */
export async function queryNomenFrequency(pleiadesIds: string[]): Promise<NomenFrequency[]> {
  const endpoint = 'https://dydra.com/junjun7613/inscriptions_llm/sparql'
  if (pleiadesIds.length === 0) return []

  const valuesClause = pleiadesIds.map(id => `"${id}"`).join(' ')
  const query = `
    PREFIX epig: <http://example.org/epigraphy/>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    PREFIX status: <http://example.org/status/>

    SELECT ?nomen (COUNT(?nomen) AS ?count)
    WHERE {
      VALUES ?pleiadesId { ${valuesClause} }
      ?inscription a epig:Inscription ; epig:pleiadesId ?pleiadesId ; epig:mentions ?person .
      ?person a foaf:Person ; epig:nomen ?nomen .
      FILTER(BOUND(?nomen))

      # Exclude imperial persons (Emperor, Empress, ImperialFamily) - COMMENTED OUT
      OPTIONAL { ?person epig:socialStatus ?status }
      FILTER(!BOUND(?status) ||
             (?status != status:emperor &&
              ?status != status:empress &&
              ?status != status:imperial-family))
    }
    GROUP BY ?nomen
    ORDER BY DESC(?count)
  `

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/sparql-results+json' },
      body: `query=${encodeURIComponent(query)}`
    })
    if (!response.ok) throw new Error(`SPARQL query failed: ${response.status}`)
    
    const data = await response.json()
    if (data.results?.bindings?.length > 0) {
      return data.results.bindings.map((b: any) => ({
        nomen: b.nomen.value,
        count: parseInt(b.count.value, 10)
      }))
    }
    return []
  } catch (error) {
    console.error('Error querying nomen frequency:', error)
    return []
  }
}

/**
 * Query benefaction type frequency
 */
export async function queryBenefactionTypeFrequency(pleiadesIds: string[]): Promise<BenefactionTypeFrequency[]> {
  const endpoint = 'https://dydra.com/junjun7613/inscriptions_llm/sparql'
  if (pleiadesIds.length === 0) return []

  const valuesClause = pleiadesIds.map(id => `"${id}"`).join(' ')
  const query = `
    PREFIX epig: <http://example.org/epigraphy/>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>

    SELECT ?benefactionType (COUNT(?benefactionType) AS ?count)
    WHERE {
      VALUES ?pleiadesId { ${valuesClause} }
      ?inscription a epig:Inscription ; epig:pleiadesId ?pleiadesId ; epig:mentions ?person .
      ?person a foaf:Person ; epig:hasBenefaction ?benefaction .
      ?benefaction epig:benefactionType ?benefactionType .
      FILTER(BOUND(?benefactionType))
    }
    GROUP BY ?benefactionType
    ORDER BY DESC(?count)
  `

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/sparql-results+json' },
      body: `query=${encodeURIComponent(query)}`
    })
    if (!response.ok) throw new Error(`SPARQL query failed: ${response.status}`)
    
    const data = await response.json()
    if (data.results?.bindings?.length > 0) {
      return data.results.bindings.map((b: any) => ({
        benefactionType: b.benefactionType.value,
        count: parseInt(b.count.value, 10)
      }))
    }
    return []
  } catch (error) {
    console.error('Error querying benefaction type:', error)
    return []
  }
}

/**
 * Query benefaction object type frequency
 */
export async function queryBenefactionObjectTypeFrequency(pleiadesIds: string[], benefactionType: string): Promise<BenefactionObjectTypeFrequency[]> {
  const endpoint = 'https://dydra.com/junjun7613/inscriptions_llm/sparql'
  if (pleiadesIds.length === 0) return []

  const valuesClause = pleiadesIds.map(id => `"${id}"`).join(' ')
  const query = `
    PREFIX epig: <http://example.org/epigraphy/>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>

    SELECT ?objectType (COUNT(?objectType) AS ?count)
    WHERE {
      VALUES ?pleiadesId { ${valuesClause} }
      ?inscription a epig:Inscription ; epig:pleiadesId ?pleiadesId ; epig:mentions ?person .
      ?person a foaf:Person ; epig:hasBenefaction ?benefaction .
      ?benefaction epig:benefactionType "${benefactionType}" ; epig:objectType ?objectType .
      FILTER(BOUND(?objectType))
    }
    GROUP BY ?objectType
    ORDER BY DESC(?count)
  `

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/sparql-results+json' },
      body: `query=${encodeURIComponent(query)}`
    })
    if (!response.ok) throw new Error(`SPARQL query failed: ${response.status}`)
    
    const data = await response.json()
    if (data.results?.bindings?.length > 0) {
      return data.results.bindings.map((b: any) => ({
        objectType: b.objectType.value,
        count: parseInt(b.count.value, 10)
      }))
    }
    return []
  } catch (error) {
    console.error('Error querying object type:', error)
    return []
  }
}

/**
 * Query divinity type frequency for selected places
 */
export async function queryDivinityTypeFrequency(pleiadesIds: string[]): Promise<DivinityTypeFrequency[]> {
  const endpoint = 'https://dydra.com/junjun7613/inscriptions_llm/sparql'
  if (pleiadesIds.length === 0) return []

  const valuesClause = pleiadesIds.map(id => `"${id}"`).join(' ')
  const query = `
    PREFIX epig: <http://example.org/epigraphy/>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    PREFIX divinity: <http://example.org/divinity/>

    SELECT ?divinityType (COUNT(?divinityType) AS ?count)
    WHERE {
      VALUES ?pleiadesId { ${valuesClause} }
      ?inscription a epig:Inscription ;
                   epig:pleiadesId ?pleiadesId ;
                   epig:mentions ?divinity .
      ?divinity a foaf:Person ;
                epig:isDivinity true ;
                epig:divinityType ?divinityType .
      FILTER(BOUND(?divinityType))
    }
    GROUP BY ?divinityType
    ORDER BY DESC(?count)
  `

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/sparql-results+json' },
      body: `query=${encodeURIComponent(query)}`
    })
    if (!response.ok) throw new Error(`SPARQL query failed: ${response.status}`)

    const data = await response.json()
    if (data.results?.bindings?.length > 0) {
      return data.results.bindings.map((b: any) => ({
        divinityType: b.divinityType.value,
        count: parseInt(b.count.value, 10)
      }))
    }
    return []
  } catch (error) {
    console.error('Error querying divinity type frequency:', error)
    return []
  }
}

/**
 * Query benefaction cost statistics by type
 */
export async function queryBenefactionCostStatistics(pleiadesIds: string[]): Promise<BenefactionCostStatistics[]> {
  const endpoint = 'https://dydra.com/junjun7613/inscriptions_llm/sparql'
  if (pleiadesIds.length === 0) return []

  const valuesClause = pleiadesIds.map(id => `"${id}"`).join(' ')

  // First query: Get total count for each benefaction type
  const countQuery = `
    PREFIX epig: <http://example.org/epigraphy/>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>

    SELECT ?benefactionType (COUNT(?benefaction) AS ?count)
    WHERE {
      VALUES ?pleiadesId { ${valuesClause} }
      ?inscription a epig:Inscription ;
                   epig:pleiadesId ?pleiadesId ;
                   epig:mentions ?person .
      ?person a foaf:Person ;
              epig:hasBenefaction ?benefaction .
      ?benefaction epig:benefactionType ?benefactionType .
    }
    GROUP BY ?benefactionType
  `

  // Second query: Get cost statistics only for benefactions with cost data
  const costQuery = `
    PREFIX epig: <http://example.org/epigraphy/>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>

    SELECT ?benefactionType
           (COUNT(?benefaction) AS ?countWithCost)
           (AVG(?cost) AS ?avgCost)
           (SUM(?cost) AS ?totalCost)
           (MIN(?cost) AS ?minCost)
           (MAX(?cost) AS ?maxCost)
    WHERE {
      VALUES ?pleiadesId { ${valuesClause} }
      ?inscription a epig:Inscription ;
                   epig:pleiadesId ?pleiadesId ;
                   epig:mentions ?person .
      ?person a foaf:Person ;
              epig:hasBenefaction ?benefaction .
      ?benefaction epig:benefactionType ?benefactionType ;
                   epig:costNumeric ?cost .
    }
    GROUP BY ?benefactionType
  `

  try {
    // Execute queries sequentially to avoid overwhelming the endpoint
    const countResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/sparql-results+json' },
      body: `query=${encodeURIComponent(countQuery)}`
    })

    if (!countResponse.ok) {
      throw new Error(`SPARQL count query failed: ${countResponse.status}`)
    }

    const countData = await countResponse.json()

    // Small delay between queries
    await new Promise(resolve => setTimeout(resolve, 100))

    const costResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/sparql-results+json' },
      body: `query=${encodeURIComponent(costQuery)}`
    })

    if (!costResponse.ok) {
      throw new Error(`SPARQL cost query failed: ${costResponse.status}`)
    }

    const costData = await costResponse.json()

    // Build a map of benefaction types with their counts
    const countMap = new Map<string, number>()
    if (countData.results?.bindings?.length > 0) {
      countData.results.bindings.forEach((b: any) => {
        countMap.set(b.benefactionType.value, parseInt(b.count.value, 10))
      })
    }

    // Build result array combining both queries
    const costMap = new Map<string, BenefactionCostStatistics>()
    if (costData.results?.bindings?.length > 0) {
      costData.results.bindings.forEach((b: any) => {
        const benefactionType = b.benefactionType.value
        costMap.set(benefactionType, {
          benefactionType,
          count: countMap.get(benefactionType) || 0,
          countWithCost: parseInt(b.countWithCost.value, 10),
          avgCost: b.avgCost?.value ? parseFloat(b.avgCost.value) : null,
          totalCost: b.totalCost?.value ? parseFloat(b.totalCost.value) : null,
          minCost: b.minCost?.value ? parseFloat(b.minCost.value) : null,
          maxCost: b.maxCost?.value ? parseFloat(b.maxCost.value) : null
        })
      })
    }

    // Add benefaction types that have no cost data
    countMap.forEach((count, benefactionType) => {
      if (!costMap.has(benefactionType)) {
        costMap.set(benefactionType, {
          benefactionType,
          count,
          countWithCost: 0,
          avgCost: null,
          totalCost: null,
          minCost: null,
          maxCost: null
        })
      }
    })

    // Convert to array and sort by total cost (descending)
    return Array.from(costMap.values()).sort((a, b) => {
      const aCost = a.totalCost || 0
      const bCost = b.totalCost || 0
      return bCost - aCost
    })
  } catch (error) {
    console.error('Error querying benefaction cost statistics:', error)
    return []
  }
}

/**
 * Query benefaction object type cost statistics for a specific benefaction type
 */
export async function queryBenefactionObjectCostStatistics(pleiadesIds: string[], benefactionType: string): Promise<BenefactionObjectCostStatistics[]> {
  const endpoint = 'https://dydra.com/junjun7613/inscriptions_llm/sparql'
  if (pleiadesIds.length === 0) return []

  const valuesClause = pleiadesIds.map(id => `"${id}"`).join(' ')

  // First query: Get total count for each object type
  const countQuery = `
    PREFIX epig: <http://example.org/epigraphy/>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>

    SELECT ?objectType (COUNT(?benefaction) AS ?count)
    WHERE {
      VALUES ?pleiadesId { ${valuesClause} }
      ?inscription a epig:Inscription ;
                   epig:pleiadesId ?pleiadesId ;
                   epig:mentions ?person .
      ?person a foaf:Person ;
              epig:hasBenefaction ?benefaction .
      ?benefaction epig:benefactionType "${benefactionType}" ;
                   epig:objectType ?objectType .
    }
    GROUP BY ?objectType
  `

  // Second query: Get cost statistics only for benefactions with cost data
  const costQuery = `
    PREFIX epig: <http://example.org/epigraphy/>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>

    SELECT ?objectType
           (COUNT(?benefaction) AS ?countWithCost)
           (AVG(?cost) AS ?avgCost)
           (SUM(?cost) AS ?totalCost)
           (MIN(?cost) AS ?minCost)
           (MAX(?cost) AS ?maxCost)
    WHERE {
      VALUES ?pleiadesId { ${valuesClause} }
      ?inscription a epig:Inscription ;
                   epig:pleiadesId ?pleiadesId ;
                   epig:mentions ?person .
      ?person a foaf:Person ;
              epig:hasBenefaction ?benefaction .
      ?benefaction epig:benefactionType "${benefactionType}" ;
                   epig:objectType ?objectType ;
                   epig:costNumeric ?cost .
    }
    GROUP BY ?objectType
  `

  try {
    // Execute queries sequentially to avoid overwhelming the endpoint
    const countResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/sparql-results+json' },
      body: `query=${encodeURIComponent(countQuery)}`
    })

    if (!countResponse.ok) {
      throw new Error(`SPARQL count query failed: ${countResponse.status}`)
    }

    const countData = await countResponse.json()

    // Small delay between queries
    await new Promise(resolve => setTimeout(resolve, 100))

    const costResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/sparql-results+json' },
      body: `query=${encodeURIComponent(costQuery)}`
    })

    if (!costResponse.ok) {
      throw new Error(`SPARQL cost query failed: ${costResponse.status}`)
    }

    const costData = await costResponse.json()

    // Build a map of object types with their counts
    const countMap = new Map<string, number>()
    if (countData.results?.bindings?.length > 0) {
      countData.results.bindings.forEach((b: any) => {
        countMap.set(b.objectType.value, parseInt(b.count.value, 10))
      })
    }

    // Build result array combining both queries
    const costMap = new Map<string, BenefactionObjectCostStatistics>()
    if (costData.results?.bindings?.length > 0) {
      costData.results.bindings.forEach((b: any) => {
        const objectType = b.objectType.value
        costMap.set(objectType, {
          objectType,
          count: countMap.get(objectType) || 0,
          countWithCost: parseInt(b.countWithCost.value, 10),
          avgCost: b.avgCost?.value ? parseFloat(b.avgCost.value) : null,
          totalCost: b.totalCost?.value ? parseFloat(b.totalCost.value) : null,
          minCost: b.minCost?.value ? parseFloat(b.minCost.value) : null,
          maxCost: b.maxCost?.value ? parseFloat(b.maxCost.value) : null
        })
      })
    }

    // Add object types that have no cost data
    countMap.forEach((count, objectType) => {
      if (!costMap.has(objectType)) {
        costMap.set(objectType, {
          objectType,
          count,
          countWithCost: 0,
          avgCost: null,
          totalCost: null,
          minCost: null,
          maxCost: null
        })
      }
    })

    // Convert to array and sort by total cost (descending)
    return Array.from(costMap.values()).sort((a, b) => {
      const aCost = a.totalCost || 0
      const bCost = b.totalCost || 0
      return bCost - aCost
    })
  } catch (error) {
    console.error('Error querying object cost statistics:', error)
    return []
  }
}

/**
 * Query top benefactions by cost
 */
export async function queryTopBenefactionsByCost(pleiadesIds: string[], limit: number = 10): Promise<TopBenefaction[]> {
  const endpoint = 'https://dydra.com/junjun7613/inscriptions_llm/sparql'
  if (pleiadesIds.length === 0) return []

  const valuesClause = pleiadesIds.map(id => `"${id}"`).join(' ')
  const query = `
    PREFIX epig: <http://example.org/epigraphy/>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    PREFIX dcterms: <http://purl.org/dc/terms/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

    SELECT ?edcsId ?personName ?benefactionType ?objectType ?cost ?costOriginalText ?description
    WHERE {
      VALUES ?pleiadesId { ${valuesClause} }
      ?inscription a epig:Inscription ;
                   epig:pleiadesId ?pleiadesId ;
                   dcterms:identifier ?edcsId ;
                   epig:mentions ?person .
      ?person a foaf:Person ;
              epig:hasBenefaction ?benefaction .
      ?benefaction epig:benefactionType ?benefactionType ;
                   epig:costNumeric ?cost .
      OPTIONAL { ?person foaf:name ?personName }
      OPTIONAL { ?benefaction epig:objectType ?objectType }
      OPTIONAL { ?benefaction epig:costOriginalText ?costOriginalText }
      OPTIONAL { ?benefaction dcterms:description ?description }
      FILTER(BOUND(?cost))
    }
    ORDER BY DESC(?cost)
    LIMIT ${limit}
  `

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/sparql-results+json' },
      body: `query=${encodeURIComponent(query)}`
    })
    if (!response.ok) throw new Error(`SPARQL query failed: ${response.status}`)

    const data = await response.json()
    if (data.results?.bindings?.length > 0) {
      return data.results.bindings.map((b: any) => ({
        edcsId: b.edcsId.value,
        personName: b.personName?.value || 'Unknown',
        benefactionType: b.benefactionType.value,
        objectType: b.objectType?.value || 'Unknown',
        cost: parseFloat(b.cost.value),
        costOriginalText: b.costOriginalText?.value || '',
        description: b.description?.value || ''
      }))
    }
    return []
  } catch (error) {
    console.error('Error querying top benefactions:', error)
    return []
  }
}

/**
 * Query inscriptions by cost range
 */
export async function queryInscriptionsByCostRange(pleiadesIds: string[], minCost?: number, maxCost?: number): Promise<string[]> {
  const endpoint = 'https://dydra.com/junjun7613/inscriptions_llm/sparql'
  if (pleiadesIds.length === 0) return []

  const valuesClause = pleiadesIds.map(id => `"${id}"`).join(' ')

  // Build cost filter based on provided parameters
  let costFilter = ''
  if (minCost !== undefined && maxCost !== undefined) {
    costFilter = `FILTER(?cost >= ${minCost} && ?cost <= ${maxCost})`
  } else if (minCost !== undefined) {
    costFilter = `FILTER(?cost >= ${minCost})`
  } else if (maxCost !== undefined) {
    costFilter = `FILTER(?cost <= ${maxCost})`
  } else {
    // If neither is provided, just filter for existence of cost
    costFilter = 'FILTER(BOUND(?cost))'
  }

  const query = `
    PREFIX epig: <http://example.org/epigraphy/>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    PREFIX dcterms: <http://purl.org/dc/terms/>

    SELECT DISTINCT ?edcsId
    WHERE {
      VALUES ?pleiadesId { ${valuesClause} }
      ?inscription a epig:Inscription ;
                   epig:pleiadesId ?pleiadesId ;
                   dcterms:identifier ?edcsId ;
                   epig:mentions ?person .
      ?person a foaf:Person ;
              epig:hasBenefaction ?benefaction .
      ?benefaction epig:costNumeric ?cost .
      ${costFilter}
    }
    ORDER BY ?edcsId
  `

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/sparql-results+json' },
      body: `query=${encodeURIComponent(query)}`
    })
    if (!response.ok) throw new Error(`SPARQL query failed: ${response.status}`)

    const data = await response.json()
    if (data.results?.bindings?.length > 0) {
      return data.results.bindings.map((b: any) => b.edcsId.value)
    }
    return []
  } catch (error) {
    console.error('Error querying inscriptions by cost range:', error)
    return []
  }
}

/**
 * Query inscriptions by nomen
 */
export async function queryInscriptionsByNomen(pleiadesIds: string[], nomen: string): Promise<string[]> {
  const endpoint = 'https://dydra.com/junjun7613/inscriptions_llm/sparql'
  if (pleiadesIds.length === 0) return []

  const valuesClause = pleiadesIds.map(id => `"${id}"`).join(' ')
  const query = `
    PREFIX epig: <http://example.org/epigraphy/>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>

    SELECT DISTINCT ?edcsId
    WHERE {
      VALUES ?pleiadesId { ${valuesClause} }
      ?inscription a epig:Inscription ; epig:pleiadesId ?pleiadesId ; epig:edcsId ?edcsId ; epig:mentions ?person .
      ?person a foaf:Person ; epig:nomen <${nomen}> .
    }
    ORDER BY ?edcsId
  `

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/sparql-results+json' },
      body: `query=${encodeURIComponent(query)}`
    })
    if (!response.ok) throw new Error(`SPARQL query failed: ${response.status}`)
    
    const data = await response.json()
    if (data.results?.bindings?.length > 0) {
      return data.results.bindings.map((b: any) => b.edcsId.value)
    }
    return []
  } catch (error) {
    console.error('Error querying inscriptions by nomen:', error)
    return []
  }
}

/**
 * Query inscriptions by benefaction type
 */
export async function queryInscriptionsByBenefactionType(pleiadesIds: string[], benefactionType: string): Promise<string[]> {
  const endpoint = 'https://dydra.com/junjun7613/inscriptions_llm/sparql'
  if (pleiadesIds.length === 0) return []

  const valuesClause = pleiadesIds.map(id => `"${id}"`).join(' ')
  const query = `
    PREFIX epig: <http://example.org/epigraphy/>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>

    SELECT DISTINCT ?edcsId
    WHERE {
      VALUES ?pleiadesId { ${valuesClause} }
      ?inscription a epig:Inscription ; epig:pleiadesId ?pleiadesId ; epig:edcsId ?edcsId ; epig:mentions ?person .
      ?person a foaf:Person ; epig:hasBenefaction ?benefaction .
      ?benefaction epig:benefactionType "${benefactionType}" .
    }
    ORDER BY ?edcsId
  `

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/sparql-results+json' },
      body: `query=${encodeURIComponent(query)}`
    })
    if (!response.ok) throw new Error(`SPARQL query failed: ${response.status}`)
    
    const data = await response.json()
    if (data.results?.bindings?.length > 0) {
      return data.results.bindings.map((b: any) => b.edcsId.value)
    }
    return []
  } catch (error) {
    console.error('Error querying inscriptions by benefaction type:', error)
    return []
  }
}

/**
 * Query inscriptions by benefaction object type
 */
export async function queryInscriptionsByBenefactionObjectType(pleiadesIds: string[], benefactionType: string, objectType: string): Promise<string[]> {
  const endpoint = 'https://dydra.com/junjun7613/inscriptions_llm/sparql'
  if (pleiadesIds.length === 0) return []

  const valuesClause = pleiadesIds.map(id => `"${id}"`).join(' ')
  const query = `
    PREFIX epig: <http://example.org/epigraphy/>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>

    SELECT DISTINCT ?edcsId
    WHERE {
      VALUES ?pleiadesId { ${valuesClause} }
      ?inscription a epig:Inscription ; epig:pleiadesId ?pleiadesId ; epig:edcsId ?edcsId ; epig:mentions ?person .
      ?person a foaf:Person ; epig:hasBenefaction ?benefaction .
      ?benefaction epig:benefactionType "${benefactionType}" ; epig:objectType <${objectType}> .
    }
    ORDER BY ?edcsId
  `

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/sparql-results+json' },
      body: `query=${encodeURIComponent(query)}`
    })
    if (!response.ok) throw new Error(`SPARQL query failed: ${response.status}`)
    
    const data = await response.json()
    if (data.results?.bindings?.length > 0) {
      return data.results.bindings.map((b: any) => b.edcsId.value)
    }
    return []
  } catch (error) {
    console.error('Error querying inscriptions by object type:', error)
    return []
  }
}

/**
 * Query inscriptions by divinity type
 */
export async function queryInscriptionsByDivinityType(pleiadesIds: string[], divinityType: string): Promise<string[]> {
  const endpoint = 'https://dydra.com/junjun7613/inscriptions_llm/sparql'
  if (pleiadesIds.length === 0) return []

  const valuesClause = pleiadesIds.map(id => `"${id}"`).join(' ')
  const query = `
    PREFIX epig: <http://example.org/epigraphy/>
    PREFIX dcterms: <http://purl.org/dc/terms/>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    PREFIX divinity: <http://example.org/divinity/>

    SELECT DISTINCT ?edcsId
    WHERE {
      VALUES ?pleiadesId { ${valuesClause} }
      ?inscription a epig:Inscription ;
                   epig:pleiadesId ?pleiadesId ;
                   dcterms:identifier ?edcsId ;
                   epig:mentions ?divinity .
      ?divinity a foaf:Person ;
                epig:isDivinity true ;
                epig:divinityType <${divinityType}> .
    }
    ORDER BY ?edcsId
  `

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/sparql-results+json' },
      body: `query=${encodeURIComponent(query)}`
    })
    if (!response.ok) throw new Error(`SPARQL query failed: ${response.status}`)

    const data = await response.json()
    if (data.results?.bindings?.length > 0) {
      return data.results.bindings.map((b: any) => b.edcsId.value)
    }
    return []
  } catch (error) {
    console.error('Error querying inscriptions by divinity type:', error)
    return []
  }
}
