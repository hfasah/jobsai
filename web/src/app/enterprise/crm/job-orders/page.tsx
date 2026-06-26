"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Search, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import { JOB_ORDER_STATUSES, labelFor, type CrmJobOrder } from "@/lib/crm-shared";
import { JobOrderForm } from "@/components/enterprise/crm/job-order-form";
import { fmtMoney, JOB_ORDER_STATUS_STYLES, PRIORITY_STYLES, StatusBadge } from "@/components/enterprise/crm/crm-ui";

type Row = CrmJobOrder & { company?: { id: string; name: string } | null };

export default function JobOrdersPage() {
  const [orders, setOrders] = useState<Row[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      fetch("/api/enterprise/crm/job-orders").then((r) => r.json()),
      fetch("/api/enterprise/crm/companies").then((r) => r.json()),
    ]).then(([jo, co]) => {
      setOrders(jo.data ?? []);
      setCompanies((co.data ?? []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
    }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length };
    for (const s of JOB_ORDER_STATUSES) c[s] = orders.filter((x) => x.status === s).length;
    return c;
  }, [orders]);

  const ACTIVE = ["all", "intake", "open", "sourcing", "submitted", "interviewing", "offer", "filled"];
  const visible = orders
    .filter((o) => filter === "all" || o.status === filter)
    .filter((o) => !search.trim() || `${o.title} ${o.company?.name ?? ""} ${o.location ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Job Orders</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Client requirements you’re working to fill.</p>
          </div>
          <button onClick={() => setFormOpen(true)} className="btn-cta inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold">
            <Plus className="h-4 w-4" /> New job order
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {ACTIVE.map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors",
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
              <Briefcase className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">{orders.length === 0 ? "No job orders yet." : "No job orders match your filters."}</p>
              {orders.length === 0 && <p className="mt-1 text-xs text-muted-foreground">Capture a client requirement to start sourcing and tracking placement value.</p>}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Title</th>
                    <th className="hidden px-4 py-3 font-medium sm:table-cell">Company</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="hidden px-4 py-3 font-medium md:table-cell">Priority</th>
                    <th className="hidden px-4 py-3 font-medium lg:table-cell">Openings</th>
                    <th className="px-4 py-3 font-medium">Est. value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visible.map((o) => (
                    <tr key={o.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <Link href={`/enterprise/crm/job-orders/${o.id}`} className="font-medium hover:text-primary">{o.title}</Link>
                        <span className="ml-2 text-xs text-muted-foreground">{labelFor(o.job_type)}</span>
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{o.company?.name ?? "—"}</td>
                      <td className="px-4 py-3"><StatusBadge value={o.status} styles={JOB_ORDER_STATUS_STYLES} /></td>
                      <td className="hidden px-4 py-3 md:table-cell"><StatusBadge value={o.priority} styles={PRIORITY_STYLES} /></td>
                      <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{o.openings}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtMoney(o.placement_value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <JobOrderForm open={formOpen} onClose={() => setFormOpen(false)} companies={companies} onSaved={() => load()} />
    </main>
  );
}
