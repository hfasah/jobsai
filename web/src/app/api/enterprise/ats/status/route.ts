import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { mergeConfigured } from "@/lib/merge";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { data } = await supabaseAdmin
    .from("enterprise_ats_connections")
    .select("provider,integration_name,status,last_synced_at,created_at")
    .eq("org_id", org.id)
    .eq("status", "active")
    .maybeSingle();

  // Loxo is a direct (BYO API key) integration, so it's always available even
  // when the Merge one-click isn't configured.
  return NextResponse.json({ configured: mergeConfigured(), loxo: true, connection: data ?? null });
}
