# Portal Data Sync

Scrapes transfer-partner, hotel-collection, and bonus data straight from the
portal sites (Chase, Amex, Capital One, Bilt, Citi), extracts structured
records via Claude, and lands candidates in a pending-review queue for a
human to approve before they go live.

## Pipeline

```
sources.ts   → per-portal { url, recordType, needsBrowser } config
fetch.ts     → fetchStatic() or fetchRendered() (Playwright), gated by robots.ts
extract.ts   → LLM extraction of structured records from the fetched page text
upsert.ts    → dedupes against status='approved' rows, writes new candidates
               as status='pending' into transfer_partners / hotel_collections /
               transfer_bonuses / spending_bonuses
audit.ts     → recordSyncRun() writes one row per source into portal_sync_runs
cache.ts     → invalidateCacheFor() busts the Redis entry for that portal
```

Entry point: `run.ts`, iterates `SOURCES` from `sources.ts`. Set
`SOURCE_KEY_FILTER` (env var) to re-run a single source by key.

## Where results land

- **Pending candidates** — `/admin` → "Pending review" tab
  (`portalData.admin.listAll` / `.approve` / `.reject`). Approving flips
  `status` to `approved` and sets `active: true`.
- **Run history** — same tab, `SyncRunsLog` component
  (`portalData.admin.listSyncRuns`) — one row per source per run, with
  status (`ok` / `partial` / `error`), records found/written, and any error
  message.

## Schedule

Weekly, Monday 09:00 UTC — `.github/workflows/portal-data-sync.yml`.

## Running manually

**Local:**
```bash
npm run portal-sync        # full pipeline
npm run portal-sync:eval   # extraction eval only, no writes
```
Requires `SUPABASE_SECRET_KEY`, `UPSTASH_REDIS_REST_URL`,
`UPSTASH_REDIS_REST_TOKEN`, `ANTHROPIC_API_KEY` in `.env.local`.

**GitHub Actions:** Actions tab → "Portal Data Sync" → "Run workflow".
Leave `source_key` as `all`, or set it to one source key from `sources.ts`
(e.g. after fixing an extraction prompt for that source only).

## Verifying a run

1. Check the run's `portal-sync-log-<run_id>` artifact on the Actions run
   page for console output / stack traces.
2. Check the "Pending review" tab for new candidates.
3. Check `SyncRunsLog` for that source's status — `partial` means
   robots.txt disallowed the path or the fetch failed; `error` means
   extraction or upsert threw.
