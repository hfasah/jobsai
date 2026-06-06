"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, Calendar, Briefcase, FileText, Bell, Loader2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const PLAN_BADGE: Record<string, string> = {
  free: "bg-muted text-muted-foreground",
  pro: "bg-blue-500/15 text-blue-400",
  premium: "bg-purple-500/15 text-purple-400",
  accelerator: "bg-amber-500/15 text-amber-400",
  enterprise: "bg-emerald-500/15 text-emerald-400",
};

const PLANS = ["free", "pro", "premium", "accelerator", "enterprise"];

export default function AdminUserDetail({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/users/${userId}`).then((r) => r.json()).then(setData).finally(() => setLoading(false));
  }, [userId]);

  const changePlan = async (plan: string) => {
    setChanging(true);
    await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const fresh = await fetch(`/api/admin/users/${userId}`).then((r) => r.json());
    setData(fresh);
    setChanging(false);
  };

  if (loading) return <div className="flex h-64 items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…</div>;
  if (!data) return <div className="text-destructive">User not found.</div>;

  const user = data.user as Record<string, unknown>;
  const billing = data.billing as Record<string, string | null | boolean | number> | null;
  const resumes = data.resumes as unknown[];
  const jobs = data.jobs as unknown[];
  const notifications = data.notifications as unknown[];
  const churnFeedback = data.churnFeedback as unknown[];
  const applyProfile = data.applyProfile as Record<string, unknown> | null;
  const currentPlan = (billing?.plan as string) ?? "free";

  return (
    <div className="space-y-6 max-w-5xl">
      <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> All users
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4 rounded-2xl border border-border bg-card p-6">
        {user.imageUrl
          ? <img src={user.imageUrl as string} alt="" className="h-14 w-14 rounded-full object-cover" />
          : <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">{(user.name as string)[0]}</div>}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold">{user.name as string}</h1>
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize", PLAN_BADGE[currentPlan] ?? PLAN_BADGE.free)}>
              {currentPlan}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {user.email as string}</p>
          <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Joined {new Date(user.createdAt as number).toLocaleDateString()}</p>
        </div>
        {/* Plan override */}
        <div className="flex items-center gap-2 shrink-0">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <select value={currentPlan} onChange={(e) => changePlan(e.target.value)}
            disabled={changing}
            className="h-9 rounded-lg border border-border bg-card px-2.5 text-sm outline-none focus:ring-2 focus:ring-primary disabled:opacity-50">
            {PLANS.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
        </div>
      </div>

      {/* Billing */}
      {billing && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 font-semibold">Billing</h2>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {[
              ["Status", billing.subscription_status as string],
              ["Stripe Customer", billing.stripe_customer_id as string ?? "—"],
              ["Subscription ID", billing.stripe_subscription_id as string ?? "—"],
              ["Period End", billing.current_period_end ? new Date(billing.current_period_end as string).toLocaleDateString() : "—"],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-xs text-muted-foreground">{k}</p>
                <p className="mt-0.5 font-medium truncate" title={String(v)}>{String(v)}</p>
              </div>
            ))}
          </div>
          {billing.stripe_customer_id && (
            <a href={`https://dashboard.stripe.com/customers/${String(billing.stripe_customer_id)}`} target="_blank" rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline">
              View in Stripe →
            </a>
          )}
        </div>
      )}

      {/* Settings */}
      {applyProfile && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 font-semibold">Settings</h2>
          <div className="flex gap-6 text-sm">
            <div><p className="text-xs text-muted-foreground">Auto-apply</p><p className="mt-0.5 font-medium">{applyProfile.auto_apply_enabled ? "On" : "Off"}</p></div>
            <div><p className="text-xs text-muted-foreground">Auto-reply</p><p className="mt-0.5 font-medium">{applyProfile.auto_reply ? "On" : "Off"}</p></div>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Resumes */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold"><FileText className="h-4 w-4" /> Resumes ({resumes.length})</h2>
          {resumes.length === 0 ? <p className="text-sm text-muted-foreground">No resumes uploaded.</p> : (
            <ul className="space-y-2">
              {(resumes as Record<string, unknown>[]).map((r) => (
                <li key={r.id as string} className="text-sm">
                  <p className="font-medium">{r.label as string}</p>
                  <p className="text-xs text-muted-foreground">{new Date(r.created_at as string).toLocaleDateString()}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Jobs */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold"><Briefcase className="h-4 w-4" /> Jobs tracked ({jobs.length})</h2>
          {jobs.length === 0 ? <p className="text-sm text-muted-foreground">No jobs tracked.</p> : (
            <ul className="space-y-2">
              {(jobs as Record<string, unknown>[]).slice(0, 10).map((j) => {
                const parsed = j.parsed as Record<string, string | null> | null;
                return (
                  <li key={j.id as string} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{parsed?.title ?? "Untitled"}</p>
                      <p className="text-xs text-muted-foreground">{parsed?.company ?? "—"}</p>
                    </div>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] capitalize text-muted-foreground">{j.status as string}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Notifications */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 flex items-center gap-2 font-semibold"><Bell className="h-4 w-4" /> Recent notifications</h2>
        {notifications.length === 0 ? <p className="text-sm text-muted-foreground">No notifications.</p> : (
          <ul className="space-y-1.5">
            {(notifications as Record<string, unknown>[]).map((n) => (
              <li key={n.id as string} className="flex items-center justify-between text-sm">
                <p className="text-muted-foreground">{n.message as string}</p>
                <span className="text-xs text-muted-foreground">{new Date(n.created_at as string).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Churn Feedback */}
      {churnFeedback.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 font-semibold">Churn Feedback</h2>
          {(churnFeedback as { id: string; reasons: string[]; comment: string | null; created_at: string; wait: boolean }[]).map((f) => (
            <div key={f.id} className="rounded-xl bg-muted/40 p-3 text-sm space-y-1">
              <p className="text-muted-foreground">{f.reasons.join(", ")}</p>
              {f.comment && <p className="text-foreground">&ldquo;{f.comment}&rdquo;</p>}
              <p className="text-xs text-muted-foreground">{new Date(f.created_at).toLocaleDateString()} · {f.wait ? "Waited" : "Cancelled"}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
