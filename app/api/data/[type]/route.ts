import { NextRequest, NextResponse } from 'next/server'

// OPTIONSリクエストの処理（Chromeのプリフライトリクエスト対応）
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params

  // 環境変数からURLを取得
  const urlMap: Record<string, string | undefined> = {
    provinces: process.env.NEXT_PUBLIC_PROVINCES_URL,
    routes: process.env.NEXT_PUBLIC_ROUTES_URL,
    places: process.env.NEXT_PUBLIC_PLACES_URL,
    originalPlaces: process.env.NEXT_PUBLIC_ORIGINAL_PLACES_URL,
  }

  const dataUrl = urlMap[type]

  if (!dataUrl) {
    return NextResponse.json(
      { error: `Unknown data type: ${type}` },
      { status: 400 }
    )
  }

  try {
    console.log(`Fetching ${type} data from:`, dataUrl)

    // 外部URLからデータを取得
    const response = await fetch(dataUrl, {
      cache: 'force-cache', // データをキャッシュ
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NextJS/16.0)',
      },
    })

    console.log(`Response status for ${type}:`, response.status, response.statusText)

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`)
    }

    const data = await response.text()
    let contentType = 'application/json; charset=utf-8'
    if (type === 'routes') {
      contentType = 'text/plain; charset=utf-8'
    } else if (type === 'originalPlaces') {
      contentType = 'text/csv; charset=utf-8'
    }

    console.log(`Successfully fetched ${type} data, size:`, data.length)

    // CORSヘッダーを設定して返す（Chromeに対応）
    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // 24時間キャッシュ
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error(`Error fetching ${type} data:`, error)
    return NextResponse.json(
      { error: `Failed to fetch ${type} data`, details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
