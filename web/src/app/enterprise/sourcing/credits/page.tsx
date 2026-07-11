"use client";

// Sourcing credits: balance + monthly allowance, action costs (editable for
// sourcing managers), spend ledger, and data-provider configuration.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Coins, Database, Loader2, Pencil, Plug, RefreshCw, Save, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { CREDIT_PACKS } from "@/lib/sourcing/packs";

interface CreditData {
  balance: number;
  monthlyAllowance: number;
  usedThisMonth: number;
  costs: Record<string, number>;
  daily_credit_limit?: number | null;
}

interface LedgerEntry {
  id: string;
  amount: number;
  balance_after: number;
  reason: string;
  created_at: string;
}

interface ProviderRow {
  id: string;
  provider_key: string;
  enabled: boolean;
  api_key: string | null;
  has_own_key: boolean;
}

const REASON_LABELS: Record<string, string> = {
  monthly_grant: "Monthly plan credits",
  purchase: "Credit purchase",
  admin_adjustment: "Admin adjustment",
  refund: "Refund",
  spend_search: "Search",
  spend_unlock_profile: "Profile unlock",
  spend_reveal_email: "Email reveal",
  spend_reveal_phone: "Phone reveal",
  spend_enrich: "Enrichment",
};

const COST_LABELS: Record<string, string> = {
  search: "External search",
  unlock_profile: "Profile unlock",
  reveal_email: "Email reveal",
  reveal_phone: "Phone reveal",
  enrich: "Full enrichment",
};

export default function SourcingCreditsPage() {
  const [credit, setCredit] = useState<CreditData | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [ledgerPage, setLedgerPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [pdlAvailable, setPdlAvailable] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [editingCosts, setEditingCosts] = useState(false);
  const [costDraft, setCostDraft] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [buyingPack, setBuyingPack] = useState<string | null>(null);
  const [purchased, setPurchased] = useState(false);
  const [capDraft, setCapDraft] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("purchased") === "1") {
      setPurchased(true);
    }
  }, []);

  const buyPack = async (key: string) => {
    setBuyingPack(key);
    try {
      const res = await fetch("/api/enterprise/sourcing/credits/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack: key }),
      });
      const json = await res.json();
      if (res.ok && json.data?.url) window.location.href = json.data.url;
      else setBuyingPack(null);
    } catch {
      setBuyingPack(null);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    const [c, u, p] = await Promise.all([
      fetch("/api/enterprise/sourcing/credits").then((r) => r.json()).catch(() => null),
      fetch("/api/enterprise/sourcing/credits/usage").then((r) => r.json()).catch(() => null),
      fetch("/api/enterprise/sourcing/providers").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    if (c?.data) {
      setCredit(c.data);
      setCostDraft(c.data.costs);
      setCapDraft(c.data.daily_credit_limit ? String(c.data.daily_credit_limit) : "");
    }
    if (u?.data) { setLedger(u.data.entries ?? []); setHasMore(u.data.has_more ?? false); setLedgerPage(0); }
    if (p?.data) {
      setProviders(p.data.providers ?? []);
      setPdlAvailable(p.data.platform?.pdl_available ?? false);
      setCanManage(true); // providers GET is manager-gated; success implies rights
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadMoreLedger = async () => {
    const next = ledgerPage + 1;
    const res = await fetch(`/api/enterprise/sourcing/credits/usage?page=${next}`);
    const json = await res.json();
    if (res.ok) {
      setLedger((prev) => [...prev, ...(json.data.entries ?? [])]);
      setHasMore(json.data.has_more ?? false);
      setLedgerPage(next);
    }
  };

  const saveCosts = async () => {
    setSaving(true);
    try {
      const cap = parseInt(capDraft, 10);
      const res = await fetch("/api/enterprise/sourcing/credits", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          costs: costDraft,
          daily_credit_limit: Number.isFinite(cap) && cap > 0 ? cap : null,
        }),
      });
      const json = await res.json();
      if (res.ok && credit) {
        setCredit({ ...credit, costs: json.data.costs, daily_credit_limit: Number.isFinite(cap) && cap > 0 ? cap : null });
        setEditingCosts(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleProvider = async (row: ProviderRow) => {
    await fetch(`/api/enterprise/sourcing/providers/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !row.enabled }),
    });
    load();
  };

  if (loading && !credit) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link href="/enterprise/sourcing" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Global Sourcing
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Coins className="h-6 w-6 text-primary" /> Sourcing credits
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Credits pay for external searches, contact reveals and enrichment. Failed or empty actions are refunded automatically.
        </p>

        {purchased && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
            <Check className="h-4 w-4 shrink-0" /> Payment received — credits are added as soon as Stripe confirms (usually seconds). Refresh to see the new balance.
          </div>
        )}

        {/* Balance cards */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            { label: "Balance", value: credit?.balance ?? 0 },
            { label: "Monthly allowance", value: credit?.monthlyAllowance ?? 0 },
            { label: "Used this month", value: credit?.usedThisMonth ?? 0 },
          ].map((c) => (
            <div key={c.label} className="rounded-2xl border border-border bg-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{c.label}</p>
              <p className="mt-1 text-2xl font-bold">{c.value.toLocaleString()}</p>
            </div>
          ))}
        </div>

        {/* Top-up packs */}
        {canManage && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
              <ShoppingCart className="h-4 w-4 text-primary" /> Top up credits
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CREDIT_PACKS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => buyPack(p.key)}
                  disabled={buyingPack !== null}
                  className={cn(
                    "rounded-xl border border-border p-3 text-center transition-colors hover:border-primary/50 disabled:opacity-60",
                  )}
                >
                  <p className="text-sm font-bold">{p.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">${(p.amount_cents / 100).toFixed(2)}</p>
                  <span className="btn-cta mt-2 inline-flex w-full items-center justify-center gap-1 rounded-lg py-1 text-[11px] font-semibold">
                    {buyingPack === p.key ? <Loader2 className="h-3 w-3 animate-spin" /> : "Purchase"}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              One-time purchase via Stripe. Credits never expire; monthly plan credits are granted separately.
            </p>
          </div>
        )}

        {/* Costs */}
        <div className="mt-6 rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Action costs</h2>
            {canManage && !editingCosts && (
              <button onClick={() => setEditingCosts(true)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <Pencil className="h-3 w-3" /> Edit
              </button>
            )}
            {editingCosts && (
              <button onClick={saveCosts} disabled={saving} className="btn-cta inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold disabled:opacity-60">
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {Object.entries(COST_LABELS).map(([key, label]) => (
              <div key={key} className="rounded-xl border border-border/60 p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground">{label}</p>
                {editingCosts ? (
                  <input
                    type="number"
                    min={0}
                    value={costDraft[key] ?? 0}
                    onChange={(e) => setCostDraft({ ...costDraft, [key]: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-1 py-0.5 text-center text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                ) : (
                  <p className="mt-0.5 text-lg font-bold">{credit?.costs?.[key] ?? "—"}</p>
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-3">
            <p className="text-xs text-muted-foreground">Daily spend cap</p>
            {editingCosts ? (
              <input
                type="number"
                min={0}
                value={capDraft}
                onChange={(e) => setCapDraft(e.target.value)}
                placeholder="No cap"
                className="w-24 rounded-lg border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            ) : (
              <p className="text-xs font-semibold">
                {credit?.daily_credit_limit ? `${credit.daily_credit_limit} credits/day` : "No cap"}
              </p>
            )}
            <p className="ml-auto text-[10px] text-muted-foreground">Blocks spends beyond this many credits per day (cost control).</p>
          </div>
        </div>

        {/* Providers */}
        {canManage && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Plug className="h-4 w-4 text-primary" /> Data providers</h2>
              <button onClick={load} className="text-muted-foreground hover:text-foreground" aria-label="Refresh">
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
            {providers.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Using platform defaults{pdlAvailable ? " (People Data Labs)" : " (mock data — no provider key configured)"}. Contact support to bring your own provider key.
              </p>
            ) : (
              <div className="space-y-2">
                {providers.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2">
                    <span>
                      <span className="text-sm font-medium">{p.provider_key === "pdl" ? "People Data Labs" : "Mock (dev)"}</span>
                      <span className="ml-2 text-[11px] text-muted-foreground">{p.has_own_key ? `key ${p.api_key}` : "platform key"}</span>
                    </span>
                    <button
                      onClick={() => toggleProvider(p)}
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                        p.enabled ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-border text-muted-foreground",
                      )}
                    >
                      {p.enabled ? "Enabled" : "Disabled"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Ledger */}
        <div className="mt-6 rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><Database className="h-4 w-4 text-primary" /> Usage history</h2>
          {ledger.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">No credit activity yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-1.5 pr-3">When</th>
                    <th className="py-1.5 pr-3">Action</th>
                    <th className="py-1.5 pr-3 text-right">Credits</th>
                    <th className="py-1.5 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((e) => (
                    <tr key={e.id} className="border-b border-border/40 last:border-0">
                      <td className="py-1.5 pr-3 text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</td>
                      <td className="py-1.5 pr-3 text-xs">{REASON_LABELS[e.reason] ?? e.reason}</td>
                      <td className={cn("py-1.5 pr-3 text-right text-xs font-semibold", e.amount > 0 ? "text-green-400" : "text-foreground")}>
                        {e.amount > 0 ? `+${e.amount}` : e.amount}
                      </td>
                      <td className="py-1.5 text-right text-xs text-muted-foreground">{e.balance_after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {hasMore && (
                <div className="mt-2 text-center">
                  <button onClick={loadMoreLedger} className="text-xs text-muted-foreground hover:text-foreground">Load more</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
