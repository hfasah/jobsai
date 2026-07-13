"use client";

// Pick candidates from the org's talent pool and enrol them straight into a
// campaign. The enroll route dedups (already-enrolled + cross-campaign active),
// so re-picking someone is safe.
import { useEffect, useMemo, useState } from "react";
import { Users, Loader2, Search } from "lucide-react";

interface PoolRow { id: string; candidate_name: string | null; candidate_email: string | null }

export default function TalentPoolPicker({ campaignId, onEnrolled }: { campaignId: string; onEnrolled: () => void }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PoolRow[]>([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/enterprise/talent-pool")
      .then((r) => r.json())
      .then((j) => setRows(((j.data ?? []) as PoolRow[]).filter((r) => r.candidate_email)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) => (r.candidate_name ?? "").toLowerCase().includes(t) || (r.candidate_email ?? "").toLowerCase().includes(t));
  }, [rows, q]);

  const toggle = (id: string) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allShownSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected((prev) => {
    const n = new Set(prev);
    if (allShownSelected) filtered.forEach((r) => n.delete(r.id));
    else filtered.forEach((r) => n.add(r.id));
    return n;
  });

  const enroll = async () => {
    const picks = rows.filter((r) => selected.has(r.id) && r.candidate_email);
    if (picks.length === 0) return;
    setAdding(true); setResult(null);
    const res = await fetch(`/api/enterprise/campaigns/${campaignId}/enroll`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidates: picks.map((r) => ({ name: r.candidate_name ?? "", email: r.candidate_email, source: "pool", source_id: r.id })) }),
    }).catch(() => null);
    setAdding(false);
    if (!res || !res.ok) { const j = await res?.json().catch(() => ({})); setResult(j?.error ?? "Could not add from the pool."); return; }
    const j = await res.json();
    const enrolled = j.data?.enrolled ?? picks.length;
    const skipped = j.data?.skipped ?? 0;
    setResult(`Added ${enrolled}${skipped ? ` · ${skipped} skipped (already in a campaign)` : ""}.`);
    setSelected(new Set());
    onEnrolled();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (rows.length === 0) return <p className="px-3 py-6 text-center text-sm text-muted-foreground">Your talent pool is empty. Add candidates to the pool first, or use Search above.</p>;

  return (
    <div className="p-3">
      <div className="mb-2 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter the pool by name or email…" className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <button onClick={toggleAll} className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted">{allShownSelected ? "Clear" : "Select all"}</button>
      </div>
      <div className="max-h-64 space-y-0.5 overflow-y-auto">
        {filtered.map((r) => (
          <label key={r.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/40">
            <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="h-4 w-4 accent-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{r.candidate_name || r.candidate_email}</p>
              <p className="truncate text-[11px] text-muted-foreground">{r.candidate_email}</p>
            </div>
          </label>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">{result ?? `${selected.size} selected`}</span>
        <button onClick={enroll} disabled={adding || selected.size === 0} className="btn-cta inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold disabled:opacity-50">
          {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
          Add {selected.size > 0 ? selected.size : ""} to campaign
        </button>
      </div>
    </div>
  );
}
