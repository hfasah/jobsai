import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin";

type Ctx = { params: Promise<{ orgId: string }> };

// POST — turn an org into a fully-loaded demo: Enterprise plan, comped access,
// every plan-tier feature granted via overrides, and all paid add-ons active.
// Deliberately separate from the generic "Open workspace" (comp + enter) so we
// never silently hand a real paying customer free features/add-ons.
export async function POST(_req: NextRequest, { params }: Ctx) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { orgId } = await params;

  const { data: org } = await supabaseAdmin.from("enterprise_orgs").select("id").eq("id", orgId).maybeSingle();
  if (!org) return NextResponse.json({ error: "Org not found." }, { status: 404 });

  // 1. Enterprise plan + comped access.
  const { data: plan } = await supabaseAdmin.from("plans").select("id").eq("slug", "enterprise").maybeSingle();
  const orgUpdate: Record<string, unknown> = {
    access_status: "comped",
    activated_by: admin.userId,
    activated_at: new Date().toISOString(),
  };
  if (plan?.id) orgUpdate.plan_id = plan.id;
  await supabaseAdmin.from("enterprise_orgs").update(orgUpdate).eq("id", orgId);

  // 2. Grant every plan-tier feature via overrides (the Enterprise plan is
  //    "custom" with no plan_features rows, so without this the workspace is
  //    almost empty). is_addon features are handled by org_addons below.
  const { data: feats } = await supabaseAdmin.from("features").select("feature_key, is_addon");
  const planFeatureKeys = (feats ?? []).filter((f) => !f.is_addon).map((f) => f.feature_key);
  if (planFeatureKeys.length) {
    await supabaseAdmin.from("org_feature_overrides").upsert(
      planFeatureKeys.map((feature_key) => ({
        org_id: orgId, feature_key, enabled: true, note: "demo: full access", created_by: admin.userId,
      })),
      { onConflict: "org_id,feature_key" },
    );
  }

  // 3. Activate all paid add-ons.
  await supabaseAdmin.from("org_addons").upsert(
    ["ai_interviews", "recruiting_agent", "sms_whatsapp", "white_label_plus"].map((addon_key) => ({
      org_id: orgId, addon_key, status: "active",
    })),
    { onConflict: "org_id,addon_key" },
  );

  return NextResponse.json({ ok: true, features_granted: planFeatureKeys.length });
}
