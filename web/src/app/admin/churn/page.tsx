"use client";

import { useEffect, useState } from "react";
import { Loader2, Clock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeedbackRow {
  id: string; user_id: string; plan: string; reasons: string[];
  comment: string | null; wait: boolean; created_at: string;
}

const PLAN_BADGE: Record<string, string> = {
  free: "bg-muted text-muted-foreground",
  pro: "bg-blue-500/15 text-blue-400",
  premium: "bg-purple-500/15 text-purple-400",
  accelerator: "bg-amber-500/15 text-amber-400",
};

export default function AdminChurn() {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/churn").then((r) => r.json()).then((j) => setRows(j.rows ?? [])).finally(() => setLoading(false));
  }, []);

  const waited = rows.filter((r) => r.wait).length;
  const cancelled = rows.filter((r) => !r.wait).length;

  // Reason frequency
  const reasonCounts: Record<string, number> = {};
  for (const row of rows) {
    for (const r of row.reasons) {
      reasonCounts[r] = (reasonCounts[r] ?? 0) + 1;
    }
  }
  const topReasons = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Churn Feedback</h1>
        <p className="mt-1 text-sm text-muted-foreground">{rows.length} total responses — {cancelled} cancelled, {waited} sent to team &amp; waited</p>
      </div>

      {topReasons.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 font-semibold">Top cancellation reasons</h2>
          <div className="space-y-2">
            {topReasons.map(([reason, count]) => (
              <div key={reason} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-foreground">{reason}</span>
                    <span className="tabular-nums text-muted-foreground">{count}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary/60" style={{ width: `${(count / rows.length) * 100}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex h-40 items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize", PLAN_BADGE[row.plan] ?? PLAN_BADGE.free)}>
                    {row.plan}
                  </span>
                  {row.wait
                    ? <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs text-amber-500"><Clock className="h-3 w-3" /> Waited</span>
                    : <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs text-destructive"><XCircle className="h-3 w-3" /> Cancelled</span>}
                </div>
                <p className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleDateString()}</p>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {row.reasons.map((r) => (
                  <span key={r} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{r}</span>
                ))}
              </div>
              {row.comment && (
                <p className="mt-2 text-sm text-foreground border-l-2 border-border pl-3">"{row.comment}"</p>
              )}
            </div>
          ))}
          {rows.length === 0 && (
            <div className="rounded-2xl border border-border bg-card py-16 text-center text-muted-foreground">
              No churn feedback yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
