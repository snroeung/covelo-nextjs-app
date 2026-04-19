import { NextRequest, NextResponse } from 'next/server';

const GMAPS_KEY = process.env.GOOGLE_MAPS_API_KEY;

export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get('ref');
  if (!ref || !GMAPS_KEY) return new NextResponse('Not found', { status: 404 });

  const url = new URL('https://maps.googleapis.com/maps/api/place/photo');
  url.searchParams.set('maxwidth', '800');
  url.searchParams.set('photo_reference', ref);
  url.searchParams.set('key', GMAPS_KEY);

  const res = await fetch(url.toString());
  if (!res.ok && res.status !== 302) return new NextResponse('Not found', { status: 404 });

  const contentType = res.headers.get('Content-Type') ?? 'image/jpeg';
  return new NextResponse(res.body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=604800, immutable',
    },
  });
}
