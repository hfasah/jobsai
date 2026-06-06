"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

const PLAN_BADGE: Record<string, string> = {
  pro: "bg-blue-500/15 text-blue-400",
  premium: "bg-purple-500/15 text-purple-400",
  accelerator: "bg-amber-500/15 text-amber-400",
  enterprise: "bg-emerald-500/15 text-emerald-400",
};

const PLAN_MRR: Record<string, number> = { pro: 29, premium: 79, accelerator: 199, enterprise: 499 };

export default function AdminSubscribers() {
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/users?plan=all&page=1")
      .then((r) => r.json())
      .then((j) => setUsers((j.users ?? []).filter((u: Record<string, unknown>) => u.plan !== "free")))
      .finally(() => setLoading(false));
  }, []);

  const mrr = users.reduce((sum, u) => sum + (PLAN_MRR[u.plan as string] ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Subscribers</h1>
          <p className="mt-1 text-sm text-muted-foreground">{users.length} paying customers · MRR ${mrr.toLocaleString()}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {loading ? (
          <div className="flex h-40 items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                {["User", "Plan", "MRR", "Resumes", "Jobs", "Joined", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.id as string} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium">{u.name as string}</p>
                    <p className="text-xs text-muted-foreground">{u.email as string}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize", PLAN_BADGE[u.plan as string] ?? "bg-muted text-muted-foreground")}>
                      {u.plan as string}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium tabular-nums">${PLAN_MRR[u.plan as string] ?? 0}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{u.resumeCount as number}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{u.jobCount as number}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(u.createdAt as number).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/users/${u.id}`} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                      <ExternalLink className="h-3 w-3" /> View
                    </Link>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">No paying subscribers yet.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
