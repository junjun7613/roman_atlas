export interface PlaceInscriptionCount {
  placeId: string
  count: number
}

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
}

export interface InscriptionDetail {
  edcsId: string
  description: string
  dating: string
  edcsUrl: string
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

    SELECT DISTINCT ?inscription ?text ?comment ?datingFrom ?datingTo
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

        return {
          edcsId: edcsId,
          description: description,
          dating: dating,
          edcsUrl: `https://db.edcs.eu/epigr/epi_url.php?s_sprache=en&p_edcs_id=${edcsId}`
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

    SELECT ?id ?title ?lat ?long ?placeType ?description ?uri ?modernName ?period ?source
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
        source: binding.source.value
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
