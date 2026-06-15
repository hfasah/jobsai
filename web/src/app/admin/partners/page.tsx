"use client";

import { useEffect, useState, useCallback } from "react";
import { Handshake, Loader2, Sparkles, Banknote, Clock, CheckCircle2, ExternalLink, Plus, X, Copy, Check, Mail } from "lucide-react";
import { PARTNER_AUDIENCE_TYPES } from "@/lib/enterprise-partners";

type Stats = {
  referrals: number;
  payingCustomers: number;
  lifetimeEarnedCents: number;
  paidCents: number;
  availableCents: number;
  pendingCents: number;
};
type Partner = {
  id: string;
  company_name: string | null;
  email: string | null;
  website: string | null;
  audience_type: string | null;
  referral_code: string;
  portal_token: string | null;
  tier: string;
  commission_rate: number;
  status: string;
  is_founding: boolean;
  payout_method: string | null;
  payout_email: string | null;
  created_at: string;
  stats: Stats;
};

const usd = (c: number) => `$${(c / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ORIGIN = typeof window !== "undefined" ? window.location.origin : "https://app.jobsai.work";

// Small chip that copies a link (referral or dashboard) to the clipboard.
function CopyChip({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };
  return (
    <button onClick={copy} title={url}
      className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted/70">
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />} {copied ? "Copied" : label}
    </button>
  );
}

export default function AdminPartners() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(() => {
    fetch("/api/admin/partners")
      .then((r) => r.json())
      .then((j) => setPartners(j.data ?? []))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const patch = async (id: string, body: Record<string, unknown>) => {
    setBusy(id);
    try {
      const r = await fetch("/api/admin/partners", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      if (!r.ok) alert((await r.json().catch(() => ({}))).error ?? "Update failed.");
      load();
    } finally {
      setBusy(null);
    }
  };

  const markPaid = async (p: Partner) => {
    const method = prompt(`Payout method for ${p.company_name || p.email} (paypal / wise / bank / manual):`, p.payout_method || "paypal");
    if (method === null) return;
    const reference = prompt("Reference / transaction id (optional):", "") ?? "";
    setBusy(p.id);
    try {
      const r = await fetch("/api/admin/partners/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partner_id: p.id, method, reference }),
      });
      const j = await r.json();
      if (!r.ok) alert(j.error ?? "Payout failed.");
      else alert(`Marked ${usd(j.data.amountCents)} paid across ${j.data.commissionCount} commission(s).`);
      load();
    } finally {
      setBusy(null);
    }
  };

  const totalAvailable = partners.reduce((s, p) => s + p.stats.availableCents, 0);
  const totalPaid = partners.reduce((s, p) => s + p.stats.paidCents, 0);
  const pending = partners.filter((p) => p.status === "pending");
  const payable = partners.filter((p) => p.status === "active" && p.stats.availableCents > 0);

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Handshake className="h-6 w-6 text-primary" /> Partners</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create &amp; approve partners, adjust commission, and process payouts.</p>
        </div>
        <button onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-4 py-2 text-sm font-semibold text-white shadow-glow">
          <Plus className="h-4 w-4" /> Invite partner
        </button>
      </div>

      {createOpen && <CreatePartnerModal onClose={() => setCreateOpen(false)} onCreated={load} />}

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Partners", value: String(partners.length), icon: Handshake },
          { label: "Pending approval", value: String(pending.length), icon: Clock },
          { label: "Available to pay", value: usd(totalAvailable), icon: Banknote, hl: true },
          { label: "Paid out (lifetime)", value: usd(totalPaid), icon: CheckCircle2 },
        ].map(({ label, value, icon: Icon, hl }) => (
          <div key={label} className={`rounded-2xl border bg-card p-5 ${hl ? "border-primary/40" : "border-border"}`}>
            <div className="flex items-center gap-2 text-muted-foreground"><Icon className="h-4 w-4" /><span className="text-xs">{label}</span></div>
            <p className={`mt-1.5 text-2xl font-bold tabular-nums ${hl ? "text-primary" : ""}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Payout queue */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-1 font-semibold">Payout queue</h2>
        <p className="mb-4 text-sm text-muted-foreground">Active partners with cleared balances (past the 2-month hold). Pay via PayPal/Wise/bank, then mark paid.</p>
        {payable.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing cleared to pay right now.</p>
        ) : (
          <div className="space-y-2">
            {payable.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3">
                <div>
                  <p className="font-semibold">{p.company_name || p.email}</p>
                  <p className="text-xs text-muted-foreground">{p.payout_method ? `${p.payout_method}${p.payout_email ? ` · ${p.payout_email}` : ""}` : "No payout method on file"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-primary">{usd(p.stats.availableCents)}</span>
                  <button onClick={() => markPaid(p)} disabled={busy === p.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                    {busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />} Mark paid
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* All partners */}
      <section className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 font-semibold">Partner</th>
              <th className="px-4 py-3 font-semibold">Audience</th>
              <th className="px-4 py-3 font-semibold">Rate</th>
              <th className="px-4 py-3 font-semibold">Referrals</th>
              <th className="px-4 py-3 font-semibold">Earned</th>
              <th className="px-4 py-3 font-semibold">Available</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {partners.map((p) => (
              <tr key={p.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 font-semibold">
                    {p.company_name || "—"}
                    {p.is_founding && <Sparkles className="h-3.5 w-3.5 text-primary" />}
                  </div>
                  <div className="text-xs text-muted-foreground">{p.email}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <a href={`${ORIGIN}/partner/${p.referral_code}`} target="_blank" rel="noreferrer"
                      className="font-mono text-[11px] text-primary hover:underline" title="Referral link">
                      {ORIGIN.replace(/^https?:\/\//, "")}/partner/{p.referral_code}
                    </a>
                    {p.website && <a href={p.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"><ExternalLink className="h-3 w-3" /></a>}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <CopyChip label="Copy referral link" url={`${ORIGIN}/partner/${p.referral_code}`} />
                    {p.portal_token && <CopyChip label="Copy dashboard link" url={`${ORIGIN}/enterprise/partners/portal/${p.portal_token}`} />}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{p.audience_type || "—"}</td>
                <td className="px-4 py-3">
                  <input type="number" defaultValue={p.commission_rate} min={0} max={100}
                    onBlur={(e) => { const v = Number(e.target.value); if (v !== p.commission_rate) patch(p.id, { commission_rate: v }); }}
                    className="w-16 rounded border border-border bg-background px-2 py-1 text-sm" />%
                </td>
                <td className="px-4 py-3 text-muted-foreground">{p.stats.referrals} <span className="text-xs">({p.stats.payingCustomers} paying)</span></td>
                <td className="px-4 py-3 tabular-nums">{usd(p.stats.lifetimeEarnedCents)}</td>
                <td className="px-4 py-3 tabular-nums font-semibold text-primary">{usd(p.stats.availableCents)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                    p.status === "active" ? "bg-emerald-100 text-emerald-700"
                    : p.status === "pending" ? "bg-amber-100 text-amber-700"
                    : "bg-muted text-muted-foreground"}`}>{p.status}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {p.status !== "active" && (
                      <button onClick={() => patch(p.id, { status: "active" })} disabled={busy === p.id}
                        className="rounded-lg border border-emerald-300 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60">Approve</button>
                    )}
                    {p.status !== "suspended" && (
                      <button onClick={() => patch(p.id, { status: "suspended" })} disabled={busy === p.id}
                        className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-60">Suspend</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {partners.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No partners yet.</p>}
      </section>
    </div>
  );
}

type Created = { acceptLink: string; emailed: boolean };

function CreatePartnerModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", company_name: "", audience_type: "", website: "", commission_rate: "", is_founding: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState(false);
  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/admin/partners", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          commission_rate: form.commission_rate === "" ? null : Number(form.commission_rate),
        }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "Could not send invitation."); return; }
      setCreated({ acceptLink: j.data.acceptLink, emailed: j.data.emailed });
      onCreated();
    } finally { setBusy(false); }
  };

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };

  const input = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{created ? "Invitation sent" : "Invite a partner"}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        {created ? (
          <div className="space-y-4">
            <p className="flex items-center gap-2 text-sm text-emerald-600">
              {created.emailed ? <><Mail className="h-4 w-4" /> Invitation emailed. They&apos;re <strong>pending</strong> until they accept.</> : <>Created (pending), but the email didn&apos;t send — share this invite link:</>}
            </p>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Invitation link</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-lg border border-border bg-background px-3 py-2 text-xs">{created.acceptLink}</code>
                <button onClick={() => copy(created.acceptLink)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-2 text-xs font-semibold hover:bg-muted">
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            <button onClick={onClose} className="w-full rounded-xl bg-gradient-brand px-5 py-2.5 text-sm font-semibold text-white">Done</button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="mb-1.5 block text-sm font-medium">Name</label><input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Sarah Lee" className={input} /></div>
              <div><label className="mb-1.5 block text-sm font-medium">Email *</label><input value={form.email} onChange={(e) => set("email", e.target.value)} type="email" placeholder="sarah@email.com" className={input} /></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="mb-1.5 block text-sm font-medium">Company</label><input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} placeholder="Acme Advisory" className={input} /></div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Audience type</label>
                <select value={form.audience_type} onChange={(e) => set("audience_type", e.target.value)} className={input}>
                  <option value="">Select…</option>
                  {PARTNER_AUDIENCE_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="mb-1.5 block text-sm font-medium">Website / LinkedIn</label><input value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://…" className={input} /></div>
              <div><label className="mb-1.5 block text-sm font-medium">Commission rate %</label><input value={form.commission_rate} onChange={(e) => set("commission_rate", e.target.value)} type="number" min={0} max={100} placeholder="auto (20 / 25)" className={input} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_founding} onChange={(e) => set("is_founding", e.target.checked)} /> Mark as Founding Partner
            </label>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button onClick={submit} disabled={busy || !form.email.includes("@")}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Send invitation
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
