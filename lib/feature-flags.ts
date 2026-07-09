export type AppEnv = "local" | "beta" | "production";

export type FlagName =
  // UI routes
  | "ui:hotels"
  | "ui:flights"
  | "ui:search"
  | "ui:trip-planner"
  | "ui:offers"
  | "ui:settings"
  // tRPC routers
  | "api:stays"
  | "api:flights"
  | "api:places"
  | "api:offers"
  // External integrations — scoped per API surface
  | "integration:duffel:flights"
  | "integration:duffel:stays"
  | "integration:hotelbeds:stays"
  | "integration:google-places:places"
  | "integration:redis:stays"
  | "integration:redis:flights"
  | "integration:redis:places"
  | "integration:redis:offers"
  | "integration:supabase";

interface FlagDef {
  enabledIn: AppEnv[];
  description?: string;
}

// Edit enabledIn arrays to gate features per environment.
// "local"      → dev machines (NEXT_PUBLIC_APP_ENV unset or "local")
// "beta"       → main branch preview deployments
// "production" → covelo.app (production branch)
const FLAGS_CONFIG: Record<FlagName, FlagDef> = {
  "ui:hotels":                 { enabledIn: ["local", "beta",], description: "/hotels page" },
  "ui:flights":                { enabledIn: ["local", "beta", "production"], description: "/flights page" },
  "ui:search":                 { enabledIn: ["local", "beta", "production"], description: "/search hub page" },
  "ui:trip-planner":           { enabledIn: ["local", "beta", "production"], description: "/trip-planner pages" },

  "api:stays":                 { enabledIn: ["local", "beta", "production"], description: "stays tRPC router" },
  "api:flights":               { enabledIn: ["local", "beta", "production"], description: "flights tRPC router" },
  "api:places":                { enabledIn: ["local", "beta", "production"], description: "places tRPC router" },

  "integration:duffel:flights":        { enabledIn: ["local", "beta", "production"], description: "Duffel API — flights router" },
  "integration:duffel:stays":          { enabledIn: ["local", "beta", "production"], description: "Duffel API — stays router" },
  "integration:hotelbeds:stays":       { enabledIn: ["local", "beta", "production"], description: "HotelBeds API — stays router" },
  "integration:google-places:places":  { enabledIn: ["local", "beta", "production"], description: "Google Places API — places router" },
  "integration:redis:stays":           { enabledIn: ["local", "beta", "production"], description: "Redis caching — stays router" },
  "integration:redis:flights":         { enabledIn: ["local", "beta", "production"], description: "Redis caching — flights router" },
  "integration:redis:places":          { enabledIn: ["local", "beta", "production"], description: "Redis caching — places lib" },
  "integration:redis:offers":          { enabledIn: ["local", "beta", "production"], description: "Redis caching — offers router" },
  "integration:supabase":              { enabledIn: ["local", "beta", "production"], description: "Supabase (auth — keep always-on)" },

  "ui:offers":                         { enabledIn: ["local", "beta", "production"], description: "/offers page" },
  "ui:settings":                       { enabledIn: ["local", "beta", "production"], description: "/settings page" },
  "api:offers":                        { enabledIn: ["local", "beta", "production"], description: "offers tRPC router" },
} as const;

// Called lazily inside isEnabled() — never at module load time.
// Works in Edge runtime, Node.js server, and browser (NEXT_PUBLIC_ is inlined at build time).
function getAppEnv(): AppEnv {
  const env = process.env.NEXT_PUBLIC_APP_ENV;
  if (env === "beta" || env === "production") return env;
  return "local";
}

/** Returns true if the flag is enabled in the current environment. */
export function isEnabled(flag: FlagName): boolean {
  return FLAGS_CONFIG[flag]?.enabledIn.includes(getAppEnv()) ?? false;
}

/** Returns all flag names currently enabled. Useful for debugging. */
export function getEnabledFlags(): FlagName[] {
  const env = getAppEnv();
  return (Object.keys(FLAGS_CONFIG) as FlagName[]).filter(
    (flag) => FLAGS_CONFIG[flag].enabledIn.includes(env),
  );
}
