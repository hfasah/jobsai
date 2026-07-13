// Webhook idempotency helpers. SERVER-ONLY.
import { supabaseAdmin } from "@/lib/supabase";

// True in a deployed (non-preview) environment. Used to fail webhook signature
// checks closed in production while keeping preview/dev usable without secrets.
export function isProdRuntime(): boolean {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
}

// Record an event id; returns true if it was ALREADY processed (a redelivery),
// false if this is the first time. Namespaced by endpoint so the same svix-id on
// two endpoints doesn't collide. Fails OPEN (returns false) on a DB error so a
// transient failure never silently drops a real event.
export async function alreadyProcessed(endpoint: string, svixId: string | null): Promise<boolean> {
  if (!svixId) return false; // nothing to dedup on — let it through
  const eventId = `${endpoint}:${svixId}`;
  const { error } = await supabaseAdmin
    .from("outreach_webhook_events")
    .insert({ event_id: eventId });
  if (!error) return false; // inserted → first time
  // Unique-violation (23505) → already processed. Any other error → fail open.
  if ((error as { code?: string }).code === "23505") return true;
  console.error("[webhook-dedup] insert failed", error.message);
  return false;
}
