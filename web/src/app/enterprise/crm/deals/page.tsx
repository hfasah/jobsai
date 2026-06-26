"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEAL_STAGES, labelFor, type CrmDeal } from "@/lib/crm-shared";
import { DealForm } from "@/components/enterprise/crm/deal-form";
import { fmtMoney } from "@/components/enterprise/crm/crm-ui";

type Row = CrmDeal & { company?: { id: string; name: string } | null };

// Open stages count toward "in pipeline"; won/lost are terminal.
const OPEN_STAGES = DEAL_STAGES.filter((s) => s !== "won" && s !== "lost");

export default function DealsPage() {
  const [deals, setDeals] = useState<Row[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([
      fetch("/api/enterprise/crm/deals").then((r) => r.json()),
      fetch("/api/enterprise/crm/companies").then((r) => r.json()),
    ]).then(([d, co]) => {
      setDeals(d.data ?? []);
      setCompanies((co.data ?? []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
    }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const moveTo = async (id: string, stage: string) => {
    const prev = deals.find((d) => d.id === id);
    if (!prev || prev.stage === stage) return;
    setDeals((ds) => ds.map((d) => (d.id === id ? { ...d, stage } : d)));  // optimistic
    const res = await fetch(`/api/enterprise/crm/deals/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage }),
    });
    if (!res.ok) load();  // revert on failure
  };

  const openValue = deals.filter((d) => OPEN_STAGES.includes(d.stage as (typeof OPEN_STAGES)[number])).reduce((s, d) => s + (Number(d.value) || 0), 0);
  const wonValue = deals.filter((d) => d.stage === "won").reduce((s, d) => s + (Number(d.value) || 0), 0);

  return (
    <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Deals</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Pipeline: <span className="font-semibold text-foreground">{fmtMoney(openValue)}</span> open · <span className="font-semibold text-green-500">{fmtMoney(wonValue)}</span> won
            </p>
          </div>
          <button onClick={() => { setEditing(null); setFormOpen(true); }} className="btn-cta inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold">
            <Plus className="h-4 w-4" /> New deal
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : deals.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-border py-16 text-center">
            <TrendingUp className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No deals yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">Track business-development opportunities from lead to won.</p>
          </div>
        ) : (
          <div className="mt-4 flex gap-3 overflow-x-auto pb-3">
            {DEAL_STAGES.map((stage) => {
              const col = deals.filter((d) => d.stage === stage);
              const colValue = col.reduce((s, d) => s + (Number(d.value) || 0), 0);
              return (
                <div key={stage}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => { if (dragId) moveTo(dragId, stage); setDragId(null); }}
                  className="flex w-64 shrink-0 flex-col rounded-2xl border border-border bg-card/40">
                  <div className="flex items-center justify-between border-b border-border px-3 py-2">
                    <span className="text-xs font-semibold">{labelFor(stage)} <span className="text-muted-foreground">({col.length})</span></span>
                    <span className="text-[11px] text-muted-foreground">{fmtMoney(colValue)}</span>
                  </div>
                  <div className="flex-1 space-y-2 p-2">
                    {col.map((d) => (
                      <div key={d.id} draggable onDragStart={() => setDragId(d.id)} onDragEnd={() => setDragId(null)}
                        onClick={() => { setEditing(d); setFormOpen(true); }}
                        className={cn("cursor-pointer rounded-xl border border-border bg-card p-3 text-sm shadow-sm transition-shadow hover:shadow-md", dragId === d.id && "opacity-50")}>
                        <p className="font-medium leading-tight">{d.name}</p>
                        {d.company && <Link href={`/enterprise/crm/companies/${d.company.id}`} onClick={(e) => e.stopPropagation()} className="text-xs text-muted-foreground hover:text-primary">{d.company.name}</Link>}
                        <div className="mt-2 flex items-center justify-between text-xs">
                          <span className="font-semibold">{fmtMoney(d.value)}</span>
                          {d.probability != null && <span className="text-muted-foreground">{d.probability}%</span>}
                        </div>
                        {d.next_action && <p className="mt-1 truncate text-[11px] text-muted-foreground">→ {d.next_action}</p>}
                      </div>
                    ))}
                    {col.length === 0 && <p className="py-4 text-center text-[11px] text-muted-foreground/60">Drop here</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <DealForm open={formOpen} onClose={() => setFormOpen(false)} deal={editing} companies={companies} onSaved={() => load()} />
    </main>
  );
}
