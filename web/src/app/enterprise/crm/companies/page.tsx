"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Search, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { COMPANY_STATUSES, labelFor, type CrmCompany } from "@/lib/enterprise-crm";
import { CompanyForm } from "@/components/enterprise/crm/company-form";
import { fmtDate, relativeTime, isOverdue, COMPANY_STATUS_STYLES, StatusBadge } from "@/components/enterprise/crm/crm-ui";

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<CrmCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(() => {
    fetch("/api/enterprise/crm/companies").then((r) => r.json()).then((j) => setCompanies(j.data ?? [])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: companies.length };
    for (const s of COMPANY_STATUSES) c[s] = companies.filter((x) => x.status === s).length;
    return c;
  }, [companies]);

  const visible = companies
    .filter((c) => filter === "all" || c.status === filter)
    .filter((c) => !search.trim() || `${c.name} ${c.industry ?? ""} ${c.location ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Companies</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Client accounts and prospects.</p>
          </div>
          <button onClick={() => setFormOpen(true)} className="btn-cta inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold">
            <Plus className="h-4 w-4" /> New company
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {["all", ...COMPANY_STATUSES].map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={cn("rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
                filter === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
              {s === "all" ? "All" : labelFor(s)} ({counts[s] ?? 0})
            </button>
          ))}
          <div className="relative ml-auto">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…"
              className="h-8 w-44 rounded-lg border border-border bg-background pl-8 pr-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
          </div>
        </div>

        <div className="mt-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : visible.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border py-16 text-center">
              <Building2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">{companies.length === 0 ? "No companies yet." : "No companies match your filters."}</p>
              {companies.length === 0 && <p className="mt-1 text-xs text-muted-foreground">Add your first client or prospect to start tracking the relationship.</p>}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Company</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="hidden px-4 py-3 font-medium sm:table-cell">Industry</th>
                    <th className="hidden px-4 py-3 font-medium md:table-cell">Location</th>
                    <th className="hidden px-4 py-3 font-medium lg:table-cell">Last activity</th>
                    <th className="px-4 py-3 font-medium">Next follow-up</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visible.map((c) => (
                    <tr key={c.id} className="transition-colors hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <Link href={`/enterprise/crm/companies/${c.id}`} className="font-medium hover:text-primary">{c.name}</Link>
                        {c.tags.length > 0 && <span className="ml-2 text-xs text-muted-foreground">{c.tags.slice(0, 2).join(", ")}</span>}
                      </td>
                      <td className="px-4 py-3"><StatusBadge value={c.status} styles={COMPANY_STATUS_STYLES} /></td>
                      <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{c.industry ?? "—"}</td>
                      <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{c.location ?? "—"}</td>
                      <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{relativeTime(c.last_activity_at)}</td>
                      <td className={cn("px-4 py-3", isOverdue(c.next_follow_up_at) ? "font-medium text-red-500" : "text-muted-foreground")}>
                        {c.next_follow_up_at ? fmtDate(c.next_follow_up_at) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <CompanyForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={() => load()} />
    </main>
  );
}
