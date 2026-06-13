import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getMyMembership } from "@/lib/enterprise";
import { getOrgEntitlements } from "@/lib/enterprise-entitlements";
import { supabaseAdmin } from "@/lib/supabase";
import { mergeConfigured } from "@/lib/merge";
import { Plug, Lock } from "lucide-react";
import { AtsPanel } from "./ats-panel";

export const dynamic = "force-dynamic";

export default async function EnterpriseAtsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/enterprise-login");
  const member = await getMyMembership(userId);
  if (!member) redirect("/enterprise/onboard");

  // Gated to Agency / Business / Enterprise plans.
  const ent = await getOrgEntitlements(member.org_id);
  if (!ent.features.includes("ats_integration")) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand">
            <Plug className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">ATS Integration</h1>
            <p className="text-sm text-muted-foreground">
              Sync jobs and candidates from your existing ATS into JobsAI Enterprise.
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold">Available on Agency, Business &amp; Enterprise</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            One-click sync with Greenhouse, Lever, Ashby, Workable, Bullhorn, Workday and 20+ more.
            Upgrade your plan to connect your ATS.
          </p>
          <a
            href="/enterprise/plans"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-gradient-brand px-5 py-2.5 text-sm font-semibold text-white"
          >
            View plans
          </a>
        </div>
      </div>
    );
  }

  const { data: conn } = await supabaseAdmin
    .from("enterprise_ats_connections")
    .select("provider,integration_name,status,last_synced_at")
    .eq("org_id", member.org_id)
    .eq("status", "active")
    .maybeSingle();

  const canManage = member.role === "owner" || member.role === "admin";

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand">
          <Plug className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">ATS Integration</h1>
          <p className="text-sm text-muted-foreground">
            Connect your existing ATS to sync jobs and candidates into JobsAI Enterprise.
          </p>
        </div>
      </div>

      <AtsPanel
        configured={mergeConfigured()}
        canManage={canManage}
        initialConnection={
          conn
            ? {
                provider: conn.provider,
                integration_name: conn.integration_name,
                last_synced_at: conn.last_synced_at,
              }
            : null
        }
      />

      <p className="mt-6 text-xs text-muted-foreground">
        Works with Greenhouse, Lever, Ashby, Workable, Bullhorn, Workday, JazzHR, Jobvite, Teamtailor,
        Recruit CRM and 20+ more — powered by a unified ATS API. Your data is read-only on the ATS side.
      </p>
    </div>
  );
}
