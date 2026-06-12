import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { googleEnterpriseConfigured } from "@/lib/google-calendar-enterprise";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!googleEnterpriseConfigured()) {
    return NextResponse.json({ configured: false, connected: false });
  }

  const { data } = await supabaseAdmin
    .from("enterprise_oauth_accounts")
    .select("email, expires_at")
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();

  return NextResponse.json({ configured: true, connected: !!data, email: data?.email ?? null });
}

export async function DELETE() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await supabaseAdmin
    .from("enterprise_oauth_accounts")
    .delete()
    .eq("user_id", userId)
    .eq("provider", "google");

  return NextResponse.json({ ok: true });
}
