"use client";

// Sending infrastructure: org sending domains (DNS wizard) + mailboxes with
// ramp-up state and deliverability health. Deliverability state is meant to
// be impossible to miss — status badges everywhere, pause reasons explicit.
import { useCallback, useEffect, useState } from "react";
import {
  Check, ClipboardCopy, Globe, Loader2, Mail, Pause, Play, Plus,
  RefreshCw, Send, ShieldCheck, Trash2, TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DnsRecord { record: string; name: string; type: string; value: string; status?: string; priority?: number }
interface DomainRow { id: string; domain: string; status: string; records: DnsRecord[]; verified_at: string | null }
interface MailboxHealth {
  effective_daily_limit: number; sends_today: number; remaining_today: number;
  sends_7d: number; bounces_7d: number; complaints_7d: number; bounce_rate_7d: number;
  ramp_day: number; ramp_complete: boolean;
}
interface MailboxRow {
  id: string; kind: string; address: string; display_name: string | null;
  status: "active" | "paused"; paused_reason: string | null; daily_limit_cap: number;
  health: MailboxHealth;
}

const DOMAIN_BADGE: Record<string, string> = {
  verified: "border-green-500/30 bg-green-500/10 text-green-400",
  partially_verified: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  not_started: "border-border bg-muted/30 text-muted-foreground",
  partially_failed: "border-red-500/30 bg-red-500/10 text-red-400",
  failed: "border-red-500/30 bg-red-500/10 text-red-400",
};

const PAUSE_LABELS: Record<string, string> = {
  bounce_rate: "Auto-paused: bounce rate too high",
  complaint_rate: "Auto-paused: spam complaints",
  manual: "Paused manually",
  domain_unverified: "Domain not verified",
};

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="rounded p-1 text-muted-foreground hover:text-foreground"
      aria-label="Copy"
    >
      {copied ? <Check className="h-3 w-3 text-green-400" /> : <ClipboardCopy className="h-3 w-3" />}
    </button>
  );
}

interface ConnectableAccount { provider: string; kind: string; email: string; registered: boolean }

export default function SendingPage() {
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [mailboxes, setMailboxes] = useState<MailboxRow[]>([]);
  const [connectable, setConnectable] = useState<ConnectableAccount[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newDomain, setNewDomain] = useState("");
  const [addingDomain, setAddingDomain] = useState(false);
  const [newAddress, setNewAddress] = useState("");
  const [addingMailbox, setAddingMailbox] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openDomain, setOpenDomain] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [d, m, c] = await Promise.all([
      fetch("/api/enterprise/outreach/domains").then((r) => r.json()).catch(() => null),
      fetch("/api/enterprise/outreach/mailboxes").then((r) => r.json()).catch(() => null),
      fetch("/api/enterprise/outreach/mailboxes/connect").then((r) => r.json()).catch(() => null),
    ]);
    if (d?.data) setDomains(d.data);
    if (m?.data) setMailboxes(m.data);
    if (c?.data) setConnectable(c.data);
    setLoading(false);
  }, []);

  const connectMailbox = async (provider: string) => {
    setConnecting(provider);
    setError(null);
    try {
      const res = await fetch("/api/enterprise/outreach/mailboxes/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Could not add the mailbox."); return; }
      await load();
    } finally {
      setConnecting(null);
    }
  };

  useEffect(() => { load(); }, [load]);

  const addDomain = async () => {
    if (!newDomain.trim()) return;
    setAddingDomain(true);
    setError(null);
    try {
      const res = await fetch("/api/enterprise/outreach/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: newDomain.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Could not add the domain."); return; }
      setNewDomain("");
      setOpenDomain(json.data.id);
      await load();
    } finally {
      setAddingDomain(false);
    }
  };

  const domainAction = async (id: string, method: "GET" | "POST" | "DELETE") => {
    setBusyId(id);
    try {
      await fetch(`/api/enterprise/outreach/domains/${id}`, { method });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const addMailbox = async () => {
    if (!newAddress.trim()) return;
    setAddingMailbox(true);
    setError(null);
    try {
      const res = await fetch("/api/enterprise/outreach/mailboxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: newAddress.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Could not add the mailbox."); return; }
      setNewAddress("");
      await load();
    } finally {
      setAddingMailbox(false);
    }
  };

  const mailboxAction = async (id: string, body: Record<string, unknown>) => {
    setBusyId(id);
    try {
      await fetch(`/api/enterprise/outreach/mailboxes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Send className="h-6 w-6 text-primary" /> Sending
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your own sending domains and mailboxes for outreach. New mailboxes ramp up gradually and
          pause automatically if bounces or complaints spike — that&apos;s what keeps you out of spam folders.
        </p>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <TriangleAlert className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {/* Send from your own inbox — the easy path (no DNS) */}
        <section className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Mail className="h-4 w-4 text-primary" /> Send from your own inbox
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            The simplest way to start: send campaigns straight from your connected Gmail or Outlook.
            No DNS setup, and replies land right back in your inbox. Best for lower volume
            (~a few hundred/day); use a sending domain below for high-volume cold outreach.
          </p>

          <div className="mt-3 space-y-2">
            {connectable.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                No mailbox connected yet. Connect your Google or Microsoft account under{" "}
                <a href="/enterprise/settings" className="font-medium text-primary hover:underline">Settings → Integrations</a>, then come back to send from it.
              </p>
            ) : (
              connectable.map((a) => (
                <div key={a.email} className="flex items-center gap-2 rounded-xl border border-border/60 bg-background px-3 py-2.5">
                  <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.email}</p>
                    <p className="text-[11px] text-muted-foreground">{a.provider === "google" ? "Gmail" : "Outlook / Microsoft 365"}</p>
                  </div>
                  {a.registered ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-1 text-[11px] font-medium text-green-400">
                      <Check className="h-3 w-3" /> Sending from this inbox
                    </span>
                  ) : (
                    <button
                      onClick={() => connectMailbox(a.provider)}
                      disabled={connecting === a.provider}
                      className="btn-cta inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                    >
                      {connecting === a.provider ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Use as sender
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        {/* Domains */}
        <section className="mt-6 rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <Globe className="h-4 w-4 text-primary" /> Sending domains
          </h2>

          <div className="mb-4 flex gap-2">
            <input
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addDomain()}
              placeholder="e.g. talent.yourcompany.com"
              className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={addDomain}
              disabled={addingDomain || !newDomain.trim()}
              className="btn-cta inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {addingDomain ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add domain
            </button>
          </div>
          <p className="mb-3 text-[11px] text-muted-foreground">
            Tip: use a subdomain (talent.yourcompany.com), not your root domain — it isolates outreach reputation from your company email.
          </p>

          {domains.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
              No sending domains yet. Add one to send outreach from your own brand.
            </p>
          ) : (
            <div className="space-y-2">
              {domains.map((d) => (
                <div key={d.id} className="rounded-xl border border-border/60">
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <button onClick={() => setOpenDomain(openDomain === d.id ? null : d.id)} className="flex flex-1 items-center gap-2 text-left">
                      <span className="text-sm font-medium">{d.domain}</span>
                      <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", DOMAIN_BADGE[d.status] ?? DOMAIN_BADGE.not_started)}>
                        {d.status.replace(/_/g, " ")}
                      </span>
                    </button>
                    <span className="flex items-center gap-1">
                      {busyId === d.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      ) : (
                        <>
                          <button title="Refresh status" onClick={() => domainAction(d.id, "GET")} className="rounded p-1.5 text-muted-foreground hover:text-foreground">
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>
                          {d.status !== "verified" && (
                            <button
                              title="Verify DNS"
                              onClick={() => domainAction(d.id, "POST")}
                              className="inline-flex items-center gap-1 rounded-lg border border-primary/40 px-2 py-1 text-[11px] font-medium text-primary"
                            >
                              <ShieldCheck className="h-3 w-3" /> Verify
                            </button>
                          )}
                          <button title="Remove" onClick={() => domainAction(d.id, "DELETE")} className="rounded p-1.5 text-muted-foreground/60 hover:text-red-400">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </span>
                  </div>

                  {openDomain === d.id && (d.records?.length ?? 0) > 0 && (
                    <div className="border-t border-border/60 px-3 py-2.5">
                      <p className="mb-2 text-[11px] text-muted-foreground">
                        Add these records at your DNS provider, then hit Verify. Propagation can take a few minutes.
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[560px] text-left text-xs">
                          <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            <tr>
                              <th className="py-1 pr-2">Purpose</th>
                              <th className="py-1 pr-2">Type</th>
                              <th className="py-1 pr-2">Name</th>
                              <th className="py-1 pr-2">Value</th>
                              <th className="py-1">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {d.records.map((r, i) => (
                              <tr key={i} className="border-t border-border/40">
                                <td className="py-1.5 pr-2">{r.record}</td>
                                <td className="py-1.5 pr-2 font-mono">{r.type}</td>
                                <td className="py-1.5 pr-2">
                                  <span className="inline-flex items-center gap-1 font-mono">{r.name}<CopyButton value={r.name} /></span>
                                </td>
                                <td className="max-w-[220px] py-1.5 pr-2">
                                  <span className="inline-flex items-center gap-1 font-mono">
                                    <span className="truncate">{r.value}</span>
                                    <CopyButton value={r.value} />
                                  </span>
                                </td>
                                <td className="py-1.5">
                                  <span className={cn(
                                    "rounded-full px-1.5 py-0.5 text-[10px]",
                                    r.status === "verified" ? "bg-green-500/10 text-green-400" : "bg-muted/40 text-muted-foreground",
                                  )}>
                                    {r.status ?? "pending"}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Mailboxes */}
        <section className="mt-6 rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <Mail className="h-4 w-4 text-primary" /> Mailboxes
          </h2>

          <div className="mb-4 flex gap-2">
            <input
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addMailbox()}
              placeholder="e.g. sarah@talent.yourcompany.com"
              className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={addMailbox}
              disabled={addingMailbox || !newAddress.trim()}
              className="btn-cta inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {addingMailbox ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add mailbox
            </button>
          </div>

          {mailboxes.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
              No mailboxes yet. Verify a domain, then add addresses on it. Each mailbox starts at ~15 sends/day and ramps up automatically.
            </p>
          ) : (
            <div className="space-y-2">
              {mailboxes.map((m) => {
                const h = m.health;
                const rampPct = Math.min(100, (h.effective_daily_limit / m.daily_limit_cap) * 100);
                const usedPct = h.effective_daily_limit > 0 ? Math.min(100, (h.sends_today / h.effective_daily_limit) * 100) : 0;
                return (
                  <div key={m.id} className={cn("rounded-xl border p-3", m.status === "paused" ? "border-amber-500/40 bg-amber-500/5" : "border-border/60")}>
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                          {m.address}
                          {m.status === "paused" && (
                            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                              {PAUSE_LABELS[m.paused_reason ?? "manual"] ?? "Paused"}
                            </span>
                          )}
                          {m.status === "active" && !h.ramp_complete && (
                            <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-400">
                              Ramping up — day {h.ramp_day}
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          Today {h.sends_today}/{h.effective_daily_limit} · cap {m.daily_limit_cap}/day · 7d: {h.sends_7d} sent, {h.bounces_7d} bounced
                          {h.sends_7d > 0 && ` (${(h.bounce_rate_7d * 100).toFixed(1)}%)`}
                          {h.complaints_7d > 0 && `, ${h.complaints_7d} complaints`}
                        </p>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary/40" style={{ width: `${rampPct}%` }}>
                            <div className="h-full rounded-full bg-primary" style={{ width: `${usedPct}%` }} />
                          </div>
                        </div>
                      </div>
                      <span className="flex shrink-0 items-center gap-1">
                        {busyId === m.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        ) : m.status === "active" ? (
                          <button
                            title="Pause sending"
                            onClick={() => mailboxAction(m.id, { action: "pause" })}
                            className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground"
                          >
                            <Pause className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <button
                            title="Resume sending"
                            onClick={() => mailboxAction(m.id, { action: "resume" })}
                            className="rounded-lg border border-green-500/40 p-1.5 text-green-400"
                          >
                            <Play className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="mt-3 text-[10px] text-muted-foreground">
            A mailbox auto-pauses when its 7-day bounce rate passes 5% or complaint rate passes 0.3%. Resuming after an auto-pause restarts the ramp.
          </p>
        </section>
      </div>
    </main>
  );
}
