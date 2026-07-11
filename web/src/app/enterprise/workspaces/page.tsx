"use client";

// Agency overview — comparative reporting across client workspaces, plus
// create/switch. Only reachable by agency orgs (agency_workspaces feature);
// the nav item is gated the same way.
import { useCallback, useEffect, useState } from "react";
import { Building2, Briefcase, Users, Megaphone, Star, Plus, Loader2, ArrowRight, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkspaceMetrics {
  id: string; name: string; slug: string | null; is_parent: boolean;
  open_jobs: number; active_candidates: number; live_campaigns: number;
  positive_replies: number; replies_30d: number;
}
interface Totals { open_jobs: number; active_candidates: number; live_campaigns: number; positive_replies: number; replies_30d: number }

export default function AgencyWorkspacesPage() {
  const [rows, setRows] = useState<WorkspaceMetrics[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/enterprise/workspaces/overview");
    if (res.status === 403) { setLocked(true); setLoading(false); return; }
    const json = await res.json();
    if (res.ok) { setRows(json.data.workspaces ?? []); setTotals(json.data.totals ?? null); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const res = await fetch("/api/enterprise/workspaces", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    setCreating(false);
    if (res.ok) { setNewName(""); load(); }
  };

  const switchTo = async (id: string) => {
    setSwitching(id);
    const res = await fetch("/api/enterprise/workspaces/switch", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_id: id }),
    });
    if (res.ok) window.location.href = "/enterprise/dashboard";
    else setSwitching(null);
  };

  if (locked) {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border border-dashed border-border p-8 text-center">
          <Building2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          <h1 className="text-base font-semibold">Agency workspaces</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage isolated workspaces for each of your clients under one agency account. Available on agency plans.</p>
        </div>
      </main>
    );
  }

  const STATS: { key: keyof Totals; label: string; icon: typeof Briefcase }[] = [
    { key: "open_jobs", label: "Open jobs", icon: Briefcase },
    { key: "active_candidates", label: "Active candidates", icon: Users },
    { key: "live_campaigns", label: "Live campaigns", icon: Megaphone },
    { key: "positive_replies", label: "Positive replies", icon: Star },
  ];

  return (
    <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Building2 className="h-6 w-6 text-primary" /> Agency overview
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">All your client workspaces at a glance. Each is fully isolated — switch in to work inside one.</p>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <>
            {/* Agency totals */}
            {totals && (
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {STATS.map((s) => (
                  <div key={s.key} className="rounded-2xl border border-border bg-card p-4">
                    <s.icon className="h-4 w-4 text-muted-foreground" />
                    <p className="mt-2 text-2xl font-bold">{totals[s.key].toLocaleString()}</p>
                    <p className="text-[11px] text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Create */}
            <div className="mt-6 flex gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && create()}
                placeholder="New client name (e.g. Acme Corp)"
                className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button onClick={create} disabled={creating || !newName.trim()} className="btn-cta inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-60">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add client
              </button>
            </div>

            {/* Comparative table */}
            <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-border bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Workspace</th>
                    <th className="px-3 py-2 text-right">Jobs</th>
                    <th className="px-3 py-2 text-right">Candidates</th>
                    <th className="px-3 py-2 text-right">Campaigns</th>
                    <th className="px-3 py-2 text-right">Positive replies</th>
                    <th className="px-3 py-2 text-right">Replies (30d)</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-1.5 font-medium">
                          {r.is_parent ? <Building2 className="h-3.5 w-3.5 text-primary" /> : <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />}
                          {r.name}
                          {r.is_parent && <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">Agency</span>}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">{r.open_jobs}</td>
                      <td className="px-3 py-2 text-right">{r.active_candidates}</td>
                      <td className="px-3 py-2 text-right">{r.live_campaigns}</td>
                      <td className={cn("px-3 py-2 text-right", r.positive_replies > 0 && "font-semibold text-green-400")}>{r.positive_replies}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{r.replies_30d}</td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => switchTo(r.id)} disabled={switching === r.id} className="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-60">
                          {switching === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <>Open <ArrowRight className="h-3 w-3" /></>}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {rows.length <= 1 && (
              <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <TriangleAlert className="h-3.5 w-3.5" /> No client workspaces yet — add your first client above.
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
