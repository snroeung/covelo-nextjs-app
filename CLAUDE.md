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
# CLAUDE.md — Covelo Developer Instructions

You are a senior full-stack developer building **Covelo** (covelo.app), a consumer travel planning app that compares flight and hotel costs across Chase, Capital One, Amex, Bilt, and Citi travel portals in real time. The core value: one search, all five portals, points costs included.

---

## 🧠 Planning First

For any non-trivial task (new feature, refactor, bug with unclear root cause), **plan before coding**:

1. Write out your understanding of the problem
2. List the files/modules affected
3. Identify edge cases and testing requirements
4. **If the task involves any API call, answer these caching questions before writing code:**
   - **Should this be cached?** — Is the response deterministic for a given input? Is it expensive (latency, cost, or rate-limited)? If yes to either, cache it.
   - **What is the right TTL?** — Pricing/availability: 15 min. Static metadata (hotel names, amenities, airline info): 24 hrs. User-specific data (balances, preferences): do not cache at the shared layer.
   - **What is the cache key?** — Must uniquely identify the query. Use a hash of the normalized input parameters (destination lat/lng, check-in, check-out, guests, source). Never include user identity in a shared cache key.
   - **What exactly gets cached?** — Cache the normalized, adapted response (post-adapter), not the raw API payload. Downstream consumers must be decoupled from source-specific response shapes.
   - **What should NOT be cached?** — Anything user-specific, real-time state (booking confirmations, live award availability), or anything containing PII.
5. Only then begin implementation

For simple, well-scoped tasks (typo fix, single-line change, adding a constant), skip straight to implementation.

---

## 🚩 Feature Flags & Cache Config

### Feature flags (non-negotiable)

Every new UI route and tRPC endpoint **must** be registered in `lib/feature-flags.ts` before it ships.

**New UI route checklist:**
1. Add a `"ui:<route>"` entry to `FLAGS_CONFIG` in `lib/feature-flags.ts` with `enabledIn` set appropriately
2. Add the route prefix to the `ROUTE_FLAGS` array in `proxy.ts`
3. Default all envs to enabled (`["local", "beta", "production"]`) unless intentionally gating the feature

**New tRPC endpoint checklist:**
1. Add an `"api:<router>"` entry to `FLAGS_CONFIG`
2. Use `flaggedProcedure("api:<router>")` instead of `publicProcedure` in the router file
3. If the endpoint calls an external API, also add an `"integration:<service>"` entry and check it inside the resolver before calling the API

**Naming conventions:**
- `"ui:<kebab-route>"` — page routes (`ui:hotels`, `ui:trip-planner`)
- `"api:<router-name>"` — tRPC routers (`api:stays`, `api:flights`)
- `"integration:<service>"` — external API calls (`integration:duffel`, `integration:redis`)

**Environment mapping** (`NEXT_PUBLIC_APP_ENV`):
- `feature/*` branches → unset (defaults to `"local"`)
- `main` branch → `"beta"` (set as branch-scoped Preview var in Vercel)
- `production` branch → `"production"` (set in Vercel Production env)

### Cache config (non-negotiable)

Every Redis cache entry **must** have its key template and TTL defined in `lib/cache-config.ts` before writing any `redis.get`/`redis.set` call.

**Adding a new cached entry:**
1. Add a key builder to `cacheKeys` in `lib/cache-config.ts`
2. Add a TTL entry to `CACHE` using a named constant from `TTL`
3. Use `cacheKeys.<entry>(params)` and `CACHE.<entry>.ttl` at every call site — never raw strings or magic numbers

**`integration:redis` flag:**
Every Redis call must short-circuit when `isEnabled("integration:redis")` is false. Use the `cacheGet`/`cacheSet` helpers in `server/routers/stays.ts` as the reference pattern for routers, and the inline `if (isEnabled("integration:redis"))` guard pattern in `lib/places.ts` for lib functions.

---

## 🔧 Terminal & Shell

The shell is **zsh**. Source `.zshrc` before running commands when in doubt:

```bash
source ~/.zshrc
```

Avoid relying on aliases that may not be loaded. Prefer explicit paths over short commands when a command fails unexpectedly. If `ls` or other basics behave unexpectedly, prepend `source ~/.zshrc &&` to your command.

Prefer:
```bash
ls -la ./src/components
```
over bare `ls` when diagnosing path issues.

---

## 📁 Project Structure Conventions

- `src/app/` — Next.js App Router pages and layouts
- `src/components/` — Shared UI components
- `src/lib/` — Business logic (points engine, adapters, utils)
- `src/lib/points/` — `calcPoints.ts`, `transferPartners.ts`
- `src/types/` — Canonical TypeScript types (`inventory.ts`, etc.)
- `src/server/` — tRPC routers and server-only logic
- `supabaseAdmin.ts` — **Server-only. Never import from `/app` or `/components`.**

---

## 🔐 Security Rules (Non-Negotiable)

- `SUPABASE_SERVICE_ROLE_KEY` must **never** be committed or used client-side
- `supabaseAdmin.ts` is server-only — enforce at the import level
- `.env.local` must be in `.gitignore` before the first commit
- All Supabase tables must have RLS enabled
- **Never read `.env` files** (`.env`, `.env.local`, `.env.production`, `.env.*`). Do not open, cat, or inspect them under any circumstance. Reference variable names only from documentation or existing code that already uses them.

---

## ✅ Commit Guidelines

Commits are **manual** — Claude will remind you when a logical commit point is reached.

### When to commit
Claude will prompt: `💾 Good commit point —` followed by a suggested message when:
- A feature or sub-feature is working end-to-end
- A test suite passes for a new module
- A refactor is complete and types check clean
- A bug is fixed and verified
- A new component is complete and visually verified

**Before prompting to commit, always verify `npm run build` passes.** Vercel runs `npm run build` on every push to deploy the app — if the build is broken, the deployment fails and the branch is dead in production. Run `export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH" && node_modules/.bin/next build` and confirm there are no errors before suggesting a commit. Common failure modes: missing npm dependencies (not in `package.json`), `useSearchParams()` without a `<Suspense>` wrapper, TypeScript errors, and unresolved imports. Fix any build errors before committing.

### Commit size
Keep commits **small and focused**. One logical change per commit. Avoid bundling unrelated changes.

### Commit message format
```
type(scope): short description

Optional: one-line body if context is non-obvious
```

**Types:** `feat`, `fix`, `refactor`, `test`, `chore`, `style`, `docs`

**Examples:**
```
feat(points): add calcEffectiveTransferCost() for bonus ratios
fix(auth): handle null avatar_url from Google OAuth
test(hotels): add Vitest unit tests for Duffel adapter normalization
chore(deps): upgrade @duffel/api to latest
```

---

## 🧪 Testing Requirements

Prompt user if ready to create tests after every conversation

### Unit / Integration (Vitest + MSW)
- All `src/lib/` modules require Vitest unit tests
- Points engine (`calcPoints.ts`, `transferPartners.ts`) requires 10+ test cases covering edge cases (Amex hotel/flight split, deduplication, transfer partner math)
- API adapters (Duffel, EPS Rapid, etc.) must be tested with MSW mocks — no live API calls in tests
- Run before committing: `npm run test`

### Component Testing (Storybook + Chromatic)
- Every new UI component needs a Storybook story
- Story must cover: default state, loading state, empty/error state, and any interactive variants
- Visual regression is enforced via Chromatic — review snapshots before merging
- Run locally: `npm run storybook`

### E2E (Playwright)
- Critical user flows require Playwright tests: search → results → portal CTA click
- axe-core accessibility assertions must pass in every E2E test (`results.violations` must be empty)
- Run: `npm run test:e2e`

### CI Gates (block merge if failing)
- TypeScript: `tsc --noEmit` with `strict: true`
- Vitest unit tests
- Lighthouse performance ≥ 85, accessibility ≥ 90
- axe-core: zero violations
- Bundle size: main JS < 200KB gzipped

---

## 🏗️ Architecture Principles

- **Adapter pattern** for all inventory sources — new sources plug in without touching upstream code
- **Points pricing is in-house only** — no external API provides loyalty redemption costs; maintain `calcPoints.ts`
- **Deep links are search-level only** — never hardcode session UUIDs (e.g. Capital One's Hopper-generated `expandedFlight` IDs); they are not portable
- **Cache at the query level** — Duffel bundles photos into search responses; a 15-min TTL Redis cache keyed by query hash covers both pricing and images
- **`supabaseAdmin` is server-only** — enforce at architecture level, not just convention

---

## 🌐 Environment Setup

Three environments, each with isolated Supabase + Upstash Redis instances:

| Branch | Environment | Vercel Target |
|--------|-------------|---------------|
| `feature/*` | dev | Preview |
| `main` | staging | Preview (main) |
| `production` | prod | Production |

Env vars are branch-scoped in Vercel. Never share service keys across environments.

---

## 🎨 Brand & Design Tokens

- **Fonts:** DM Sans (UI), DM Mono (points figures), DM Serif Display italic (wordmark)
- **Colors:**
  - Blue `#1F6FBF` — navigation / primary actions
  - Green `#2D7A3A` — savings / best value
  - Amber `#F5A623` / `#B35C00` — transfer hacks / bonuses
- Use Tailwind core utility classes only (no custom config classes in artifacts)

### 🌗 Light & Dark Mode Visibility (Non-Negotiable)

Every UI element must be legible in **both** light and dark mode. Always pair a `text-*` class with a `dark:text-*` counterpart, and verify background/foreground contrast in both themes before considering a component done.

**Hard rules:**
- Never use `text-white` without ensuring the background is dark in light mode (`bg-gray-800`, `bg-blue-600`, etc.)
- Never use `text-gray-900` or `text-black` on dark backgrounds without a `dark:text-white` or `dark:text-gray-100` override
- Never use low-contrast color combinations — minimum WCAG AA contrast ratio (4.5:1 for body text, 3:1 for large text)
- Icon-only buttons must have visible contrast in both modes; don't rely solely on opacity

**Common failure patterns to avoid:**
```tsx
// ❌ White text on light background
<p className="text-white">Total savings</p>

// ✅ Correct
<p className="text-gray-900 dark:text-white">Total savings</p>

// ❌ Dark text invisible in dark mode
<span className="text-gray-800">Points needed</span>

// ✅ Correct
<span className="text-gray-800 dark:text-gray-100">Points needed</span>
```

**Storybook stories must include a dark mode variant** for every component. Chromatic will diff both — treat dark mode contrast failures as blocking bugs, not cosmetic issues.

### 📱 Mobile & Web Usability (Non-Negotiable)

Covelo is a consumer app — assume users are on their phone while at the airport or planning a trip on their laptop. Every feature must be fully usable on both. "Works on desktop" is not done.

**Planning requirement:** For any UI feature, explicitly decide before coding:
- What is the mobile interaction pattern? (bottom sheet, swipe, tap target size)
- What is the desktop interaction pattern? (hover state, sidebar panel, keyboard nav)
- Are they meaningfully different enough to warrant separate layouts, or can responsive Tailwind classes handle it?

**Hard rules:**
- All tap targets must be at least **44×44px** (Apple HIG / WCAG minimum) — use `min-h-11 min-w-11` in Tailwind
- No hover-only interactions — anything triggered by `hover:` must have an equivalent tap/focus interaction on mobile
- Filters, drawers, and detail panels use **bottom sheets on mobile**, **side panels or modals on desktop**
- Date pickers and input fields must use mobile-native inputs where appropriate (`type="date"`, `inputMode="numeric"`) to avoid forcing users through desktop-style calendar widgets on small screens
- Horizontal scroll is acceptable for card rows (portal comparison, search result tabs) — use `overflow-x-auto` with `-webkit-overflow-scrolling: touch` and visible scroll affordance
- No fixed-width layouts — all containers must be fluid with max-width caps for desktop

**Responsive layout conventions:**
```tsx
// Mobile-first, expand for desktop
<div className="flex flex-col gap-4 md:flex-row md:gap-6">

// Bottom sheet on mobile, sidebar on desktop
<aside className="fixed bottom-0 inset-x-0 md:static md:w-80">

// Full-width on mobile, constrained on desktop
<main className="w-full max-w-5xl mx-auto px-4 md:px-8">
```

**Storybook stories must include a mobile viewport variant** (375px wide) alongside desktop. Lighthouse CI runs against both mobile and desktop profiles — both must meet the performance and accessibility thresholds.

---

## 📦 Key Dependencies

```
@duffel/api          — flights + hotels (Duffel Stays)
@supabase/supabase-js + @supabase/ssr
@upstash/redis
@trpc/server + @trpc/client
@tanstack/react-query
zod
```

---

## 🚫 What Claude Should Not Do

- Import `supabaseAdmin` from any client-side file
- Hardcode portal session UUIDs or booking-specific identifiers in deep links
- Rename Posthog event names after they've been defined (the event taxonomy is the schema)
- Add heavy dependencies without checking bundle size impact
- Skip tests to "come back later"
- Make large, multi-concern commits
- **Read any `.env` file** — not `.env`, `.env.local`, `.env.production`, or any variant
- **Write UI with single-mode contrast** — every text/background color pair must be verified in both light and dark mode
- **Build desktop-only UI** — every feature must be planned and tested for mobile interaction patterns before it is considered done
