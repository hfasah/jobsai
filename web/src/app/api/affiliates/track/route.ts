import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { createRateLimiter, getClientIp, tooManyRequests } from "@/lib/rate-limit";

// 30 clicks/min per IP — generous for real referral traffic, blocks click fraud.
const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

// Public: record a click on an affiliate link. ?ref=CODE
export async function POST(req: NextRequest) {
  const rl = limiter(getClientIp(req));
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);
  const url = new URL(req.url);
  const code = url.searchParams.get("ref");
  if (!code) return NextResponse.json({ ok: false });

  const { data: aff } = await supabaseAdmin.from("affiliates").select("id, clicks").eq("code", code).maybeSingle();
  if (!aff) return NextResponse.json({ ok: false });

  await Promise.all([
    supabaseAdmin.from("affiliates").update({ clicks: (aff.clicks ?? 0) + 1 }).eq("id", aff.id),
    supabaseAdmin.from("affiliate_referrals").insert({ affiliate_id: aff.id, ref_code: code, event: "click" }),
  ]);

  return NextResponse.json({ ok: true });
}
