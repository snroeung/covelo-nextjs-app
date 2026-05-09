/**
 * Color scheme configuration for covelo landing page (Design B — High-Contrast Modern).
 *
 * ── How to switch the palette ────────────────────────────────────────────────
 * Change ACTIVE_PALETTE below.  That is the only code change needed to retheme
 * the entire site — all sections read from this single export at runtime.
 *
 *   "graphite" — charcoal neutrals + acid lime (default)
 *   "azure"    — navy + azure / sky-blue
 *   "forest"   — deep green + chartreuse
 *   "ember"    — burnt orange + amber
 *   "iris"     — violet + magenta
 *   "cherry"   — crimson + coral
 */
export const ACTIVE_PALETTE = "graphite" as const;

export type PaletteName = "graphite" | "azure" | "forest" | "ember" | "iris" | "cherry";

// ── Neutral tokens — identical across all palettes; only light/dark flips ────
// These are the page bg, card surfaces, text, and border colours.
const NEUTRALS = {
  light: {
    bg:       "#f5f5f4",
    card:     "#ffffff",
    ink:      "#0c0c0d",
    muted:    "#5f6066",
    line:     "#e3e3e1",
    lineSoft: "#ededeb",
  },
  dark: {
    bg:       "#0a0a0b",
    card:     "#161618",
    ink:      "#f3f3f1",
    muted:    "#8a8a90",
    line:     "#262629",
    lineSoft: "#1c1c1f",
  },
} as const;

// ── Palette-specific tokens ───────────────────────────────────────────────────
// sky  = standout accent (punctuation, badges, CTA button) — SAME in light & dark
// blue = primary interactive colour (nav active, card selected borders)
// navy = darkest background used in the final CTA section
const PALETTE_COLORS = {
  graphite: {
    blue: "#18181b",  blueHi: "#27272a",  blueSoft: "#e9e9e7",  sky: "#84cc16",  navy: "#0a0a0a",
    dBlue: "#e4e4e1", dBlueHi: "#f3f3f0", dBlueSoft: "#222226", dNavy: "#000000",
  },
  azure: {
    blue: "#1d4ed8",  blueHi: "#2563eb",  blueSoft: "#e8eefc",  sky: "#0ea5e9",  navy: "#0b1d3e",
    dBlue: "#6ea4ff", dBlueHi: "#7eb1ff", dBlueSoft: "#15244a", dNavy: "#050b18",
  },
  forest: {
    blue: "#0e6b3a",  blueHi: "#0f7d44",  blueSoft: "#e2f0e8",  sky: "#a3e635",  navy: "#0a2418",
    dBlue: "#5fc28a", dBlueHi: "#74d49d", dBlueSoft: "#162a1f", dNavy: "#04100a",
  },
  ember: {
    blue: "#b9460c",  blueHi: "#cf5111",  blueSoft: "#fbe9d8",  sky: "#f59e0b",  navy: "#3a1908",
    dBlue: "#f08b4a", dBlueHi: "#f59f6a", dBlueSoft: "#3a1f10", dNavy: "#0e0603",
  },
  iris: {
    blue: "#5b21b6",  blueHi: "#6d28d9",  blueSoft: "#ede4fb",  sky: "#ec4899",  navy: "#1f0e3a",
    dBlue: "#a78bfa", dBlueHi: "#b89dfb", dBlueSoft: "#221540", dNavy: "#06030f",
  },
  cherry: {
    blue: "#b91c1c",  blueHi: "#dc2626",  blueSoft: "#fbe2e0",  sky: "#fb7185",  navy: "#3f1112",
    dBlue: "#f87171", dBlueHi: "#fb8c8c", dBlueSoft: "#3a1817", dNavy: "#0c0303",
  },
} as const;

// Utility colours — constant regardless of palette or mode
const UTIL = {
  good: "#0f9d58",
  gold: "#f59e0b",
  sans: "Inter, system-ui, sans-serif",
  mono: "Geist Mono, ui-monospace, monospace",
} as const;

export interface Tokens {
  bg: string; card: string; ink: string; muted: string; line: string; lineSoft: string;
  blue: string; blueHi: string; blueSoft: string; sky: string; navy: string;
  good: string; gold: string; sans: string; mono: string;
}

/**
 * Returns the full colour-token object for use with inline styles.
 * Matches the `hcLt(dark)` pattern from the original design files.
 */
export function getTokens(palette: PaletteName, dark: boolean): Tokens {
  const n = dark ? NEUTRALS.dark : NEUTRALS.light;
  const p = PALETTE_COLORS[palette];
  return {
    ...n,
    blue:     dark ? p.dBlue     : p.blue,
    blueHi:   dark ? p.dBlueHi   : p.blueHi,
    blueSoft: dark ? p.dBlueSoft : p.blueSoft,
    sky:      p.sky,   // intentionally SAME in both light and dark
    navy:     dark ? p.dNavy     : p.navy,
    ...UTIL,
  };
}

/**
 * Returns CSS custom-property declarations injected into the document <head>.
 * These power the ThemeToggle component and any Tailwind colour utilities.
 */
export function getCssVars(palette: PaletteName, mode: "light" | "dark"): string {
  const dark = mode === "dark";
  const n    = dark ? NEUTRALS.dark : NEUTRALS.light;
  const p    = PALETTE_COLORS[palette];
  const sky  = p.sky;
  // High-luminance accents (lime, chartreuse, amber) need black foreground text
  const skyFg = ["#84cc16","#a3e635","#f59e0b"].includes(sky) ? "#000000" : "#ffffff";
  return `
    --bg:           ${n.bg};
    --surface:      ${n.card};
    --text-primary: ${n.ink};
    --text-muted:   ${n.muted};
    --border:       ${n.line};
    --accent:       ${sky};
    --accent-fg:    ${skyFg};
    --accent-subtle:${dark ? p.dBlueSoft : p.blueSoft};
  `;
}
