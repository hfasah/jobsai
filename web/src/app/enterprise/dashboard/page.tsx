"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, Users, CheckCircle2, Clock, Plus, ArrowRight, Loader2, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EnterpriseJob, EnterpriseApplication } from "@/types/enterprise";
import { STAGE_COLORS, STAGE_LABELS } from "@/types/enterprise";

export default function EnterpriseDashboard() {
  const [jobs, setJobs] = useState<EnterpriseJob[]>([]);
  const [recentApps, setRecentApps] = useState<EnterpriseApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/enterprise/jobs").then((r) => r.json()),
    ]).then(([j]) => {
      const jobList: EnterpriseJob[] = j.data ?? [];
      setJobs(jobList);
      // Fetch recent applications for active jobs
      const activeIds = jobList.filter((j) => j.status === "active").map((j) => j.id).slice(0, 3);
      return Promise.all(activeIds.map((id) =>
        fetch(`/api/enterprise/jobs/${id}/applications`).then((r) => r.json())
      ));
    }).then((results) => {
      const all = results.flatMap((r) => r.data ?? []);
      all.sort((a: EnterpriseApplication, b: EnterpriseApplication) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setRecentApps(all.slice(0, 8));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const activeJobs = jobs.filter((j) => j.status === "active").length;
  const totalApps = jobs.reduce((s, j) => s + (j.application_count ?? 0), 0);
  const draftJobs = jobs.filter((j) => j.status === "draft").length;

  if (loading) return (
    <main className="flex flex-1 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </main>
  );

  return (
    <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Recruiting overview</p>
          </div>
          <Link href="/enterprise/jobs/new"
            className="btn-cta inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold">
            <Plus className="h-4 w-4" /> Post a job
          </Link>
        </div>

        {/* Stats */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            { label: "Active jobs", value: activeJobs, icon: Briefcase, color: "text-primary" },
            { label: "Total applicants", value: totalApps, icon: Users, color: "text-desyn-accent" },
            { label: "Draft jobs", value: draftJobs, icon: Clock, color: "text-muted-foreground" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className={cn("h-5 w-5", color)} />
                </div>
                <p className="text-sm font-medium text-muted-foreground">{label}</p>
              </div>
              <p className="mt-3 text-3xl font-bold tabular-nums">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Active jobs */}
          <section className="rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-semibold">Active jobs</h2>
              <Link href="/enterprise/jobs" className="text-xs text-primary hover:underline flex items-center gap-1">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="divide-y divide-border">
              {jobs.filter((j) => j.status === "active").slice(0, 5).map((job) => (
                <Link key={job.id} href={`/enterprise/jobs/${job.id}`}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/40 transition-colors">
                  <div>
                    <p className="text-sm font-medium">{job.title}</p>
                    <p className="text-xs text-muted-foreground">{job.department ?? job.location ?? "—"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums">{job.application_count ?? 0}</span>
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </Link>
              ))}
              {jobs.filter((j) => j.status === "active").length === 0 && (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                  No active jobs.{" "}
                  <Link href="/enterprise/jobs/new" className="text-primary hover:underline">Post your first job →</Link>
                </div>
              )}
            </div>
          </section>

          {/* Recent applicants */}
          <section className="rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-semibold">Recent applicants</h2>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="divide-y divide-border">
              {recentApps.slice(0, 6).map((app) => (
                <div key={app.id} className="flex items-center justify-between px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{app.candidate_name}</p>
                    <p className="truncate text-xs text-muted-foreground">{app.candidate_email}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    {app.match_score !== null && (
                      <span className="text-xs font-semibold tabular-nums text-desyn-accent">{app.match_score}%</span>
                    )}
                    <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", STAGE_COLORS[app.stage])}>
                      {STAGE_LABELS[app.stage]}
                    </span>
                  </div>
                </div>
              ))}
              {recentApps.length === 0 && (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                  No applications yet. Applications appear here as candidates apply.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
