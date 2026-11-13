import { registerOTel } from "@vercel/otel";
import { isEnabled } from "@/lib/feature-flags";

// Exports Next.js framework spans and the custom `timed()` spans (lib/timing.ts) to Vercel
// Observability. Outbound fetch spans (Duffel, HotelBeds, Supabase, Upstash) come with it.
export function register() {
  if (!isEnabled("integration:otel")) return;
  // Off Vercel there is no collector: without an explicit endpoint the exporter retries localhost:4318 and floods the log
  if (!process.env.VERCEL && !process.env.OTEL_EXPORTER_OTLP_ENDPOINT) return;
  registerOTel({ serviceName: "covelo" });
}
