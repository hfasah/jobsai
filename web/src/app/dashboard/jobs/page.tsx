"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus, Loader2, Briefcase, MapPin, Search, X, ChevronDown, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BulkApplyBar, type BulkJob } from "@/components/apply/bulk-apply-bar";
import { boardForUrl } from "@/lib/job-boards";

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
          <div className="mt-6 space-y-4">
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
                {/* Select-all for the apply queue */}
                {selectableIds.length > 0 && (
                  <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
                    <button onClick={toggleSelectAll} className="inline-flex items-center gap-2 hover:text-foreground">
                      <span className={cn(
                        "flex h-4 w-4 items-center justify-center rounded border",
                        allSelected ? "border-primary bg-primary text-primary-foreground" : "border-border"
                      )}>
                        {allSelected && <Check className="h-3 w-3" />}
                      </span>
                      Select all ready ({selectableIds.length})
                    </button>
                    {selected.size > 0 && (
                      <button onClick={() => setSelected(new Set())} className="hover:text-foreground">Clear selection</button>
                    )}
                  </div>
                )}

                {filteredJobs.map((job) => {
                  const parsed = Array.isArray(job.parsed) ? job.parsed[0] : job.parsed;
                  const processing = job.status === "processing" || job.status === "created";
                  const ready = job.status === "ready";
                  const isSel = selected.has(job.id);
                  const board = boardForUrl(job.posting_url || job.source_url);
                  return (
                    <div
                      key={job.id}
                      onClick={() => router.push(`/dashboard/jobs/${job.id}`)}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-4 transition-shadow hover:shadow-sm",
                        isSel ? "border-primary/60 ring-1 ring-primary/30" : "border-border"
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
                      <div className="shrink-0 text-right">
                        {processing ? (
                          <span className="flex items-center gap-1.5 text-xs text-blue-500">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Scoring
                          </span>
                        ) : job.status === "failed" ? (
                          <span className="text-xs text-destructive">Failed</span>
                        ) : job.match ? (
                          <span className={cn("rounded-full px-2.5 py-1 text-sm font-bold", scoreColor(job.match.match_score))}>
                            {job.match.match_score}%
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">No resume</span>
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
    </>
  );
}
