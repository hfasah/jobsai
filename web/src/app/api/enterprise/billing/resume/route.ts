import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getMyOrg } from "@/lib/enterprise";
import { requirePermission } from "@/lib/enterprise-permissions";
import { resumeSubscription } from "@/lib/enterprise-retention";

export async function POST() {
  const { userId } = await auth();
  const denied = await requirePermission(userId, "can_manage_settings");
  if (denied) return denied;

  const org = await getMyOrg(userId!);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  try {
    const res = await resumeSubscription(org.id);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not resume." }, { status: 502 });
  }
}
