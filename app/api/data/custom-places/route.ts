import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    const customPlaceDir = path.join(process.cwd(), 'public', 'custom_place')

    // Check if directory exists
    if (!fs.existsSync(customPlaceDir)) {
      return NextResponse.json({ error: 'Custom place directory not found' }, { status: 404 })
    }

    // Read all CSV files in the directory
    const files = fs.readdirSync(customPlaceDir).filter(file => file.endsWith('.csv'))

    if (files.length === 0) {
      return NextResponse.json({ error: 'No CSV files found' }, { status: 404 })
    }

    // Combine all CSV files
    let combinedContent = ''
    let isFirstFile = true

    for (const file of files) {
      const filePath = path.join(customPlaceDir, file)
      const content = fs.readFileSync(filePath, 'utf-8')
      const lines = content.split('\n')

      if (isFirstFile) {
        // Include header from first file
        combinedContent += content
        isFirstFile = false
      } else {
        // Skip header for subsequent files
        combinedContent += '\n' + lines.slice(1).join('\n')
      }
    }

    return new NextResponse(combinedContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error) {
    console.error('Error reading custom place files:', error)
    return NextResponse.json({ error: 'Failed to read custom place files' }, { status: 500 })
  }
}
