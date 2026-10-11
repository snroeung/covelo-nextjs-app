/** A ms timestamp as the viewer's local calendar date, YYYY-MM-DD. */
export function localIsoDate(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The later of two YYYY-MM-DD dates; blanks / undefined are ignored. */
export function laterDate(a: string | undefined, b: string | undefined): string | undefined {
  if (!a) return b || undefined;
  if (!b) return a;
  return a > b ? a : b;
}
