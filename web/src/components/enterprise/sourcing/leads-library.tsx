"use client";

// My Leads — the client's OWNED lead inventory. Every candidate they've paid to
// reveal, across all searches, decoupled from any run or campaign. Search it,
// and bulk-add into a campaign / talent pool / CRM anytime ("buy now, use
// later"). Backed by /api/enterprise/sourcing/leads; add-to actions reuse the
// same ImportDialog the search results use (leads are already revealed, so no
// reveal spend).
import { useCallback, useEffect, useState } from "react";
import {
  Users, Search, Loader2, Mail, Phone, Linkedin, MapPin, Building2, Download,
  CheckCircle2, Send, RefreshCw, Coins,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ImportDialog from "./import-dialog";

interface Lead {
  id: string;
  result_id: string | null;
  full_name: string | null;
  job_title: string | null;
  company: string | null;
  location: string | null;
  linkedin_url: string | null;
  email: string | null;
  email_status: string | null;
  phone: string | null;
  revealed_at: string | null;
  provider_key: string;
  in_campaign: boolean;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function LeadsLibrary() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (searchQ: string, nextOffset: number, append: boolean) => {
    setLoading(true);
    const res = await fetch(`/api/enterprise/sourcing/leads?q=${encodeURIComponent(searchQ)}&offset=${nextOffset}`);
    const j = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) { setNotice(j.error ?? "Could not load leads."); return; }
    const rows = (j.data ?? []) as Lead[];
    setLeads((prev) => (append ? [...prev, ...rows] : rows));
    setTotal(j.total ?? rows.length);
    setOffset(nextOffset);
    setHasMore(!!j.has_more);
  }, []);

  // Load on mount and whenever the (debounced) search changes. The setTimeout
  // keeps the setState out of the effect body (no cascading-render lint) and
  // also debounces typing. Fires immediately on mount because q starts empty.
  useEffect(() => {
    const t = setTimeout(() => { setSelected(new Set()); load(q, 0, false); }, q ? 350 : 0);
    return () => clearTimeout(t);
  }, [q, load]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  const allOnPage = leads.length > 0 && leads.every((l) => selected.has(l.id));
  const toggleAll = () =>
    setSelected((s) => {
      if (allOnPage) return new Set();
      const n = new Set(s); leads.forEach((l) => n.add(l.id)); return n;
    });

  // Selected leads that can be actioned (have a result id to drive import).
  const selectedLeads = leads.filter((l) => selected.has(l.id));
  const selectedResultIds = selectedLeads.map((l) => l.result_id).filter((x): x is string => !!x);

  const exportCsv = () => {
    const rows = selectedLeads.length ? selectedLeads : leads;
    const header = ["Name", "Title", "Company", "Location", "Email", "Email status", "Phone", "LinkedIn", "Revealed"];
    const esc = (v: string | null) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const body = rows.map((l) =>
      [l.full_name, l.job_title, l.company, l.location, l.email, l.email_status, l.phone, l.linkedin_url, fmtDate(l.revealed_at)]
        .map(esc).join(","),
    );
    const csv = [header.map(esc).join(","), ...body].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `my-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search owned leads by name, title, or company…"
            className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button
          onClick={() => { setSelected(new Set()); load(q, 0, false); }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Refresh
        </button>
      </div>

      {notice && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="flex-1">{notice}</span>
          {/credit|top up/i.test(notice) && (
            <a href="/enterprise/sourcing/credits" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
              <Coins className="h-3 w-3" /> Top up
            </a>
          )}
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
            <button
              onClick={() => setImporting(true)}
              disabled={selectedResultIds.length === 0}
              className="btn-cta inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
              title={selectedResultIds.length === 0 ? "These leads can't be actioned" : undefined}
            >
              <Send className="h-3.5 w-3.5" /> Add {selectedResultIds.length || selected.size} to…
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {leads.length === 0 && !loading ? (
        <div className="rounded-2xl border border-dashed border-border py-14 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          <h2 className="text-base font-semibold">No owned leads yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {q
              ? "No leads match your search."
              : "Search external sources and reveal a contact — every lead you unlock is stored here, yours to use in a campaign anytime."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border">
          {/* Header row */}
          <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <input type="checkbox" checked={allOnPage} onChange={toggleAll} className="h-3.5 w-3.5 rounded border-border" aria-label="Select all on page" />
            <span className="flex-1">Lead</span>
            <span className="hidden w-40 sm:block">Contact</span>
            <span className="hidden w-24 text-right md:block">Revealed</span>
          </div>
          {leads.map((l) => {
            const on = selected.has(l.id);
            return (
              <div key={l.id} className={cn("flex items-center gap-3 border-b border-border/60 px-4 py-3 last:border-0", on && "bg-primary/5")}>
                <input type="checkbox" checked={on} onChange={() => toggle(l.id)} className="h-3.5 w-3.5 shrink-0 rounded border-border" aria-label={`Select ${l.full_name ?? "lead"}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{l.full_name ?? "—"}</span>
                    {l.in_campaign && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        <Send className="h-2.5 w-2.5" /> In campaign
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                    {l.job_title && <span className="truncate">{l.job_title}</span>}
                    {l.company && <span className="inline-flex items-center gap-0.5"><Building2 className="h-3 w-3" />{l.company}</span>}
                    {l.location && <span className="inline-flex items-center gap-0.5"><MapPin className="h-3 w-3" />{l.location}</span>}
                  </div>
                </div>
                <div className="hidden w-40 shrink-0 flex-col gap-0.5 text-[11px] sm:flex">
                  {l.email && <span className="inline-flex items-center gap-1 truncate text-foreground"><Mail className="h-3 w-3 shrink-0 text-primary" />{l.email}</span>}
                  {l.phone && <span className="inline-flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3 shrink-0" />{l.phone}</span>}
                  {l.linkedin_url && (
                    <a href={l.linkedin_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary">
                      <Linkedin className="h-3 w-3 shrink-0" /> Profile
                    </a>
                  )}
                </div>
                <span className="hidden w-24 shrink-0 text-right text-[11px] text-muted-foreground md:block">{fmtDate(l.revealed_at)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer: count + load more */}
      {leads.length > 0 && (
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>Showing {leads.length} of {total} owned lead{total !== 1 ? "s" : ""}</span>
          {hasMore && (
            <button
              onClick={() => load(q, offset + 50, true)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 font-medium hover:bg-muted disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Load more
            </button>
          )}
        </div>
      )}

      {importing && (
        <ImportDialog
          resultIds={selectedResultIds}
          onClose={() => setImporting(false)}
          onDone={(msg) => {
            setImporting(false);
            setNotice(msg);
            setSelected(new Set());
            load(q, 0, false);
          }}
        />
      )}
    </div>
  );
}
