import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getMyMembership } from "@/lib/enterprise";
import { supabaseAdmin } from "@/lib/supabase";
import { mergeConfigured } from "@/lib/merge";
import { Plug } from "lucide-react";
import { AtsPanel } from "./ats-panel";

export const dynamic = "force-dynamic";

export default async function EnterpriseAtsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/enterprise-login");
  const member = await getMyMembership(userId);
  if (!member) redirect("/enterprise/onboard");

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
