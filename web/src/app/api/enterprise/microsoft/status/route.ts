import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { microsoftConfigured } from "@/lib/microsoft";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!microsoftConfigured()) {
    return NextResponse.json({ configured: false, connected: false });
  }

  const { data } = await supabaseAdmin
    .from("enterprise_oauth_accounts")
    .select("email, display_name, expires_at")
    .eq("user_id", userId)
    .eq("provider", "microsoft")
    .maybeSingle();

  return NextResponse.json({
    configured: true,
    connected: !!data,
    email: data?.email ?? null,
    display_name: data?.display_name ?? null,
  });
}

export async function DELETE() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await supabaseAdmin
    .from("enterprise_oauth_accounts")
    .delete()
    .eq("user_id", userId)
    .eq("provider", "microsoft");

  return NextResponse.json({ ok: true });
}
