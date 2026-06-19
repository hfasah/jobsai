"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2, Loader2, Plus, X, Sparkles, DollarSign, Users,
  CheckCircle2, Copy, Check, ExternalLink, ClipboardList, LogIn,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Org {
  id: string; name: string; slug: string; industry: string | null; plan_label: string;
  plan_name: string | null; plan_slug: string | null;
  access_status: string; has_subscription: boolean;
  status: string; onboarding_done: boolean; created_at: string;
  members: number; jobs: number; applicants: number; month_cost: number;
}

// Billing reality, derived from access_status (+ whether a Stripe sub exists).
// This is the source of truth for "who actually signed up / pays", separate
// from the manually-set plan.
const BILLING_META: Record<string, { label: string; dot: string; cls: string }> = {
  paid:      { label: "Paid",     dot: "bg-green-500",  cls: "border-green-500/30 bg-green-500/10 text-green-400" },
  active:    { label: "Active",   dot: "bg-green-500",  cls: "border-green-500/30 bg-green-500/10 text-green-400" },
  trial:     { label: "Trial",    dot: "bg-blue-500",   cls: "border-blue-500/30 bg-blue-500/10 text-blue-400" },
  comped:    { label: "Comped",   dot: "bg-violet-500", cls: "border-violet-500/30 bg-violet-500/10 text-violet-400" },
  pending:   { label: "Pending",  dot: "bg-muted-foreground", cls: "border-border bg-muted/40 text-muted-foreground" },
  past_due:  { label: "Past due", dot: "bg-amber-500",  cls: "border-amber-500/30 bg-amber-500/10 text-amber-400" },
  canceled:  { label: "Canceled", dot: "bg-red-500",    cls: "border-red-500/30 bg-red-500/10 text-red-400" },
};
function billingOf(o: Org): string {
  if (o.access_status === "active") return o.has_subscription ? "paid" : "active";
  if (o.access_status === "trialing") return "trial";
  return o.access_status in BILLING_META ? o.access_status : "pending";
}

export default function AdminEnterprise() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [templates, setTemplates] = useState<{ id: string; name: string; description: string }[]>([]);
  const [plans, setPlans] = useState<{ slug: string; name: string; price_monthly: number | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [planFilter, setPlanFilter] = useState<string>("");
  const [billingFilter, setBillingFilter] = useState<string>("");

  const load = () => {
    fetch("/api/admin/enterprise").then((r) => r.json()).then((j) => { setOrgs(j.data ?? []); setTemplates(j.templates ?? []); setPlans(j.plans ?? []); }).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const totalMonthCost = orgs.reduce((s, o) => s + o.month_cost, 0);

  // Plan distribution: count orgs per plan (by slug), plus an "unassigned" bucket.
  const planOf = (o: Org) => o.plan_slug ?? "unassigned";
  const planCount = (slug: string) => orgs.filter((o) => planOf(o) === slug).length;
  const billingCount = (key: string) => orgs.filter((o) => billingOf(o) === key).length;
  const visible = orgs.filter((o) =>
    (!planFilter || planOf(o) === planFilter) && (!billingFilter || billingOf(o) === billingFilter),
  );
  // Billing buckets present in the data, in a sensible order.
  const billingOrder = ["paid", "active", "trial", "comped", "past_due", "pending", "canceled"];
  const billingPresent = billingOrder.filter((k) => billingCount(k) > 0);

  // Inline plan change from the list — re-tier an org without opening Manage.
  const [savingPlan, setSavingPlan] = useState<string | null>(null);
  const changePlan = async (orgId: string, plan_slug: string) => {
    setSavingPlan(orgId);
    const res = await fetch(`/api/admin/enterprise/${orgId}/features`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan_slug }),
    });
    setSavingPlan(null);
    if (res.ok) load();
    else alert("Couldn't change plan.");
  };

  // Super-admin "Open workspace": enter any org's workspace directly (demos).
  const openWorkspace = async (orgId: string) => {
    const res = await fetch("/api/admin/enterprise/impersonate", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ org_id: orgId }),
    });
    if (res.ok) window.location.assign("/enterprise/dashboard");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Enterprise Accounts</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage enterprise orgs, monitor LLM cost, and create new accounts.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/enterprise/intake" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted">
            <ClipboardList className="h-4 w-4" /> Intake leads
          </Link>
          <button onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-4 py-2 text-sm font-semibold text-white shadow-glow">
            <Plus className="h-4 w-4" /> Create enterprise account
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Enterprise orgs", value: orgs.length, icon: Building2 },
          { label: "LLM cost this month", value: `$${totalMonthCost.toFixed(2)}`, icon: DollarSign },
          { label: "Total applicants", value: orgs.reduce((s, o) => s + o.applicants, 0), icon: Users },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-muted-foreground"><Icon className="h-4 w-4" /><span className="text-xs">{label}</span></div>
            <p className="mt-1.5 text-2xl font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {/* Plan distribution — click a plan to filter the list */}
      {!loading && orgs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Plans:</span>
          <button onClick={() => setPlanFilter("")}
            className={cn("rounded-full border px-3 py-1 text-xs font-medium", planFilter === "" ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted")}>
            All <span className="tabular-nums opacity-70">{orgs.length}</span>
          </button>
          {plans.map((p) => (
            <button key={p.slug} onClick={() => setPlanFilter(p.slug)}
              className={cn("rounded-full border px-3 py-1 text-xs font-medium", planFilter === p.slug ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted")}>
              {p.name} <span className="tabular-nums opacity-70">{planCount(p.slug)}</span>
            </button>
          ))}
          {planCount("unassigned") > 0 && (
            <button onClick={() => setPlanFilter("unassigned")}
              className={cn("rounded-full border px-3 py-1 text-xs font-medium", planFilter === "unassigned" ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted")}>
              No plan <span className="tabular-nums opacity-70">{planCount("unassigned")}</span>
            </button>
          )}
        </div>
      )}

      {/* Billing reality — click to filter to who's actually paying / on trial / comped */}
      {!loading && orgs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Billing:</span>
          <button onClick={() => setBillingFilter("")}
            className={cn("rounded-full border px-3 py-1 text-xs font-medium", billingFilter === "" ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted")}>
            All <span className="tabular-nums opacity-70">{orgs.length}</span>
          </button>
          {billingPresent.map((k) => (
            <button key={k} onClick={() => setBillingFilter(k)}
              className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium", billingFilter === k ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted")}>
              <span className={cn("h-1.5 w-1.5 rounded-full", BILLING_META[k].dot)} />
              {BILLING_META[k].label} <span className="tabular-nums opacity-70">{billingCount(k)}</span>
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex h-40 items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading…</div>
      ) : orgs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center">
          <Building2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="font-semibold">No enterprise accounts yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Create one from a template to get started.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>{["Organization", "Plan", "Billing", "Members", "Jobs", "Applicants", "LLM / mo", "Created", "Status", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-muted-foreground">No orgs match this filter.</td></tr>
              ) : visible.map((o) => (
                <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3"><p className="font-medium">{o.name}</p><p className="text-xs text-muted-foreground">{o.industry ?? "—"}</p></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <select value={o.plan_slug ?? ""} disabled={savingPlan === o.id}
                        onChange={(e) => changePlan(o.id, e.target.value)}
                        className="rounded-lg border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50">
                        {!o.plan_slug && <option value="">— no plan —</option>}
                        {plans.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
                      </select>
                      {savingPlan === o.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {(() => { const b = BILLING_META[billingOf(o)]; return (
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium", b.cls)}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", b.dot)} /> {b.label}
                      </span>
                    ); })()}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{o.members}</td>
                  <td className="px-4 py-3 tabular-nums">{o.jobs}</td>
                  <td className="px-4 py-3 tabular-nums">{o.applicants}</td>
                  <td className="px-4 py-3 tabular-nums font-medium">${o.month_cost.toFixed(2)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize",
                      o.status === "suspended" ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-green-500/30 bg-green-500/10 text-green-400")}>{o.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openWorkspace(o.id)} title="Enter this workspace as admin" className="inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20">Open <LogIn className="h-3 w-3" /></button>
                      <Link href={`/admin/enterprise/${o.id}`} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-muted">Manage <ExternalLink className="h-3 w-3" /></Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && <CreateModal templates={templates} plans={plans} onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); setLoading(true); load(); }} />}
    </div>
  );
}

function CreateModal({ templates, plans, onClose, onCreated }: { templates: { id: string; name: string; description: string }[]; plans: { slug: string; name: string; price_monthly: number | null }[]; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: "", owner_email: "", contact_name: "", contact_phone: "", industry: "", template: templates[0]?.id ?? "general", plan_slug: "professional", access_status: "trialing", admin_notes: "" });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ onboarding_steps: string[]; invite_url: string | null } | null>(null);
  const [copied, setCopied] = useState(false);
  // Demo account = Enterprise plan, comped (free forever), every add-on granted.
  const [demo, setDemo] = useState(false);

  const create = async () => {
    if (!form.name.trim()) { setError("Company name is required."); return; }
    setCreating(true); setError("");
    const payload = demo ? { ...form, plan_slug: "enterprise", access_status: "comped", grant_all_addons: true } : form;
    const res = await fetch("/api/admin/enterprise", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? "Failed."); setCreating(false); return; }
    setResult({ onboarding_steps: json.data.onboarding_steps, invite_url: json.data.invite_url });
    setCreating(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold"><Building2 className="h-5 w-5 text-primary" /> {result ? "Account created" : "Create enterprise account"}</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground hover:text-foreground" /></button>
        </div>

        {result ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
              <CheckCircle2 className="h-4 w-4" /> Workspace created{result.invite_url ? " and owner invited by email." : "."}
            </div>
            {result.invite_url && (
              <div>
                <p className="mb-1.5 text-sm font-medium">Owner invite link</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 overflow-x-auto rounded-lg border border-border bg-background px-3 py-2 text-xs">{result.invite_url}</code>
                  <button onClick={() => { navigator.clipboard.writeText(result.invite_url!); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="rounded-lg border border-border p-2 hover:bg-muted">{copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}</button>
                </div>
              </div>
            )}
            <div>
              <p className="mb-1.5 text-sm font-medium">Onboarding steps to share with the client</p>
              <ol className="space-y-1.5 rounded-xl border border-border bg-background/40 p-4 text-sm text-muted-foreground">
                {result.onboarding_steps.map((s, i) => <li key={i} className="flex gap-2"><span className="font-semibold text-foreground">{i + 1}.</span> {s}</li>)}
              </ol>
            </div>
            <button onClick={onCreated} className="btn-cta w-full rounded-xl py-2.5 text-sm font-semibold">Done</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Company name *</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Acme Corp"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Contact name</label>
                <input value={form.contact_name} onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))} placeholder="Jane Doe"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Contact phone</label>
                <input value={form.contact_phone} onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))} placeholder="(optional)"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Owner email <span className="text-muted-foreground">(becomes primary contact + gets the invite)</span></label>
              <input value={form.owner_email} onChange={(e) => setForm((f) => ({ ...f, owner_email: e.target.value }))} type="email" placeholder="owner@acme.com"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Template</label>
              <div className="grid gap-2 sm:grid-cols-2">
                {templates.map((t) => (
                  <button key={t.id} onClick={() => setForm((f) => ({ ...f, template: t.id }))}
                    className={cn("rounded-xl border p-3 text-left transition-colors", form.template === t.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted")}>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{t.description}</p>
                  </button>
                ))}
              </div>
            </div>
            <label className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors", demo ? "border-primary bg-primary/5" : "border-border hover:bg-muted")}>
              <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} className="mt-0.5 h-4 w-4" />
              <span>
                <span className="block text-sm font-medium">🎬 Demo account — everything on</span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">Enterprise plan, comped (free forever), and all add-ons (AI interviews, recruiting agent, SMS/WhatsApp, white-label) granted — for showing clients the full platform.</span>
              </span>
            </label>
            <div className={cn("grid gap-3 sm:grid-cols-2", demo && "pointer-events-none opacity-50")}>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Plan</label>
                <select value={demo ? "enterprise" : form.plan_slug} disabled={demo} onChange={(e) => setForm((f) => ({ ...f, plan_slug: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  {plans.map((p) => (
                    <option key={p.slug} value={p.slug}>{p.name}{p.price_monthly != null ? ` — $${p.price_monthly}/mo` : " — Custom"}</option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-muted-foreground">Sets the account&apos;s feature entitlements.</p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Billing</label>
                <select value={demo ? "comped" : form.access_status} disabled={demo} onChange={(e) => setForm((f) => ({ ...f, access_status: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="trialing">14-day trial</option>
                  <option value="comped">Free (comped — no billing)</option>
                </select>
                <p className="mt-1 text-[11px] text-muted-foreground">{(demo || form.access_status === "comped") ? "Free access indefinitely." : "Full access for 14 days, then must subscribe."}</p>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Industry</label>
              <input value={form.industry} onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))} placeholder="(optional)"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Admin notes / custom requests</label>
              <textarea value={form.admin_notes} onChange={(e) => setForm((f) => ({ ...f, admin_notes: e.target.value }))} rows={2} placeholder="Client-specific customizations, contract terms…"
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button onClick={create} disabled={creating} className="btn-cta inline-flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Create from {templates.find((t) => t.id === form.template)?.name ?? "template"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
