"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus, Loader2, Briefcase, MapPin, Search, X, ChevronDown, Check,
  TrendingUp, FileText, Star, Send, Zap, CheckCircle2, Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BulkApplyBar, type BulkJob } from "@/components/apply/bulk-apply-bar";
import { boardForUrl } from "@/lib/job-boards";
import { CreditConfirmModal } from "@/components/credit-confirm-modal";
import { ApplyMethodModal } from "@/components/apply-method-modal";
import { extensionMaybeInstalled } from "@/lib/extension-bridge";

// ─── Types ────────────────────────────────────────────────────────────────────

interface JobListItem {
  id: string;
  status: string;
  source_url: string | null;
  posting_url: string | null;
  created_at: string;
  parsed: {
    title: string | null;
    company: string | null;
    location: string | null;
    seniority: string | null;
  } | null;
  match: { match_score: number } | null;
  progress?: {
    tailored: boolean;
    cover: boolean;
    ats: boolean;
    applied: boolean;
    report: boolean;
  };
}

type ScoreFilter = "all" | "great" | "good" | "fair" | "none";
type StatusFilter = "all" | "ready" | "processing" | "failed";
type SortKey = "newest" | "oldest" | "score_desc" | "score_asc";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number) {
  return score >= 75
    ? "text-desyn-success bg-desyn-success/15"
    : score >= 50
    ? "text-desyn-warning bg-desyn-warning/15"
    : "text-destructive bg-destructive/15";
}

function matchesScoreFilter(job: JobListItem, f: ScoreFilter) {
  const s = job.match?.match_score;
  if (f === "all") return true;
  if (f === "none") return s == null;
  if (s == null) return false;
  if (f === "great") return s >= 75;
  if (f === "good") return s >= 50 && s < 75;
  if (f === "fair") return s < 50;
  return true;
}

function matchesStatusFilter(job: JobListItem, f: StatusFilter) {
  if (f === "all") return true;
  if (f === "processing") return job.status === "processing" || job.status === "created";
  return job.status === f;
}

function applySort(jobs: JobListItem[], sort: SortKey) {
  return [...jobs].sort((a, b) => {
    if (sort === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sort === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    const sa = a.match?.match_score ?? -1;
    const sb = b.match?.match_score ?? -1;
    return sort === "score_desc" ? sb - sa : sa - sb;
  });
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({ jobs }: { jobs: JobListItem[] }) {
  const total = jobs.length;
  const tailored = jobs.filter((j) => j.progress?.tailored).length;
  const applied  = jobs.filter((j) => j.progress?.applied).length;
  const scored   = jobs.filter((j) => j.match?.match_score != null);
  const avgScore = scored.length
    ? Math.round(scored.reduce((s, j) => s + (j.match!.match_score), 0) / scored.length)
    : null;

  const stats = [
    { label: "Total Jobs",   value: total,                      icon: FileText,   color: "text-primary",        bg: "bg-primary/10"        },
    { label: "Résumés Tailored", value: tailored,               icon: Star,       color: "text-desyn-accent",   bg: "bg-desyn-accent/10"   },
    { label: "Avg Match Score",  value: avgScore != null ? `${avgScore}%` : "—", icon: TrendingUp, color: "text-desyn-success", bg: "bg-desyn-success/10" },
    { label: "Applied",      value: applied,                    icon: Send,       color: "text-desyn-warning",  bg: "bg-desyn-warning/10"  },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map(({ label, value, icon: Icon, color, bg }) => (
        <div key={label} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", bg)}>
              <Icon className={cn("h-4 w-4", color)} />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

const SCORE_OPTIONS: { value: ScoreFilter; label: string }[] = [
  { value: "all",   label: "All scores" },
  { value: "great", label: "Great 75+" },
  { value: "good",  label: "Good 50–74" },
  { value: "fair",  label: "Fair <50" },
  { value: "none",  label: "Unscored" },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all",        label: "All statuses" },
  { value: "ready",      label: "Ready" },
  { value: "processing", label: "Processing" },
  { value: "failed",     label: "Failed" },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "newest",     label: "Newest first" },
  { value: "oldest",     label: "Oldest first" },
  { value: "score_desc", label: "Score: high → low" },
  { value: "score_asc",  label: "Score: low → high" },
];

function FilterBar({
  search, setSearch,
  scoreFilter, setScoreFilter,
  statusFilter, setStatusFilter,
  sort, setSort,
  total, filtered,
}: {
  search: string; setSearch: (v: string) => void;
  scoreFilter: ScoreFilter; setScoreFilter: (v: ScoreFilter) => void;
  statusFilter: StatusFilter; setStatusFilter: (v: StatusFilter) => void;
  sort: SortKey; setSort: (v: SortKey) => void;
  total: number; filtered: number;
}) {
  const hasFilters = search || scoreFilter !== "all" || statusFilter !== "all" || sort !== "newest";

  const clearAll = () => {
    setSearch("");
    setScoreFilter("all");
    setStatusFilter("all");
    setSort("newest");
  };

  return (
    <div className="space-y-3">
      {/* Search + sort row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or company…"
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Sort dropdown */}
        <div className="relative">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-full appearance-none rounded-lg border border-border bg-background py-2 pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      {/* Filter pills row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Score filter */}
        <div className="flex rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
          {SCORE_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setScoreFilter(o.value)}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition-colors",
                scoreFilter === o.value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
          {STATUS_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setStatusFilter(o.value)}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition-colors",
                statusFilter === o.value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* Count + clear */}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {filtered === total ? `${total} jobs` : `${filtered} of ${total}`}
          </span>
          {hasFilters && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [search, setSearch] = useState("");
  const [scoreFilter, setScoreFilter] = useState<ScoreFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("newest");

  // Bulk-apply selection
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  // Per-job agent-apply state
  const [agentStates, setAgentStates] = useState<Record<string, "running" | "done" | "error">>({});
  const [agentBulkRunning, setAgentBulkRunning] = useState(false);

  // Credits + apply engine
  const [balance, setBalance] = useState(0);
  const [applyCost, setApplyCost] = useState(600);      // Skyvern (server-side)
  const [extCost, setExtCost] = useState(10);           // extension (client-side)
  const [freeApplies, setFreeApplies] = useState(0);
  const [dailyCap, setDailyCap] = useState(20);
  const [extInstalled, setExtInstalled] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; jobIds: string[] }>({ open: false, jobIds: [] });
  const [methodModal, setMethodModal] = useState<{ open: boolean; jobIds: string[] }>({ open: false, jobIds: [] });

  const fetchTokens = useCallback(async () => {
    try {
      const r = await fetch("/api/tokens");
      const j = await r.json();
      if (j.data) {
        setBalance(j.data.balance ?? 0);
        setFreeApplies(j.data.free_applies ?? 0);
        if (j.data.costs?.auto_apply) setApplyCost(j.data.costs.auto_apply);
        if (j.data.costs?.extension_apply) setExtCost(j.data.costs.extension_apply);
        if (j.data.daily_apply_cap) setDailyCap(j.data.daily_apply_cap);
      }
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => { fetchTokens(); }, [fetchTokens]);

  const agentApplyOne = useCallback(async (jobId: string) => {
    setAgentStates((p) => ({ ...p, [jobId]: "running" }));
    try {
      const res = await fetch(`/api/jobs/${jobId}/agent-apply`, { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setAgentStates((p) => ({ ...p, [jobId]: "done" }));
        setSelected((prev) => { const n = new Set(prev); n.delete(jobId); return n; });
        fetchTokens();
      } else {
        setAgentStates((p) => ({ ...p, [jobId]: "error" }));
        if (json.error) alert(json.error);
      }
    } catch {
      setAgentStates((p) => ({ ...p, [jobId]: "error" }));
    }
  }, [fetchTokens]);

  // Two-tier apply: show method modal if extension not installed, else credit confirm.
  const requestAgentApply = useCallback((jobIds: string[]) => {
    if (jobIds.length === 0) return;
    if (extInstalled) setConfirmModal({ open: true, jobIds });
    else setMethodModal({ open: true, jobIds });
  }, [extInstalled]);

  // Confirmed from credit-confirm modal → run Skyvern apply.
  const confirmAgentApply = useCallback(async () => {
    const ids = confirmModal.jobIds;
    setConfirmModal({ open: false, jobIds: [] });
    if (ids.length === 0) return;
    setAgentBulkRunning(true);
    for (const id of ids) {
      await agentApplyOne(id);
    }
    setAgentBulkRunning(false);
  }, [confirmModal.jobIds, agentApplyOne]);

  // Chose "apply while you sleep" from method modal → autonomous (Skyvern).
  const sleepApply = useCallback(async () => {
    const ids = methodModal.jobIds;
    setMethodModal({ open: false, jobIds: [] });
    if (ids.length === 0) return;
    setAgentBulkRunning(true);
    for (const id of ids) {
      await agentApplyOne(id);
    }
    setAgentBulkRunning(false);
  }, [methodModal.jobIds, agentApplyOne]);

  const fetchJobs = useCallback(async () => {
    const res = await fetch("/api/jobs");
    const json = await res.json();
    if (json.data) setJobs(json.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 4000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  useEffect(() => {
    setExtInstalled(extensionMaybeInstalled());
  }, []);

  const filteredJobs = useMemo(() => {
    const result = jobs.filter((job) => {
      const parsed = Array.isArray(job.parsed) ? job.parsed[0] : job.parsed;
      const q = search.toLowerCase();
      if (q) {
        const title = (parsed?.title ?? "").toLowerCase();
        const company = (parsed?.company ?? "").toLowerCase();
        if (!title.includes(q) && !company.includes(q)) return false;
      }
      if (!matchesScoreFilter(job, scoreFilter)) return false;
      if (!matchesStatusFilter(job, statusFilter)) return false;
      return true;
    });
    return applySort(result, sort);
  }, [jobs, search, scoreFilter, statusFilter, sort]);

  const jobUrl = (j: JobListItem) => j.posting_url || j.source_url || null;

  // Only "ready" jobs are selectable for apply.
  const selectableIds = useMemo(
    () => filteredJobs.filter((j) => j.status === "ready").map((j) => j.id),
    [filteredJobs]
  );
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const toggleSelectAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) selectableIds.forEach((id) => next.delete(id));
      else selectableIds.forEach((id) => next.add(id));
      return next;
    });

  const selectedBulkJobs: BulkJob[] = useMemo(
    () =>
      jobs
        .filter((j) => selected.has(j.id))
        .map((j) => {
          const parsed = Array.isArray(j.parsed) ? j.parsed[0] : j.parsed;
          return { id: j.id, title: parsed?.title ?? "Untitled role", company: parsed?.company ?? null, url: jobUrl(j) };
        }),
    [jobs, selected]
  );

  return (
    <>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wider text-desyn-accent">
              Job tracker
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Your Jobs</h1>
          </div>
          <Button render={<Link href="/dashboard/jobs/import" />}>
            <Plus className="mr-1.5 h-4 w-4" />
            Import job
          </Button>
        </div>

        {!loading && jobs.length > 0 && (
          <div className="mt-6">
            <StatsBar jobs={jobs} />
          </div>
        )}

        {loading ? (
          <div className="mt-12 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading jobs…
          </div>
        ) : jobs.length === 0 ? (
          <div className="mt-12 rounded-xl border border-dashed border-border p-12 text-center">
            <Briefcase className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">No jobs yet.</p>
            <Button className="mt-4" render={<Link href="/dashboard/jobs/import" />}>
              <Plus className="mr-1.5 h-4 w-4" />
              Import your first job
            </Button>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <FilterBar
              search={search} setSearch={setSearch}
              scoreFilter={scoreFilter} setScoreFilter={setScoreFilter}
              statusFilter={statusFilter} setStatusFilter={setStatusFilter}
              sort={sort} setSort={setSort}
              total={jobs.length} filtered={filteredJobs.length}
            />

            {filteredJobs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-10 text-center">
                <p className="text-sm text-muted-foreground">No jobs match your filters.</p>
                <button
                  onClick={() => { setSearch(""); setScoreFilter("all"); setStatusFilter("all"); }}
                  className="mt-2 text-sm text-primary hover:underline"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {/* Selection action bar */}
                {selectableIds.length > 0 && (
                  <div className={cn(
                    "flex items-center gap-3 rounded-xl border px-4 py-2.5 transition-colors",
                    selected.size > 0
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-muted/30"
                  )}>
                    <button onClick={toggleSelectAll} className="inline-flex items-center gap-2 text-sm font-medium hover:text-foreground">
                      <span className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                        allSelected ? "border-primary bg-primary text-primary-foreground" : "border-border"
                      )}>
                        {allSelected && <Check className="h-3 w-3" />}
                      </span>
                      {allSelected ? "Deselect all" : `Select all ready (${selectableIds.length})`}
                    </button>

                    {selected.size > 0 && (
                      <>
                        <span className="text-xs font-semibold text-primary">
                          {selected.size} selected
                        </span>
                        <div className="ml-auto flex items-center gap-2">
                          <button
                            onClick={() => setSelected(new Set())}
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            Clear
                          </button>
                          {/* Agent Apply — credits charged per job, confirmed in modal */}
                          <button
                            onClick={() => requestAgentApply(Array.from(selected))}
                            disabled={agentBulkRunning}
                            title={`${selected.size * applyCost} credits · balance ${balance}`}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#f5c518] px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-60 transition-opacity"
                          >
                            {agentBulkRunning
                              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Working…</>
                              : <><Bot className="h-3.5 w-3.5" /> Agent Apply ({selected.size})</>
                            }
                          </button>
                          {/* Optimize + Apply — full tailor → cover → submit flow */}
                          <button
                            onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })}
                            className="btn-cta inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
                          >
                            <Zap className="h-3.5 w-3.5" />
                            Optimize &amp; Apply ↓
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {filteredJobs.map((job) => {
                  const parsed = Array.isArray(job.parsed) ? job.parsed[0] : job.parsed;
                  const processing = job.status === "processing" || job.status === "created";
                  const ready = job.status === "ready";
                  const isSel = selected.has(job.id);
                  const board = boardForUrl(job.posting_url || job.source_url);
                  const agentState = agentStates[job.id];
                  return (
                    <div
                      key={job.id}
                      onClick={() => router.push(`/dashboard/jobs/${job.id}`)}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-4 transition-shadow hover:shadow-sm",
                        isSel ? "border-primary/60 ring-1 ring-primary/30" : "border-border",
                        agentState === "done" && "border-desyn-success/40 bg-desyn-success/5",
                      )}
                    >
                      {/* Selection checkbox (only for ready jobs) */}
                      {ready ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleSelect(job.id); }}
                          aria-label={isSel ? "Deselect job" : "Select job"}
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                            isSel ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary"
                          )}
                        >
                          {isSel && <Check className="h-3.5 w-3.5" />}
                        </button>
                      ) : (
                        <span className="h-5 w-5 shrink-0" />
                      )}

                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Briefcase className="h-4.5 w-4.5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium">
                          {parsed?.title ?? (processing ? "Parsing…" : "Untitled role")}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {parsed?.company && <span>{parsed.company}</span>}
                          {parsed?.location && (
                            <span className="flex items-center gap-0.5">
                              <MapPin className="h-3 w-3" />
                              {parsed.location}
                            </span>
                          )}
                          {(job.posting_url || job.source_url) && (
                            <span className={cn(
                              "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                              board.applyMode === "direct" ? "bg-desyn-success/15 text-desyn-success"
                                : board.applyMode === "assisted" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                : "bg-muted text-muted-foreground"
                            )}>
                              {board.label}{board.applyMode === "direct" ? " · 1-click" : ""}
                            </span>
                          )}
                        </div>
                        {/* Saved-work badges so users can see/resume what's done */}
                        {job.progress && (job.progress.applied || job.progress.tailored || job.progress.cover || job.progress.ats || job.progress.report) && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            {job.progress.applied && <span className="rounded-full bg-desyn-success/15 px-2 py-0.5 text-[10px] font-medium text-desyn-success">✓ Applied</span>}
                            {job.progress.tailored && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Résumé tailored</span>}
                            {job.progress.cover && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Cover letter</span>}
                            {job.progress.ats && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">ATS scan</span>}
                            {job.progress.report && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Interview report</span>}
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        {/* Agent apply status */}
                        {agentState === "running" && (
                          <span className="flex items-center gap-1 text-xs font-medium text-primary">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Applying…
                          </span>
                        )}
                        {agentState === "done" && (
                          <span className="flex items-center gap-1 text-xs font-medium text-desyn-success">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Submitted
                          </span>
                        )}
                        {agentState === "error" && (
                          <span className="text-xs font-medium text-destructive">Failed</span>
                        )}
                        {/* Score */}
                        {!agentState && (processing ? (
                          <span className="flex items-center gap-1.5 text-xs text-blue-500">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Scoring
                          </span>
                        ) : job.status === "failed" ? (
                          <span className="text-xs text-destructive">Failed</span>
                        ) : job.match ? (
                          <span className={cn("rounded-full px-2.5 py-1 text-sm font-bold", scoreColor(job.match.match_score))}>
                            {job.match.match_score}%
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">No resume</span>
                        ))}
                        {/* Per-row apply button — credits charged, confirmed in modal */}
                        {ready && !agentState && (
                          <button
                            onClick={(e) => { e.stopPropagation(); requestAgentApply([job.id]); }}
                            title={`${applyCost} credits · balance ${balance}`}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#f5c518] px-2 py-1 text-[11px] font-semibold text-black hover:opacity-90 transition-opacity"
                          >
                            <Zap className="h-3 w-3" /> Apply
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Spacer so the fixed bar never covers the last row */}
        {selected.size > 0 && <div className="h-28" />}
      </main>

      {selected.size > 0 && (
        <BulkApplyBar jobs={selectedBulkJobs} onClear={() => setSelected(new Set())} />
      )}

      <CreditConfirmModal
        open={confirmModal.open}
        onClose={() => setConfirmModal({ open: false, jobIds: [] })}
        onConfirm={confirmAgentApply}
        action="Auto Apply"
        unitCost={applyCost}
        quantity={confirmModal.jobIds.length}
        balance={balance}
        freeApplies={freeApplies}
        busy={agentBulkRunning}
        note="Expired or already-applied jobs are skipped automatically after a quick availability check."
      />

      <ApplyMethodModal
        open={methodModal.open}
        onClose={() => setMethodModal({ open: false, jobIds: [] })}
        onSleep={sleepApply}
        quantity={methodModal.jobIds.length}
        extCost={extCost}
        sleepCost={applyCost}
        balance={balance}
        dailyCap={dailyCap}
        busy={agentBulkRunning}
      />
    </>
  );
}
