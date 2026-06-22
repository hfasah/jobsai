"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, Calendar, Briefcase, FileText, Bell, Loader2, ShieldCheck, LogIn, Ban, RotateCcw } from "lucide-react";
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
  // Credits & refunds
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [refundRef, setRefundRef] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [banBusy, setBanBusy] = useState(false);
  const [controlMsg, setControlMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/users/${userId}`).then((r) => r.json()).then(setData).finally(() => setLoading(false));
  }, [userId]);

  const runAction = async (payload: Record<string, unknown>) => {
    setActionBusy(true); setActionMsg(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) { setActionMsg(json.error ?? "Action failed."); return; }
      setActionMsg(payload.action === "grant_credit"
        ? `✓ Granted. New balance: ${Number(json.balance).toLocaleString()} tokens.`
        : `✓ Refunded ${(json.amount / 100).toFixed(2)} ${String(json.currency).toUpperCase()}.`);
      setCreditAmount(""); setCreditReason(""); setRefundRef(""); setRefundReason("");
      const fresh = await fetch(`/api/admin/users/${userId}`).then((r) => r.json());
      setData(fresh);
    } finally {
      setActionBusy(false);
    }
  };

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

  // "Open account" — mint a Clerk actor token, then hand off to the consumer
  // domain (jobsai.work) to complete the sign-in and land in the user's
  // dashboard. The consumer ImpersonationBanner shows an Exit there.
  const openAccount = async () => {
    setOpening(true); setControlMsg(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/impersonate`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.handoffUrl) { setControlMsg(json.error ?? "Could not open account."); setOpening(false); return; }
      window.location.href = json.handoffUrl;
    } catch (err) {
      setControlMsg(err instanceof Error ? err.message : "Could not open account.");
      setOpening(false);
    }
  };

  // Suspend (Clerk ban) / reactivate — blocks or restores the user's sign-in.
  const toggleBan = async (banned: boolean) => {
    const verb = banned ? "reactivate" : "suspend";
    if (!confirm(`Are you sure you want to ${verb} this account?`)) return;
    setBanBusy(true); setControlMsg(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: banned ? "unban" : "ban" }),
      });
      const json = await res.json();
      if (!res.ok) { setControlMsg(json.error ?? `Could not ${verb} account.`); return; }
      setControlMsg(banned ? "✓ Account reactivated — sign-in restored." : "✓ Account suspended — sign-in blocked.");
      const fresh = await fetch(`/api/admin/users/${userId}`).then((r) => r.json());
      setData(fresh);
    } catch (err) {
      setControlMsg(err instanceof Error ? err.message : `Could not ${verb} account.`);
    } finally {
      setBanBusy(false);
    }
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
  const tokens = data.tokens as { balance: number; plan: string } | null;
  const ledger = (data.ledger as Record<string, unknown>[]) ?? [];
  const currentPlan = (billing?.plan as string) ?? "free";
  const banned = Boolean(user.banned);

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
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", banned ? "bg-red-500/15 text-red-400" : "bg-emerald-500/15 text-emerald-400")}>
              {banned ? <><Ban className="h-3 w-3" /> Suspended</> : <><ShieldCheck className="h-3 w-3" /> Active</>}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {user.email as string}</p>
          <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Joined {new Date(user.createdAt as number).toLocaleDateString()}</p>
        </div>
        {/* Admin controls */}
        <div className="flex flex-col items-stretch gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <select value={currentPlan} onChange={(e) => changePlan(e.target.value)}
              disabled={changing}
              className="h-9 flex-1 rounded-lg border border-border bg-card px-2.5 text-sm outline-none focus:ring-2 focus:ring-primary disabled:opacity-50">
              {PLANS.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={openAccount} disabled={opening || banned}
              title={banned ? "Reactivate the account first" : "Sign in as this user (consumer dashboard)"}
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50">
              {opening ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />} Access account
            </button>
            {banned ? (
              <button onClick={() => toggleBan(true)} disabled={banBusy}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-emerald-500/40 px-3 text-sm font-medium text-emerald-600 transition-colors hover:bg-emerald-500/10 disabled:opacity-50 dark:text-emerald-400">
                {banBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Reactivate
              </button>
            ) : (
              <button onClick={() => toggleBan(false)} disabled={banBusy}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-red-500/40 px-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400">
                {banBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />} Suspend
              </button>
            )}
          </div>
          {controlMsg && (
            <p className={cn("text-right text-xs font-medium", controlMsg.startsWith("✓") ? "text-emerald-500" : "text-red-400")}>
              {controlMsg}
            </p>
          )}
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

      {/* Credits & Refunds */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-semibold">Credits &amp; Refunds</h2>
          {tokens && <span className="text-sm text-muted-foreground">Balance: <span className="font-semibold text-foreground tabular-nums">{tokens.balance.toLocaleString()}</span> tokens</span>}
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Refunds are issued as <strong className="text-foreground">credits (tokens)</strong> by default — for support, goodwill, or compensating a technical/support issue. Money refunds are exceptional. (See the <Link href="/refund-policy" className="text-primary hover:underline">refund policy</Link>.)
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Grant credits */}
          <div className="rounded-xl border border-border bg-background/40 p-4">
            <p className="mb-2 text-sm font-medium">Grant credits</p>
            <input type="number" min={1} value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} placeholder="Tokens (e.g. 5000)"
              className="mb-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
            <input value={creditReason} onChange={(e) => setCreditReason(e.target.value)} placeholder="Reason (e.g. support issue, goodwill)"
              className="mb-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
            <button onClick={() => runAction({ action: "grant_credit", amount: Number(creditAmount), reason: creditReason })}
              disabled={actionBusy || !creditAmount}
              className="btn-cta inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg text-sm disabled:opacity-60">
              Grant credits
            </button>
          </div>

          {/* Money refund (exceptional) */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <p className="mb-2 text-sm font-medium text-amber-600 dark:text-amber-400">Money refund (exceptional)</p>
            <input value={refundRef} onChange={(e) => setRefundRef(e.target.value)} placeholder="Stripe payment intent / charge id"
              className="mb-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
            <input value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder="Reason (required)"
              className="mb-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
            <button onClick={() => { if (confirm("Issue a real money refund via Stripe? This is exceptional.")) runAction({ action: "refund", payment_intent_id: refundRef.startsWith("pi_") ? refundRef : undefined, charge_id: refundRef.startsWith("ch_") ? refundRef : undefined, reason: refundReason }); }}
              disabled={actionBusy || !refundRef || !refundReason}
              className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-amber-500/40 text-sm font-medium text-amber-600 transition-colors hover:bg-amber-500/10 disabled:opacity-60 dark:text-amber-400">
              Issue money refund
            </button>
          </div>
        </div>

        {actionMsg && <p className="mt-3 text-sm font-medium text-desyn-success">{actionMsg}</p>}

        {ledger.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Recent token ledger</p>
            <div className="space-y-1">
              {ledger.slice(0, 8).map((l, i) => (
                <div key={i} className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate text-muted-foreground">{String(l.reason)}{(l.metadata as Record<string, unknown>)?.note ? ` — ${String((l.metadata as Record<string, unknown>).note)}` : ""}</span>
                  <span className={cn("shrink-0 tabular-nums font-medium", Number(l.delta) > 0 ? "text-desyn-success" : Number(l.delta) < 0 ? "text-muted-foreground" : "text-amber-500")}>
                    {Number(l.delta) > 0 ? "+" : ""}{Number(l.delta).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

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
