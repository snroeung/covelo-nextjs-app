import "dotenv/config";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

// A plain member (no admin role) for testing member-side board flows, e.g.
// posting an offer so it lands in the admin queue as "offer_review".
// Local only: refuses to run against a non-local Supabase URL. Like the admin
// seed, re-run after every `supabase db reset`.
const email = process.env.PLAYWRIGHT_MEMBER_EMAIL || "member@covelo.local";
const password = process.env.PLAYWRIGHT_MEMBER_PASSWORD || "local-member-password";
const username = "local_member";

function assertLocal() {
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://invalid").hostname;
  if (!["127.0.0.1", "localhost", "host.docker.internal"].includes(host)) {
    throw new Error("Refusing to seed: NEXT_PUBLIC_SUPABASE_URL is not a local Supabase instance.");
  }
}

async function main() {
  assertLocal();
  const supabase = getSupabaseAdmin();

  const { data: list, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;
  let user = list.users.find((u) => u.email === email) ?? null;

  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    user = data.user;
    console.log(`Created local member ${email} (${user.id})`);
  } else {
    console.log(`Found existing local member ${email} (${user.id})`);
  }

  // Explicitly a member: never carry an admin role
  const { error: roleError } = await supabase.auth.admin.updateUserById(user.id, { app_metadata: { role: null } });
  if (roleError) throw roleError;

  // Skip the onboarding redirect so the member can go straight to the board
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ display_name: "Local Member", username, onboarding_completed: true })
    .eq("id", user.id);
  if (profileError) throw profileError;

  console.log(`Ready. Sign in with ${email} (no admin role).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
