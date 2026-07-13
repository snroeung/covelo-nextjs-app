# Covelo

Covelo (`covelo-nextjs-app`) compares flight and hotel costs — cash and points — across Chase, Capital One, Amex, Bilt, and Citi travel portals in one search.

## Development

### Start the dev server

```bash
npm run dev
```

Server runs at `http://localhost:3000`.

## Calling tRPC routes

The tRPC client (`lib/trpc-client.ts`) is a vanilla `createTRPCClient` — **not** `createTRPCReact` — pointed at `/api/trpc` via `httpBatchLink`. Components call `trpc.<router>.<procedure>.query()` / `.mutate()` directly, wrapped in TanStack Query's own `useQuery`/`useMutation` rather than tRPC's React bindings. The API route (`app/api/trpc/[trpc]/route.ts`) handles both `GET`/`POST` via `fetchRequestHandler`.

### Available routers (`server/routers/_app.ts`)

| Router | Covers |
|---|---|
| `flights` | Duffel flight offer search |
| `stays` | Duffel + HotelBeds hotel search |
| `places` | Google Places autocomplete / geocoding |
| `offers` | Transfer bonuses, spending bonuses, sponsored ads |

### From a React component

Query — `app/offers/page.tsx`:

```tsx
import { useQuery } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc-client';

const { data: transferBonuses = [], isLoading: loadingTransfer } = useQuery({
  queryKey: ['offers.transferBonuses'],
  queryFn: () => trpc.offers.listTransferBonuses.query(),
  staleTime: 15 * 60 * 1000,
});
```

Mutation — `app/hotels/page.tsx`:

```tsx
import { useMutation } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc-client';

const hotelSearch = useMutation({
  mutationFn: (vars: any) => trpc.stays.search.mutate(vars),
});

hotelSearch.mutate({ latitude: paramLat, /* ... */ });
const allAccommodations: any[] = hotelSearch.data ?? [];
```

### From the terminal (curl)

**Flight search** (`flights.searchOffers`):

Local:

```bash
curl -X POST http://localhost:3000/api/trpc/flights.searchOffers \
  -H "Content-Type: application/json" \
  -d '{"origin": "LHR", "destination": "JFK", "departureDate": "2026-06-01", "passengers": 1}'
```

Vercel preview:

```bash
vercel curl /api/trpc/flights.searchOffers --deployment https://points-portal-backend-1sva7fdz1-snroeungs-projects.vercel.app -- --request POST --header "Content-Type: application/json" --data '{"origin":"SYD","destination":"MEL","departureDate":"2026-04-01","passengers":1,"cabinClass":"economy"}'
```

Input fields:

| Field | Type | Required | Description |
|---|---|---|---|
| `origin` | string (IATA) | yes | 3-letter origin airport code |
| `destination` | string (IATA) | yes | 3-letter destination airport code |
| `departureDate` | string (YYYY-MM-DD) | yes | Departure date |
| `passengers` | number (1–9) | yes | Number of adult passengers |
| `cabinClass` | `economy` \| `premium_economy` \| `business` \| `first` | no | Defaults to `economy` |

**Stays search** (`stays.search`):

> **Note:** The Duffel Stays API requires separate product access. Access has been requested and is pending approval. The endpoint exists but will return an error until access is granted.

```bash
curl -X POST http://localhost:3000/api/trpc/stays.search \
  -H "Content-Type: application/json" \
  -d '{"location": "London, UK", "checkInDate": "2026-06-04", "checkOutDate": "2026-06-07", "rooms": 1, "guests": [{"type": "adult"}, {"type": "child", "age": 7}]}'
```

Input fields:

| Field | Type | Required | Description |
|---|---|---|---|
| `location` | string | yes | City, neighborhood, or region (e.g. `"Paris, France"`, `"SoHo, New York"`) |
| `checkInDate` | string (YYYY-MM-DD) | yes | Check-in date |
| `checkOutDate` | string (YYYY-MM-DD) | yes | Check-out date |
| `rooms` | number | no | Number of rooms, defaults to `1` |
| `guests` | array | yes | At least one guest: `{"type": "adult"}` or `{"type": "child", "age": 7}` |
| `freeCancellationOnly` | boolean | no | Filter for free cancellation rates, defaults to `false` |
| `radius` | number | no | Search radius in km, defaults to `5` |

## Known limitations / future work

### Transfer partner award pricing
The "Transfer beats portal" section in the points grid currently shows airline transfer partners with no award cost estimate — users are directed to check each partner program's award chart. This is intentional: award pricing is route-specific, availability-dependent, and changes frequently, so a static estimate would be misleading.

**Future work:** integrate a live award availability data source (e.g. [seats.aero](https://seats.aero)) to show real saver award costs per route, cabin class, and partner program. This would make the transfer comparison genuinely actionable rather than advisory.

See `lib/points/transferPartners.ts` for the TODO marker.

## Testing

### Component / unit tests (Vitest)

```bash
npm test
```

Runs all unit tests in `__tests__/` using Vitest, headless by default. Covers the points engine, tRPC routers (offers, flights), adapters, and feature flags.

### E2E tests (Playwright)

#### Prerequisites

1. Install Playwright browsers (one-time):
   ```bash
   npx playwright install
   ```

2. Add admin credentials to `.env`:
   ```
   PLAYWRIGHT_ADMIN_EMAIL=test_admin@covelo.app
   PLAYWRIGHT_ADMIN_PASSWORD=your-password
   ```

3. The dev server must be running (Playwright starts it automatically via `webServer` in `playwright.config.ts`).

#### Run E2E tests

```bash
# All specs, headless
npm run test:e2e

# Interactive UI mode (recommended for development)
npm run test:e2e:ui

# Step-through debugger (headed)
npm run test:e2e:debug

# Single spec file
npx playwright test e2e/offers/offers-admin.spec.ts
npx playwright test e2e/offers/offers-page.spec.ts
npx playwright test e2e/home/home.spec.ts
```

`test:e2e` and `test:e2e:ui`/`test:e2e:debug` run the exact same specs — the difference is purely how Playwright presents the run (headless CLI output vs. its interactive UI runner vs. a headed step-through debugger), not different test content.

#### E2E test structure

| File | Covers |
|---|---|
| `e2e/global-setup.ts` | Runs before all tests, including `--ui` mode |
| `e2e/auth.setup.ts` | Admin login — runs once, saves session to `e2e/.auth/admin.json` |
| `e2e/offers/offers-admin.spec.ts` | Create/publish/edit/deactivate sponsored ads, spending bonuses, and transfer bonuses |
| `e2e/offers/offers-page.spec.ts` | Offers page display, filtering, modals, accessibility, mobile layout |
| `e2e/home/home.spec.ts` | Home page load and accessibility baseline |

All E2E tests include `axe-core` accessibility assertions — `results.violations` must be empty.

## GitHub Actions / CI pipeline

Three workflows under `.github/workflows/`:

| Workflow | Triggers | Jobs |
|---|---|---|
| `dependency-review.yml` | PRs into `main` or `production` | `dependency-review` — flags vulnerable/license-problem dependencies introduced by the PR |
| `ci-fast.yml` | Every push and PR, any branch | `syntax` (lint + typecheck), `component-tests` (`npm test`) |
| `ci-full.yml` | Push/PR targeting `main` or `production` only | `determine-target`, `security` (npm audit + CodeQL), `code-review` (Claude Code Action, PR-only), `live-dependency-test` (Playwright E2E against real integrations), `dependency-freshness` (fresh `npm install` + build + test) |

`ci-fast.yml` runs everywhere so lint/type/unit-test regressions surface immediately on every commit, even on feature branches. `ci-full.yml` only runs against `main`/`production` since its jobs are heavier (real API calls, static analysis, an AI review pass) and only matter once code is headed toward a shared environment.

**`main` is the QA gate, `production` is the strict production gate:** the `determine-target` job resolves which one a run is targeting (`github.base_ref` for PRs, `github.ref_name` for direct pushes) and exposes it to the other jobs. On `main`, `security`, `live-dependency-test`, and `dependency-freshness` run but are `continue-on-error: true` — failures are visible but don't block. On `production`, none of them have that escape hatch — every job must pass.

## Environments

Branch name drives three independent mappings — Vercel's own deploy target, the app's runtime feature-flag environment, and the GitHub Actions Environment used for CI secrets:

| Branch | Vercel target | `NEXT_PUBLIC_APP_ENV` (`lib/feature-flags.ts`) | GitHub Actions Environment (`ci-full.yml`) |
|---|---|---|---|
| `feature/*` | Preview (dev) | unset → `"local"` | n/a — only `ci-fast.yml` runs |
| `main` | Preview (staging/beta) | `"beta"` | `qa` |
| `production` | Production (prod) | `"production"` | `production` |

- **Vercel target** controls which deployment a push produces and which Vercel-side env vars are injected (isolated Supabase + Upstash Redis instances per environment).
- **`NEXT_PUBLIC_APP_ENV`** is read by `isEnabled()` in `lib/feature-flags.ts` to decide which UI routes / tRPC routers / integrations are actually reachable at runtime — independent of what Vercel deployed.
- **GitHub Actions Environment** (`qa` or `production`) scopes which set of secrets (`DUFFEL_API_KEY`, `SUPABASE_SECRET_KEY`, `UPSTASH_REDIS_REST_TOKEN`, etc.) the `live-dependency-test` job in `ci-full.yml` pulls from — kept separate from Vercel's env vars so a CI run against `main` can never see `production`'s credentials.
