import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getMyOrg } from "@/lib/enterprise";
import { requirePermission } from "@/lib/enterprise-permissions";
import { scheduleCancellation } from "@/lib/enterprise-retention";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  const denied = await requirePermission(userId, "can_manage_settings");
  if (denied) return denied;

  const org = await getMyOrg(userId!);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { reason, comment } = await req.json().catch(() => ({}));
  const res = await scheduleCancellation(org.id, userId!, reason ?? "unknown", comment ?? null);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true, cancel_at: res.cancelAt });
}
