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
// Mints a Clerk actor token (admin recorded as `actor` for audit) and returns a
// handoff URL on the consumer domain. The browser is redirected there to
// complete the ticket sign-in, landing the admin in the consumer dashboard as
// the user. jobsai.work and app.jobsai.work share one Clerk instance, so the
// ticket is valid on the consumer site.
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
  if (target.banned) {
    return NextResponse.json({ error: "Account is suspended — reactivate it before opening." }, { status: 409 });
  }

  const actorToken = await client.actorTokens.create({
    userId,
    actor: { sub: adminId },
    expiresInSeconds: 600, // token must be consumed within 10 minutes
  });
  if (!actorToken.token) {
    return NextResponse.json({ error: "Could not create impersonation token." }, { status: 500 });
  }

  const handoffUrl = `${CONSUMER_URL}/impersonate-handoff?ticket=${encodeURIComponent(actorToken.token)}`;
  return NextResponse.json({ handoffUrl });
}
