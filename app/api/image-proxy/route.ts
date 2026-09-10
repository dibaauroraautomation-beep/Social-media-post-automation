// Place this file at: app/api/image-proxy/route.ts
//
// Google Drive webContentLink URLs don't reliably send CORS/image
// headers, so the browser can't <img src> them directly. This route
// fetches the bytes server-side and streams them back. Not an n8n
// call — just a passthrough, so it stays a Next.js route instead of
// living in page.tsx.

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid url parameter' }, { status: 400 });
  }

  // Basic allowlist so this can't be used as an open proxy for arbitrary sites.
  const allowedHosts = ['drive.google.com', 'drive.usercontent.google.com', 'lh3.googleusercontent.com'];
  if (!allowedHosts.includes(target.hostname)) {
    return NextResponse.json({ error: 'Host not allowed' }, { status: 403 });
  }

  try {
    const upstream = await fetch(target.toString());
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: 'Upstream fetch failed' }, { status: 502 });
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Proxy error' }, { status: 500 });
  }
}
