"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Loader2, X, Target, TrendingUp, Trophy, Percent, GripVertical, Trash2, Calendar, User } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  STAGES, STAGE_BY_KEY, summarize, fmtUSD, dealProbability, isOverdue, type Deal, type DealStage,
} from "@/lib/sales-pipeline";

const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary";

export default function AdminSales() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [editing, setEditing] = useState<Deal | null>(null);
  const [creating, setCreating] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const load = () => {
    fetch("/api/admin/sales").then((r) => r.json()).then((j) => setDeals(j.data ?? [])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const owners = useMemo(() => [...new Set(deals.map((d) => d.owner).filter(Boolean))] as string[], [deals]);
  const visible = useMemo(() => ownerFilter === "all" ? deals : deals.filter((d) => d.owner === ownerFilter), [deals, ownerFilter]);
  const summary = useMemo(() => summarize(visible), [visible]);

  const move = async (id: string, stage: DealStage) => {
    const deal = deals.find((d) => d.id === id);
    if (!deal || deal.stage === stage) return;
    setDeals((ds) => ds.map((d) => (d.id === id ? { ...d, stage } : d))); // optimistic
    await fetch(`/api/admin/sales/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage }),
    }).catch(() => load());
  };

  const stats = [
    { label: "Open pipeline", value: fmtUSD(summary.openValueCents), icon: TrendingUp },
    { label: "Weighted pipeline", value: fmtUSD(summary.weightedValueCents), icon: Target },
    { label: "Won", value: fmtUSD(summary.wonValueCents), icon: Trophy },
    { label: "Win rate", value: `${summary.winRate}%`, icon: Percent },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Sales Pipeline</h1>
          <p className="mt-1 text-sm text-muted-foreground">Track deals by stage, owner, and expected close.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} className={cn(inputCls, "w-auto")}>
            <option value="all">All owners</option>
            {owners.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-4 py-2 text-sm font-semibold text-white shadow-glow">
            <Plus className="h-4 w-4" /> New deal
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-muted-foreground"><Icon className="h-4 w-4" /><span className="text-xs">{label}</span></div>
            <p className="mt-1.5 text-2xl font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STAGES.map((stage) => {
            const items = visible.filter((d) => d.stage === stage.key);
            const colValue = items.reduce((s, d) => s + d.value_cents, 0);
            return (
              <div key={stage.key}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => dragId && move(dragId, stage.key)}
                className="flex w-72 shrink-0 flex-col rounded-2xl border border-border bg-muted/20">
                <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <span className={cn("h-2 w-2 rounded-full", stage.kind === "won" ? "bg-emerald-500" : stage.kind === "lost" ? "bg-red-500" : "bg-primary")} />
                    {stage.label}
                    <span className="text-xs font-normal text-muted-foreground">{items.length}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{fmtUSD(colValue)}</span>
                </div>
                <div className="flex-1 space-y-2 p-2">
                  {items.map((d) => (
                    <DealCard key={d.id} deal={d} onOpen={() => setEditing(d)} onDragStart={() => setDragId(d.id)} onDragEnd={() => setDragId(null)} />
                  ))}
                  {items.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted-foreground/60">Drop deals here</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(creating || editing) && (
        <DealModal
          deal={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function DealCard({ deal, onOpen, onDragStart, onDragEnd }: { deal: Deal; onOpen: () => void; onDragStart: () => void; onDragEnd: () => void }) {
  const overdue = isOverdue(deal);
  return (
    <div draggable onDragStart={onDragStart} onDragEnd={onDragEnd} onClick={onOpen}
      className="group cursor-pointer rounded-xl border border-border bg-card p-3 text-sm shadow-sm hover:border-primary/40">
      <div className="flex items-start gap-1.5">
        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{deal.title}</p>
          {deal.company && <p className="truncate text-xs text-muted-foreground">{deal.company}</p>}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="font-semibold tabular-nums">{fmtUSD(deal.value_cents)}</span>
        <span className="text-xs text-muted-foreground">{dealProbability(deal)}%</span>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1 truncate">{deal.owner ? <><User className="h-3 w-3" />{deal.owner}</> : "—"}</span>
        {deal.expected_close_date && (
          <span className={cn("flex items-center gap-1", overdue && "font-medium text-red-500")}>
            <Calendar className="h-3 w-3" />{new Date(deal.expected_close_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        )}
      </div>
    </div>
  );
}

function DealModal({ deal, onClose, onSaved }: { deal: Deal | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: deal?.title ?? "",
    company: deal?.company ?? "",
    contact_name: deal?.contact_name ?? "",
    contact_email: deal?.contact_email ?? "",
    owner: deal?.owner ?? "",
    stage: (deal?.stage ?? "new") as DealStage,
    value: deal ? String(deal.value_cents / 100) : "",
    probability: deal?.probability != null ? String(deal.probability) : "",
    expected_close_date: deal?.expected_close_date ?? "",
    notes: deal?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.title.trim()) { setError("Title is required."); return; }
    setSaving(true); setError("");
    const body = {
      title: form.title, company: form.company, contact_name: form.contact_name, contact_email: form.contact_email,
      owner: form.owner, stage: form.stage,
      value_cents: Math.round((Number(form.value) || 0) * 100),
      probability: form.probability === "" ? null : Number(form.probability),
      expected_close_date: form.expected_close_date || null,
      notes: form.notes,
    };
    const res = deal
      ? await fetch(`/api/admin/sales/${deal.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await fetch("/api/admin/sales", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error ?? "Could not save."); setSaving(false); return; }
    onSaved();
  };

  const remove = async () => {
    if (!deal || !confirm("Delete this deal?")) return;
    setSaving(true);
    await fetch(`/api/admin/sales/${deal.id}`, { method: "DELETE" });
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-bold">{deal ? "Edit deal" : "New deal"}</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground hover:text-foreground" /></button>
        </div>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto p-5">
          <Field label="Deal title" required><input value={form.title} onChange={(e) => set("title", e.target.value)} className={inputCls} placeholder="DHRLife — Enterprise" /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Company"><input value={form.company} onChange={(e) => set("company", e.target.value)} className={inputCls} /></Field>
            <Field label="Deal owner"><input value={form.owner} onChange={(e) => set("owner", e.target.value)} className={inputCls} placeholder="Rep name" /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Contact name"><input value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} className={inputCls} /></Field>
            <Field label="Contact email"><input value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} className={inputCls} type="email" /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Stage">
              <select value={form.stage} onChange={(e) => set("stage", e.target.value)} className={inputCls}>
                {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Value ($/yr)"><input value={form.value} onChange={(e) => set("value", e.target.value)} className={inputCls} type="number" min={0} placeholder="0" /></Field>
            <Field label={`Probability (${STAGE_BY_KEY[form.stage]?.probability ?? 0}%)`}><input value={form.probability} onChange={(e) => set("probability", e.target.value)} className={inputCls} type="number" min={0} max={100} placeholder="auto" /></Field>
          </div>
          <Field label="Expected close date"><input value={form.expected_close_date} onChange={(e) => set("expected_close_date", e.target.value)} className={inputCls} type="date" /></Field>
          <Field label="Notes"><textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} className={cn(inputCls, "resize-none")} /></Field>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <div className="flex items-center justify-between border-t border-border px-5 py-4">
          {deal ? (
            <button onClick={remove} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /> Delete</button>
          ) : <span />}
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-5 py-2.5 text-sm font-semibold text-white shadow-glow disabled:opacity-60">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} {deal ? "Save" : "Create deal"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}{required && <span className="text-primary"> *</span>}</span>
      {children}
    </label>
  );
}
