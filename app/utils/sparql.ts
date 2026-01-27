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
          edcsUrl: `https://db.edcs.eu/epigr/epi_url.php?s_sprache=en&p_edcs_id=${edcsId}`,
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
 * Query inscription network data (persons, communities, relationships, careers, benefactions) from SPARQL endpoint
 */
export async function queryInscriptionNetwork(edcsId: string): Promise<InscriptionNetworkData[]> {
  const endpoint = 'https://dydra.com/junjun7613/inscriptions_llm/sparql'

  const query = `
    PREFIX base: <http://example.org/inscription/>
    PREFIX epig: <http://example.org/epigraphy/>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    PREFIX dcterms: <http://purl.org/dc/terms/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

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
        ?inscription a epig:Inscription ;
                     dcterms:identifier "${edcsId}" .

        OPTIONAL {
            ?inscription epig:mentions ?person .
            ?person a foaf:Person .
            OPTIONAL { ?person foaf:name ?person_name . }
            OPTIONAL { ?person rdfs:label ?person_label . }
            OPTIONAL { ?person epig:normalizedName ?normalized_name . }
            OPTIONAL { ?person epig:socialStatus ?social_status . }

            OPTIONAL {
                ?person epig:hasCareerPosition ?career_position .
                OPTIONAL { ?career_position epig:position ?position . }
                OPTIONAL { ?career_position epig:positionAbstract ?position_abstract . }
                OPTIONAL { ?career_position epig:positionNormalized ?position_normalized . }
                OPTIONAL { ?career_position epig:positionType ?position_type . }
                OPTIONAL { ?career_position epig:order ?position_order . }
                OPTIONAL { ?career_position dcterms:description ?position_desc . }
            }

            OPTIONAL {
                ?person epig:hasBenefaction ?benefaction .
                OPTIONAL { ?benefaction epig:benefactionType ?benef_type . }
                OPTIONAL { ?benefaction epig:object ?benef_object . }
                OPTIONAL { ?benefaction epig:objectType ?benef_objectType . }
            }
        }

        OPTIONAL {
            ?inscription epig:mentions ?community .
            ?community a epig:Community .
            OPTIONAL { ?community rdfs:label ?community_label . }
        }

        OPTIONAL {
            ?inscription epig:mentions ?relationship .
            ?relationship a epig:Relationship .
            OPTIONAL { ?relationship epig:relationshipType ?rel_type . }
            OPTIONAL { ?relationship epig:relationshipProperty ?rel_property . }
            OPTIONAL { ?relationship epig:source ?rel_source . }
            OPTIONAL { ?relationship epig:target ?rel_target . }
        }
    }
  `

  console.log('Querying inscription network for EDCS ID:', edcsId)

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
    console.error('Error querying inscription network from SPARQL endpoint:', error)
    // Return empty array to avoid breaking the UI
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

    SELECT ?nomen (COUNT(?nomen) AS ?count)
    WHERE {
      VALUES ?pleiadesId { ${valuesClause} }
      ?inscription a epig:Inscription ; epig:pleiadesId ?pleiadesId ; epig:mentions ?person .
      ?person a foaf:Person ; epig:nomen ?nomen .
      FILTER(BOUND(?nomen))
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
