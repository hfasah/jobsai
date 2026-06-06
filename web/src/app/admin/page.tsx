"use client";

import { useEffect, useState } from "react";
import { Users, TrendingUp, DollarSign, UserCheck, FileText, Briefcase, UserMinus, MessageSquareWarning } from "lucide-react";
import { cn } from "@/lib/utils";

interface Stats {
  totalUsers: number; todayCount: number; weekCount: number; monthCount: number;
  mrr: number; byPlan: Record<string, number>; totalSubscribers: number;
  totalResumes: number; totalJobs: number; totalChurned: number; totalFeedback: number;
}

const PLAN_COLOR: Record<string, string> = {
  pro: "bg-blue-500/15 text-blue-400",
  premium: "bg-purple-500/15 text-purple-400",
  accelerator: "bg-amber-500/15 text-amber-400",
  enterprise: "bg-emerald-500/15 text-emerald-400",
};

function KPI({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", color ?? "bg-primary/10")}>
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
      <p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function AdminOverview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats").then((r) => r.json()).then(setStats).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading…</div>;
  if (!stats) return <div className="text-destructive">Failed to load stats.</div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Platform Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">Live metrics across all JobsAI users.</p>
      </div>

      {/* Revenue */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Revenue</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <KPI icon={DollarSign} label="Monthly Recurring Revenue" value={`$${stats.mrr.toLocaleString()}`} sub="based on active subscriptions" />
          <KPI icon={UserCheck} label="Active Subscribers" value={stats.totalSubscribers} sub="paid plans" />
          <KPI icon={UserMinus} label="Churned" value={stats.totalChurned} sub="all time" />
        </div>
      </section>

      {/* Plan breakdown */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Subscribers by Plan</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          {["pro", "premium", "accelerator", "enterprise"].map((p) => (
            <div key={p} className="rounded-xl border border-border bg-card p-4 text-center">
              <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold capitalize", PLAN_COLOR[p] ?? "bg-muted text-muted-foreground")}>{p}</span>
              <p className="mt-2 text-3xl font-bold tabular-nums">{stats.byPlan[p] ?? 0}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Users */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">User Growth</h2>
        <div className="grid gap-4 sm:grid-cols-4">
          <KPI icon={Users} label="Total Users" value={stats.totalUsers.toLocaleString()} />
          <KPI icon={TrendingUp} label="New Today" value={stats.todayCount} />
          <KPI icon={TrendingUp} label="New This Week" value={stats.weekCount} />
          <KPI icon={TrendingUp} label="New This Month" value={stats.monthCount} />
        </div>
      </section>

      {/* Platform usage */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Platform Usage</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <KPI icon={FileText} label="Total Resumes Uploaded" value={stats.totalResumes.toLocaleString()} />
          <KPI icon={Briefcase} label="Total Jobs Tracked" value={stats.totalJobs.toLocaleString()} />
          <KPI icon={MessageSquareWarning} label="Churn Survey Responses" value={stats.totalFeedback} />
        </div>
      </section>
    </div>
  );
}
