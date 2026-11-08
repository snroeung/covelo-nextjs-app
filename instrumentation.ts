import { registerOTel } from "@vercel/otel";
import { isEnabled } from "@/lib/feature-flags";

// Exports Next.js framework spans and the custom `timed()` spans (lib/timing.ts) to Vercel
// Observability. Outbound fetch spans (Duffel, HotelBeds, Supabase, Upstash) come with it.
export function register() {
  if (!isEnabled("integration:otel")) return;
  registerOTel({ serviceName: "covelo" });
}
