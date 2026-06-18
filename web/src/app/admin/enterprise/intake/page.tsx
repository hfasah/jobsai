"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Clock, Sparkles, Building2, Copy, Check, ArrowLeft, ClipboardList, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import { toolLabel, type ToolPref } from "@/lib/enterprise-intake";
import { QuoteBuilder } from "@/components/enterprise/quote-builder";

interface Intake {
  id: string; company: string; website: string | null;
  contact_name: string; contact_email: string; contact_phone: string | null;
  num_employees: string | null; num_recruiters: number | null; hiring_volume: string | null;
  industry: string | null; current_tools: string | null;
  tool_prefs: Record<string, ToolPref>; notes: string | null;
  suggested_plan: string | null; status: string; org_id: string | null; created_at: string;
}

const STATUS_BADGE: Record<string, string> = {
  new: "bg-amber-500/15 text-amber-400",
  reviewed: "bg-sky-500/15 text-sky-400",
  converted: "bg-emerald-500/15 text-emerald-400",
  archived: "bg-muted text-muted-foreground",
};
const PREF_BADGE: Record<ToolPref, string> = {
  need: "bg-emerald-500/15 text-emerald-400",
  want: "bg-primary/15 text-primary",
  unsure: "bg-amber-500/15 text-amber-400",
  no: "bg-muted text-muted-foreground",
};
const PREF_LABEL: Record<ToolPref, string> = { need: "Need", want: "Want", unsure: "Not sure", no: "No" };

function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
  return `${Math.floor(d / 86_400_000)}d ago`;
}

const FORM_URL = (typeof window !== "undefined" ? window.location.origin : "https://app.jobsai.work") + "/enterprise/intake";

export default function AdminIntake() {
  const [rows, setRows] = useState<Intake[]>([]);
  const [selected, setSelected] = useState<Intake | null>(null);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("new");
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ invite_url: string | null } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/enterprise/intake?status=${filter}`);
    const json = await res.json();
    setRows(json.data ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const open = (r: Intake) => { setSelected(r); setResult(null); };

  const createAccount = async () => {
    if (!selected) return;
    setCreating(true);
    const needs = Object.entries(selected.tool_prefs).filter(([, v]) => v === "need").map(([k]) => toolLabel(k));
    const wants = Object.entries(selected.tool_prefs).filter(([, v]) => v === "want").map(([k]) => toolLabel(k));
    const planLabel = selected.suggested_plan ? selected.suggested_plan[0].toUpperCase() + selected.suggested_plan.slice(1) : "Enterprise";
    const notes = [
      `From intake form. Employees: ${selected.num_employees ?? "—"}, recruiter seats: ${selected.num_recruiters ?? "—"}, hiring: ${selected.hiring_volume ?? "—"}.`,
      selected.current_tools ? `Currently uses: ${selected.current_tools}.` : "",
      needs.length ? `Needs: ${needs.join(", ")}.` : "",
      wants.length ? `Wants: ${wants.join(", ")}.` : "",
      selected.notes ? `Notes: ${selected.notes}` : "",
    ].filter(Boolean).join(" ");

    const res = await fetch("/api/admin/enterprise", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: selected.company,
        owner_email: selected.contact_email,
        contact_name: selected.contact_name,
        contact_phone: selected.contact_phone ?? undefined,
        industry: selected.industry ?? undefined,
        plan_slug: selected.suggested_plan ?? undefined, // sets plan_id → full entitlements
        plan_label: planLabel,
        admin_notes: notes,
      }),
    });
    const json = await res.json();
    setCreating(false);
    if (!res.ok) { setResult({ invite_url: null }); alert(json.error ?? "Could not create account."); return; }
    const orgId = json.data?.org?.id;
    if (orgId) await fetch(`/api/admin/enterprise/intake/${selected.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "converted", org_id: orgId }) });
    setResult({ invite_url: json.data?.invite_url ?? null });
    load();
  };

  const setStatus = async (status: string) => {
    if (!selected) return;
    await fetch(`/api/admin/enterprise/intake/${selected.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    setSelected((s) => s ? { ...s, status } : s);
    load();
  };

  const copyUrl = () => { navigator.clipboard.writeText(FORM_URL); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/enterprise" className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3 w-3" /> Enterprise</Link>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><ClipboardList className="h-5 w-5 text-primary" /> Intake leads</h1>
        </div>
        <button onClick={copyUrl} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted">
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />} Copy form link
        </button>
      </div>

      <div className="flex gap-2">
        {["new", "reviewed", "converted", "all"].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={cn("rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors", filter === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted")}>{s}</button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* List */}
        <div className="lg:col-span-2 overflow-hidden rounded-2xl border border-border bg-card">
          {loading ? (
            <div className="flex h-40 items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading…</div>
          ) : rows.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-center text-sm text-muted-foreground">No {filter} leads.<br />Share the form link to collect some.</div>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((r) => (
                <li key={r.id}>
                  <button onClick={() => open(r)} className={cn("w-full px-4 py-3 text-left transition-colors hover:bg-muted/30", selected?.id === r.id && "bg-primary/5 border-l-2 border-primary")}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{r.company}</p>
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize", STATUS_BADGE[r.status] ?? STATUS_BADGE.new)}>{r.status}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{r.contact_name} · {r.contact_email}</p>
                    <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
                      {r.suggested_plan && <span className="flex items-center gap-1"><Sparkles className="h-3 w-3 text-primary" />{r.suggested_plan}</span>}
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{timeAgo(r.created_at)}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Detail */}
        <div className="lg:col-span-3">
          {!selected ? (
            <div className="flex h-64 items-center justify-center rounded-2xl border border-border bg-card text-sm text-muted-foreground">Select a lead to review and create an account</div>
          ) : (
            <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-lg font-bold">{selected.company}{selected.website ? <span className="ml-2 text-sm font-normal text-muted-foreground">{selected.website}</span> : null}</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">{selected.contact_name} · {selected.contact_email}{selected.contact_phone ? ` · ${selected.contact_phone}` : ""}</p>
                </div>
                {selected.suggested_plan && (
                  <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Suggested</p>
                    <p className="flex items-center gap-1 text-sm font-bold text-primary"><Sparkles className="h-3.5 w-3.5" />{selected.suggested_plan[0].toUpperCase() + selected.suggested_plan.slice(1)}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                {[["Employees", selected.num_employees], ["Recruiter seats", selected.num_recruiters], ["Hiring/yr", selected.hiring_volume], ["Industry", selected.industry]].map(([k, v]) => (
                  <div key={k as string} className="rounded-lg border border-border bg-background p-2.5"><p className="text-[10px] text-muted-foreground">{k}</p><p className="font-medium">{v ?? "—"}</p></div>
                ))}
              </div>
              {selected.current_tools && <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">Uses today:</span> {selected.current_tools}</p>}

              {/* Tool selections */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tool interest</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(selected.tool_prefs).filter(([, v]) => v !== "no").sort((a, b) => (a[1] === "need" ? 0 : 1) - (b[1] === "need" ? 0 : 1)).map(([k, v]) => (
                    <span key={k} className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", PREF_BADGE[v])}>{toolLabel(k)} · {PREF_LABEL[v]}</span>
                  ))}
                  {Object.values(selected.tool_prefs).every((v) => v === "no") && <span className="text-sm text-muted-foreground">No tools selected.</span>}
                </div>
              </div>

              {selected.notes && <div className="rounded-xl bg-muted/30 p-3 text-sm whitespace-pre-wrap">{selected.notes}</div>}

              {/* Actions */}
              {result ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-500"><Check className="h-4 w-4" /> Account created for {selected.company}</p>
                  {result.invite_url && <p className="mt-2 break-all text-xs text-muted-foreground">Owner invite: <span className="text-primary">{result.invite_url}</span></p>}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                  <button onClick={createAccount} disabled={creating || selected.status === "converted"} className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-5 py-2.5 text-sm font-semibold text-white shadow-glow disabled:opacity-60">
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
                    {selected.status === "converted" ? "Already created" : "Create account"}
                  </button>
                  <button onClick={() => setQuoteOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/5 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10">
                    <Calculator className="h-4 w-4" /> Build quote
                  </button>
                  <button onClick={() => setStatus("reviewed")} className="rounded-xl border border-border px-3 py-2.5 text-sm font-medium hover:bg-muted">Mark reviewed</button>
                  <button onClick={() => setStatus("archived")} className="rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground">Archive</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {quoteOpen && selected && (
        <QuoteBuilder
          lead={{
            id: selected.id,
            company: selected.company,
            contact_name: selected.contact_name,
            contact_email: selected.contact_email,
            num_recruiters: selected.num_recruiters,
            tool_prefs: selected.tool_prefs,
            suggested_plan: selected.suggested_plan,
          }}
          onClose={() => setQuoteOpen(false)}
          onConverted={() => { setQuoteOpen(false); load(); }}
        />
      )}
    </div>
  );
}
