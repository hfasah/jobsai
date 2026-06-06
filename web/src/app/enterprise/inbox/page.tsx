"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Inbox, Loader2, Sparkles, Star, ThumbsUp, HelpCircle, ThumbsDown,
  Mail, ChevronRight, Filter, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { EnterpriseApplication, AIRecommendation } from "@/types/enterprise";
import { atsTier } from "@/types/enterprise";

type InboxApp = EnterpriseApplication & { job?: { id: string; title: string; department: string | null } };

type TriageMode = "recommendation" | "ats" | "job";

// Triage pools by AI recommendation
const REC_POOLS: { id: AIRecommendation | "unscored"; label: string; icon: React.ElementType; color: string; ring: string }[] = [
  { id: "strong_yes", label: "Strong Yes",  icon: Star,       color: "text-green-400",  ring: "border-green-500/30 bg-green-500/5" },
  { id: "yes",        label: "Yes",         icon: ThumbsUp,   color: "text-blue-400",   ring: "border-blue-500/30 bg-blue-500/5" },
  { id: "maybe",      label: "Maybe",       icon: HelpCircle, color: "text-amber-400",  ring: "border-amber-500/30 bg-amber-500/5" },
  { id: "no",         label: "No",          icon: ThumbsDown, color: "text-red-400",    ring: "border-red-500/30 bg-red-500/5" },
  { id: "unscored",   label: "Unscreened",  icon: Sparkles,   color: "text-muted-foreground", ring: "border-border bg-muted/20" },
];

function ApplicantRow({ app }: { app: InboxApp }) {
  return (
    <Link href={`/enterprise/jobs/${app.job_id}`}
      className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 hover:bg-muted/40 transition-colors">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{app.candidate_name}</p>
        <p className="truncate text-[11px] text-muted-foreground">{app.job?.title ?? "—"}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {app.ats_score !== null && app.ats_score !== undefined && (
          <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-semibold", atsTier(app.ats_score)?.color)}>
            ATS {app.ats_score}
          </span>
        )}
        {app.match_score !== null && (
          <span className={cn("text-xs font-bold tabular-nums", app.match_score >= 75 ? "text-green-400" : app.match_score >= 50 ? "text-amber-400" : "text-red-400")}>
            {app.match_score}
          </span>
        )}
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
    </Link>
  );
}

export default function EnterpriseInbox() {
  const [apps, setApps] = useState<InboxApp[]>([]);
  const [jobs, setJobs] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<TriageMode>("recommendation");
  const [jobFilter, setJobFilter] = useState<string>("");

  useEffect(() => {
    fetch("/api/enterprise/inbox")
      .then((r) => r.json())
      .then((j) => { setApps(j.data ?? []); setJobs(j.jobs ?? []); })
      .finally(() => setLoading(false));
  }, []);

  const visible = jobFilter ? apps.filter((a) => a.job_id === jobFilter) : apps;

  // Auto-triage into pools
  const recPools = useMemo(() => {
    return REC_POOLS.map((pool) => ({
      ...pool,
      apps: visible.filter((a) =>
        pool.id === "unscored" ? !a.screened_at : a.ai_recommendation === pool.id
      ),
    }));
  }, [visible]);

  const atsPools = useMemo(() => {
    const tiers = [
      { id: "top",      label: "Top Match (85-100)", color: "text-green-400",  ring: "border-green-500/30 bg-green-500/5" },
      { id: "strong",   label: "Strong (70-84)",     color: "text-cyan-400",   ring: "border-cyan-500/30 bg-cyan-500/5" },
      { id: "possible", label: "Possible (50-69)",   color: "text-amber-400",  ring: "border-amber-500/30 bg-amber-500/5" },
      { id: "low",      label: "Low (0-49)",         color: "text-red-400",    ring: "border-red-500/30 bg-red-500/5" },
      { id: "unscored", label: "Unscreened",         color: "text-muted-foreground", ring: "border-border bg-muted/20" },
    ];
    return tiers.map((t) => ({
      ...t,
      apps: visible.filter((a) => t.id === "unscored"
        ? (a.ats_score === null || a.ats_score === undefined)
        : atsTier(a.ats_score)?.id === t.id),
    }));
  }, [visible]);

  const jobPools = useMemo(() => {
    const byJob: Record<string, { title: string; apps: InboxApp[] }> = {};
    for (const a of visible) {
      const id = a.job_id;
      if (!byJob[id]) byJob[id] = { title: a.job?.title ?? "Unknown role", apps: [] };
      byJob[id].apps.push(a);
    }
    return Object.entries(byJob).map(([id, v]) => ({ id, ...v }));
  }, [visible]);

  if (loading) return (
    <main className="flex flex-1 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></main>
  );

  return (
    <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <Inbox className="h-6 w-6 text-primary" /> Candidate Inbox
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Every application across all jobs, auto-triaged into pools. {visible.length} total.
            </p>
          </div>

          {/* Job filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select value={jobFilter} onChange={(e) => setJobFilter(e.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="">All jobs</option>
              {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
          </div>
        </div>

        {/* Triage mode toggle */}
        <div className="mb-5 inline-flex rounded-xl border border-border bg-muted/40 p-1">
          {([
            { id: "recommendation", label: "By recommendation" },
            { id: "ats",            label: "By ATS score" },
            { id: "job",            label: "By job" },
          ] as const).map(({ id, label }) => (
            <button key={id} onClick={() => setMode(id)}
              className={cn("rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                mode === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {label}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
            <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
            No applications yet. They appear here automatically as candidates apply.
          </div>
        ) : mode === "recommendation" ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {recPools.filter((p) => p.apps.length > 0).map((pool) => {
              const Icon = pool.icon;
              return (
                <div key={pool.id} className={cn("rounded-2xl border p-3", pool.ring)}>
                  <div className="mb-3 flex items-center gap-2 px-1">
                    <Icon className={cn("h-4 w-4", pool.color)} />
                    <span className="text-sm font-semibold">{pool.label}</span>
                    <span className="ml-auto text-xs text-muted-foreground tabular-nums">{pool.apps.length}</span>
                  </div>
                  <div className="space-y-2">
                    {pool.apps.map((a) => <ApplicantRow key={a.id} app={a} />)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : mode === "ats" ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {atsPools.filter((p) => p.apps.length > 0).map((pool) => (
              <div key={pool.id} className={cn("rounded-2xl border p-3", pool.ring)}>
                <div className="mb-3 flex items-center gap-2 px-1">
                  <span className={cn("text-sm font-semibold", pool.color)}>{pool.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums">{pool.apps.length}</span>
                </div>
                <div className="space-y-2">
                  {pool.apps.map((a) => <ApplicantRow key={a.id} app={a} />)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {jobPools.map((pool) => (
              <div key={pool.id} className="rounded-2xl border border-border bg-card/40 p-3">
                <div className="mb-3 flex items-center gap-2 px-1">
                  <span className="text-sm font-semibold">{pool.title}</span>
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums">{pool.apps.length}</span>
                </div>
                <div className="space-y-2">
                  {pool.apps.map((a) => <ApplicantRow key={a.id} app={a} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
