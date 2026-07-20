"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, Calendar, Briefcase, FileText, Bell, Loader2, ShieldCheck, LogIn, Ban, RotateCcw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const PLAN_BADGE: Record<string, string> = {
  free: "bg-muted text-muted-foreground",
  pro: "bg-blue-500/15 text-blue-400",
  premium: "bg-purple-500/15 text-purple-400",
  accelerator: "bg-amber-500/15 text-amber-400",
  enterprise: "bg-emerald-500/15 text-emerald-400",
};

const PLANS = ["free", "pro", "premium", "accelerator", "enterprise"];

// Friendly labels for token_ledger reasons/features in the spend breakdown.
const LEDGER_LABEL: Record<string, string> = {
  auto_apply: "Auto-apply", ats_scan: "ATS scan", resume_tailor: "Resume tailor",
  cover_letter: "Cover letter", interview_coach: "Interview coach", free_apply: "Free apply",
  signup_grant: "Signup grant", monthly_grant: "Monthly grant", admin_credit: "Admin credit",
  auto_apply_failed_refund: "Auto-apply refund", auto_apply_meter_refund: "Auto-apply meter refund",
  auto_apply_confirmed_recharge: "Confirmed re-charge", monthly_grant_clawback: "Grant claw-back",
};
const ledgerLabel = (k: string) => LEDGER_LABEL[k] ?? k.replace(/_/g, " ");

type TokenSummary = {
  rows: number; since: string | null; credited_total: number; spent_total: number;
  grants_in: { key: string; amount: number }[];
  spend_by_feature: { key: string; amount: number }[];
};

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
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelMsg, setCancelMsg] = useState<string | null>(null);

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

  // Bypass the card-required trial gate for this user (grandfathered credit
  // buyers, comp accounts). Server enforces the users.plan_override permission.
  const [accessBusy, setAccessBusy] = useState(false);
  const toggleDashboardAccess = async (enabled: boolean) => {
    setAccessBusy(true);
    try {
      await fetch(`/api/admin/users/${userId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dashboard_access", enabled }),
      });
      const fresh = await fetch(`/api/admin/users/${userId}`).then((r) => r.json());
      setData(fresh);
    } finally {
      setAccessBusy(false);
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

  // Cancel the Stripe subscription at period end (two-click confirm). Support
  // tool for disputes/cancellation requests — stops renewals, keeps paid-for
  // access, refunds nothing.
  const cancelSubscription = async () => {
    if (!cancelConfirm) { setCancelConfirm(true); setTimeout(() => setCancelConfirm(false), 4000); return; }
    setCancelConfirm(false);
    setCancelBusy(true); setCancelMsg(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/cancel-subscription`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const json = await res.json();
      if (!res.ok) { setCancelMsg(json.error ?? "Cancel failed."); return; }
      const pe = json.data?.period_end ? ` Access ends ${new Date(json.data.period_end).toLocaleDateString()}.` : "";
      setCancelMsg(json.data?.canceled === "already" ? "✓ Was already canceled." : `✓ Canceled at period end.${pe} No further charges.`);
      const fresh = await fetch(`/api/admin/users/${userId}`).then((r) => r.json());
      setData(fresh);
    } catch (err) {
      setCancelMsg(err instanceof Error ? err.message : "Cancel failed.");
    } finally {
      setCancelBusy(false);
    }
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

  // Permanently delete the account + all data. Confirms by typing the email.
  const deleteAccount = async () => {
    const u = (data?.user ?? {}) as Record<string, unknown>;
    const email = String(u.email ?? "");
    const typed = window.prompt(
      `This permanently deletes ${email} and ALL of their data (resumes, jobs, billing — everything). This CANNOT be undone.\n\nType the email to confirm:`
    );
    if (typed === null) return;
    if (typed.trim().toLowerCase() !== email.toLowerCase()) { setDeleteMsg("Email didn't match — deletion cancelled."); return; }
    setDeleting(true); setDeleteMsg(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm_email: typed.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { setDeleteMsg(json.error ?? "Deletion failed."); setDeleting(false); return; }
      alert(`Account deleted — removed ${json.cleanup?.total_rows ?? 0} rows and ${json.filesRemoved ?? 0} file(s).`);
      window.location.href = "/admin/users";
    } catch (err) {
      setDeleteMsg(err instanceof Error ? err.message : "Deletion failed.");
      setDeleting(false);
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
  const summary = (data.tokenSummary as TokenSummary | undefined) ?? null;
  const currentPlan = (billing?.plan as string) ?? "free";
  const banned = Boolean(user.banned);
  // Server-derived caller permissions (RBAC). `!== false` keeps everything
  // visible for super admins and during rollout; the API enforces regardless.
  const perms = (data.permissions ?? {}) as {
    grant_credits?: boolean; grant_allowance_today?: number | null; money_refund?: boolean;
    cancel_sub?: boolean; suspend?: boolean; delete?: boolean; impersonate?: boolean; plan_override?: boolean;
  };

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
          {perms.plan_override !== false && (
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <select value={currentPlan} onChange={(e) => changePlan(e.target.value)}
                disabled={changing}
                className="h-9 flex-1 rounded-lg border border-border bg-card px-2.5 text-sm outline-none focus:ring-2 focus:ring-primary disabled:opacity-50">
                {PLANS.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
          )}
          <div className="flex items-center gap-2">
            {perms.impersonate !== false && (
              <button onClick={openAccount} disabled={opening || banned}
                title={banned ? "Reactivate the account first" : "Sign in as this user (consumer dashboard)"}
                className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50">
                {opening ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />} Access account
              </button>
            )}
            {perms.suspend !== false && (banned ? (
              <button onClick={() => toggleBan(true)} disabled={banBusy}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-emerald-500/40 px-3 text-sm font-medium text-emerald-600 transition-colors hover:bg-emerald-500/10 disabled:opacity-50 dark:text-emerald-400">
                {banBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Reactivate
              </button>
            ) : (
              <button onClick={() => toggleBan(false)} disabled={banBusy}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-red-500/40 px-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400">
                {banBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />} Suspend
              </button>
            ))}
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
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {billing.stripe_customer_id && (
              <a href={`https://dashboard.stripe.com/customers/${String(billing.stripe_customer_id)}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                View in Stripe →
              </a>
            )}
            {perms.cancel_sub !== false && billing.stripe_subscription_id && billing.subscription_status !== "canceled" && (
              <button
                onClick={cancelSubscription}
                disabled={cancelBusy}
                title="Stops future renewals. The user keeps access until the end of the period they paid for (per the refund policy). No money is refunded."
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400"
              >
                {cancelBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                {cancelConfirm ? "Confirm — cancel at period end" : "Cancel subscription"}
              </button>
            )}
            {cancelMsg && <span className={cn("text-xs font-medium", cancelMsg.startsWith("✓") ? "text-emerald-500" : "text-red-400")}>{cancelMsg}</span>}
            {perms.plan_override !== false && (
              billing.dashboard_access_override ? (
                <button onClick={() => toggleDashboardAccess(false)} disabled={accessBusy}
                  title="This user can use the dashboard WITHOUT a subscription (grandfathered credits / comp). Click to remove the bypass."
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 disabled:opacity-50 dark:text-emerald-400">
                  {accessBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                  Dashboard access: bypass ON
                </button>
              ) : (
                <button onClick={() => toggleDashboardAccess(true)} disabled={accessBusy}
                  title="Let this user use the dashboard without a subscription (no card required) — for customers with purchased credits or comp accounts."
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50">
                  {accessBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                  Grant no-card dashboard access
                </button>
              )
            )}
          </div>
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
          {perms.grant_credits !== false && (
          <div className="rounded-xl border border-border bg-background/40 p-4">
            <p className="mb-2 text-sm font-medium">
              Grant credits
              {typeof perms.grant_allowance_today === "number" && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">({perms.grant_allowance_today.toLocaleString()} left today)</span>
              )}
            </p>
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
          )}

          {/* Money refund (exceptional) */}
          {perms.money_refund !== false && (
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
          )}
        </div>

        {actionMsg && <p className="mt-3 text-sm font-medium text-desyn-success">{actionMsg}</p>}

        {summary && summary.rows > 0 && (
          <div className="mt-4 rounded-xl border border-border bg-background/40 p-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Credit spend since signup</p>
              {summary.since && <span className="text-xs text-muted-foreground">since {new Date(summary.since).toLocaleDateString()} · {summary.rows} entries</span>}
            </div>
            <div className="mb-4 grid grid-cols-3 gap-3 text-center">
              <div><p className="text-lg font-bold tabular-nums text-desyn-success">+{summary.credited_total.toLocaleString()}</p><p className="text-[11px] text-muted-foreground">Total credited</p></div>
              <div><p className="text-lg font-bold tabular-nums text-foreground">−{summary.spent_total.toLocaleString()}</p><p className="text-[11px] text-muted-foreground">Total consumed</p></div>
              <div><p className="text-lg font-bold tabular-nums text-foreground">{tokens ? tokens.balance.toLocaleString() : "—"}</p><p className="text-[11px] text-muted-foreground">Balance now</p></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Consumed by feature</p>
                {summary.spend_by_feature.length === 0
                  ? <p className="text-xs text-muted-foreground">No spend yet.</p>
                  : <div className="space-y-1">{summary.spend_by_feature.map((s) => (
                      <div key={s.key} className="flex items-center justify-between gap-3 text-xs">
                        <span className="truncate text-muted-foreground">{ledgerLabel(s.key)}</span>
                        <span className="shrink-0 font-medium tabular-nums">{s.amount.toLocaleString()}</span>
                      </div>))}</div>}
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Credited by source</p>
                <div className="space-y-1">{summary.grants_in.map((g) => (
                  <div key={g.key} className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate text-muted-foreground">{ledgerLabel(g.key)}</span>
                    <span className="shrink-0 font-medium tabular-nums text-desyn-success">+{g.amount.toLocaleString()}</span>
                  </div>))}</div>
              </div>
            </div>
          </div>
        )}

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

      {/* Auto-Apply Outcomes */}
      {(() => {
        const aa = data.autoApply as {
          total: number; submitted: number; failed: number; manual_required: number; stuck: number; pending: number;
          recent: { id: string; job_id: string; platform: string; status: string; error_msg: string | null; created_at: string }[];
        } | undefined;
        if (!aa) return null;
        const STATUS_STYLE: Record<string, string> = {
          submitted: "bg-emerald-500/15 text-emerald-400", failed: "bg-red-500/15 text-red-400",
          manual_required: "bg-amber-500/15 text-amber-400", pending: "bg-blue-500/15 text-blue-400",
        };
        return (
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-3 font-semibold">Auto-Apply Outcomes</h2>
            {aa.total === 0 ? (
              <p className="text-sm text-muted-foreground">No automated application attempts on record.</p>
            ) : (
              <>
                <div className="mb-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
                  {[
                    ["Attempts", aa.total, "text-foreground"],
                    ["Submitted", aa.submitted, "text-emerald-400"],
                    ["Failed", aa.failed, "text-red-400"],
                    ["Manual req.", aa.manual_required, "text-amber-400"],
                    ["In progress", aa.pending, "text-blue-400"],
                    ["Stuck >1h", aa.stuck, "text-red-400"],
                  ].map(([label, val, color]) => (
                    <div key={String(label)} className="rounded-lg border border-border bg-background p-2.5 text-center">
                      <p className={cn("text-lg font-bold tabular-nums", color as string)}>{val as number}</p>
                      <p className="text-[10px] text-muted-foreground">{label as string}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-1">
                  {aa.recent.map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-3 text-xs">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize", STATUS_STYLE[a.status] ?? "bg-muted text-muted-foreground")}>{a.status.replace("_", " ")}</span>
                        <span className="truncate text-muted-foreground">{a.platform}{a.error_msg ? ` · ${a.error_msg}` : ""}</span>
                      </span>
                      <span className="shrink-0 text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-muted-foreground">Note: only Skyvern <em>launch</em> failures are auto-refunded; post-launch failures keep the 600 tokens. A “stuck” pending usually means the completion webhook never landed.</p>
              </>
            )}
          </div>
        );
      })()}

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

      {/* Danger zone — permanent deletion */}
      {perms.delete !== false && (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5">
        <h2 className="flex items-center gap-2 font-semibold text-red-500"><Trash2 className="h-4 w-4" /> Danger zone</h2>
        <p className="mt-1 mb-3 max-w-xl text-xs text-muted-foreground">
          Permanently delete this account and <strong className="text-foreground">all</strong> of its data — resumes,
          jobs, billing, inbox, files, and the login. This cannot be undone. You&apos;ll be asked to type the
          account&apos;s email to confirm.
        </p>
        <button
          onClick={deleteAccount}
          disabled={deleting}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
        >
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete account &amp; all data
        </button>
        {deleteMsg && <p className="mt-2 text-xs font-medium text-red-400">{deleteMsg}</p>}
      </div>
      )}
    </div>
  );
}
