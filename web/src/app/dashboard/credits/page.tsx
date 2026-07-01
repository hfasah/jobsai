"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Coins, Loader2, ArrowDownRight, ArrowUpRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type Account = { balance: number; grant_balance: number; topup_balance: number; monthly_grant: number; plan: string; free_applies: number };
type Row = { id: string; delta: number; balance_after: number; label: string; reason: string; created_at: string };
type Ledger = { rows: Row[]; breakdown: { label: string; spent: number; count: number }[]; totalSpent: number; totalCredited: number };

export default function CreditsPage() {
  const [acct, setAcct] = useState<Account | null>(null);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/tokens").then((r) => r.json()).then((j) => setAcct(j.data ?? null)),
      fetch("/api/tokens/ledger?limit=200").then((r) => r.json()).then((j) => setLedger(j.data ?? null)),
    ]).finally(() => setLoading(false));
  }, []);

  const usedThisMonth = acct ? Math.max(0, acct.monthly_grant - acct.grant_balance) : 0;
  const pct = acct && acct.monthly_grant > 0 ? Math.min(100, Math.round((usedThisMonth / acct.monthly_grant) * 100)) : 0;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Coins className="h-5 w-5 text-primary" /> Credits &amp; Usage</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your credit balance and exactly where every credit goes.</p>
        </div>
        <Link href="/dashboard/billing" className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
          <Plus className="h-4 w-4" /> Get more
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !acct ? (
        <p className="py-16 text-center text-muted-foreground">Couldn&apos;t load your credits. Please refresh.</p>
      ) : (
        <div className="space-y-6">
          {/* Balance summary */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Current balance</p>
                <p className="mt-1 text-4xl font-bold tabular-nums">{acct.balance.toLocaleString()} <span className="text-lg font-medium text-muted-foreground">credits</span></p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p className="capitalize"><span className="font-semibold text-foreground">{acct.plan}</span> plan</p>
                <p className="mt-0.5">{acct.monthly_grant.toLocaleString()} credits / month · rolls over up to 2 months</p>
                {acct.topup_balance > 0 && <p className="mt-0.5">incl. {acct.topup_balance.toLocaleString()} purchased (never expire)</p>}
              </div>
            </div>
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>{usedThisMonth.toLocaleString()} of {acct.monthly_grant.toLocaleString()} monthly credits used</span>
                <span>{pct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full", pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-primary")} style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>

          {/* Spend breakdown */}
          {ledger && ledger.breakdown.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold">Where your credits went</h2>
                <span className="text-xs text-muted-foreground">{ledger.totalSpent.toLocaleString()} spent{ledger.totalCredited > 0 ? ` · ${ledger.totalCredited.toLocaleString()} credited` : ""}</span>
              </div>
              <div className="space-y-2">
                {ledger.breakdown.map((b) => {
                  const w = ledger.totalSpent > 0 ? Math.round((b.spent / ledger.totalSpent) * 100) : 0;
                  return (
                    <div key={b.label}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{b.label} <span className="text-xs">×{b.count}</span></span>
                        <span className="font-medium tabular-nums">{b.spent.toLocaleString()}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary/60" style={{ width: `${w}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* History */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-3 font-semibold">Activity</h2>
            {!ledger || ledger.rows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No credit activity yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {ledger.rows.map((r) => {
                  const spend = r.delta < 0;
                  return (
                    <div key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", spend ? "bg-muted text-muted-foreground" : "bg-emerald-500/15 text-emerald-400")}>
                          {spend ? <ArrowDownRight className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{r.label}</p>
                          <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn("text-sm font-semibold tabular-nums", spend ? "text-foreground" : "text-emerald-400")}>{spend ? "" : "+"}{r.delta.toLocaleString()}</p>
                        <p className="text-[11px] text-muted-foreground tabular-nums">bal {r.balance_after.toLocaleString()}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
