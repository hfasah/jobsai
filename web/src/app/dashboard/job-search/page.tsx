"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search, MapPin, Loader2, Briefcase, Building2, DollarSign, Clock,
  ExternalLink, ChevronLeft, ChevronRight, ChevronDown, Wifi, AlertCircle, Zap, Check, Globe, Sparkles,
} from "lucide-react";
import { AutoApplyControls } from "@/components/apply/auto-apply-controls";
import { cn } from "@/lib/utils";
import {
  SEARCH_COUNTRIES, JOB_SITES, EMPLOYMENT_TYPES, companyLogoUrl, MAX_COUNTRIES,
  type SearchJob, type SearchResult, type SortKey, type EmploymentType,
} from "@/lib/job-search";
import { BulkApplyBar, type BulkJob } from "@/components/apply/bulk-apply-bar";

const CUR: Record<string, string> = { USD: "$", CAD: "C$", GBP: "£", EUR: "€", PLN: "zł" };

function salaryLabel(j: SearchJob): string | null {
  const sym = CUR[j.currency ?? ""] ?? "";
  const fmt = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(Math.round(n)));
  if (j.salaryMin && j.salaryMax) return `${sym}${fmt(j.salaryMin)}–${sym}${fmt(j.salaryMax)}`;
  if (j.salaryMin) return `${sym}${fmt(j.salaryMin)}+`;
  if (j.salaryMax) return `up to ${sym}${fmt(j.salaryMax)}`;
  return null;
}

// Listing text we pass to import as a fallback when the URL can't be scraped.
function buildFallbackText(job: SearchJob): string {
  const meta = [job.title, job.company, job.location, salaryLabel(job)].filter(Boolean).join(" · ");
  return `${meta}\n\n${job.description ?? ""}`.trim();
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

const COUNTRY_BY_CODE = new Map(SEARCH_COUNTRIES.map((c) => [c.code, c]));
const REGIONS = ["USA", "Canada", "Britain", "EU", "Africa"] as const;

// Multi-country picker (checkbox popover). Selecting >1 country aggregates jobs
// across all of them in a single search — the core "everything in one place" UX.
function CountryMultiSelect({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const atCap = selected.length >= MAX_COUNTRIES;

  const toggle = (code: string) => {
    if (selected.includes(code)) {
      // Keep at least one country selected.
      if (selected.length > 1) onChange(selected.filter((c) => c !== code));
    } else if (!atCap) {
      onChange([...selected, code]);
    }
  };

  const flags = selected.map((c) => COUNTRY_BY_CODE.get(c)?.flag ?? "🏳️").join(" ");
  const label =
    selected.length === 1
      ? `${COUNTRY_BY_CODE.get(selected[0])?.flag ?? ""} ${COUNTRY_BY_CODE.get(selected[0])?.label ?? "Country"}`
      : `${flags}  ${selected.length} countries`;

  return (
    <div className="relative lg:w-56">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-full items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm outline-none"
        aria-label="Countries"
      >
        <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{label}</span>
        <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-12 z-30 max-h-80 w-72 overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-xl">
            <div className="flex items-center justify-between px-2 py-1 text-[11px] text-muted-foreground">
              <span>Select up to {MAX_COUNTRIES}</span>
              <span>{selected.length}/{MAX_COUNTRIES}</span>
            </div>
            {REGIONS.map((region) => (
              <div key={region}>
                <p className="px-2 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{region}</p>
                {SEARCH_COUNTRIES.filter((c) => c.region === region).map((c) => {
                  const on = selected.includes(c.code);
                  const disabled = !on && atCap;
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => toggle(c.code)}
                      disabled={disabled}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                        on ? "bg-primary/10 text-foreground" : disabled ? "opacity-40" : "hover:bg-muted",
                      )}
                    >
                      <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                        on ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                        {on && <Check className="h-3 w-3" />}
                      </span>
                      <span>{c.flag}</span>
                      <span className="truncate">{c.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

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
  const [countries, setCountries] = useState<string[]>(["us"]);
  const [remote, setRemote] = useState(false);
  const [empTypes, setEmpTypes] = useState<EmploymentType[]>([]);
  const [jobSites, setJobSites] = useState<string[]>([]);
  const [sort, setSort] = useState<SortKey>("relevance");
  const [page, setPage] = useState(1);

  const [result, setResult] = useState<SearchResult | null>(null);
  const [failedLogos, setFailedLogos] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SearchJob | null>(null);
  const [acting, setActing] = useState<Record<string, "loading" | "error" | "upgrade">>({});
  // Bulk selection (multi-apply)
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const togglePick = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const reqId = useRef(0);
  const router = useRouter();

  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>, id: string) =>
    setter((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));

  const run = useCallback(
    async (nextPage: number, override?: Partial<{ what: string; where: string; remote: boolean; empTypes: EmploymentType[] }>) => {
      const id = ++reqId.current;
      setLoading(true);
      setError(null);
      // Overrides let the initial preference-seeded search fire with the seed
      // values directly, without waiting for React state to settle.
      const q = { what, where, remote, empTypes, ...override };
      const qs = new URLSearchParams({ what: q.what, where: q.where, countries: countries.join(","), page: String(nextPage), sort });
      if (q.remote) qs.set("remote", "1");
      if (q.empTypes.length) qs.set("employment_types", q.empTypes.join(","));
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
        setPicked(new Set()); // selection is per-page
      } catch (e) {
        if (id !== reqId.current) return;
        setError(e instanceof Error ? e.message : "Search failed");
        setResult(null);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [what, where, countries, sort, remote, empTypes, jobSites]
  );

  // Seed the search from the user's saved Preferences (target titles, location,
  // remote, job types) so the board is relevant to THEM — a DevOps profile
  // shouldn't open to Physical Therapist listings. Reused by the mount effect
  // AND the "Profile Search" button. Returns true if it seeded from prefs.
  const [matchedToProfile, setMatchedToProfile] = useState(false);
  const profileSearch = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/preferences");
      const json = await res.json();
      const p = json?.data;
      const titles: string[] = Array.isArray(p?.job_titles) ? p.job_titles : [];
      const locs: string[] = Array.isArray(p?.locations) ? p.locations : [];
      if (titles.length || locs.length) {
        const EMP_MAP: Record<string, EmploymentType> = { "full-time": "fulltime", contract: "contract", internship: "internship" };
        const seedEmp = [
          ...((Array.isArray(p?.employment_types) ? p.employment_types : []) as string[])
            .map((e) => EMP_MAP[e]).filter(Boolean) as EmploymentType[],
          ...(p?.location_type === "hybrid" ? (["hybrid"] as EmploymentType[]) : []),
        ];
        const seedRemote = p?.location_type === "remote";
        const seedWhat = titles[0] ?? "";
        const seedWhere = seedRemote ? "" : (locs[0] ?? "");
        setWhat(seedWhat); setWhere(seedWhere); setRemote(seedRemote); setEmpTypes(seedEmp);
        setMatchedToProfile(true);
        run(1, { what: seedWhat, where: seedWhere, remote: seedRemote, empTypes: seedEmp });
        return true;
      }
    } catch { /* preferences unavailable */ }
    return false;
  }, [run]);

  /* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
  useEffect(() => {
    (async () => {
      const seeded = await profileSearch();
      if (!seeded) run(1); // no preferences set → broad search
    })();
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */

  const onSubmit = (e: React.FormEvent) => { e.preventDefault(); setMatchedToProfile(false); run(1); };

  // Apply inside JobsAI: import the job, then drop the user on the in-app job
  // page where tailoring + auto-apply happen. No external redirect.
  async function applyInternal(job: SearchJob) {
    if (!job.url) return;
    setActing((m) => ({ ...m, [job.id]: "loading" }));
    try {
      // Send the listing data we already have from search as a fallback, so the
      // import still works when the URL can't be scraped (JS-heavy ATS, 403, etc.).
      const res = await fetch("/api/jobs/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: job.url, text: buildFallbackText(job) }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.job_id) {
        router.push(`/dashboard/jobs/${json.job_id}`);
        return;
      }
      setActing((m) => ({ ...m, [job.id]: res.status === 402 ? "upgrade" : "error" }));
    } catch {
      setActing((m) => ({ ...m, [job.id]: "error" }));
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
        One search, every board — Indeed, LinkedIn, Glassdoor, ZipRecruiter, Google and more,
        across up to {MAX_COUNTRIES} countries at once.
      </p>

      {/* Two-click actions: search by profile, or hand it off entirely. */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => profileSearch()}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted">
          <Sparkles className="h-4 w-4 text-primary" /> Profile Search
        </button>
        <AutoApplyControls />
      </div>

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
        <CountryMultiSelect selected={countries} onChange={setCountries} />
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
          <div className="ml-auto flex items-center gap-2">
            {(empTypes.length > 0 || jobSites.length > 0 || remote || what || where) && (
              <button
                type="button"
                onClick={() => { setEmpTypes([]); setJobSites([]); setRemote(false); setWhat(""); setWhere(""); }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
              >
                Clear all
              </button>
            )}
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
      {result && !result.configured && !sitesNeedJSearch && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-[var(--cta)]/30 bg-[var(--cta)]/10 p-3 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cta)]" />
          <p className="text-muted-foreground">
            Showing <span className="font-medium text-foreground">remote roles</span> for this search.
            Try a broader keyword or add another country for more listings.
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

          {matchedToProfile && what && (
            <p className="mb-3 flex items-center gap-1.5 text-xs text-primary">
              <Zap className="h-3.5 w-3.5" />
              Matched to your profile. <Link href="/dashboard/preferences" className="underline underline-offset-2 hover:text-foreground">Edit preferences</Link> or refine the search above.
            </p>
          )}

          {loading && !result ? (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading jobs…
            </div>
          ) : error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">{error}</div>
          ) : result && result.jobs.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              <Briefcase className="mx-auto h-7 w-7 opacity-60" />
              <p className="mt-2">No jobs match. Try a broader keyword, fewer Job Sites, or add another country.</p>
            </div>
          ) : (
            <>
              {/* Select-all on this page */}
              {result && result.jobs.length > 0 && (
                <div className="mb-2 flex items-center justify-between px-1 text-xs text-muted-foreground">
                  <button
                    onClick={() => {
                      const ids = (result?.jobs ?? []).filter((j) => !j.blocked).map((j) => j.id);
                      const all = ids.length > 0 && ids.every((id) => picked.has(id));
                      setPicked((prev) => {
                        const next = new Set(prev);
                        if (all) ids.forEach((id) => next.delete(id)); else ids.forEach((id) => next.add(id));
                        return next;
                      });
                    }}
                    className="inline-flex items-center gap-2 hover:text-foreground"
                  >
                    <span className={cn("flex h-4 w-4 items-center justify-center rounded border",
                      (result?.jobs ?? []).filter((j) => !j.blocked).every((j) => picked.has(j.id)) && result.jobs.length > 0
                        ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                      {(result?.jobs ?? []).filter((j) => !j.blocked).every((j) => picked.has(j.id)) && result.jobs.length > 0 && <Check className="h-3 w-3" />}
                    </span>
                    Select all on this page ({result.jobs.length})
                  </button>
                  {picked.size > 0 && <button onClick={() => setPicked(new Set())} className="hover:text-foreground">Clear</button>}
                </div>
              )}

              <ul className="space-y-2">
                {result?.jobs.map((job) => {
                  const active = selected?.id === job.id;
                  const isPicked = picked.has(job.id);
                  const sal = salaryLabel(job);
                  return (
                    <li key={job.id}>
                      <div className={cn("flex items-start gap-2.5 rounded-xl border p-3 transition-colors",
                        active ? "border-primary/60 bg-primary/5" : isPicked ? "border-primary/40 bg-primary/[0.03]" : "border-border bg-card hover:border-primary/30")}>
                        <button
                          onClick={() => !job.blocked && togglePick(job.id)}
                          disabled={!!job.blocked}
                          aria-label={isPicked ? "Deselect" : "Select"}
                          className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors disabled:opacity-30",
                            isPicked ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary")}
                        >
                          {isPicked && <Check className="h-3.5 w-3.5" />}
                        </button>
                        <button onClick={() => setSelected(job)} className="min-w-0 flex-1 text-left">
                          <div className="flex items-center gap-2">
                            {(() => {
                              const src = job.logo ?? companyLogoUrl(job.company);
                              return src && !failedLogos.has(job.id) ? (
                                <img
                                  src={src}
                                  alt={job.company}
                                  className="h-6 w-6 shrink-0 rounded bg-white object-contain p-px"
                                  onError={() => setFailedLogos((p) => new Set([...p, job.id]))}
                                />
                              ) : (
                                <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                              );
                            })()}
                            <p className="truncate text-sm font-semibold">{job.title}</p>
                          </div>
                          <p className="mt-0.5 truncate pl-6 text-xs text-muted-foreground">{job.company}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {job.location}</span>
                            {sal && <span className="flex items-center gap-1 text-emerald-400"><DollarSign className="h-3 w-3" /> {sal}</span>}
                            {job.postedAt && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {ago(job.postedAt)}</span>}
                            {job.publisher && job.publisher !== "Adzuna" && (
                              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-foreground/80">{job.publisher}</span>
                            )}
                            {job.blocked && (
                              <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium text-destructive">Blocked</span>
                            )}
                          </div>
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
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
                {(() => {
                  const src = selected.logo ?? companyLogoUrl(selected.company);
                  return src && !failedLogos.has(selected.id) ? (
                    <img
                      src={src}
                      alt={selected.company}
                      className="h-12 w-12 shrink-0 rounded-xl border border-border bg-white object-contain p-1"
                      onError={() => setFailedLogos((p) => new Set([...p, selected.id]))}
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-brand text-white shadow-glow">
                      <Briefcase className="h-6 w-6" />
                    </div>
                  );
                })()}
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

              {selected.blocked && (
                <div className="mt-5 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  This company is on your block list — JobsAI won&apos;t apply here. Remove it in Preferences to enable applying.
                </div>
              )}
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => applyInternal(selected)}
                  disabled={acting[selected.id] === "loading" || !!selected.blocked}
                  className="btn-cta inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {selected.blocked
                    ? <><Zap className="h-4 w-4" /> Blocked</>
                    : acting[selected.id] === "loading"
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Preparing…</>
                    : <><Zap className="h-4 w-4" /> Apply with JobsAI</>}
                </button>
                <a
                  href={selected.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  View original posting <ExternalLink className="h-3.5 w-3.5" />
                </a>
                {acting[selected.id] === "upgrade" && (
                  <Link href="/dashboard/billing" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                    Upgrade to apply
                  </Link>
                )}
                {acting[selected.id] === "error" && (
                  <span className="inline-flex items-center gap-1 text-xs text-destructive"><AlertCircle className="h-3.5 w-3.5" /> Couldn&apos;t import — try again.</span>
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

      {/* Spacer so the fixed bulk bar never covers content */}
      {picked.size > 0 && <div className="h-28" />}

      {picked.size > 0 && (
        <BulkApplyBar
          importFirst
          onClear={() => setPicked(new Set())}
          jobs={(result?.jobs ?? [])
            .filter((j) => picked.has(j.id))
            .map((j): BulkJob => ({ id: j.id, title: j.title, company: j.company, url: j.url, text: buildFallbackText(j) }))}
        />
      )}
    </main>
  );
}
