// Copy a board link to the clipboard. Returns whether it worked.
export async function copyLink(path: string): Promise<boolean> {
  const url = `${window.location.origin}${path}`;
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    // Clipboard is blocked outside secure contexts / without permission
    try {
      const el = document.createElement('textarea');
      el.value = url;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
}

export const postPath = (id: string) => `/discover/board/${id}`;
