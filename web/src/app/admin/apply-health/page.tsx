"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Loader2, Rocket, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type Feed = { id: string; user_id: string; email: string; platform: string; status: string; error_msg: string | null; created_at: string };
type Health = {
  days: number;
  stats: { total: number; submitted: number; failed: number; manual_required: number; pending: number; stuck: number; successRate: number | null; tokensRefunded: number };
  failureReasons: { reason: string; count: number }[];
  platforms: { platform: string; total: number; submitted: number; failed: number }[];
  feed: Feed[];
};

export default function AdminApplyHealth() {
  const [data, setData] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/apply-health?days=${days}`).then((r) => r.json()).then(setData).finally(() => setLoading(false));
  }, [days]);
  useEffect(() => { load(); }, [load]);

  const s = data?.stats;
  const rate = s?.successRate;
  const rateColor = rate == null ? "text-muted-foreground" : rate >= 70 ? "text-emerald-400" : rate >= 40 ? "text-amber-400" : "text-red-400";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Rocket className="h-5 w-5 text-primary" /> Auto-Apply Health</h1>
          <p className="mt-1 text-sm text-muted-foreground">System-wide success &amp; failure of automated applications.</p>
        </div>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}
          className="h-10 rounded-xl border border-border bg-card px-3 text-sm outline-none">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {loading || !s ? (
        <div className="flex h-40 items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading…</div>
      ) : (
        <>
          {/* Headline stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
            {[
              ["Success rate", rate == null ? "—" : `${rate}%`, rateColor],
              ["Attempts", s.total.toLocaleString(), "text-foreground"],
              ["Submitted", s.submitted.toLocaleString(), "text-emerald-400"],
              ["Failed", s.failed.toLocaleString(), "text-red-400"],
              ["Manual req.", s.manual_required.toLocaleString(), "text-amber-400"],
              ["Stuck >1h", s.stuck.toLocaleString(), s.stuck > 0 ? "text-red-400" : "text-muted-foreground"],
              ["Tokens refunded", s.tokensRefunded.toLocaleString(), "text-blue-400"],
            ].map(([label, val, color]) => (
              <div key={String(label)} className="rounded-2xl border border-border bg-card p-4">
                <p className={cn("text-2xl font-bold tabular-nums", color as string)}>{val as string}</p>
                <p className="mt-1 text-xs text-muted-foreground">{label as string}</p>
              </div>
            ))}
          </div>

          {s.stuck > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span><strong>{s.stuck} attempt(s) stuck in “pending” &gt;1h.</strong> These usually mean the Skyvern completion webhook never landed (check <code>NEXT_PUBLIC_APP_URL</code> / the <code>/api/webhooks/agent-apply</code> callback). Tokens stay spent until resolved.</span>
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Failure reasons */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-3 font-semibold">Failure reasons</h2>
              {data.failureReasons.length === 0 ? (
                <p className="text-sm text-muted-foreground">No failures in this window. 🎉</p>
              ) : (
                <div className="space-y-2">
                  {data.failureReasons.map((f) => (
                    <div key={f.reason} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate capitalize text-muted-foreground">{f.reason}</span>
                      <span className="shrink-0 font-semibold tabular-nums">{f.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Platform breakdown */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-3 font-semibold">By platform</h2>
              {data.platforms.length === 0 ? (
                <p className="text-sm text-muted-foreground">No attempts in this window.</p>
              ) : (
                <div className="space-y-2">
                  {data.platforms.map((p) => {
                    const r = p.submitted + p.failed > 0 ? Math.round((p.submitted / (p.submitted + p.failed)) * 100) : null;
                    return (
                      <div key={p.platform} className="flex items-center justify-between gap-3 text-sm">
                        <span className="capitalize text-muted-foreground">{p.platform}</span>
                        <span className="shrink-0 tabular-nums">
                          <span className="text-emerald-400">{p.submitted}</span> / <span className="text-red-400">{p.failed}</span>
                          <span className="ml-2 text-muted-foreground">{r == null ? "" : `(${r}%)`}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Recent failures / stuck feed */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-3 font-semibold">Recent failures &amp; stuck attempts</h2>
            {data.feed.length === 0 ? (
              <p className="text-sm text-muted-foreground">No failures or stuck attempts in this window.</p>
            ) : (
              <div className="space-y-1.5">
                {data.feed.map((f) => (
                  <div key={f.id} className="flex items-center justify-between gap-3 text-xs">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize", f.status === "stuck" ? "bg-red-500/15 text-red-400" : "bg-red-500/15 text-red-400")}>{f.status}</span>
                      <Link href={`/admin/users/${f.user_id}`} className="shrink-0 text-primary hover:underline">{f.email}</Link>
                      <span className="truncate text-muted-foreground">{f.platform}{f.error_msg ? ` · ${f.error_msg}` : ""}</span>
                    </span>
                    <span className="shrink-0 text-muted-foreground">{new Date(f.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
