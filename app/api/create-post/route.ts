// Place this file at: app/api/create-post/route.ts
//
// The browser can't call https://n8naurora.duckdns.org directly unless that
// server sends back CORS headers allowing it — n8n's webhook response
// usually doesn't, so the workflow runs fine (you can see the JSON in n8n's
// execution log) but the browser's fetch() throws before your page ever
// sees it. Routing through our own server sidesteps that entirely: server-
// to-server calls are never subject to CORS.
//
// app/page.tsx now calls this same-origin route ('/api/create-post') and
// this route forwards the request to n8n, then hands the JSON straight back.

import { NextRequest, NextResponse } from 'next/server';

// Server-only env var (no NEXT_PUBLIC_ prefix — it never needs to reach the browser).
const N8N_CUSTOM_POST_URL =
  process.env.N8N_CUSTOM_POST_WEBHOOK || 'https://n8naurora.duckdns.org/webhook/create-post';

// Your n8n workflow takes ~1:35–1:45 to respond. On Vercel, serverless
// functions default to a much shorter timeout (10s on Hobby, 60s on Pro) —
// this raises the limit for THIS route specifically so it isn't cut off
// server-side before n8n replies. (Local `next dev` ignores this; it only
// matters once deployed.)
export const maxDuration = 200; // seconds

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const res = await fetch(N8N_CUSTOM_POST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const raw = await res.text();
    let json: unknown = null;
    try {
      json = raw ? JSON.parse(raw) : null;
    } catch {
      json = null;
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: `n8n webhook responded with status ${res.status}` },
        { status: 502 }
      );
    }

    // Pass the n8n response straight through — page.tsx already knows how to
    // read Title / Caption / "Image LInk" / "Post Date" / time from it.
    return NextResponse.json(json ?? {});
  } catch {
    return NextResponse.json({ error: 'Could not reach the n8n webhook.' }, { status: 502 });
  }
}