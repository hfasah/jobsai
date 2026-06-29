"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Search, Loader2, ChevronLeft, ChevronRight, Building2, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserRow {
  id: string; email: string; name: string; plan: string;
  subscriptionStatus: string; createdAt: number; lastActiveAt: number | null;
  resumeCount: number; jobCount: number; imageUrl: string;
  suspended?: boolean;
  type?: "enterprise" | "consumer";
  orgName?: string | null;
  orgRole?: string | null;
}

const PLAN_BADGE: Record<string, string> = {
  free: "bg-muted text-muted-foreground",
  pro: "bg-blue-500/15 text-blue-400",
  premium: "bg-purple-500/15 text-purple-400",
  accelerator: "bg-amber-500/15 text-amber-400",
  enterprise: "bg-emerald-500/15 text-emerald-400",
};

function timeAgo(ms: number | null) {
  if (!ms) return "—";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState("all");
  const [type, setType] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ q: search, plan, type, page: String(page) });
    const res = await fetch(`/api/admin/users?${params}`);
    const json = await res.json();
    setUsers(json.users ?? []);
    setTotal(json.total ?? 0);
    setPages(json.pages ?? 1);
    setLoading(false);
  }, [search, plan, type, page]);

  useEffect(() => { setPage(1); }, [search, plan, type]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">All Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">{total.toLocaleString()} total</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email…"
            className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <select value={type} onChange={(e) => setType(e.target.value)}
          className="h-10 rounded-xl border border-border bg-card px-3 text-sm outline-none">
          <option value="all">All types</option>
          <option value="consumer">Consumer</option>
          <option value="enterprise">Enterprise</option>
        </select>
        <select value={plan} onChange={(e) => setPlan(e.target.value)}
          className="h-10 rounded-xl border border-border bg-card px-3 text-sm outline-none">
          <option value="all">All plans</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="premium">Premium</option>
          <option value="accelerator">Accelerator</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {loading ? (
          <div className="flex h-40 items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                {["User", "Type", "Plan", "Resumes", "Jobs", "Joined", "Last Active", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {u.imageUrl
                        ? <img src={u.imageUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
                        : <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">{u.name[0] ?? "?"}</div>}
                      <div>
                        <p className="flex items-center gap-1.5 font-medium text-foreground">
                          {u.name}
                          {u.suspended && <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">Suspended</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {u.type === "enterprise" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-xs font-semibold text-indigo-400" title={u.orgRole ? `${u.orgName} · ${u.orgRole}` : (u.orgName ?? "Enterprise")}>
                        <Building2 className="h-3 w-3" /> {u.orgName ?? "Enterprise"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                        <User className="h-3 w-3" /> Consumer
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize", PLAN_BADGE[u.plan] ?? PLAN_BADGE.free)}>
                      {u.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{u.resumeCount}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{u.jobCount}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-muted-foreground">{timeAgo(u.lastActiveAt)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/users/${u.id}`} className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">No users found.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <p>Page {page} of {pages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-muted">
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>
            <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}
              className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-muted">
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
