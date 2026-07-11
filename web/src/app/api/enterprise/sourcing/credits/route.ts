import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { requirePermission } from "@/lib/enterprise-permissions";
import { getMyOrg } from "@/lib/enterprise";
import { audit } from "@/lib/enterprise-audit";
import { ensureMonthlyGrant, getCreditCosts, getCreditState } from "@/lib/sourcing/credits";
import type { CreditAction } from "@/lib/sourcing/types";

const ACTIONS: CreditAction[] = ["search", "unlock_profile", "reveal_email", "reveal_phone", "enrich"];

// GET — balance, monthly allowance, usage this month, effective costs.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "global_sourcing");
  if (gate) return gate;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  await ensureMonthlyGrant(org.id);
  const [state, costs] = await Promise.all([getCreditState(org.id), getCreditCosts(org.id)]);
  return NextResponse.json({ data: { ...state, costs } });
}

// PATCH — org-level cost overrides: { costs: { reveal_email: 3, ... } }.
export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "global_sourcing");
  if (gate) return gate;
  const denied = await requirePermission(userId, "can_manage_sourcing");
  if (denied) return denied;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const costs = (body.costs ?? {}) as Record<string, unknown>;
  const applied: Record<string, number> = {};
  for (const action of ACTIONS) {
    const v = costs[action];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 1000) continue;
    await supabaseAdmin
      .from("sourcing_credit_costs")
      .upsert({ org_id: org.id, action, cost: v }, { onConflict: "org_id,action" });
    applied[action] = v;
  }
  if (Object.keys(applied).length === 0) {
    return NextResponse.json({ error: "No valid cost values supplied." }, { status: 400 });
  }

  after(() => {
    audit({
      org_id: org.id,
      user_id: userId,
      action: "sourcing.credits_adjusted",
      resource_type: "sourcing_credit_costs",
      metadata: { applied },
    });
  });

  const effective = await getCreditCosts(org.id);
  return NextResponse.json({ data: { costs: effective } });
}
