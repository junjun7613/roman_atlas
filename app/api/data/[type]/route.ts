import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { type: string } }
) {
  const { type } = params

  // 環境変数からURLを取得
  const urlMap: Record<string, string | undefined> = {
    provinces: process.env.NEXT_PUBLIC_PROVINCES_URL,
    routes: process.env.NEXT_PUBLIC_ROUTES_URL,
    places: process.env.NEXT_PUBLIC_PLACES_URL,
  }

  const dataUrl = urlMap[type]

  if (!dataUrl) {
    return NextResponse.json(
      { error: `Unknown data type: ${type}` },
      { status: 400 }
    )
  }

  try {
    // 外部URLからデータを取得
    const response = await fetch(dataUrl, {
      cache: 'force-cache', // データをキャッシュ
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`)
    }

    const data = await response.text()
    const contentType = type === 'routes' ? 'text/plain' : 'application/json'

    // CORSヘッダーを設定して返す
    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // 24時間キャッシュ
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    console.error(`Error fetching ${type} data:`, error)
    return NextResponse.json(
      { error: `Failed to fetch ${type} data` },
      { status: 500 }
    )
  }
}
