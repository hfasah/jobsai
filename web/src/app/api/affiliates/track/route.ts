import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Public: record a click on an affiliate link. ?ref=CODE
export async function POST(req: NextRequest) {
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
