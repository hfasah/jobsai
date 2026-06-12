import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Load all orgs with an active retention policy
  const { data: orgs } = await supabaseAdmin
    .from("enterprise_orgs")
    .select("id,name,data_retention_days,retention_action")
    .not("data_retention_days", "is", null);

  if (!orgs?.length) return NextResponse.json({ ok: true, orgs_processed: 0 });

  let totalProcessed = 0;

  for (const org of orgs) {
    const days = org.data_retention_days as number;
    const action = (org.retention_action as string) ?? "anonymize";
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();

    const { data: apps } = await supabaseAdmin
      .from("enterprise_applications")
      .select("id,candidate_name,candidate_email")
      .eq("org_id", org.id)
      .eq("stage", "rejected")
      .eq("legal_hold", false)
      .lte("stage_updated_at", cutoff)
      .limit(500);

    if (!apps?.length) continue;
    const ids = apps.map((a) => a.id);

    if (action === "delete") {
      await supabaseAdmin.from("enterprise_applications").delete().in("id", ids);
    } else {
      // Anonymize: wipe PII but keep the row for audit/analytics purposes
      const suffix = `${org.id.slice(0, 6)}-ret`;
      await supabaseAdmin
        .from("enterprise_applications")
        .update({
          candidate_name: "[retained-deleted]",
          candidate_email: `deleted-${suffix}@erased.invalid`,
          candidate_phone: null,
          resume_text: null,
          resume_url: null,
          cover_letter: null,
          linkedin_url: null,
          portfolio_url: null,
          notes: null,
          ai_summary: null,
        })
        .in("id", ids);
    }

    void supabaseAdmin.from("enterprise_audit_logs").insert({
      org_id: org.id,
      user_id: null,
      action: "compliance.retention_enforced",
      resource_type: "application",
      metadata: { action, count: ids.length, days_policy: days },
    });

    totalProcessed += ids.length;
  }

  return NextResponse.json({ ok: true, orgs_processed: orgs.length, records_processed: totalProcessed });
}
