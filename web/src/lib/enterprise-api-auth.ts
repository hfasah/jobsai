import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import type { EnterpriseOrg } from "@/types/enterprise";

// Authenticate a public API request by its Bearer API key.
// Returns the org, or null if invalid.
export async function authApiKey(req: NextRequest): Promise<EnterpriseOrg | null> {
  const header = req.headers.get("authorization") ?? "";
  const key = header.startsWith("Bearer ") ? header.slice(7).trim() : header.trim();
  if (!key || !key.startsWith("jbai_ent_")) return null;

  const { data } = await supabaseAdmin
    .from("enterprise_orgs")
    .select("*")
    .eq("api_key", key)
    .maybeSingle();

  return (data as EnterpriseOrg | null) ?? null;
}

// Simple per-key rate limiter (in-memory): 120 req / minute
const rl = new Map<string, { count: number; reset: number }>();
export function rateLimit(key: string, max = 120): boolean {
  const now = Date.now();
  const e = rl.get(key);
  if (!e || now > e.reset) { rl.set(key, { count: 1, reset: now + 60_000 }); return true; }
  if (e.count >= max) return false;
  e.count++; return true;
}
