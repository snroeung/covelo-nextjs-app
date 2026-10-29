// Remember the feed's filters (?type=offer&sort=new) so "The board" on a post
// takes you back to the same view, not to the unfiltered default.

const KEY = 'covelo:board:feed-search';

export function saveFeedSearch(search: string): void {
  try { sessionStorage.setItem(KEY, search); } catch { /* storage blocked — fall back to the default view */ }
}

export function readFeedSearch(): string {
  try {
    const v = sessionStorage.getItem(KEY) ?? '';
    return v.startsWith('?') ? v : '';
  } catch {
    return '';
  }
}
