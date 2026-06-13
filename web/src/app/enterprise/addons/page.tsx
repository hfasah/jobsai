import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getMyMembership } from "@/lib/enterprise";
import { getOrgEntitlements } from "@/lib/enterprise-entitlements";
import { supabaseAdmin } from "@/lib/supabase";
import { Package, Check } from "lucide-react";
import { ManageBilling } from "../billing/billing-actions";

export const dynamic = "force-dynamic";

const BLURB: Record<string, string> = {
  ai_interviews: "AI voice & avatar interviews, auto-scoring, and interview reports.",
  recruiting_agent: "Autonomous sourcing, outreach, follow-ups, and AI recommendations.",
  sms_whatsapp: "SMS & WhatsApp candidate messaging and automated notifications.",
  white_label_plus: "Custom domain, branding removal, and custom email branding.",
  extra_recruiter: "Add recruiter seats beyond your plan limit ($29 / user / month).",
};

export default async function EnterpriseAddonsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/enterprise-login");
  const member = await getMyMembership(userId);
  if (!member) redirect("/enterprise/onboard");

  const ent = await getOrgEntitlements(member.org_id);
  const { data } = await supabaseAdmin
    .from("features")
    .select("feature_key,name,price_monthly")
    .eq("is_addon", true)
    .order("price_monthly");
  const addons = (data ?? []) as { feature_key: string; name: string; price_monthly: number | null }[];
  const active = new Set(ent.addons);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand"><Package className="h-5 w-5 text-white" /></div>
        <div>
          <h1 className="text-2xl font-bold">Add-ons</h1>
          <p className="text-sm text-muted-foreground">Premium capabilities on top of your plan.</p>
        </div>
      </div>

      <div className="space-y-3">
        {addons.map((a) => {
          const on = active.has(a.feature_key);
          return (
            <div key={a.feature_key} className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-card p-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold">{a.name}</h2>
                  {on && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"><Check className="h-3 w-3" /> Active</span>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{BLURB[a.feature_key] ?? ""}</p>
                <p className="mt-1 text-sm font-medium">${a.price_monthly}/mo{a.feature_key === "extra_recruiter" ? " / user" : ""}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-muted/30 p-5">
        <p className="text-sm text-muted-foreground">Add or remove add-ons from your subscription:</p>
        <div className="mt-3"><ManageBilling hasBilling={ent.hasBilling} /></div>
      </div>
    </div>
  );
}
