# Lint Report — PR #11 (`feature/init-portal-markup`)

Source: `CI - Fast Checks` → `Syntax (lint + typecheck)` job, `npm run lint` step.
Run: [29531829530](https://github.com/snroeung/covelo-nextjs-app/actions/runs/29531829530/job/87733712949) — commit `39c212aa`.

**Result:** ✖ 59 problems (**28 errors**, 31 warnings) — errors fail the build; warnings do not.

---

## Errors (28) — must fix

### `@typescript-eslint/no-explicit-any` (27)

| File | Lines |
|---|---|
| `__tests__/flights.test.ts` | 61, 62, 133, 148, 159, 174, 175, 176, 180, 195, 209, 223, 238, 252, 262, 268 |
| `__tests__/places.test.ts` | 52, 53, 107, 117 |
| `__tests__/rankOptions.test.ts` | 100 |
| `__tests__/searchBoard.test.ts` | 11, 142 |
| `app/search/page.tsx` | 116, 121 |
| `components/search/SearchBoard.tsx` | 65, 92 |

Fix: replace `any` with a concrete type or the narrowest applicable type (e.g. `unknown` + narrowing, or the actual Duffel/response shape). Test-file `any` casts on mock payloads can usually be typed against the real response interfaces instead.

### `react-hooks/purity` (1)

| File | Line | Issue |
|---|---|---|
| `components/PointsGrid.tsx` | 641 | `Date.now()` called directly during render — impure, produces unstable results on re-render |

```
639 |   // Date-window guard: admin sessions bypass the public RLS end_date filter,
640 |   // so re-check here to only badge bonuses currently live on the offers page.
641 |   const now = Date.now();
    |               ^^^^^^^^^^ Cannot call impure function
```

Fix: move the `Date.now()` read into a `useMemo`/`useEffect`, or compute it outside the render path (e.g. in an event handler or a memoized value keyed off a dependency that changes when the check should re-run).

---

## Warnings (31) — non-blocking, cleanup recommended

### `react-hooks/exhaustive-deps` (7)

| File | Line(s) |
|---|---|
| `app/flights/page.tsx` | 431 (flags hooks at 441, 455, 461, 483) |
| `app/hotels/page.tsx` | 288 (flags hooks at 305, 327) |
| `components/AddToTripButton.tsx` | 47 — missing `itemId` dependency |
| `components/GeoMap.tsx` | 271 — `pinElsRef.current` may change before cleanup runs |

### `@typescript-eslint/no-unused-expressions` (6)

| File | Lines |
|---|---|
| `app/flights/page.tsx` | 551, 558 |
| `app/hotels/page.tsx` | 468 |
| `app/trip-planner/[id]/page.tsx` | 198, 200, 218 |

### `@next/next/no-img-element` (11)

| File | Lines |
|---|---|
| `app/hotels/page.tsx` | 353, 370 |
| `app/trip-planner/[id]/page.tsx` | 360, 377, 717, 930 |
| `app/trip-planner/page.tsx` | 266 |
| `components/HotelCard.tsx` | 65 |
| `components/HotelDetailModal.tsx` | 275, 479, 553 |
| `components/search/SearchBoard.tsx` | 159 |

### `@typescript-eslint/no-unused-vars` (5)

| File | Lines | Symbol |
|---|---|---|
| `components/GeoMap.tsx` | 96 | `markerVariant` |
| `components/HotelCard.tsx` | 19, 49 | `forceExpand`, `dividerCls` |
| `components/PointsGrid.tsx` | 620, 621 | `itemName`, `itemMeta` |

---

## Recommended fix order

1. **`components/PointsGrid.tsx:641`** — only `error`-severity item outside `no-explicit-any`; also the only one affecting non-test source shipped to users. Fix first.
2. **`no-explicit-any` in `app/search/page.tsx` and `components/search/SearchBoard.tsx`** (4 occurrences) — production code, straightforward type fixes.
3. **`no-explicit-any` in `__tests__/*`** (23 occurrences) — mechanical, can be batched.
4. Warnings can be deferred to a follow-up PR since they don't block CI, but `no-img-element` (11 instances) is worth a dedicated pass given it's the largest warning bucket.
