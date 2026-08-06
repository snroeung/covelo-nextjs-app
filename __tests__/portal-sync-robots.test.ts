import { vi, beforeEach, describe, it, expect } from 'vitest';
import { isAllowed, clearRobotsCache } from '../scripts/portal-sync/robots';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

beforeEach(() => {
  vi.clearAllMocks();
  clearRobotsCache();
});

function textResponse(body: string, ok = true) {
  return { ok, text: () => Promise.resolve(body) };
}

describe('isAllowed', () => {
  it('allows a path with no matching disallow rule', async () => {
    fetchMock.mockResolvedValue(textResponse('User-agent: *\nDisallow: /admin'));
    expect(await isAllowed('https://example.com/hotels', 'CoveloBot')).toBe(true);
  });

  it('disallows a path matching a wildcard group rule', async () => {
    fetchMock.mockResolvedValue(textResponse('User-agent: *\nDisallow: /admin'));
    expect(await isAllowed('https://example.com/admin/panel', 'CoveloBot')).toBe(false);
  });

  it('fails closed (disallow everything) when the fetch throws', async () => {
    fetchMock.mockRejectedValue(new Error('network error'));
    expect(await isAllowed('https://example.com/hotels', 'CoveloBot')).toBe(false);
  });

  it('fails open when robots.txt returns a non-ok response', async () => {
    fetchMock.mockResolvedValue(textResponse('', false));
    expect(await isAllowed('https://example.com/hotels', 'CoveloBot')).toBe(true);
  });

  it('prefers a specific user-agent group over the wildcard group', async () => {
    fetchMock.mockResolvedValue(
      textResponse('User-agent: CoveloBot\nDisallow: /admin\nUser-agent: *\nDisallow: /'),
    );
    expect(await isAllowed('https://example.com/hotels', 'CoveloBot')).toBe(true);
    expect(await isAllowed('https://example.com/admin', 'CoveloBot')).toBe(false);
  });

  it('allow rule overrides a broader disallow rule', async () => {
    fetchMock.mockResolvedValue(
      textResponse('User-agent: *\nDisallow: /private\nAllow: /private/public-page'),
    );
    expect(await isAllowed('https://example.com/private/public-page', 'CoveloBot')).toBe(true);
    expect(await isAllowed('https://example.com/private/secret', 'CoveloBot')).toBe(false);
  });

  it('caches robots.txt per origin — only fetches once for repeated calls', async () => {
    fetchMock.mockResolvedValue(textResponse('User-agent: *\nDisallow: /admin'));
    await isAllowed('https://example.com/a', 'CoveloBot');
    await isAllowed('https://example.com/b', 'CoveloBot');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('clearRobotsCache forces a re-fetch on the next call', async () => {
    fetchMock.mockResolvedValue(textResponse('User-agent: *\nDisallow: /admin'));
    await isAllowed('https://example.com/a', 'CoveloBot');
    clearRobotsCache();
    await isAllowed('https://example.com/a', 'CoveloBot');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
