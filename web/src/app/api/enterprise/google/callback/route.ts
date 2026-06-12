import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  exchangeGoogleEnterpriseCode,
  getGoogleEnterpriseProfileEmail,
} from "@/lib/google-calendar-enterprise";

export async function GET(req: NextRequest) {
  const dest = new URL("/enterprise/settings?tab=integrations", req.url);
  const code = req.nextUrl.searchParams.get("code");
  const userId = req.nextUrl.searchParams.get("state");

  if (!code || !userId) {
    dest.searchParams.set("error", "google_auth_failed");
    return NextResponse.redirect(dest);
  }

  try {
    const t = await exchangeGoogleEnterpriseCode(code);
    const email = await getGoogleEnterpriseProfileEmail(t.access_token);
    const expires_at = new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString();

    const row: Record<string, unknown> = {
      user_id: userId,
      provider: "google",
      email,
      display_name: email,
      access_token: t.access_token,
      expires_at,
    };
    if (t.refresh_token) row.refresh_token = t.refresh_token;

    await supabaseAdmin
      .from("enterprise_oauth_accounts")
      .upsert(row, { onConflict: "user_id,provider" });

    dest.searchParams.set("google_connected", "1");
  } catch (err) {
    console.error("Google enterprise OAuth callback error:", err);
    dest.searchParams.set("error", "google_auth_failed");
  }
  return NextResponse.redirect(dest);
}
