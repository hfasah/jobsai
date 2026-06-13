import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getMyMembership } from "@/lib/enterprise";
import { getOrgEntitlements } from "@/lib/enterprise-entitlements";
import { getOrgUsage } from "@/lib/enterprise-limits";
import { CreditCard, Sparkles } from "lucide-react";
import { ManageBilling } from "./billing-actions";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  trialing: { label: "Trialing", cls: "bg-blue-100 text-blue-700" },
  active: { label: "Active", cls: "bg-emerald-100 text-emerald-700" },
  comped: { label: "Active (comped)", cls: "bg-emerald-100 text-emerald-700" },
  past_due: { label: "Past due", cls: "bg-amber-100 text-amber-700" },
  pending: { label: "Pending", cls: "bg-muted text-muted-foreground" },
  canceled: { label: "Canceled", cls: "bg-red-100 text-red-700" },
};

function fmt(n: number) { return n.toLocaleString(); }
function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

function UsageRow({ label, used, limit }: { label: string; used: number; limit: number | undefined }) {
  const unlimited = limit === undefined || limit < 0;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const near = !unlimited && pct >= 80;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{fmt(used)} {unlimited ? "" : `/ ${fmt(limit!)}`}{unlimited && <span className="text-muted-foreground"> / unlimited</span>}</span>
      </div>
      {!unlimited && (
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className={`h-full rounded-full ${near ? "bg-amber-500" : "bg-gradient-brand"}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

export default async function EnterpriseBillingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/enterprise-login");
  const member = await getMyMembership(userId);
  if (!member) redirect("/enterprise/onboard");

  const [ent, usage] = await Promise.all([getOrgEntitlements(member.org_id), getOrgUsage(member.org_id)]);
  const status = STATUS_STYLE[ent.accessStatus ?? "pending"] ?? STATUS_STYLE.pending;
  const trialDays = ent.accessStatus === "trialing" ? daysLeft(ent.trialEndsAt) : null;
  const trialDate = ent.trialEndsAt ? new Date(ent.trialEndsAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : null;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand"><CreditCard className="h-5 w-5 text-white" /></div>
        <div>
          <h1 className="text-2xl font-bold">Billing & Subscription</h1>
          <p className="text-sm text-muted-foreground">Your plan, usage, and billing.</p>
        </div>
      </div>

      {/* Plan + status */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Current plan</p>
            <p className="text-2xl font-bold">{ent.planName ?? "No plan"}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status.cls}`}>{status.label}</span>
        </div>
        {trialDays !== null && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
            <Sparkles className="h-4 w-4" />
            <span>Trial ends in <strong>{trialDays} day{trialDays === 1 ? "" : "s"}</strong>{trialDate ? ` — ${trialDate}` : ""}. Upgrade to keep your workspace active.</span>
          </div>
        )}
        <div className="mt-6"><ManageBilling hasBilling={ent.hasBilling} /></div>
      </div>

      {/* Usage */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-4 text-sm font-semibold">Usage this plan</h2>
        <div className="space-y-4">
          <UsageRow label="Recruiters" used={usage.recruiters} limit={ent.limits.recruiters} />
          <UsageRow label="Active jobs" used={usage.jobs} limit={ent.limits.jobs} />
          <UsageRow label="Candidates" used={usage.candidates} limit={ent.limits.candidates} />
        </div>
      </div>

      {/* Add-ons summary */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Add-ons</h2>
            <p className="text-sm text-muted-foreground">{ent.addons.length ? `${ent.addons.length} active` : "None active"}</p>
          </div>
          <a href="/enterprise/addons" className="text-sm font-semibold text-primary hover:underline">Browse add-ons →</a>
        </div>
      </div>
    </div>
  );
}
