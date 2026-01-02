import { queryAllRelationshipTypes } from '../app/utils/sparql'
import fs from 'fs'
import path from 'path'

async function updateFilteringData() {
  console.log('Fetching relationship types from SPARQL endpoint...')

  try {
    const relationshipTypes = await queryAllRelationshipTypes()
    console.log(`Found ${relationshipTypes.length} relationship types`)

    // Read existing FilteringData.json
    const filteringDataPath = path.join(process.cwd(), 'public', 'FilteringData.json')
    const existingData = JSON.parse(fs.readFileSync(filteringDataPath, 'utf-8'))

    // Update with relationship types
    existingData.RelationshipType = relationshipTypes

    // Write back to file
    fs.writeFileSync(filteringDataPath, JSON.stringify(existingData, null, 2))

    console.log('FilteringData.json updated successfully!')
    console.log('Relationship types:', relationshipTypes)
  } catch (error) {
    console.error('Error updating FilteringData.json:', error)
    process.exit(1)
  }
}

updateFilteringData()
