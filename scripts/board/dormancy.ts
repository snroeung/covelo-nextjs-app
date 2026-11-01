// npm run board:dormancy
// Weekly (GitHub Actions: board-jobs.yml). Marks active topics quiet for 60 days as dormant.

import "dotenv/config";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { checkSupabase } from "../supabase-healthcheck";
import { markDormantTopics } from "@/lib/board/server/dormancy";

const db = getSupabaseAdmin();

checkSupabase(db, "board_posts")
  .then((ok) => { if (!ok) process.exit(1); return markDormantTopics(db); })
  .then((n) => console.log(`Marked ${n} topic${n === 1 ? "" : "s"} dormant.`))
  .catch((err) => { console.error(err); process.exit(1); });
