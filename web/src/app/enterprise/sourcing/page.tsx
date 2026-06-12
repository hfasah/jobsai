"use client";

import { useState, useRef } from "react";
import {
  Sparkles, Search, Loader2, Send, Check, Users, Star, Briefcase,
  ExternalLink, ChevronRight, X, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

const EXAMPLE_PROMPTS = [
  "Senior DevOps engineers with Kubernetes and AWS experience",
  "Product managers with SaaS experience and strong technical background",
  "React frontend developers available in the next 30 days",
  "Sales executives who previously applied but were rejected from other roles",
  "Candidates who scored above 80 for engineering roles",
];

const REC_COLORS: Record<string, string> = {
  strong_yes: "text-green-400 bg-green-500/10 border-green-500/30",
  yes:        "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  maybe:      "text-amber-400 bg-amber-500/10 border-amber-500/30",
  no:         "text-slate-400 bg-slate-500/10 border-slate-500/30",
};
const REC_LABELS: Record<string, string> = {
  strong_yes: "Strong yes", yes: "Yes", maybe: "Maybe", no: "No",
};

type Candidate = {
  id: string; source: "application" | "pool";
  name: string; email: string; phone: string | null; linkedin: string | null;
  match_score: number; applied_for: string; stage: string;
  ai_summary: string; ai_rec: string; cover_snippet: string;
  fit_reason: string; relevance_score: number;
};

type OutreachStyle = "warm" | "professional" | "casual";

export default function SourcingPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Candidate[] | null>(null);
  const [totalSearched, setTotalSearched] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [outreachOpen, setOutreachOpen] = useState(false);
  const [outreachStyle, setOutreachStyle] = useState<OutreachStyle>("warm");
  const [jobId, setJobId] = useState("");
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = async (q = query) => {
    if (!q.trim()) return;
    setLoading(true);
    setResults(null);
    setSelected(new Set());
    setSentCount(null);
    const res = await fetch("/api/enterprise/sourcing/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: q, job_id: jobId || undefined }),
    });
    const json = await res.json();
    setResults(json.data?.candidates ?? []);
    setTotalSearched(json.data?.total_searched ?? 0);
    setLoading(false);
  };

  const toggle = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (!results) return;
    setSelected(new Set(results.map((c) => c.id)));
  };

  const sendOutreach = async () => {
    if (!results || selected.size === 0) return;
    setSending(true);
    const candidates = results
      .filter((c) => selected.has(c.id))
      .map((c) => ({ id: c.id, source: c.source, name: c.name, email: c.email, fit_reason: c.fit_reason }));

    const res = await fetch("/api/enterprise/sourcing/outreach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidates, job_id: jobId || undefined, message_style: outreachStyle }),
    });
    const json = await res.json();
    setSentCount(json.data?.sent ?? 0);
    setOutreachOpen(false);
    setSelected(new Set());
    setSending(false);
  };

  return (
    <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Sparkles className="h-6 w-6 text-primary" /> AI Talent Rediscovery
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Search your entire candidate database with natural language — past applicants, rejected candidates, talent pool. Find them before posting externally.
          </p>
        </div>

        {/* Search bar */}
        <div className="mb-4 rounded-2xl border border-border bg-card p-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && search()}
                placeholder="e.g. Senior DevOps engineers with Kubernetes experience in Toronto"
                className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              onClick={() => search()}
              disabled={loading || !query.trim()}
              className="btn-cta inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Search
            </button>
          </div>

          {/* Optional: link to a specific job for extra context */}
          <div className="mt-3 flex items-center gap-2">
            <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Optional: paste a Job ID to give the AI context about the specific role.
            </p>
            <input
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              placeholder="Job ID (optional)"
              className="ml-auto w-56 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Example prompts */}
        {!results && !loading && (
          <div className="mb-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Try asking</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => { setQuery(p); search(p); }}
                  className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary hover:text-foreground transition-colors"
                >
                  <ChevronRight className="h-3 w-3" /> {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Searching your candidate database…</p>
            <p className="text-xs text-muted-foreground/60">AI is ranking matches against your query</p>
          </div>
        )}

        {/* Success banner */}
        {sentCount !== null && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
            <Check className="h-4 w-4 shrink-0" />
            {sentCount} personalized outreach email{sentCount !== 1 ? "s" : ""} sent successfully.
          </div>
        )}

        {/* Results */}
        {results !== null && !loading && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">
                  {results.length === 0 ? "No matches found" : `${results.length} match${results.length !== 1 ? "es" : ""} found`}
                </p>
                <p className="text-xs text-muted-foreground">Searched {totalSearched} candidates in your database</p>
              </div>
              {results.length > 0 && (
                <div className="flex items-center gap-2">
                  <button onClick={selectAll} className="text-xs text-muted-foreground hover:text-foreground">
                    {selected.size === results.length ? "Deselect all" : "Select all"}
                  </button>
                  {selected.size > 0 && (
                    <button
                      onClick={() => setOutreachOpen(true)}
                      className="btn-cta inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold"
                    >
                      <Send className="h-3.5 w-3.5" /> Outreach ({selected.size})
                    </button>
                  )}
                </div>
              )}
            </div>

            {results.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border py-12 text-center">
                <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No candidates matched your query.</p>
                <p className="mt-1 text-xs text-muted-foreground">Try broader terms or different skills.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {results.map((c) => {
                  const isSelected = selected.has(c.id);
                  return (
                    <div
                      key={c.id}
                      onClick={() => toggle(c.id)}
                      className={cn(
                        "cursor-pointer rounded-2xl border p-4 transition-colors",
                        isSelected
                          ? "border-primary/50 bg-primary/5"
                          : "border-border bg-card hover:border-border/80 hover:bg-muted/30",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <div className={cn(
                          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                          isSelected ? "border-primary bg-primary" : "border-border",
                        )}>
                          {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{c.name}</p>
                            {/* Source badge */}
                            <span className={cn(
                              "rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                              c.source === "pool"
                                ? "border-purple-500/30 bg-purple-500/10 text-purple-400"
                                : "border-sky-500/30 bg-sky-500/10 text-sky-400",
                            )}>
                              {c.source === "pool" ? "Talent pool" : "Past applicant"}
                            </span>
                            {/* AI rec badge */}
                            {c.ai_rec && (
                              <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] font-medium", REC_COLORS[c.ai_rec] ?? "")}>
                                {REC_LABELS[c.ai_rec] ?? c.ai_rec}
                              </span>
                            )}
                            {/* Relevance score */}
                            <span className="ml-auto text-xs font-semibold text-primary">
                              {c.relevance_score}% match
                            </span>
                          </div>

                          <p className="mt-0.5 text-xs text-muted-foreground">{c.email}{c.phone ? ` · ${c.phone}` : ""}</p>

                          {c.applied_for && (
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                              <Briefcase className="h-3 w-3 shrink-0" />
                              Previously applied for: <span className="text-foreground">{c.applied_for}</span>
                              {c.stage && <span className="ml-1 text-muted-foreground/60">({c.stage})</span>}
                            </p>
                          )}

                          {/* AI fit reason */}
                          <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                            <Star className="mr-1 inline h-3 w-3 text-amber-400" />
                            {c.fit_reason}
                          </p>

                          {c.ai_summary && (
                            <p className="mt-1 text-xs text-muted-foreground/70 line-clamp-2">{c.ai_summary}</p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          {c.linkedin && (
                            <a href={c.linkedin} target="_blank" rel="noopener noreferrer"
                              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Outreach modal */}
      {outreachOpen && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setOutreachOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold"><Send className="h-4 w-4 text-primary" /> Send Outreach</h2>
              <button onClick={() => setOutreachOpen(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>

            <p className="mb-4 text-sm text-muted-foreground">
              AI will write a personalized email for each of the <strong className="text-foreground">{selected.size} selected candidate{selected.size !== 1 ? "s" : ""}</strong>, tailored to why they fit your search.
            </p>

            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email tone</label>
              <div className="flex gap-2">
                {(["warm", "professional", "casual"] as OutreachStyle[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setOutreachStyle(s)}
                    className={cn(
                      "flex-1 rounded-lg border py-2 text-sm font-medium capitalize transition-colors",
                      outreachStyle === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4 rounded-xl bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
              Each email will be unique — personalized with the candidate&apos;s name, previous role context, and your specific reason they&apos;re a fit. Sent from your connected Gmail or JobsAI.
            </div>

            <button
              onClick={sendOutreach}
              disabled={sending}
              className="btn-cta inline-flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? "Sending…" : `Send ${selected.size} personalized email${selected.size !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
