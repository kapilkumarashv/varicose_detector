import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ ok: false, error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeoutId);

    return NextResponse.json({
      ok: true,
      status: res.status,
      contentType: res.headers.get('content-type'),
    });
  } catch (err: any) {
    const isTimeout = err.name === 'AbortError' || err.message?.includes('timeout');
    return NextResponse.json({
      ok: false,
      error: isTimeout
        ? 'Connection timed out. Target IP is unreachable from this PC.'
        : err.message,
    });
  }
}

