"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Search, MapPin, Loader2, Briefcase, Building2, DollarSign, Clock,
  ExternalLink, Download, Check, ChevronLeft, ChevronRight, Wifi, AlertCircle, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SEARCH_COUNTRIES, JOB_SITES, EMPLOYMENT_TYPES,
  type SearchJob, type SearchResult, type SortKey, type EmploymentType,
} from "@/lib/job-search";

const CUR: Record<string, string> = { USD: "$", CAD: "C$", GBP: "£", EUR: "€", PLN: "zł" };

function salaryLabel(j: SearchJob): string | null {
  const sym = CUR[j.currency ?? ""] ?? "";
  const fmt = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(Math.round(n)));
  if (j.salaryMin && j.salaryMax) return `${sym}${fmt(j.salaryMin)}–${sym}${fmt(j.salaryMax)}`;
  if (j.salaryMin) return `${sym}${fmt(j.salaryMin)}+`;
  if (j.salaryMax) return `up to ${sym}${fmt(j.salaryMax)}`;
  return null;
}

function ago(iso: string | null): string {
  if (!iso) return "";
  const d = Date.parse(iso);
  if (Number.isNaN(d)) return "";
  const days = Math.floor((Date.now() - d) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

const SORTS: { key: SortKey; label: string }[] = [
  { key: "relevance", label: "Most relevant" },
  { key: "date", label: "Newest" },
  { key: "salary", label: "Highest salary" },
];

// Brand colors per job board — used to tint the Job Sites chips.
const SITE_BRAND: Record<string, string> = {
  indeed: "#2557A7",       // Indeed blue
  linkedin: "#0A66C2",     // LinkedIn blue
  glassdoor: "#0CAA41",    // Glassdoor green
  ziprecruiter: "#1F9D55", // ZipRecruiter green
  google: "#4285F4",       // Google blue
};

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-foreground/80 hover:bg-white/5 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

export default function JobSearchPage() {
  const [what, setWhat] = useState("");
  const [where, setWhere] = useState("");
  const [country, setCountry] = useState("us");
  const [remote, setRemote] = useState(false);
  const [empTypes, setEmpTypes] = useState<EmploymentType[]>([]);
  const [jobSites, setJobSites] = useState<string[]>([]);
  const [sort, setSort] = useState<SortKey>("relevance");
  const [page, setPage] = useState(1);

  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SearchJob | null>(null);
  const [imported, setImported] = useState<Record<string, "loading" | "done" | "error">>({});
  const reqId = useRef(0);

  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>, id: string) =>
    setter((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));

  const run = useCallback(
    async (nextPage: number) => {
      const id = ++reqId.current;
      setLoading(true);
      setError(null);
      const qs = new URLSearchParams({ what, where, country, page: String(nextPage), sort });
      if (remote) qs.set("remote", "1");
      if (empTypes.length) qs.set("employment_types", empTypes.join(","));
      if (jobSites.length) qs.set("job_sites", jobSites.join(","));
      try {
        const res = await fetch(`/api/job-search?${qs}`);
        const json = await res.json();
        if (id !== reqId.current) return;
        if (!res.ok) throw new Error(json.error || "Search failed");
        const data = json.data as SearchResult;
        setResult(data);
        setPage(data.page);
        setSelected(data.jobs[0] ?? null);
      } catch (e) {
        if (id !== reqId.current) return;
        setError(e instanceof Error ? e.message : "Search failed");
        setResult(null);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [what, where, country, sort, remote, empTypes, jobSites]
  );

  // Initial broad search so the board isn't empty on first load.
  /* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
  useEffect(() => {
    run(1);
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */

  const onSubmit = (e: React.FormEvent) => { e.preventDefault(); run(1); };

  async function importJob(job: SearchJob) {
    if (!job.url) return;
    setImported((m) => ({ ...m, [job.id]: "loading" }));
    try {
      const res = await fetch("/api/jobs/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: job.url }),
      });
      setImported((m) => ({ ...m, [job.id]: res.ok ? "done" : "error" }));
    } catch {
      setImported((m) => ({ ...m, [job.id]: "error" }));
    }
  }

  const total = result?.count ?? 0;
  const startIdx = result ? (result.page - 1) * result.perPage + 1 : 0;
  const endIdx = result ? startIdx + result.jobs.length - 1 : 0;
  const pagesByCount = result ? Math.max(1, Math.ceil(Math.min(total, 1000) / result.perPage)) : 1;
  const canPrev = page > 1;
  const canNext = result
    ? result.totalKnown || result.provider === "free"
      ? page < pagesByCount
      : result.jobs.length >= 10 // jsearch: assume more while a full-ish page comes back
    : false;
  const sitesNeedJSearch = !!result && jobSites.length > 0 && result.provider !== "jsearch";

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight">Search Jobs</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
        Our internal job board, powered by live listings across the US, Canada, the UK, and the EU.
        What you see here is a sample — Auto-Apply searches a much wider range when activated.
      </p>

      {/* Search bar */}
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-2 lg:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={what}
            onChange={(e) => setWhat(e.target.value)}
            placeholder="Job title, keyword, or company"
            className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 lg:w-64">
          <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={where}
            onChange={(e) => setWhere(e.target.value)}
            placeholder="City or region"
            className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="h-11 rounded-xl border border-border bg-card px-3 text-sm outline-none lg:w-48"
          aria-label="Country"
        >
          {(["USA", "Canada", "Britain", "EU"] as const).map((region) => (
            <optgroup key={region} label={region}>
              {SEARCH_COUNTRIES.filter((c) => c.region === region).map((c) => (
                <option key={c.code} value={c.code}>{c.flag} {c.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <button type="submit" className="btn-cta inline-flex h-11 items-center justify-center gap-2 rounded-xl px-6 text-sm">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Search
        </button>
      </form>

      {/* Filters */}
      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-semibold text-foreground">Job Sites</span>
          {JOB_SITES.map((s) => {
            const c = SITE_BRAND[s.id] ?? "#7c3aed";
            const on = jobSites.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggle(setJobSites, s.id)}
                style={on
                  ? { backgroundColor: c, borderColor: c, color: "#fff" }
                  : { borderColor: `${c}80`, backgroundColor: `${c}14` }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all",
                  on ? "shadow-sm" : "text-foreground/90 hover:bg-white/5"
                )}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: on ? "#fff" : c }} />
                {s.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-semibold text-foreground">Job Types</span>
          {EMPLOYMENT_TYPES.map((t) => (
            <Chip key={t.id} active={empTypes.includes(t.id)} onClick={() => toggle(setEmpTypes as React.Dispatch<React.SetStateAction<string[]>>, t.id)}>{t.label}</Chip>
          ))}
          <Chip active={remote} onClick={() => setRemote((v) => !v)}><Wifi className="h-3.5 w-3.5" /> Remote only</Chip>
          <div className="ml-auto">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs outline-none"
              aria-label="Sort"
            >
              {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Banners */}
      {sitesNeedJSearch && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-[var(--cta)]/30 bg-[var(--cta)]/10 p-3 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cta)]" />
          <p className="text-muted-foreground">
            Filtering by <span className="font-medium text-foreground">Job Sites</span> (Indeed, LinkedIn, Glassdoor…)
            needs a free <span className="font-medium text-foreground">JSearch / RapidAPI key</span> (JSEARCH_RAPIDAPI_KEY).
            Showing standard results for now.
          </p>
        </div>
      )}
      {result && !result.configured && !sitesNeedJSearch && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-[var(--cta)]/30 bg-[var(--cta)]/10 p-3 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cta)]" />
          <p className="text-muted-foreground">
            Showing a <span className="font-medium text-foreground">limited free sample</span> (remote roles).
            Add a free <span className="font-medium text-foreground">Adzuna API key</span> for full US, Canada, UK &amp; EU coverage.
          </p>
        </div>
      )}

      {/* Results */}
      <div className="mt-5 grid gap-4 lg:grid-cols-[360px_1fr]">
        {/* List */}
        <div className="min-w-0">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {result && result.jobs.length > 0
                ? result.totalKnown
                  ? <>{startIdx}–{endIdx} of <span className="font-semibold text-foreground">{total.toLocaleString()}</span> jobs</>
                  : <><span className="font-semibold text-foreground">{result.jobs.length}</span> jobs on this page</>
                : loading ? "Searching…" : "No results"}
            </span>
            {result?.sources?.length ? <span className="hidden sm:inline">via {result.sources.join(", ")}</span> : null}
          </div>

          {loading && !result ? (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading jobs…
            </div>
          ) : error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">{error}</div>
          ) : result && result.jobs.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              <Briefcase className="mx-auto h-7 w-7 opacity-60" />
              <p className="mt-2">No jobs match. Try a broader keyword, fewer Job Sites, or another country.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {result?.jobs.map((job) => {
                const active = selected?.id === job.id;
                const sal = salaryLabel(job);
                return (
                  <li key={job.id}>
                    <button
                      onClick={() => setSelected(job)}
                      className={cn("w-full rounded-xl border p-3 text-left transition-colors",
                        active ? "border-primary/60 bg-primary/5" : "border-border bg-card hover:border-primary/30")}
                    >
                      <p className="truncate text-sm font-semibold">{job.title}</p>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <Building2 className="h-3 w-3 shrink-0" /> {job.company}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {job.location}</span>
                        {sal && <span className="flex items-center gap-1 text-emerald-400"><DollarSign className="h-3 w-3" /> {sal}</span>}
                        {job.postedAt && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {ago(job.postedAt)}</span>}
                        {job.publisher && job.publisher !== "Adzuna" && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-foreground/80">{job.publisher}</span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {result && result.jobs.length > 0 && (canPrev || canNext) && (
            <div className="mt-3 flex items-center justify-between">
              <button disabled={!canPrev || loading} onClick={() => run(page - 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground enabled:hover:text-foreground disabled:opacity-40">
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>
              <span className="text-xs text-muted-foreground">
                {result.totalKnown ? <>Page {page} of {pagesByCount}</> : <>Page {page}</>}
              </span>
              <button disabled={!canNext || loading} onClick={() => run(page + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground enabled:hover:text-foreground disabled:opacity-40">
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Detail */}
        <div className="min-w-0">
          {selected ? (
            <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-brand text-white shadow-glow">
                  <Briefcase className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-bold tracking-tight">{selected.title}</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {selected.company}{selected.publisher && selected.publisher !== "Adzuna" ? <span className="text-muted-foreground/70"> · via {selected.publisher}</span> : null}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-muted-foreground"><MapPin className="h-3 w-3" /> {selected.location}</span>
                {salaryLabel(selected) && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-400"><DollarSign className="h-3 w-3" /> {salaryLabel(selected)}</span>}
                {selected.contractTime && <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-muted-foreground"><Briefcase className="h-3 w-3" /> {selected.contractTime.replace(/_/g, " ").toLowerCase()}</span>}
                {selected.postedAt && <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-muted-foreground"><Clock className="h-3 w-3" /> {ago(selected.postedAt)}</span>}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <a href={selected.url} target="_blank" rel="noopener noreferrer" className="btn-cta inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm">
                  Apply <ExternalLink className="h-4 w-4" />
                </a>
                <button
                  onClick={() => importJob(selected)}
                  disabled={imported[selected.id] === "loading" || imported[selected.id] === "done"}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
                >
                  {imported[selected.id] === "loading" ? <><Loader2 className="h-4 w-4 animate-spin" /> Importing…</>
                    : imported[selected.id] === "done" ? <><Check className="h-4 w-4 text-emerald-400" /> Imported</>
                    : imported[selected.id] === "error" ? <><AlertCircle className="h-4 w-4 text-destructive" /> Try again</>
                    : <><Download className="h-4 w-4" /> Import to tailor</>}
                </button>
                {imported[selected.id] === "done" && (
                  <Link href="/dashboard/jobs" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium text-primary hover:underline">
                    <Zap className="h-4 w-4" /> Go to My Jobs
                  </Link>
                )}
              </div>

              <div className="mt-6 border-t border-border pt-5">
                <h3 className="text-sm font-semibold">Job description</h3>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {selected.description || "No description provided. Open the listing to read the full posting."}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid h-full place-items-center rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              <div>
                <Search className="mx-auto h-7 w-7 opacity-60" />
                <p className="mt-2">Select a job to see details.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
