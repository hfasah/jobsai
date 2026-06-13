import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getMyMembership } from "@/lib/enterprise";
import { getOrgEntitlements } from "@/lib/enterprise-entitlements";
import { supabaseAdmin } from "@/lib/supabase";
import { Package, Check, Clock } from "lucide-react";
import { AddonButton } from "./addon-button";

export const dynamic = "force-dynamic";

const BLURB: Record<string, string> = {
  ai_interviews: "AI voice & avatar interviews, auto-scoring, and interview reports.",
  recruiting_agent: "Autonomous sourcing, outreach, follow-ups, and AI recommendations.",
  sms_whatsapp: "SMS & WhatsApp candidate messaging and automated notifications.",
  white_label_plus: "Custom domain, branding removal, and custom email branding.",
  extra_recruiter: "Add recruiter seats beyond your plan limit.",
};

export default async function EnterpriseAddonsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/enterprise-login");
  const member = await getMyMembership(userId);
  if (!member) redirect("/enterprise/onboard");

  const ent = await getOrgEntitlements(member.org_id);
  const [{ data: feats }, { data: owned }] = await Promise.all([
    supabaseAdmin.from("features").select("feature_key,name,price_monthly").eq("is_addon", true).order("price_monthly"),
    supabaseAdmin.from("org_addons").select("addon_key,quantity,status,removal_at").eq("org_id", member.org_id).in("status", ["active", "scheduled_removal"]),
  ]);
  const addons = (feats ?? []) as { feature_key: string; name: string; price_monthly: number | null }[];
  const ownedMap = new Map((owned as { addon_key: string; quantity: number; status: string; removal_at: string | null }[] | null ?? []).map((o) => [o.addon_key, o]));
  const active = new Set(ent.addons); // already excludes expired scheduled removals
  const trialing = ent.accessStatus === "trialing";
  const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand"><Package className="h-5 w-5 text-white" /></div>
        <div>
          <h1 className="text-2xl font-bold">Add-ons</h1>
          <p className="text-sm text-muted-foreground">Premium capabilities on top of your plan.{trialing ? " Added during your trial, billed when it converts." : " Added instantly and prorated."}</p>
        </div>
      </div>

      {!ent.hasBilling && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Start a plan to add add-ons. <a href="/enterprise/plans" className="font-semibold underline">Choose a plan →</a>
        </div>
      )}

      <div className="space-y-3">
        {addons.map((a) => {
          const o = ownedMap.get(a.feature_key);
          const on = active.has(a.feature_key);
          const seat = a.feature_key === "extra_recruiter";
          const scheduled = o?.status === "scheduled_removal" && on;
          return (
            <div key={a.feature_key} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">{a.name}</h2>
                  {on && !scheduled && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"><Check className="h-3 w-3" /> Active{seat && o?.quantity ? ` · ${o.quantity} seats` : ""}</span>}
                  {scheduled && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700"><Clock className="h-3 w-3" /> Cancels {fmtDate(o?.removal_at ?? null)}</span>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{BLURB[a.feature_key] ?? ""}</p>
                <p className="mt-1 text-sm font-medium">${a.price_monthly}/mo{seat ? " / user" : ""}</p>
              </div>
              <div className="shrink-0">
                <AddonButton
                  featureKey={a.feature_key} name={a.name} active={on} scheduled={!!scheduled}
                  price={a.price_monthly ?? 0} isSeat={seat} currentQty={o?.quantity} trialing={trialing}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
