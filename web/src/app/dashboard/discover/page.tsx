"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Briefcase, Building2, MapPin, DollarSign,
  Loader2, RefreshCw, ExternalLink, Check,
  Settings2, Zap, AlertCircle, Clock,
  Search, X, ArrowDownUp, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/layout/site-header";
import { cn } from "@/lib/utils";
import type { DiscoveredJob } from "@/lib/job-discovery";

// ─── Types ────────────────────────────────────────────────────────────────────

type ImportState = "idle" | "importing" | "done";
type SourceFilter = "all" | "remoteok" | "adzuna";
type SalaryFilter = "all" | "with_salary";
type SortKey = "relevance" | "salary_high" | "salary_low" | "newest";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function salaryLabel(job: DiscoveredJob) {
  const fmt = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
  const sym = job.currency === "GBP" ? "£" : job.currency === "EUR" ? "€" : "$";
  if (job.salary_min && job.salary_max) return `${sym}${fmt(job.salary_min)}–${sym}${fmt(job.salary_max)}`;
  if (job.salary_min) return `${sym}${fmt(job.salary_min)}+`;
  if (job.salary_max) return `up to ${sym}${fmt(job.salary_max)}`;
  return null;
}

function postedLabel(iso?: string): string | null {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

const SOURCE_META: Record<string, { label: string; color: string }> = {
  remoteok: { label: "RemoteOK", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" },
  adzuna:   { label: "Adzuna",   color: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" },
};

// ─── Filter bar ───────────────────────────────────────────────────────────────

function FilterBar({
  search, onSearch,
  source, onSource,
  salary, onSalary,
  sort, onSort,
  count, total,
  onClear,
}: {
  search: string; onSearch: (v: string) => void;
  source: SourceFilter; onSource: (v: SourceFilter) => void;
  salary: SalaryFilter; onSalary: (v: SalaryFilter) => void;
  sort: SortKey; onSort: (v: SortKey) => void;
  count: number; total: number;
  onClear: () => void;
}) {
  const isFiltered = search || source !== "all" || salary !== "all" || sort !== "relevance";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search title, company, tags…"
            className="h-9 w-full rounded-lg border border-border bg-card pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {search && (
            <button onClick={() => onSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Sort */}
        <div className="relative">
          <ArrowDownUp className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <select
            value={sort}
            onChange={(e) => onSort(e.target.value as SortKey)}
            className="h-9 appearance-none rounded-lg border border-border bg-card pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="relevance">Best match</option>
            <option value="salary_high">Salary: High → Low</option>
            <option value="salary_low">Salary: Low → High</option>
            <option value="newest">Newest first</option>
          </select>
        </div>

        {/* Count + clear */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {count === total ? `${total} jobs` : `${count} of ${total}`}
          </span>
          {isFiltered && (
            <button
              onClick={onClear}
              className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Pill row */}
      <div className="flex flex-wrap gap-2">
        {/* Source pills */}
        {(["all", "remoteok", "adzuna"] as SourceFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => onSource(s)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              source === s
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40"
            )}
          >
            {s === "all" ? "All sources" : SOURCE_META[s]?.label ?? s}
          </button>
        ))}

        <div className="w-px bg-border self-stretch" />

        {/* Salary */}
        <button
          onClick={() => onSalary(salary === "all" ? "with_salary" : "all")}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            salary === "with_salary"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:border-primary/40"
          )}
        >
          {salary === "with_salary" ? "✓ " : ""}With salary
        </button>
      </div>
    </div>
  );
}

// ─── Job card ─────────────────────────────────────────────────────────────────

function JobCard({
  job, importedJobId, onImport,
}: {
  job: DiscoveredJob;
  importedJobId: string | null;
  onImport: (job: DiscoveredJob) => Promise<string | null>;
}) {
  const [state, setState] = useState<ImportState>(importedJobId ? "done" : "idle");
  const [jobId, setJobId] = useState<string | null>(importedJobId);
  const salary = salaryLabel(job);
  const posted = postedLabel(job.posted_at);
  const srcMeta = SOURCE_META[job.source] ?? { label: job.source, color: "bg-muted text-muted-foreground" };

  const handleImport = async () => {
    setState("importing");
    const id = await onImport(job);
    if (id) { setJobId(id); setState("done"); }
    else setState("idle");
  };

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug line-clamp-2">{job.title}</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{job.company}</span>
          </p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", srcMeta.color)}>
          {srcMeta.label}
        </span>
      </div>

      {/* Meta row */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {job.location && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" />{job.location}
          </span>
        )}
        {salary && (
          <span className="flex items-center gap-1 font-medium text-green-600">
            <DollarSign className="h-3 w-3" />{salary}
          </span>
        )}
        {posted && (
          <span className="flex items-center gap-1 ml-auto">
            <Clock className="h-3 w-3" />{posted}
          </span>
        )}
      </div>

      {/* Tags */}
      {job.tags.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {job.tags.slice(0, 5).map((t) => (
            <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{t}</span>
          ))}
          {job.tags.length > 5 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              +{job.tags.length - 5}
            </span>
          )}
        </div>
      )}

      {/* Description */}
      {job.description && (
        <p className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">
          {job.description}
        </p>
      )}

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2 border-t border-border/60 pt-3">
        {state === "done" && jobId ? (
          <Link
            href={`/dashboard/jobs/${jobId}`}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-desyn-success/10 px-3 py-2 text-sm font-medium text-desyn-success hover:bg-desyn-success/20 transition-colors"
          >
            <Check className="h-4 w-4" />
            Imported — view
          </Link>
        ) : (
          <Button size="sm" className="flex-1" onClick={handleImport} disabled={state === "importing"}>
            {state === "importing"
              ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Importing…</>
              : <><Briefcase className="mr-1.5 h-4 w-4" />Import & Match</>}
          </Button>
        )}
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}

// ─── Preferences bar ──────────────────────────────────────────────────────────

interface PrefSummary {
  job_titles: string[];
  keywords: string[];
  location_type: string;
  locations: string[];
  min_salary: number | null;
  salary_currency: string;
  auto_apply_enabled: boolean;
  last_discovery_at: string | null;
  last_discovery_count: number;
}

function StatusBar({ prefs }: { prefs: PrefSummary }) {
  const chips: string[] = [];
  if (prefs.job_titles.length) chips.push(...prefs.job_titles.slice(0, 3));
  else if (prefs.keywords.length) chips.push(...prefs.keywords.slice(0, 2));
  const loc = prefs.location_type !== "any"
    ? prefs.location_type.charAt(0).toUpperCase() + prefs.location_type.slice(1)
    : prefs.locations[0] ?? null;
  if (loc) chips.push(loc);
  const sym = prefs.salary_currency === "GBP" ? "£" : prefs.salary_currency === "EUR" ? "€" : "$";
  if (prefs.min_salary) chips.push(`${sym}${Math.round(prefs.min_salary / 1000)}k+`);

  const isOn = prefs.auto_apply_enabled;
  const lastRun = prefs.last_discovery_at ? postedLabel(prefs.last_discovery_at) : null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm">
      <span className={cn(
        "flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        isOn ? "bg-desyn-success/10 text-desyn-success" : "bg-muted text-muted-foreground"
      )}>
        <Zap className="h-3 w-3" />
        Auto-apply {isOn ? "on" : "off"}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <span key={c} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{c}</span>
        ))}
      </div>
      {lastRun && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          Last run {lastRun}
          {prefs.last_discovery_count > 0 && ` · ${prefs.last_discovery_count} found`}
        </span>
      )}
      <Link
        href="/dashboard/preferences"
        className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <Settings2 className="h-3.5 w-3.5" />
        Settings
      </Link>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DiscoverPage() {
  const [jobs, setJobs] = useState<DiscoveredJob[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [prefs, setPrefs] = useState<PrefSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [importedIds, setImportedIds] = useState<Record<string, string>>({});

  // Filter state
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [salaryFilter, setSalaryFilter] = useState<SalaryFilter>("all");
  const [sort, setSort] = useState<SortKey>("relevance");

  // Batch import state
  const [batchState, setBatchState] = useState<"idle" | "running">("idle");
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);

  const discover = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/jobs/discover");
      const json = await res.json();
      if (!res.ok) {
        setError({ code: json.error ?? "error", message: json.message ?? "Discovery failed." });
        return;
      }
      setJobs(json.data ?? []);
      setSources(json.sources ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((j) => { if (j.data) setPrefs(j.data); });
    discover();
  }, [discover]);

  const importJob = useCallback(async (job: DiscoveredJob): Promise<string | null> => {
    try {
      const body = job.url
        ? { url: job.url }
        : { text: `${job.title}\n${job.company}\n${job.location}\n\n${job.description}`, source_url: job.url };
      const res = await fetch("/api/jobs/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) { alert(json.error ?? "Import failed."); return null; }
      const id: string = json.job_id;
      setImportedIds((prev) => ({ ...prev, [job.id]: id }));
      return id;
    } catch {
      return null;
    }
  }, []);

  // ─── Filtering + sorting ────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = [...jobs];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          j.company.toLowerCase().includes(q) ||
          j.description?.toLowerCase().includes(q) ||
          j.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    if (sourceFilter !== "all") {
      result = result.filter((j) => j.source === sourceFilter);
    }

    if (salaryFilter === "with_salary") {
      result = result.filter((j) => j.salary_min != null || j.salary_max != null);
    }

    if (sort === "salary_high") {
      result.sort((a, b) => {
        const av = a.salary_max ?? a.salary_min ?? -1;
        const bv = b.salary_max ?? b.salary_min ?? -1;
        return bv - av;
      });
    } else if (sort === "salary_low") {
      result.sort((a, b) => {
        const av = a.salary_min ?? a.salary_max ?? Infinity;
        const bv = b.salary_min ?? b.salary_max ?? Infinity;
        return av - bv;
      });
    } else if (sort === "newest") {
      result.sort((a, b) => {
        const at = a.posted_at ? new Date(a.posted_at).getTime() : 0;
        const bt = b.posted_at ? new Date(b.posted_at).getTime() : 0;
        return bt - at;
      });
    }

    return result;
  }, [jobs, search, sourceFilter, salaryFilter, sort]);

  // ─── Batch import ───────────────────────────────────────────────────────────

  const importAll = useCallback(async () => {
    const toImport = filtered.filter((j) => !importedIds[j.id]);
    if (toImport.length === 0) return;
    if (!confirm(`Import all ${toImport.length} visible jobs?`)) return;

    setBatchState("running");
    setBatchProgress({ done: 0, total: toImport.length });

    for (let i = 0; i < toImport.length; i++) {
      await importJob(toImport[i]);
      setBatchProgress({ done: i + 1, total: toImport.length });
    }

    setBatchState("idle");
    setBatchProgress(null);
  }, [filtered, importedIds, importJob]);

  const clearFilters = () => {
    setSearch("");
    setSourceFilter("all");
    setSalaryFilter("all");
    setSort("relevance");
  };

  const unimportedVisible = filtered.filter((j) => !importedIds[j.id]).length;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">

        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wider text-desyn-accent">Auto discovery</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Discover Jobs</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Jobs matched to your preferences. Import any to run AI matching, ATS scan, and interview prep.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!loading && jobs.length > 0 && unimportedVisible > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={importAll}
                disabled={batchState === "running"}
              >
                {batchState === "running" && batchProgress ? (
                  <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    {batchProgress.done}/{batchProgress.total}</>
                ) : (
                  <><Download className="mr-1.5 h-4 w-4" />
                    Import all ({unimportedVisible})</>
                )}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={discover} disabled={loading}>
              {loading
                ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                : <RefreshCw className="mr-1.5 h-4 w-4" />}
              Refresh
            </Button>
          </div>
        </div>

        {/* Status bar */}
        {prefs && <div className="mt-6"><StatusBar prefs={prefs} /></div>}

        {/* States */}
        {loading ? (
          <div className="mt-12 flex flex-col items-center gap-3 text-muted-foreground">
            <div className="relative flex h-14 w-14 items-center justify-center">
              <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
              <Zap className="h-6 w-6 animate-pulse text-primary" />
            </div>
            <p className="text-sm">Searching across job sources…</p>
          </div>
        ) : error ? (
          <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20 p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-400">{error.message}</p>
                {(error.code === "no_preferences" || error.code === "no_targets") && (
                  <Link
                    href="/dashboard/preferences"
                    className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-400 hover:underline"
                  >
                    <Settings2 className="h-4 w-4" />
                    Set up your preferences
                  </Link>
                )}
              </div>
            </div>
          </div>
        ) : jobs.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed border-border p-12 text-center">
            <Briefcase className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No jobs found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try broadening your preferences — add more job titles or remove salary/location filters.
            </p>
            <Button className="mt-4" nativeButton={false} render={<Link href="/dashboard/preferences" />}>
              <Settings2 className="mr-2 h-4 w-4" />
              Edit preferences
            </Button>
          </div>
        ) : (
          <>
            {/* Filter bar */}
            <div className="mt-6">
              <FilterBar
                search={search} onSearch={setSearch}
                source={sourceFilter} onSource={setSourceFilter}
                salary={salaryFilter} onSalary={setSalaryFilter}
                sort={sort} onSort={setSort}
                count={filtered.length} total={jobs.length}
                onClear={clearFilters}
              />
            </div>

            {/* Source breakdown */}
            {sources.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {sources.map((s) => {
                  const count = jobs.filter((j) => j.source === s).length;
                  const meta = SOURCE_META[s];
                  return (
                    <span key={s} className={cn("rounded-full px-2 py-0.5 font-medium", meta?.color ?? "bg-muted text-muted-foreground")}>
                      {meta?.label ?? s}: {count}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Empty filter state */}
            {filtered.length === 0 ? (
              <div className="mt-8 rounded-xl border border-dashed border-border p-10 text-center">
                <Search className="mx-auto mb-3 h-7 w-7 text-muted-foreground/40" />
                <p className="font-medium">No jobs match your filters</p>
                <button onClick={clearFilters} className="mt-2 text-sm text-primary hover:underline">
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    importedJobId={importedIds[job.id] ?? null}
                    onImport={importJob}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
