"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Sparkles, Loader2, Send, Check, Users, Star, Briefcase,
  ExternalLink, X, UserPlus, Clock, MailCheck, AlertCircle, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Candidate = {
  id: string;
  source: "application" | "pool";
  name: string;
  email: string;
  phone: string | null;
  linkedin: string | null;
  match_score: number;
  applied_for: string;
  stage: string;
  ai_summary: string;
  ai_rec: string;
  fit_reason: string;
  relevance_score: number;
};

type OutreachRecord = {
  id: string;
  candidate_name: string;
  candidate_email: string;
  subject: string | null;
  replied_at: string | null;
  reply_added_to_pipeline: boolean;
  follow_up_1_sent_at: string | null;
  follow_up_2_sent_at: string | null;
  unsubscribed: boolean;
  created_at: string;
};

const REC_COLORS: Record<string, string> = {
  strong_yes: "text-green-400 bg-green-500/10 border-green-500/30",
  yes:        "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  maybe:      "text-amber-400 bg-amber-500/10 border-amber-500/30",
  no:         "text-slate-400 bg-slate-500/10 border-slate-500/30",
};
const REC_LABELS: Record<string, string> = {
  strong_yes: "Strong yes", yes: "Yes", maybe: "Maybe", no: "No",
};

export function SourcingTab({ jobId, jobTitle }: { jobId: string; jobTitle: string }) {
  const [tab, setTab] = useState<"discover" | "history">("discover");

  // Discover tab
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [totalSearched, setTotalSearched] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [outreachSent, setOutreachSent] = useState<Set<string>>(new Set());

  // History tab
  const [history, setHistory] = useState<OutreachRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const runSearch = useCallback(async () => {
    setLoading(true);
    setSearched(true);
    setSelected(new Set());
    const res = await fetch("/api/enterprise/sourcing/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: jobTitle, job_id: jobId, limit: 20 }),
    });
    const json = await res.json();
    setCandidates(json.data?.candidates ?? []);
    setTotalSearched(json.data?.total_searched ?? 0);
    setLoading(false);
  }, [jobId, jobTitle]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    const res = await fetch(`/api/enterprise/sourcing/history?jobId=${jobId}`);
    const json = await res.json();
    setHistory(json.data ?? []);
    setHistoryLoading(false);
  }, [jobId]);

  useEffect(() => {
    // Auto-run search when tab mounts
    runSearch();
  }, [runSearch]);

  useEffect(() => {
    if (tab === "history") loadHistory();
  }, [tab, loadHistory]);

  const toggle = (id: string) => {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const addToPipeline = async (cand: Candidate) => {
    setAddingId(cand.id);
    const res = await fetch(`/api/enterprise/jobs/${jobId}/applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        candidate_name: cand.name,
        candidate_email: cand.email,
        candidate_phone: cand.phone ?? undefined,
        source: "sourced",
      }),
    });
    if (res.ok || res.status === 409) {
      setAddedIds((s) => new Set(s).add(cand.id));
    }
    setAddingId(null);
  };

  const sendOutreach = async (candidateList: Candidate[]) => {
    setSending(true);
    const candidates = candidateList.map((c) => ({
      id: c.id, source: c.source, name: c.name, email: c.email, fit_reason: c.fit_reason,
    }));
    await fetch("/api/enterprise/sourcing/outreach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidates, job_id: jobId, message_style: "warm" }),
    });
    setOutreachSent((s) => { const n = new Set(s); candidateList.forEach((c) => n.add(c.id)); return n; });
    setSelected(new Set());
    setSending(false);
  };

  const historyAction = async (id: string, action: string) => {
    setActingId(id);
    const res = await fetch(`/api/enterprise/sourcing/outreach/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) await loadHistory();
    setActingId(null);
  };

  const selectedCandidates = candidates.filter((c) => selected.has(c.id));

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-lg">
              <Sparkles className="h-5 w-5 text-primary" /> AI Sourcing
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Candidates from your database who match <strong>{jobTitle}</strong>.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-border bg-muted/40 p-0.5">
              <button onClick={() => setTab("discover")} className={cn("rounded-md px-3 py-1 text-xs font-medium transition-colors", tab === "discover" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
                Discover
              </button>
              <button onClick={() => setTab("history")} className={cn("rounded-md px-3 py-1 text-xs font-medium transition-colors", tab === "history" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
                Outreach history
              </button>
            </div>
          </div>
        </div>

        {/* Discover tab */}
        {tab === "discover" && (
          <>
            {/* Actions bar */}
            {searched && !loading && candidates.length > 0 && (
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{candidates.length}</span> matches from {totalSearched} candidates
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={runSearch} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted">
                    <RefreshCw className="h-3 w-3" /> Refresh
                  </button>
                  <button
                    onClick={() => setSelected(selected.size === candidates.length ? new Set() : new Set(candidates.map((c) => c.id)))}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {selected.size === candidates.length ? "Deselect all" : "Select all"}
                  </button>
                  {selected.size > 0 && (
                    <button
                      onClick={() => sendOutreach(selectedCandidates)}
                      disabled={sending}
                      className="btn-cta inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                    >
                      {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      Outreach ({selected.size})
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium">Searching your candidate database…</p>
                <p className="text-xs text-muted-foreground">AI is matching against "{jobTitle}"</p>
              </div>
            )}

            {/* Empty */}
            {searched && !loading && candidates.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border py-14 text-center">
                <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No matching candidates found in your database.</p>
                <p className="mt-1 text-xs text-muted-foreground">As more candidates apply and are screened, they'll appear here.</p>
              </div>
            )}

            {/* Results */}
            {!loading && candidates.length > 0 && (
              <div className="space-y-2">
                {candidates.map((c) => {
                  const isSelected = selected.has(c.id);
                  const isAdded = addedIds.has(c.id);
                  const isSent = outreachSent.has(c.id);
                  return (
                    <div
                      key={c.id}
                      className={cn(
                        "rounded-2xl border p-4 transition-colors",
                        isSelected ? "border-primary/50 bg-primary/5" : "border-border bg-card",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <button
                          onClick={() => toggle(c.id)}
                          disabled={isAdded}
                          className={cn(
                            "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                            isSelected ? "border-primary bg-primary" : "border-border",
                            isAdded && "opacity-40 cursor-not-allowed",
                          )}
                        >
                          {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{c.name}</p>
                            <span className={cn(
                              "rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                              c.source === "pool"
                                ? "border-purple-500/30 bg-purple-500/10 text-purple-400"
                                : "border-sky-500/30 bg-sky-500/10 text-sky-400",
                            )}>
                              {c.source === "pool" ? "Talent pool" : "Past applicant"}
                            </span>
                            {c.ai_rec && (
                              <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] font-medium", REC_COLORS[c.ai_rec] ?? "")}>
                                {REC_LABELS[c.ai_rec] ?? c.ai_rec}
                              </span>
                            )}
                            <span className="ml-auto text-xs font-bold text-primary">{c.relevance_score}% match</span>
                          </div>

                          <p className="mt-0.5 text-xs text-muted-foreground">{c.email}</p>

                          {c.applied_for && (
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                              <Briefcase className="h-3 w-3 shrink-0" />
                              Applied for: <span className="text-foreground">{c.applied_for}</span>
                            </p>
                          )}

                          <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                            <Star className="mr-1 inline h-3 w-3 text-amber-400" />
                            {c.fit_reason}
                          </p>
                        </div>

                        {/* Per-card actions */}
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <button
                            onClick={() => addToPipeline(c)}
                            disabled={isAdded || addingId === c.id}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                              isAdded
                                ? "border-green-500/30 bg-green-500/10 text-green-400"
                                : "border-border text-muted-foreground hover:border-primary hover:text-primary",
                            )}
                          >
                            {addingId === c.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : isAdded
                              ? <Check className="h-3 w-3" />
                              : <UserPlus className="h-3 w-3" />}
                            {isAdded ? "Added" : "Add to pipeline"}
                          </button>
                          <button
                            onClick={() => sendOutreach([c])}
                            disabled={sending || isSent}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                              isSent
                                ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
                                : "border-border text-muted-foreground hover:border-primary hover:text-primary",
                            )}
                          >
                            {isSent ? <Check className="h-3 w-3" /> : <Send className="h-3 w-3" />}
                            {isSent ? "Sent" : "Outreach"}
                          </button>
                          {c.linkedin && (
                            <a href={c.linkedin} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted">
                              <ExternalLink className="h-3 w-3" /> LinkedIn
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Outreach history tab */}
        {tab === "history" && (
          <>
            {historyLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : history.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border py-12 text-center">
                <Send className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No outreach sent for this job yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((r) => {
                  const replied = !!r.replied_at;
                  const inPipeline = r.reply_added_to_pipeline;
                  const unsub = r.unsubscribed;
                  return (
                    <div key={r.id} className={cn("rounded-xl border bg-card p-3.5", unsub && "opacity-60")}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{r.candidate_name}</p>
                            {replied && <span className="flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/10 px-1.5 py-0.5 text-[10px] text-green-400"><MailCheck className="h-2.5 w-2.5" /> Replied</span>}
                            {inPipeline && <span className="flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-400"><UserPlus className="h-2.5 w-2.5" /> In pipeline</span>}
                            {unsub && <span className="flex items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground"><X className="h-2.5 w-2.5" /> Unsubscribed</span>}
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">{r.candidate_email}</p>
                          <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Sent {new Date(r.created_at).toLocaleDateString()}</span>
                            {r.follow_up_1_sent_at && <span className="text-blue-400/70">FU1 sent</span>}
                            {r.follow_up_2_sent_at && <span className="text-blue-400/70">FU2 sent</span>}
                          </div>
                        </div>
                        {!unsub && (
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            {!replied && (
                              <button
                                onClick={() => historyAction(r.id, "mark_replied")}
                                disabled={actingId === r.id}
                                className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] text-muted-foreground hover:border-green-500/50 hover:text-green-400"
                              >
                                {actingId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <MailCheck className="h-3 w-3" />}
                                Mark replied
                              </button>
                            )}
                            {replied && !inPipeline && (
                              <button
                                onClick={() => historyAction(r.id, "add_to_pipeline")}
                                disabled={actingId === r.id}
                                className="inline-flex items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-[11px] text-blue-400 hover:bg-blue-500/20"
                              >
                                {actingId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
                                Add to pipeline
                              </button>
                            )}
                            <button
                              onClick={() => historyAction(r.id, "unsubscribe")}
                              disabled={actingId === r.id}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-muted-foreground/50 hover:text-muted-foreground"
                            >
                              <AlertCircle className="h-3 w-3" /> Unsubscribe
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
