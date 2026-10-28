// npm run board:backfill [-- --dry]
// Creates the covelo board post for live offers switched on for the board that
// have none. --dry lists what it would do and writes nothing. Safe to repeat.

import "dotenv/config";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { backfillSystemPosts } from "@/lib/board/server/backfill";

const dry = process.argv.includes("--dry");

backfillSystemPosts(getSupabaseAdmin(), { dry })
  .then((r) => {
    const verb = dry ? "Would post" : "Posted";
    console.log(`${verb} ${r.posted.length} · skipped ${r.skipped.length} · failed ${r.failed.length}`);
    for (const p of r.posted) console.log(`  + ${p.table} ${p.id}  ${p.title}`);
    for (const s of r.skipped) console.log(`  - ${s.table} ${s.id}  ${s.reason}`);
    for (const f of r.failed) console.error(`  ! ${f.table} ${f.id}  ${f.error}`);
    if (r.failed.length > 0) process.exit(1);
  })
  .catch((err) => { console.error(err); process.exit(1); });
