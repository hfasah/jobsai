"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Briefcase, Building2, MapPin, DollarSign,
  Loader2, RefreshCw, ExternalLink, Check,
  Settings2, Zap, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/layout/site-header";
import { cn } from "@/lib/utils";
import type { DiscoveredJob } from "@/lib/job-discovery";

type ImportState = "idle" | "importing" | "done";

// ─── Salary badge ─────────────────────────────────────────────────────────────

function salaryLabel(job: DiscoveredJob) {
  const fmt = (n: number) =>
    n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
  const cur = job.currency ?? "USD";
  const sym = cur === "GBP" ? "£" : cur === "EUR" ? "€" : "$";
  if (job.salary_min && job.salary_max)
    return `${sym}${fmt(job.salary_min)} – ${sym}${fmt(job.salary_max)}`;
  if (job.salary_min) return `${sym}${fmt(job.salary_min)}+`;
  if (job.salary_max) return `up to ${sym}${fmt(job.salary_max)}`;
  return null;
}

// ─── Job card ─────────────────────────────────────────────────────────────────

function JobCard({
  job,
  importedJobId,
  onImport,
}: {
  job: DiscoveredJob;
  importedJobId: string | null;
  onImport: (job: DiscoveredJob) => Promise<string | null>;
}) {
  const [state, setState] = useState<ImportState>(importedJobId ? "done" : "idle");
  const [jobId, setJobId] = useState<string | null>(importedJobId);
  const salary = salaryLabel(job);

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
            {job.company}
          </p>
        </div>
        <span className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
          job.source === "remoteok"
            ? "bg-green-100 text-green-700"
            : "bg-blue-100 text-blue-700"
        )}>
          {job.source === "remoteok" ? "RemoteOK" : "Adzuna"}
        </span>
      </div>

      {/* Meta */}
      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <MapPin className="h-3 w-3" />{job.location}
        </span>
        {salary && (
          <span className="flex items-center gap-1 font-medium text-green-600">
            <DollarSign className="h-3 w-3" />{salary}
          </span>
        )}
      </div>

      {/* Tags */}
      {job.tags.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {job.tags.slice(0, 6).map((t) => (
            <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Description snippet */}
      {job.description && (
        <p className="mt-3 line-clamp-3 text-sm text-muted-foreground leading-relaxed">
          {job.description}
        </p>
      )}

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2 border-t border-border/60 pt-3">
        {state === "done" && jobId ? (
          <Link
            href={`/dashboard/jobs/${jobId}`}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100 transition-colors"
          >
            <Check className="h-4 w-4" />
            Imported — view job
          </Link>
        ) : (
          <Button
            size="sm"
            className="flex-1"
            onClick={handleImport}
            disabled={state === "importing"}
          >
            {state === "importing" ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importing…</>
            ) : (
              <><Briefcase className="mr-2 h-4 w-4" />Import & Match</>
            )}
          </Button>
        )}
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}

// ─── Preferences summary bar ──────────────────────────────────────────────────

interface PrefSummary {
  job_titles: string[];
  keywords: string[];
  location_type: string;
  locations: string[];
  min_salary: number | null;
  salary_currency: string;
}

function PrefSummaryBar({ prefs }: { prefs: PrefSummary }) {
  const chips: string[] = [];
  if (prefs.job_titles.length) chips.push(...prefs.job_titles);
  else if (prefs.keywords.length) chips.push(...prefs.keywords.slice(0, 2));

  const loc = prefs.location_type !== "any"
    ? prefs.location_type.charAt(0).toUpperCase() + prefs.location_type.slice(1)
    : prefs.locations[0] ?? null;
  if (loc) chips.push(loc);

  const sym = prefs.salary_currency === "GBP" ? "£" : prefs.salary_currency === "EUR" ? "€" : "$";
  if (prefs.min_salary) chips.push(`${sym}${Math.round(prefs.min_salary / 1000)}k+`);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-3">
      <Zap className="h-4 w-4 shrink-0 text-desyn-accent" />
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <span key={c} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            {c}
          </span>
        ))}
      </div>
      <Link
        href="/dashboard/preferences"
        className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <Settings2 className="h-3.5 w-3.5" />
        Edit
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
    // Load prefs summary for the top bar
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
      alert("Network error. Please try again.");
      return null;
    }
  }, []);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wider text-desyn-accent">
              Auto discovery
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Discover Jobs</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Jobs matched to your preferences. Import any to run AI matching, ATS scan, and interview prep.
            </p>
          </div>
          <Button variant="outline" onClick={discover} disabled={loading}>
            {loading
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>

        {/* Preferences summary */}
        {prefs && (
          <div className="mt-6">
            <PrefSummaryBar prefs={prefs} />
          </div>
        )}

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
          <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="font-medium text-amber-800">{error.message}</p>
                {(error.code === "no_preferences" || error.code === "no_targets") && (
                  <Link
                    href="/dashboard/preferences"
                    className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 hover:underline"
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
            {/* Result meta */}
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <span>{jobs.length} jobs found</span>
              {sources.length > 0 && (
                <>
                  <span>·</span>
                  <span>{sources.join(", ")}</span>
                </>
              )}
            </div>

            {/* Job grid */}
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  importedJobId={importedIds[job.id] ?? null}
                  onImport={importJob}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
