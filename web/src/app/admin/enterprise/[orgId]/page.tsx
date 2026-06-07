"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Loader2, DollarSign, Cpu, Save, Check, ExternalLink, Power, CheckCircle2,
  Copy, KeyRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

function CustomLink({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "https://www.jobsai.work";
  const link = `${origin}/e/${slug}`;
  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
      <h2 className="mb-1 flex items-center gap-2 font-semibold"><KeyRound className="h-4 w-4 text-primary" /> Enterprise login link</h2>
      <p className="mb-3 text-sm text-muted-foreground">Send this to the client. It always takes them straight into their workspace (never the job-seeker account), on any device.</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 overflow-x-auto rounded-lg border border-border bg-background px-3 py-2 text-sm">{link}</code>
        <button onClick={() => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="btn-cta inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
        </button>
        <a href={link} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-border p-2 hover:bg-muted"><ExternalLink className="h-4 w-4" /></a>
      </div>
    </div>
  );
}

interface Detail {
  org: { id: string; name: string; slug: string; industry: string | null; plan_label: string; status: string; onboarding_done: boolean; admin_notes: string | null; created_at: string;
    contact_name: string | null; contact_email: string | null; contact_phone: string | null;
    contact2_name: string | null; contact2_email: string | null; contact2_phone: string | null };
  members: { user_id: string; role: string; created_at: string; name: string; email: string; image_url: string | null }[];
  jobs: number; applicants: number;
  llm: {
    total_cost: number; total_calls: number; total_tokens: number;
    by_feature: { feature: string; calls: number; cost: number; tokens: number }[];
    by_day: { date: string; cost: number }[];
  };
}

export default function AdminOrgDetail({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = use(params);
  const [d, setD] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [planLabel, setPlanLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [contacts, setContacts] = useState({ contact_name: "", contact_email: "", contact_phone: "", contact2_name: "", contact2_email: "", contact2_phone: "" });
  const [contactsSaved, setContactsSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/enterprise/${orgId}`).then((r) => r.json()).then((j) => {
      if (j.data) {
        setD(j.data); setNotes(j.data.org.admin_notes ?? ""); setPlanLabel(j.data.org.plan_label ?? "Enterprise");
        const o = j.data.org;
        setContacts({ contact_name: o.contact_name ?? "", contact_email: o.contact_email ?? "", contact_phone: o.contact_phone ?? "", contact2_name: o.contact2_name ?? "", contact2_email: o.contact2_email ?? "", contact2_phone: o.contact2_phone ?? "" });
      }
    }).finally(() => setLoading(false));
  }, [orgId]);

  const update = async (patch: Record<string, unknown>) => {
    setSaving(true); setSaved(false);
    const res = await fetch(`/api/admin/enterprise/${orgId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); const j = await res.json(); setD((prev) => prev ? { ...prev, org: { ...prev.org, ...j.data } } : prev); }
    setSaving(false);
  };

  if (loading) return <div className="flex h-40 items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading…</div>;
  if (!d) return <p className="text-muted-foreground">Org not found.</p>;

  const maxDay = Math.max(...d.llm.by_day.map((x) => x.cost), 0.0001);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/enterprise" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><ArrowLeft className="h-4 w-4" /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{d.org.name}</h1>
          <p className="text-sm text-muted-foreground">{d.org.industry ?? "—"} · {d.members.length} members · {d.jobs} jobs · {d.applicants} applicants · Created {new Date(d.org.created_at).toLocaleDateString()}</p>
        </div>
        <Link href={`/careers/${d.org.slug}`} target="_blank" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted">
          <ExternalLink className="h-3.5 w-3.5" /> Careers page
        </Link>
        <button onClick={() => update({ status: d.org.status === "active" ? "suspended" : "active" })}
          className={cn("inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium",
            d.org.status === "active" ? "border-red-500/30 text-red-400 hover:bg-red-500/10" : "border-green-500/30 text-green-400 hover:bg-green-500/10")}>
          <Power className="h-3.5 w-3.5" /> {d.org.status === "active" ? "Suspend" : "Reactivate"}
        </button>
      </div>

      {/* Custom login link */}
      <CustomLink slug={d.org.slug} />

      {/* Contacts & members */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Account contacts (admin-managed) */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 font-semibold">Account contacts</h2>
          <div className="space-y-3">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Primary contact</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <input value={contacts.contact_name} onChange={(e) => setContacts((c) => ({ ...c, contact_name: e.target.value }))} placeholder="Name" className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                <input value={contacts.contact_email} onChange={(e) => setContacts((c) => ({ ...c, contact_email: e.target.value }))} placeholder="Email" className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                <input value={contacts.contact_phone} onChange={(e) => setContacts((c) => ({ ...c, contact_phone: e.target.value }))} placeholder="Phone" className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Secondary contact</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <input value={contacts.contact2_name} onChange={(e) => setContacts((c) => ({ ...c, contact2_name: e.target.value }))} placeholder="Name" className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                <input value={contacts.contact2_email} onChange={(e) => setContacts((c) => ({ ...c, contact2_email: e.target.value }))} placeholder="Email" className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                <input value={contacts.contact2_phone} onChange={(e) => setContacts((c) => ({ ...c, contact2_phone: e.target.value }))} placeholder="Phone" className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>
            <button onClick={async () => { await update(contacts); setContactsSaved(true); setTimeout(() => setContactsSaved(false), 2000); }}
              className="btn-cta inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold">
              {contactsSaved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />} {contactsSaved ? "Saved" : "Save contacts"}
            </button>
          </div>
        </div>

        {/* Workspace members (the actual people signed in) */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="border-b border-border px-5 py-3.5"><h2 className="font-semibold">Workspace members ({d.members.length})</h2></div>
          {d.members.length === 0 ? <p className="px-5 py-6 text-sm text-muted-foreground">No one has joined the workspace yet.</p> : (
            <div className="divide-y divide-border">
              {d.members.map((m) => (
                <div key={m.user_id} className="flex items-center gap-3 px-5 py-3">
                  {m.image_url ? <img src={m.image_url} alt={m.name} className="h-8 w-8 rounded-full" /> : <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">{(m.name || "?").charAt(0).toUpperCase()}</div>}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                  </div>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium capitalize">{m.role}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* LLM cost */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total LLM cost", value: `$${d.llm.total_cost.toFixed(3)}`, icon: DollarSign },
          { label: "AI calls", value: d.llm.total_calls.toLocaleString(), icon: Cpu },
          { label: "Tokens", value: d.llm.total_tokens.toLocaleString(), icon: Cpu },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-muted-foreground"><Icon className="h-4 w-4" /><span className="text-xs">{label}</span></div>
            <p className="mt-1.5 text-2xl font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Cost by feature */}
        <div className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-5 py-3.5"><h2 className="font-semibold">LLM cost by feature</h2></div>
          {d.llm.by_feature.length === 0 ? <p className="px-5 py-6 text-sm text-muted-foreground">No AI usage yet.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-5 py-2 font-medium">Feature</th><th className="py-2 font-medium">Calls</th><th className="py-2 font-medium">Tokens</th><th className="px-5 py-2 text-right font-medium">Cost</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {d.llm.by_feature.map((f) => (
                  <tr key={f.feature}>
                    <td className="px-5 py-2 font-medium capitalize">{f.feature.replace(/_/g, " ")}</td>
                    <td className="py-2 tabular-nums">{f.calls}</td>
                    <td className="py-2 tabular-nums text-muted-foreground">{f.tokens.toLocaleString()}</td>
                    <td className="px-5 py-2 text-right tabular-nums font-medium">${f.cost.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Daily cost */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 font-semibold">LLM cost — last 30 days</h2>
          {d.llm.by_day.length === 0 ? <p className="text-sm text-muted-foreground">No usage in the last 30 days.</p> : (
            <div className="flex h-28 items-end gap-1">
              {d.llm.by_day.map((x) => (
                <div key={x.date} className="group flex flex-1 flex-col items-center gap-1">
                  <div className="relative w-full">
                    <div className="hidden group-hover:block absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[10px] text-background">${x.cost.toFixed(3)} · {x.date.slice(5)}</div>
                  </div>
                  <div className="w-full rounded-t bg-primary/60 hover:bg-primary" style={{ height: `${Math.max(4, (x.cost / maxDay) * 100)}%` }} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Support / management */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h2 className="font-semibold">Account management & support</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Plan label</label>
            <div className="flex gap-2">
              <input value={planLabel} onChange={(e) => setPlanLabel(e.target.value)} className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              <button onClick={() => update({ plan_label: planLabel })} className="rounded-lg border border-border px-3 text-sm hover:bg-muted">Set</button>
            </div>
          </div>
          <div className="flex items-end">
            <label className="flex cursor-pointer items-center gap-2.5">
              <input type="checkbox" checked={d.org.onboarding_done} onChange={(e) => update({ onboarding_done: e.target.checked })} className="h-4 w-4 rounded border-border accent-primary" />
              <span className="text-sm">Onboarding completed</span>
            </label>
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Admin notes / custom requests</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Client-specific code customizations, contract terms, support history…"
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <button onClick={() => update({ admin_notes: notes })} disabled={saving}
            className="btn-cta mt-2 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saved ? "Saved" : "Save notes"}
          </button>
        </div>
      </div>
    </div>
  );
}
