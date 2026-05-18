# Covelo — Design System & Codebase Guide

## Design System

### Typography
- **Font family**: Geist Sans (`var(--font-geist-sans)`) — loaded via `next/font/google` in `app/layout.tsx`
- **Mono font**: Geist Mono — used for tabular numbers (points, prices)
- **Scale**: standard Tailwind `text-*` scale; display headings use `text-xl`–`text-2xl font-bold`
- **Labels**: `text-[10px] font-semibold uppercase tracking-widest` — used for field labels throughout

### Color Tokens (`app/globals.css`)

#### Brand Navy — dark surfaces, badges, bottom bars
| Token | Hex | Usage |
|---|---|---|
| `cv-navy-900` | `#0D1B2A` | Hotel card bottom bar, BEST VALUE badge, active card bg |
| `cv-navy-800` | `#1B2D42` | Secondary dark surfaces |
| `cv-navy-50` | `#EEF6FB` | Very light navy tint |

#### Lime — value indicators, primary CTAs
| Token | Hex | Usage |
|---|---|---|
| `cv-lime-500` | `#84CC16` | Points text in bottom bar, Compare portals button, ABOVE FACE label |
| `cv-lime-400` | `#A3E635` | Hover state for lime CTA |
| `cv-lime-700` | `#4D7C0F` | Dark lime for text on light bg |

#### Green — ratings, savings confirmation
| Token | Hex | Usage |
|---|---|---|
| `cv-green-500` | `#22C55E` | Review score label ("Excellent", "Very Good") |
| `cv-green-700` | `#3F8F4E` | PointsGrid "Great" tier badge |
| `cv-green-800` | `#2D7A3A` | PointsGrid "Excellent" tier badge |

#### Blue (legacy dark mode palette)
| Token | Hex | Usage |
|---|---|---|
| `cv-blue-950` | `#0D1B2A` | Dark mode page background |
| `cv-blue-900` | `#1B3A5C` | Dark mode surface (cards, sidebar) |
| `cv-blue-600` | `#1F6FBF` | Dark mode CTA button, active nav |
| `cv-blue-400` | `#4A9ED6` | Dark mode muted text, icons |
| `cv-blue-300` | `#85BFE8` | Dark mode primary text |

#### Amber — transfer hacks
| Token | Hex | Usage |
|---|---|---|
| `cv-amber-400` | `#F5A623` | Transfer dot indicator, amber text |
| `cv-amber-900` | `#6B3500` | Dark amber bg for transfer section |

### Light Mode (default)
- **Page background**: `bg-gray-100` (`#F3F4F6`)
- **Surface (cards, sidebar, nav)**: `bg-white`
- **Border**: `border-gray-200`
- **Text primary**: `text-gray-900`
- **Text muted**: `text-gray-500` / `text-gray-400`
- **Search button**: `bg-gray-900 text-white`
- **Active nav link**: `bg-gray-900 text-white`

### Dark Mode
- **Page background**: `bg-cv-blue-950`
- **Surface**: `bg-cv-navy-900`
- **Border**: `border-cv-blue-800`
- **Text primary**: `text-white`
- **Text muted**: `text-cv-blue-400`
- **CTA button**: `bg-cv-blue-600 text-white`
- **Active nav link**: `bg-white text-gray-900`

---

## Layout

### Desktop
```
┌─────────────────────────────────────────────────────────────────┐
│ covelo.  [Flights] [Hotels]                      [☀/☾] [NR]    │  ← nav
├──────────────────────────┬──────────────────────────────────────┤
│  Your Cards              │  [Location] [In] [Out] [Rooms] [→]  │  ← search strip
│  ─────────               ├──────────────────────────────────────┤
│  CHASE                   │  42 hotels in Philadelphia  Filter Sort│
│  [Sapphire Reserve    ]  │                                      │
│  [Sapphire Preferred ✓]  │  ┌────────────────────────────────┐  │
│  [Freedom Unlimited   ]  │  │ [img] Hotel Name      FROM·CASH│  │
│                          │  │       ★★★★ Excellent   $1,302 │  │
│  AMERICAN EXPRESS        │  │       Wi-Fi 24h Desk  $434/nt │  │
│  ...                     │  │ BEST PORTAL│REDEEM│ [Compare→]│  │
│                          │  └────────────────────────────────┘  │
│  BALANCE                 │                                      │
│  487,320                 │                                      │
│  ■ Chase UR  120,800     │                                      │
└──────────────────────────┴──────────────────────────────────────┘
```

### Mobile
- Nav: logo + links + theme toggle + avatar
- Collapsible "Your Cards" dropdown
- Collapsible search form (auto-collapses when results load)
- Hotel cards: full-width image on top, compact bottom bar

---

## Components

### `AppShell` (`components/AppShell.tsx`)
Main layout shell used by all pages. Props:
- `header` — search form content (rendered as desktop strip / mobile accordion)
- `children` — results content
- `hasResults` — auto-collapses mobile search header when true

### `CardSelector` (`components/CardSelector.tsx`)
Sidebar card selector with:
- Cards grouped by issuer (Chase, Amex, Capital One, Bilt, Citi)
- Full-width row buttons with ✓ for selected cards
- "Edit →" opens inline balance editor per currency pool
- Balance summary (total points + ~dollar value at 1.25¢/pt estimate)

### `HotelCard` (`components/HotelCard.tsx`)
- Desktop: image left (w-44) + info + price | Mobile: image top
- "★ Best Value" badge overlay when cpp > 1.0
- Favorite (heart) button — UI only, no persistence
- Dark navy bottom bar: Best Portal | Redeem (points·cpp) | Value tier | Compare button
- "Compare N portals →" toggles `PointsGrid` inline

### `PointsGrid` (`components/PointsGrid.tsx`)
Renders portal groups and transfer alternatives. Called from `HotelCard` and `FlightCard`.

---

## Data Flow

- **Points calc**: `hooks/usePointsCalc.ts` → `lib/points/calcPoints.ts`
- **Card selection**: `contexts/SelectedCardsContext.tsx` — also stores per-portal point balances
- **Theme**: `contexts/ThemeContext.tsx` — persisted to localStorage as `covelo_theme`, defaults to light
- **Hotel search**: `app/hotels/page.tsx` → tRPC `stays.search` → Duffel API (cached 1h in Redis)
- **Places autocomplete**: `components/LocationSearch.tsx` → tRPC `places.autocomplete` + `places.getLatLng`

---

## Conventions

- Tailwind v4 — no `tailwind.config.js`; theme tokens defined via `@theme inline` in `globals.css`
- All custom tokens use `cv-` prefix
- Dark/light theming via `isDark` boolean from `useTheme()` — no CSS `dark:` variant
- `any` types used intentionally for Duffel API responses (untyped SDK shapes)
- Max content width: `max-w-3xl` for hotel results
