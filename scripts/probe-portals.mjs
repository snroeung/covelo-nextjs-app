/**
 * scripts/probe-portals.mjs
 *
 * HTTP reachability probe for all five credit card travel portals and their
 * registered airline / hotel transfer-partner booking sites.
 *
 * Used by .github/workflows/portal-monitoring.yml (daily schedule).
 * Also runnable locally:  node scripts/probe-portals.mjs
 *
 * Exit codes:
 *   0 — all targets responded with a non-5xx status (including bot-protection 403/429)
 *   1 — one or more targets returned 5xx or a connection error
 *
 * Design notes:
 *  • HEAD requests — no body download, minimal load on target servers.
 *  • Bot-protection 4xx (403, 429) are treated as UP: the server is responding,
 *    just blocking automated requests.
 *  • Only 5xx responses or network errors are treated as failures.
 *  • 10-second timeout per request; all requests run concurrently.
 *  • Requires Node ≥ 18 (native global fetch).
 */

// ---------------------------------------------------------------------------
// Target list — mirrors the portals and partners in lib/deepLink.ts
// ---------------------------------------------------------------------------

const TARGETS = [
  // ── Credit card travel portals ───────────────────────────────────────────
  { name: 'Chase Travel',          url: 'https://travel.chase.com',           category: 'portal' },
  { name: 'Amex Travel',           url: 'https://www.amextravel.com',          category: 'portal' },
  { name: 'Capital One Travel',    url: 'https://travel.capitalone.com',       category: 'portal' },
  { name: 'Citi Travel',           url: 'https://search.travel.citi.com',      category: 'portal' },
  { name: 'Bilt Travel',           url: 'https://bilt.com/rewards/travel',     category: 'portal' },

  // ── Airline transfer partners ────────────────────────────────────────────
  { name: 'United MileagePlus',    url: 'https://www.united.com',              category: 'airline' },
  { name: 'Delta SkyMiles',        url: 'https://www.delta.com',               category: 'airline' },
  { name: 'American AAdvantage',   url: 'https://www.aa.com',                  category: 'airline' },
  { name: 'Southwest Rapid Rwds',  url: 'https://www.southwest.com',           category: 'airline' },
  { name: 'JetBlue TrueBlue',      url: 'https://www.jetblue.com',             category: 'airline' },
  { name: 'British Airways Avios', url: 'https://www.britishairways.com',      category: 'airline' },
  { name: 'Air France Flying Blue',url: 'https://wwws.airfrance.us',           category: 'airline' },
  { name: 'KLM Flying Blue',       url: 'https://www.klm.com',                 category: 'airline' },
  { name: 'Singapore KrisFlyer',   url: 'https://www.singaporeair.com',        category: 'airline' },
  { name: 'Virgin Atlantic',       url: 'https://www.virginatlantic.com',      category: 'airline' },
  { name: 'Air Canada Aeroplan',   url: 'https://www.aircanada.com',           category: 'airline' },
  { name: 'Alaska Mileage Plan',   url: 'https://www.alaskaair.com',           category: 'airline' },
  { name: 'Emirates Skywards',     url: 'https://www.emirates.com',            category: 'airline' },
  { name: 'Etihad Guest',          url: 'https://www.etihad.com',              category: 'airline' },
  { name: 'ANA Mileage Club',      url: 'https://www.ana.co.jp',               category: 'airline' },
  { name: 'Avianca LifeMiles',     url: 'https://www.avianca.com',             category: 'airline' },
  { name: 'Turkish Miles&Smiles',  url: 'https://www.turkishairlines.com',     category: 'airline' },
  { name: 'Cathay Asia Miles',     url: 'https://www.cathaypacific.com',       category: 'airline' },
  { name: 'Qantas Freq. Flyer',    url: 'https://www.qantas.com',              category: 'airline' },
  { name: 'Hawaiian Miles',        url: 'https://www.hawaiianairlines.com',    category: 'airline' },
  { name: 'Iberia Plus',           url: 'https://www.iberia.com',              category: 'airline' },
  { name: 'Aer Lingus AerClub',    url: 'https://www.aerlingus.com',           category: 'airline' },
  { name: 'TAP Miles&Go',          url: 'https://www.flytap.com',              category: 'airline' },
  { name: 'EVA Air',               url: 'https://www.evaair.com',              category: 'airline' },

  // ── Hotel transfer partners ──────────────────────────────────────────────
  { name: 'World of Hyatt',        url: 'https://www.hyatt.com',               category: 'hotel' },
  { name: 'Marriott Bonvoy',       url: 'https://www.marriott.com',            category: 'hotel' },
  { name: 'Hilton Honors',         url: 'https://www.hilton.com',              category: 'hotel' },
  { name: 'IHG One Rewards',       url: 'https://www.ihg.com',                 category: 'hotel' },
  { name: 'Wyndham Rewards',       url: 'https://www.wyndhamhotels.com',       category: 'hotel' },
  { name: 'Choice Privileges',     url: 'https://www.choicehotels.com',        category: 'hotel' },
];

// ---------------------------------------------------------------------------
// Probe
// ---------------------------------------------------------------------------

const VERBOSE = process.env.VERBOSE === 'true';

async function probe(name, url) {
  try {
    const res = await fetch(url, {
      method:   'HEAD',
      headers:  { 'User-Agent': 'Mozilla/5.0 (compatible; CoveloPortalMonitor/1.0; +https://github.com)' },
      redirect: 'follow',
      signal:   AbortSignal.timeout(10_000),
    });
    // 5xx = server error → failure; everything else (including 4xx bot-blocks) = OK
    const ok = res.status < 500;
    return { name, url, status: res.status, ok };
  } catch (err) {
    return { name, url, status: 'ERROR', ok: false, detail: err.message };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const timestamp = new Date().toISOString();
  console.log(`\nCovelo Portal Monitor — ${timestamp}`);
  console.log(`Probing ${TARGETS.length} targets…\n`);

  const results = await Promise.all(TARGETS.map(({ name, url }) => probe(name, url)));

  const categories = ['portal', 'airline', 'hotel'];
  const failures = [];

  for (const category of categories) {
    const group = results.filter((r) => TARGETS.find((t) => t.url === r.url)?.category === category);
    if (group.length === 0) continue;

    const label = category === 'portal' ? 'Credit Card Portals'
                : category === 'airline' ? 'Airline Partners'
                : 'Hotel Partners';
    console.log(`── ${label} ${'─'.repeat(40 - label.length)}`);

    for (const r of group) {
      const icon   = r.ok ? '✅' : '❌';
      const status = r.status === 'ERROR'
        ? `CONNECTION ERROR — ${r.detail}`
        : `HTTP ${r.status}`;

      if (VERBOSE || !r.ok) {
        console.log(`${icon}  ${r.name.padEnd(26)} ${status}`);
      } else {
        console.log(`${icon}  ${r.name}`);
      }
      if (!r.ok) failures.push(r);
    }
    console.log();
  }

  const passed = results.length - failures.length;
  console.log(`─────────────────────────────────────────────────`);
  console.log(`Result: ${passed}/${results.length} reachable`);

  if (failures.length > 0) {
    console.log(`\n❌ Unreachable (${failures.length}):`);
    for (const f of failures) {
      const status = f.status === 'ERROR' ? f.detail : `HTTP ${f.status}`;
      console.log(`   • ${f.name}: ${status}`);
      console.log(`     ${f.url}`);
    }
    console.log(`
Action required: update lib/deepLink.ts if a portal has moved,
then run:  npm test -- --testPathPattern=deepLink --updateSnapshot
`);
    process.exit(1);
  }

  console.log('\n✅ All portals reachable\n');
}

main();
