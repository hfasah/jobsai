import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) return null;
  const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return adminIds.includes(userId) ? userId : null;
}

// POST /api/admin/users/[userId]/impersonate — "Open account".
//
// Mints a Clerk actor token so the admin can sign in as the user. Clerk records
// the admin as the `actor` on the impersonated session (audit trail in the JWT
// + Clerk dashboard). The returned token is consumed client-side with the
// `ticket` sign-in strategy. The session is short-lived (30 min default).
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

  return NextResponse.json({ ticket: actorToken.token });
}
