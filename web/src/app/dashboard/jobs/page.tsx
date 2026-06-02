"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Loader2, Briefcase, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/layout/site-header";
import { cn } from "@/lib/utils";

interface JobListItem {
  id: string;
  status: string;
  created_at: string;
  parsed: { title: string | null; company: string | null; location: string | null; seniority: string | null } | { title: string | null; company: string | null; location: string | null; seniority: string | null }[] | null;
  match: { match_score: number } | null;
}

function scoreColor(score: number) {
  return score >= 75 ? "text-green-600 bg-green-100" : score >= 50 ? "text-yellow-700 bg-yellow-100" : "text-red-600 bg-red-100";
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    const res = await fetch("/api/jobs");
    const json = await res.json();
    if (json.data) setJobs(json.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchJobs();
    // Poll while any job is still processing
    const interval = setInterval(fetchJobs, 4000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wider text-desyn-accent">
              Job tracker
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Your Jobs</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Import jobs to see how well your resume matches.
            </p>
          </div>
          <Button nativeButton={false} render={<Link href="/dashboard/jobs/import" />}>
            <Plus className="mr-2 h-4 w-4" />
            Import Job
          </Button>
        </div>

        <div className="mt-8">
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading jobs…
            </div>
          ) : jobs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center">
              <Briefcase className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground">No jobs yet.</p>
              <Button className="mt-4" nativeButton={false} render={<Link href="/dashboard/jobs/import" />}>
                <Plus className="mr-2 h-4 w-4" />
                Import your first job
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => {
                const parsed = Array.isArray(job.parsed) ? job.parsed[0] : job.parsed;
                const processing = job.status === "processing" || job.status === "created";
                return (
                  <Link
                    key={job.id}
                    href={`/dashboard/jobs/${job.id}`}
                    className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-sm"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Briefcase className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">
                        {parsed?.title ?? (processing ? "Parsing…" : "Untitled role")}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {parsed?.company && <span>{parsed.company}</span>}
                        {parsed?.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {parsed.location}
                          </span>
                        )}
                        {parsed?.seniority && <span className="capitalize">{parsed.seniority}</span>}
                      </div>
                    </div>
                    {processing ? (
                      <span className="flex items-center gap-1.5 text-xs text-blue-500">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Scoring
                      </span>
                    ) : job.status === "failed" ? (
                      <span className="text-xs text-destructive">Failed</span>
                    ) : job.match ? (
                      <span className={cn("rounded-full px-2.5 py-1 text-sm font-bold", scoreColor(job.match.match_score))}>
                        {job.match.match_score}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">No resume</span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
