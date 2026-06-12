"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, Users, Clock, Plus, ArrowRight, Loader2, TrendingUp, Target, AlertTriangle, Star, CalendarDays, MessageSquare, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EnterpriseJob, EnterpriseApplication } from "@/types/enterprise";
import { STAGE_COLORS, STAGE_LABELS, ATS_TIERS, atsTier } from "@/types/enterprise";

interface Nudge { type: string; message: string; count: number; href: string; color: string }

export default function EnterpriseDashboard() {
  const [jobs, setJobs] = useState<EnterpriseJob[]>([]);
  const [recentApps, setRecentApps] = useState<EnterpriseApplication[]>([]);
  const [recentAll, setRecentAll] = useState<EnterpriseApplication[]>([]);
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/enterprise/dashboard/nudges")
      .then((r) => r.json())
      .then((j) => setNudges(j.nudges ?? []))
      .catch(() => {});

    Promise.all([
      fetch("/api/enterprise/jobs").then((r) => r.json()),
    ]).then(([j]) => {
      const jobList: EnterpriseJob[] = j.data ?? [];
      setJobs(jobList);
      // Fetch applications for active jobs
      const activeIds = jobList.filter((j) => j.status === "active").map((j) => j.id).slice(0, 5);
      return Promise.all(activeIds.map((id) =>
        fetch(`/api/enterprise/jobs/${id}/applications`).then((r) => r.json())
      ));
    }).then((results) => {
      const all: EnterpriseApplication[] = results.flatMap((r) => r.data ?? []);
      all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setRecentAll(all);
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

        {/* Smart nudges */}
        {nudges.length > 0 && (
          <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {nudges.map((n) => (
              <Link key={n.type} href={n.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors hover:opacity-90",
                  n.color === "amber"  && "border-amber-500/30 bg-amber-500/5 text-amber-400",
                  n.color === "green"  && "border-green-500/30 bg-green-500/5 text-green-400",
                  n.color === "violet" && "border-violet-500/30 bg-violet-500/5 text-violet-400",
                  n.color === "cyan"   && "border-cyan-500/30 bg-cyan-500/5 text-cyan-400",
                  n.color === "blue"   && "border-blue-500/30 bg-blue-500/5 text-blue-400",
                )}>
                {n.color === "amber"  && <AlertTriangle className="h-4 w-4 shrink-0" />}
                {n.color === "green"  && <Star className="h-4 w-4 shrink-0" />}
                {n.color === "violet" && <CalendarDays className="h-4 w-4 shrink-0" />}
                {n.color === "cyan"   && <MessageSquare className="h-4 w-4 shrink-0" />}
                {n.color === "blue"   && <FileText className="h-4 w-4 shrink-0" />}
                <span className="flex-1 truncate">{n.message}</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
              </Link>
            ))}
          </div>
        )}

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
                    {app.ats_score !== null && app.ats_score !== undefined && (
                      <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", atsTier(app.ats_score)?.color)}>
                        ATS {app.ats_score}
                      </span>
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

        {/* ATS score distribution across all candidates */}
        <AtsDistribution apps={recentAll} />
      </div>
    </main>
  );
}

function AtsDistribution({ apps }: { apps: EnterpriseApplication[] }) {
  const scored = apps.filter((a) => a.ats_score !== null && a.ats_score !== undefined);
  if (scored.length === 0) return null;

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Target className="h-4 w-4 text-primary" />
        <h2 className="font-semibold">ATS score distribution</h2>
        <span className="text-xs text-muted-foreground">· {scored.length} screened candidates</span>
      </div>

      {/* stacked bar */}
      <div className="mb-4 flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {ATS_TIERS.map((tier) => {
          const count = scored.filter((a) => atsTier(a.ats_score)?.id === tier.id).length;
          const pct = Math.round((count / scored.length) * 100);
          if (pct === 0) return null;
          return <div key={tier.id} className={tier.dot} style={{ width: `${pct}%` }} title={`${tier.label}: ${count}`} />;
        })}
      </div>

      {/* tier counts */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ATS_TIERS.map((tier) => {
          const count = scored.filter((a) => atsTier(a.ats_score)?.id === tier.id).length;
          return (
            <div key={tier.id} className="rounded-xl border border-border p-3">
              <div className="flex items-center gap-1.5">
                <span className={cn("h-2 w-2 rounded-full", tier.dot)} />
                <span className="text-xs font-medium">{tier.label}</span>
              </div>
              <p className="mt-1.5 text-2xl font-bold tabular-nums">{count}</p>
              <p className="text-[10px] text-muted-foreground">ATS {tier.range}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
