import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { sendWelcomeEmail } from "@/lib/email";

export const maxDuration = 30;

// POST /api/user/test-welcome — send the welcome email to YOUR OWN inbox, to
// preview the real render. Sends only to the signed-in user's email (no abuse
// surface beyond self). Run from the dashboard console:
//   fetch('/api/user/test-welcome',{method:'POST'}).then(r=>r.json()).then(console.log)
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const to = user.emailAddresses[0]?.emailAddress;
  if (!to) return NextResponse.json({ error: "No email on file" }, { status: 400 });

  const result = await sendWelcomeEmail({ to, firstName: user.firstName });
  // Surface the ACTUAL send result (Resend can 403 on an unverified sender
  // domain) — don't report success on a failed send.
  return NextResponse.json(
    { ok: result.ok, sent_to: to, error: result.error },
    { status: result.ok ? 200 : 502 },
  );
}
