import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

function slugifyCode(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 16) || "aff";
}
function rand(n = 4) { return Math.random().toString(36).slice(2, 2 + n); }

// GET — the signed-in user's affiliate account + stats
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: aff } = await supabaseAdmin
    .from("affiliates").select("*").eq("owner_user_id", userId).maybeSingle();
  if (!aff) return NextResponse.json({ data: null });

  const { data: refs } = await supabaseAdmin
    .from("affiliate_referrals").select("event, plan, created_at").eq("affiliate_id", aff.id)
    .order("created_at", { ascending: false }).limit(50);

  return NextResponse.json({ data: { affiliate: aff, recent: refs ?? [] } });
}

// POST — become an affiliate (creates a code)
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in to join the affiliate program." }, { status: 401 });

  const existing = await supabaseAdmin.from("affiliates").select("*").eq("owner_user_id", userId).maybeSingle();
  if (existing.data) return NextResponse.json({ data: existing.data });

  const body = await req.json().catch(() => ({}));
  const name = (body.name as string | undefined)?.trim();
  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });

  // unique code
  let code = slugifyCode(name);
  for (let i = 0; i < 5; i++) {
    const { count } = await supabaseAdmin.from("affiliates").select("id", { count: "exact", head: true }).eq("code", code);
    if (!count) break;
    code = `${slugifyCode(name)}${rand(3)}`;
  }

  const { data, error } = await supabaseAdmin.from("affiliates")
    .insert({ code, name, email: body.email ?? null, owner_user_id: userId })
    .select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
