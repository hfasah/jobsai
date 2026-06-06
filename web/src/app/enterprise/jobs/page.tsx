"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Loader2, Users, MapPin, Clock, CheckCircle2, PauseCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EnterpriseJob, JobStatus } from "@/types/enterprise";

const STATUS_STYLES: Record<JobStatus, string> = {
  active:  "bg-green-500/15 text-green-400 border-green-500/30",
  draft:   "bg-muted text-muted-foreground border-border",
  paused:  "bg-amber-500/15 text-amber-400 border-amber-500/30",
  closed:  "bg-red-500/15 text-red-400 border-red-500/30",
};

const STATUS_ICONS: Record<JobStatus, React.ElementType> = {
  active:  CheckCircle2,
  draft:   Clock,
  paused:  PauseCircle,
  closed:  XCircle,
};

export default function EnterpriseJobsPage() {
  const [jobs, setJobs] = useState<EnterpriseJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<JobStatus | "all">("all");

  useEffect(() => {
    fetch("/api/enterprise/jobs").then((r) => r.json()).then((j) => setJobs(j.data ?? [])).finally(() => setLoading(false));
  }, []);

  const visible = filter === "all" ? jobs : jobs.filter((j) => j.status === filter);

  return (
    <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Jobs</h1>
          <Link href="/enterprise/jobs/new"
            className="btn-cta inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold">
            <Plus className="h-4 w-4" /> Post a job
          </Link>
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-wrap gap-2">
          {(["all", "active", "draft", "paused", "closed"] as const).map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={cn("rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
                filter === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
              {s} {s === "all" ? `(${jobs.length})` : `(${jobs.filter((j) => j.status === s).length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="mt-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : visible.length === 0 ? (
          <div className="mt-12 text-center">
            <p className="text-muted-foreground">No jobs found.</p>
            <Link href="/enterprise/jobs/new" className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
              <Plus className="h-4 w-4" /> Post your first job
            </Link>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {visible.map((job) => {
              const StatusIcon = STATUS_ICONS[job.status];
              return (
                <Link key={job.id} href={`/enterprise/jobs/${job.id}`}
                  className="flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-4 transition-colors hover:bg-muted/40">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                      <p className="font-semibold truncate">{job.title}</p>
                      <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold shrink-0", STATUS_STYLES[job.status])}>
                        <StatusIcon className="h-2.5 w-2.5" />
                        {job.status}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {job.department && <span>{job.department}</span>}
                      {job.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location}</span>}
                      <span className="capitalize">{job.employment_type}</span>
                      {job.salary_min && job.salary_max && (
                        <span>${job.salary_min.toLocaleString()}–${job.salary_max.toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="ml-4 flex items-center gap-1.5 text-sm font-semibold tabular-nums shrink-0">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    {job.application_count ?? 0}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
