import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ACTIVE_PALETTE, getCssVars } from "@/lib/themes";

/*
 * ─── Fonts ───────────────────────────────────────────────────────────────────
 * Inter            → body / UI copy (next/font, self-hosted)
 * Geist Mono       → labels, badges  (Google Fonts CDN)
 * Instrument Serif → display headings (Google Fonts CDN)
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "covelo — Every portal. One search.",
  description:
    "Covelo searches every points program at once — Chase, Amex, Capital One, Bilt — and ranks them by true cents-per-point value.",
  openGraph: {
    title: "covelo — Every portal. One search.",
    description:
      "Covelo searches every points program at once — Chase, Amex, Capital One, Bilt — and ranks them by true cents-per-point value.",
    type: "website",
  },
};

/*
 * ─── Theme injection script (prevents flash on page load) ────────────────────
 * Runs synchronously before first paint; reads localStorage and sets
 * data-theme on <html> so the correct palette is applied immediately.
 */
const themeScript = `
(function(){
  try{
    var t=localStorage.getItem('covelo-theme')||'light';
    document.documentElement.setAttribute('data-theme',t);
  }catch(e){}
})();
`;

/*
 * ─── CSS variables for the active palette ────────────────────────────────────
 * Generated from lib/themes.ts based on ACTIVE_PALETTE.
 *
 * To switch the entire color scheme of the site, change ACTIVE_PALETTE
 * in lib/themes.ts — no other changes needed.
 */
function buildThemeStyles(): string {
  const light = getCssVars(ACTIVE_PALETTE, "light");
  const dark  = getCssVars(ACTIVE_PALETTE, "dark");
  return `
    :root { ${light} }
    [data-theme="dark"] { ${dark} }
    :root { --font-geist-mono: 'Geist Mono'; }
  `;
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Google Fonts: Geist Mono + Instrument Serif */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        {/* Active palette CSS variables (light + dark) */}
        <style dangerouslySetInnerHTML={{ __html: buildThemeStyles() }} />
        {/* Flash-free theme init — must be synchronous, no defer/async */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={inter.variable}>
        {children}
      </body>
    </html>
  );
}
