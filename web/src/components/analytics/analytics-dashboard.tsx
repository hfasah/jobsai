"use client";

import { useEffect, useState } from "react";
import {
  Briefcase, TrendingUp, ClipboardList, Trophy,
  Loader2, ShieldCheck, Wand2, Mail, BrainCircuit,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  AnalyticsData, StageBucket, ScoreBucket, SkillFrequency, WeekActivity,
} from "@/types/analytics";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 75) return "text-green-600";
  if (score >= 50) return "text-amber-600";
  return "text-red-600";
}

function pct(value: number, total: number) {
  return total === 0 ? 0 : Math.round((value / total) * 100);
}

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, sub, valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </div>
      <div>
        <p className={cn("text-3xl font-bold tabular-nums", valueClass)}>{value}</p>
        <p className="mt-0.5 text-sm font-medium">{label}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Section title ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 font-semibold tracking-tight">{children}</h2>
  );
}

// ─── Horizontal bar ──────────────────────────────────────────────────────────

function HBar({
  label, count, maxCount, color, badge,
}: {
  label: string;
  count: number;
  maxCount: number;
  color: string;
  badge?: string;
}) {
  const width = maxCount === 0 ? 0 : Math.max(pct(count, maxCount), count > 0 ? 4 : 0);
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">{label}</span>
      <div className="flex-1">
        <div className="h-6 overflow-hidden rounded-md bg-muted">
          <div
            className={cn("h-full rounded-md transition-all duration-700", color)}
            style={{ width: `${width}%` }}
          />
        </div>
      </div>
      <span className="w-6 shrink-0 text-right text-xs font-semibold tabular-nums">{count}</span>
      {badge && (
        <span className="w-9 shrink-0 text-right text-xs text-muted-foreground">{badge}</span>
      )}
    </div>
  );
}

// ─── Pipeline ────────────────────────────────────────────────────────────────

const STAGE_COLORS: Record<string, string> = {
  saved:        "bg-slate-400",
  applied:      "bg-blue-500",
  interviewing: "bg-amber-500",
  offer:        "bg-green-500",
  rejected:     "bg-red-400",
};

function Pipeline({ stages }: { stages: StageBucket[] }) {
  const total = stages.reduce((s, b) => s + b.count, 0);
  if (total === 0) {
    return <p className="text-sm text-muted-foreground">No applications tracked yet.</p>;
  }
  return (
    <div className="space-y-2.5">
      {stages.map((s) => (
        <HBar
          key={s.stage}
          label={s.label}
          count={s.count}
          maxCount={total}
          color={STAGE_COLORS[s.stage] ?? "bg-primary"}
          badge={`${pct(s.count, total)}%`}
        />
      ))}
    </div>
  );
}

// ─── Match distribution ───────────────────────────────────────────────────────

const DIST_COLORS = ["bg-green-500", "bg-amber-400", "bg-orange-400", "bg-red-400"];

function MatchDistribution({ buckets }: { buckets: ScoreBucket[] }) {
  const maxCount = Math.max(...buckets.map((b) => b.count), 1);
  return (
    <div className="space-y-2.5">
      {buckets.map((b, i) => (
        <HBar
          key={b.label}
          label={b.label}
          count={b.count}
          maxCount={maxCount}
          color={DIST_COLORS[i]}
        />
      ))}
    </div>
  );
}

// ─── Skill list ───────────────────────────────────────────────────────────────

function SkillList({ skills, color }: { skills: SkillFrequency[]; color: string }) {
  const max = skills[0]?.count ?? 1;
  if (skills.length === 0) {
    return <p className="text-sm text-muted-foreground">Not enough data yet.</p>;
  }
  return (
    <div className="space-y-2">
      {skills.map((s) => (
        <div key={s.skill} className="flex items-center gap-3">
          <span className="min-w-0 flex-1 truncate text-sm capitalize">{s.skill}</span>
          <div className="w-24 shrink-0">
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full", color)}
                style={{ width: `${pct(s.count, max)}%` }}
              />
            </div>
          </div>
          <span className="w-5 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
            {s.count}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Weekly activity chart ────────────────────────────────────────────────────

function ActivityChart({ weeks }: { weeks: WeekActivity[] }) {
  const maxJobs = Math.max(...weeks.map((w) => w.jobs), 1);
  const maxApps = Math.max(...weeks.map((w) => w.applications), 1);
  const overallMax = Math.max(maxJobs, maxApps, 1);
  const BAR_HEIGHT = 80; // px

  return (
    <div>
      {/* Legend */}
      <div className="mb-4 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-primary" />
          Jobs imported
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" />
          Applications added
        </span>
      </div>

      <div className="flex items-end gap-2">
        {weeks.map((w) => (
          <div key={w.week} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex w-full items-end justify-center gap-1" style={{ height: BAR_HEIGHT }}>
              <div
                title={`${w.jobs} job${w.jobs !== 1 ? "s" : ""}`}
                className="w-1/2 rounded-t-sm bg-primary transition-all duration-700"
                style={{ height: `${pct(w.jobs, overallMax)}%`, minHeight: w.jobs > 0 ? 4 : 0 }}
              />
              <div
                title={`${w.applications} application${w.applications !== 1 ? "s" : ""}`}
                className="w-1/2 rounded-t-sm bg-amber-400 transition-all duration-700"
                style={{ height: `${pct(w.applications, overallMax)}%`, minHeight: w.applications > 0 ? 4 : 0 }}
              />
            </div>
            <span className="text-center text-xs text-muted-foreground">{w.week}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── AI usage pills ───────────────────────────────────────────────────────────

function AiPill({ icon, label, count }: { icon: React.ReactNode; label: string; count: number }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <p className="text-2xl font-bold tabular-nums">{count}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then((j) => { if (j.data) setData(j.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading analytics…
      </div>
    );
  }

  if (!data) {
    return <p className="py-12 text-sm text-muted-foreground">Failed to load analytics.</p>;
  }

  const { summary, applications_by_stage, match_distribution, top_missing_skills, top_matched_skills, activity_by_week, ai_usage } = data;

  return (
    <div className="space-y-8">
      {/* ── Summary cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Briefcase className="h-5 w-5" />}
          label="Jobs imported"
          value={summary.total_jobs}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Avg match score"
          value={summary.avg_match_score != null ? `${summary.avg_match_score}` : "—"}
          sub={summary.avg_match_score != null ? "across all scored jobs" : "no matches yet"}
          valueClass={summary.avg_match_score != null ? scoreColor(summary.avg_match_score) : ""}
        />
        <StatCard
          icon={<ClipboardList className="h-5 w-5" />}
          label="Active applications"
          value={summary.active_applications}
          sub={`${summary.total_applications} total tracked`}
        />
        <StatCard
          icon={<Trophy className="h-5 w-5" />}
          label="Offers received"
          value={summary.offers}
          valueClass={summary.offers > 0 ? "text-green-600" : ""}
        />
      </div>

      {/* ── Pipeline + Distribution ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6">
          <SectionTitle>Application pipeline</SectionTitle>
          <Pipeline stages={applications_by_stage} />
        </div>
        <div className="rounded-2xl border border-border bg-card p-6">
          <SectionTitle>Match score distribution</SectionTitle>
          {match_distribution.every((b) => b.count === 0) ? (
            <p className="text-sm text-muted-foreground">No scored jobs yet.</p>
          ) : (
            <MatchDistribution buckets={match_distribution} />
          )}
        </div>
      </div>

      {/* ── Skills ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6">
          <SectionTitle>Top skill gaps</SectionTitle>
          <p className="mb-4 text-xs text-muted-foreground">
            Skills most frequently missing from your resume across all job matches
          </p>
          <SkillList skills={top_missing_skills} color="bg-red-400" />
        </div>
        <div className="rounded-2xl border border-border bg-card p-6">
          <SectionTitle>Your strengths</SectionTitle>
          <p className="mb-4 text-xs text-muted-foreground">
            Skills most frequently matched across all job descriptions
          </p>
          <SkillList skills={top_matched_skills} color="bg-green-500" />
        </div>
      </div>

      {/* ── Weekly activity ── */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <SectionTitle>Activity — last 5 weeks</SectionTitle>
        <ActivityChart weeks={activity_by_week} />
      </div>

      {/* ── AI usage ── */}
      <div>
        <SectionTitle>AI tools used</SectionTitle>
        <div className="flex gap-3">
          <AiPill icon={<ShieldCheck className="h-4 w-4" />} label="ATS scans"       count={ai_usage.ats_scans} />
          <AiPill icon={<Wand2 className="h-4 w-4" />}       label="Tailored resumes" count={ai_usage.tailored_resumes} />
          <AiPill icon={<Mail className="h-4 w-4" />}         label="Cover letters"   count={ai_usage.cover_letters} />
          <AiPill icon={<BrainCircuit className="h-4 w-4" />} label="Interview preps" count={ai_usage.interview_preps} />
        </div>
      </div>
    </div>
  );
}
