import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        Accept: 'multipart/x-mixed-replace, image/jpeg, */*',
      },
    });

    if (!response.ok) {
      return new NextResponse(`Camera responded with HTTP ${response.status}`, {
        status: response.status,
      });
    }

    const contentType = response.headers.get('content-type') || 'multipart/x-mixed-replace; boundary=frame';

    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
    });
  } catch (error: any) {
    return new NextResponse(`Proxy error: ${error.message}`, { status: 502 });
  }
}

