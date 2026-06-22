import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Where a consumer job-seeker's dashboard lives. Impersonation must complete on
// this domain so the admin lands in the real consumer experience (and outside
// /admin, which jobsai.work redirects back to this enterprise portal).
const CONSUMER_URL = process.env.NEXT_PUBLIC_CONSUMER_URL ?? "https://jobsai.work";

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) return null;
  const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return adminIds.includes(userId) ? userId : null;
}

// POST /api/admin/users/[userId]/impersonate — "Open account".
//
// Mints a Clerk sign-in token and returns a handoff URL on the consumer domain.
// The browser is redirected there to complete the ticket sign-in, landing the
// admin in the consumer dashboard as the user. jobsai.work and app.jobsai.work
// share one Clerk instance, so the token is valid on the consumer site.
//
// We use sign-in tokens (not actor tokens) because actor-token impersonation is
// capped per billing period on our Clerk plan (e.g. 5/period). Sign-in tokens
// aren't capped. Trade-off: no Clerk `actor` claim, so the consumer side drives
// the "Viewing as / Exit" banner from a per-tab flag instead.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { userId } = await params;

  if (userId === adminId) {
    return NextResponse.json({ error: "You're already signed in as yourself." }, { status: 400 });
  }

  const client = await clerkClient();
  const target = await client.users.getUser(userId).catch(() => null);
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if ((target.privateMetadata as { suspended?: boolean } | undefined)?.suspended) {
    return NextResponse.json({ error: "Account is suspended — reactivate it before opening." }, { status: 409 });
  }

  let token: string | null = null;
  try {
    const signInToken = await client.signInTokens.createSignInToken({
      userId,
      expiresInSeconds: 600, // token must be consumed within 10 minutes
    });
    token = signInToken.token ?? null;
  } catch (err) {
    console.error("impersonate signInTokens.create error:", JSON.stringify(err, null, 2));
    // Clerk API errors carry detail in `.errors[]` (the top-level message is just
    // the HTTP status text, e.g. "Unprocessable Entity").
    const e = err as { errors?: Array<{ message?: string; longMessage?: string; code?: string }>; message?: string };
    const detail = e.errors?.map((x) => x.longMessage || x.message || x.code).filter(Boolean).join("; ")
      || (err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: `Could not start impersonation: ${detail}` }, { status: 422 });
  }
  if (!token) {
    return NextResponse.json({ error: "Could not create impersonation token (empty token)." }, { status: 500 });
  }

  // Also mint a return token for the admin so "Exit" can sign them straight back
  // in (no manual re-login). Non-fatal: if it fails, Exit falls back to sign-out.
  let returnToken: string | null = null;
  try {
    const rt = await client.signInTokens.createSignInToken({ userId: adminId, expiresInSeconds: 1800 });
    returnToken = rt.token ?? null;
  } catch (err) {
    console.error("impersonate: admin return token failed (non-fatal):", err);
  }

  const handoffUrl = `${CONSUMER_URL}/impersonate-handoff?ticket=${encodeURIComponent(token)}&imp=1`
    + (returnToken ? `&rt=${encodeURIComponent(returnToken)}` : "");
  return NextResponse.json({ handoffUrl });
}
