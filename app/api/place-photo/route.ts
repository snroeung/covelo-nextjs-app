import { NextRequest, NextResponse } from 'next/server';

const GMAPS_KEY = process.env.GOOGLE_MAPS_API_KEY;
const PLACE_PHOTO_REF_RE = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/;

export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get('ref');
  if (!ref || !GMAPS_KEY || !PLACE_PHOTO_REF_RE.test(ref)) {
    return new NextResponse('Not found', { status: 404 });
  }

  // `ref` is a Places API (New) photo resource name: places/XXX/photos/YYY.
  // The /media endpoint 302s to the actual image; fetch follows it by default.
  const [placesLiteral, placeId, photosLiteral, photoId] = ref.split('/');
  const normalizedRef = `${placesLiteral}/${encodeURIComponent(placeId)}/${photosLiteral}/${encodeURIComponent(photoId)}`;
  const url = new URL(`https://places.googleapis.com/v1/${normalizedRef}/media`);
  url.searchParams.set('maxWidthPx', '800');

  const res = await fetch(url.toString(), {
    headers: { 'X-Goog-Api-Key': GMAPS_KEY },
  });
  if (!res.ok && res.status !== 302) return new NextResponse('Not found', { status: 404 });

  const contentType = res.headers.get('Content-Type') ?? 'image/jpeg';
  return new NextResponse(res.body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=604800, immutable',
    },
  });
}
