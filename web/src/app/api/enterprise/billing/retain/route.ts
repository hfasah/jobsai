import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getMyOrg } from "@/lib/enterprise";
import { requirePermission } from "@/lib/enterprise-permissions";
import { applyRetention, type RetentionOffer } from "@/lib/enterprise-retention";

const VALID: RetentionOffer[] = ["discount_50_6mo", "pause_90d", "extend_trial_14d", "book_demo"];

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  const denied = await requirePermission(userId, "can_manage_settings");
  if (denied) return denied;

  const org = await getMyOrg(userId!);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { offer, reason } = await req.json().catch(() => ({}));
  if (!VALID.includes(offer)) return NextResponse.json({ error: "Unknown offer." }, { status: 400 });

  try {
    const res = await applyRetention(org.id, userId!, offer, reason ?? "unknown");
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true, message: res.message });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not apply offer." }, { status: 502 });
  }
}
