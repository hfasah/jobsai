"use client";

import { useEffect, useState } from "react";
import { Loader2, Coins, Activity, Users, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type Window = "day" | "week" | "month";
interface Stat { tokens: number; uses: number; users: number }
interface FeatureRow { feature: string; day: Stat; week: Stat; month: Stat }
interface UsageData {
  features: FeatureRow[];
  totals: Record<Window, Stat>;
  generated_at: string;
}

const WINDOW_LABEL: Record<Window, string> = { day: "Last 24 hours", week: "Last 7 days", month: "Last 30 days" };

// Friendly names for the token_ledger feature keys.
const FEATURE_LABEL: Record<string, string> = {
  resume_tailor: "Résumé Tailoring",
  cover_letter: "Cover Letter",
  ats_scan: "ATS Scan",
  linkedin_optimize: "LinkedIn Optimizer",
  linkedin_post: "LinkedIn Post",
  voice_minute: "Voice Interview",
  avatar_minute: "Avatar Interview",
  interview_prep: "Interview Prep",
  mock_interview: "Mock Interview",
  company_research: "Company Research",
  salary_intel: "Salary Intel",
  follow_up: "Follow-up",
  other: "Other",
};
const labelFor = (f: string) => FEATURE_LABEL[f] ?? f.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default function AdminUsagePage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Window>("week");

  const load = () => {
    setLoading(true);
    fetch("/api/admin/usage").then((r) => r.json()).then((j) => setData(j.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  if (loading) return <div className="flex h-64 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading usage…</div>;
  if (!data) return <div className="text-destructive">Could not load usage.</div>;

  const rows = [...data.features].sort((a, b) => b[period].tokens - a[period].tokens).filter((r) => r[period].uses > 0);
  const totals = data.totals[period];
  const maxTokens = Math.max(1, ...rows.map((r) => r[period].tokens));

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Token Usage by Feature</h1>
          <p className="text-sm text-muted-foreground">Which features users rely on, and what they cost in tokens.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-1 text-xs">
            {(["day", "week", "month"] as Window[]).map((w) => (
              <button key={w} onClick={() => setPeriod(w)}
                className={cn("rounded-full px-3 py-1 font-medium transition-colors", period === w ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                {w === "day" ? "Day" : w === "week" ? "Week" : "Month"}
              </button>
            ))}
          </div>
          <button onClick={load} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Totals */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: Coins, label: "Tokens consumed", value: totals.tokens.toLocaleString() },
          { icon: Activity, label: "Feature uses", value: totals.uses.toLocaleString() },
          { icon: Users, label: "Active users", value: totals.users.toLocaleString() },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-4 w-4" /> {label}</div>
            <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
            <p className="text-[11px] text-muted-foreground">{WINDOW_LABEL[period]}</p>
          </div>
        ))}
      </div>

      {/* Per-feature table */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 font-semibold">By feature · {WINDOW_LABEL[period]}</h2>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No token usage in this period yet.</p>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => {
              const s = r[period];
              const pct = Math.round((s.tokens / maxTokens) * 100);
              const shareOfTotal = totals.tokens ? Math.round((s.tokens / totals.tokens) * 100) : 0;
              return (
                <div key={r.feature}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium">{labelFor(r.feature)}</span>
                    <span className="flex items-center gap-4 text-xs text-muted-foreground tabular-nums">
                      <span><span className="font-semibold text-foreground">{s.tokens.toLocaleString()}</span> tokens ({shareOfTotal}%)</span>
                      <span>{s.uses.toLocaleString()} uses</span>
                      <span>{s.users.toLocaleString()} users</span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-gradient-brand" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-4 text-[11px] text-muted-foreground">Updated {new Date(data.generated_at).toLocaleString()}</p>
      </div>
    </div>
  );
}
