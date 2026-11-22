import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { NextRequest } from 'next/server';
import { server } from './mocks/server';
import { GET } from '@/app/api/place-photo/route';

const MEDIA_URL = 'https://places.googleapis.com/v1/places/:id/photos/:photo/media';
const call = (qs: string) => GET(new NextRequest(`http://localhost/api/place-photo${qs}`));

describe('GET /api/place-photo', () => {
  it('404s when no ref is provided — and never calls Google', async () => {
    let called = false;
    server.use(http.get(MEDIA_URL, () => { called = true; return new HttpResponse(null, { status: 200 }); }));

    const res = await call('');

    expect(res.status).toBe(404);
    expect(called).toBe(false);
  });

  it('streams the image for a valid photo resource ref, with maxWidthPx + key header', async () => {
    let maxWidth: string | null = null;
    let hasKey = false;
    server.use(http.get(MEDIA_URL, ({ request }) => {
      maxWidth = new URL(request.url).searchParams.get('maxWidthPx');
      hasKey = Boolean(request.headers.get('X-Goog-Api-Key'));
      return new HttpResponse(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/png' } });
    }));

    const res = await call('?ref=places/X/photos/Y');

    expect(res.status).toBe(200);
    expect(maxWidth).toBe('800');
    expect(hasKey).toBe(true);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(res.headers.get('Cache-Control')).toContain('max-age=604800');
  });

  it('404s when the media endpoint fails', async () => {
    server.use(http.get(MEDIA_URL, () => new HttpResponse('no', { status: 404 })));

    const res = await call('?ref=places/X/photos/Y');

    expect(res.status).toBe(404);
  });
});
