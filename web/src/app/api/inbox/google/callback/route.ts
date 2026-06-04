import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { exchangeCode, getProfileEmail } from "@/lib/gmail";

// GET /api/inbox/google/callback — finish OAuth, store tokens.
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  const dest = new URL("/dashboard/inbox", req.url);
  if (!userId) return NextResponse.redirect(new URL("/sign-in", req.url));

  const code = req.nextUrl.searchParams.get("code");
  if (!code) { dest.searchParams.set("error", "1"); return NextResponse.redirect(dest); }

  try {
    const t = await exchangeCode(code);
    const email = await getProfileEmail(t.access_token);
    const expires_at = new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString();

    const row: Record<string, unknown> = {
      user_id: userId, provider: "google", email,
      access_token: t.access_token, expires_at, updated_at: new Date().toISOString(),
    };
    if (t.refresh_token) row.refresh_token = t.refresh_token;

    await supabaseAdmin.from("email_accounts").upsert(row, { onConflict: "user_id" });
    dest.searchParams.set("connected", "1");
  } catch (err) {
    console.error("Gmail OAuth callback error:", err);
    dest.searchParams.set("error", "1");
  }
  return NextResponse.redirect(dest);
}
