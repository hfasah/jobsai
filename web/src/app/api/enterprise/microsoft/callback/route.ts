import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { exchangeMicrosoftCode, getMicrosoftProfile } from "@/lib/microsoft";

export async function GET(req: NextRequest) {
  const dest = new URL("/enterprise/settings?tab=integrations", req.url);
  const code = req.nextUrl.searchParams.get("code");
  const userId = req.nextUrl.searchParams.get("state"); // we passed userId as state

  if (!code || !userId) {
    dest.searchParams.set("error", "microsoft_auth_failed");
    return NextResponse.redirect(dest);
  }

  try {
    const t = await exchangeMicrosoftCode(code);
    const profile = await getMicrosoftProfile(t.access_token);
    const expires_at = new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString();

    const row: Record<string, unknown> = {
      user_id: userId,
      provider: "microsoft",
      email: profile?.email ?? null,
      display_name: profile?.name ?? null,
      access_token: t.access_token,
      expires_at,
    };
    if (t.refresh_token) row.refresh_token = t.refresh_token;

    await supabaseAdmin
      .from("enterprise_oauth_accounts")
      .upsert(row, { onConflict: "user_id,provider" });

    dest.searchParams.set("microsoft_connected", "1");
  } catch (err) {
    console.error("Microsoft OAuth callback error:", err);
    dest.searchParams.set("error", "microsoft_auth_failed");
  }
  return NextResponse.redirect(dest);
}
