// Initials + tone for a member avatar, derived from the display name (no
// avatar image is stored for board authors).

export type AvatarTone = "blue" | "warm" | "green" | "iris";

const TONES: readonly AvatarTone[] = ["blue", "warm", "green", "iris"];

export function initials(name: string): string {
  const words = name.trim().split(/[\s._-]+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = (w: string) => Array.from(w)[0] ?? "";
  if (words.length === 1) return Array.from(words[0]).slice(0, 2).join("").toUpperCase();
  return (first(words[0]) + first(words[1])).toUpperCase();
}

/** Stable per name, so a member keeps one colour everywhere. */
export function toneFor(name: string): AvatarTone {
  let h = 0;
  for (const ch of name.toLowerCase()) h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
  return TONES[h % TONES.length];
}
