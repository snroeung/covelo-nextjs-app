// npm run board:purge-expired [-- --dry] [-- --days N]
// Daily (GitHub Actions: board-jobs.yml). Removes offer posts whose offer ended
// more than N days ago (default 7). --dry lists them and changes nothing.

import "dotenv/config";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { EXPIRED_POST_GRACE_DAYS, purgeExpiredOfferPosts } from "@/lib/board/server/purgeExpired";

const dry = process.argv.includes("--dry");
const i = process.argv.indexOf("--days");
const graceDays = i >= 0 ? Number(process.argv[i + 1]) : EXPIRED_POST_GRACE_DAYS;
if (!Number.isInteger(graceDays) || graceDays < 0) {
  console.error("--days must be a whole number of days (0 or more).");
  process.exit(1);
}

purgeExpiredOfferPosts(getSupabaseAdmin(), { dry, graceDays })
  .then((r) => {
    console.log(`${dry ? "Would remove" : "Removed"} ${r.posts.length} expired offer post${r.posts.length === 1 ? "" : "s"} (offer ended over ${graceDays} days ago).`);
    for (const p of r.posts) console.log(`  - ${p.id}  ended ${p.offerExpiredOn}  ${p.title}`);
    if (r.truncated) console.log("  More are due than one run takes; the next run continues.");
  })
  .catch((err) => { console.error(err); process.exit(1); });
