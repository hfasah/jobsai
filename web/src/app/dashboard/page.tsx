import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  Briefcase, TrendingUp, Send, Trophy,
  Zap, Sparkles, Plus, Search,
  CheckCircle2, Clock, XCircle, ArrowRight,
} from "lucide-react";

import { SiteHeader } from "@/components/layout/site-header";
import { supabaseAdmin } from "@/lib/supabase";
import { cn } from "@/lib/utils";

// ─── Data fetching ────────────────────────────────────────────────────────────

async function getDashboardData(userId: string) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [
    jobsRes,
    applicationsRes,
    matchesRes,
    recentJobsRes,
    prefsRes,
    applyAttemptsRes,
  ] = await Promise.all([
    supabaseAdmin
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabaseAdmin
      .from("applications")
      .select("stage")
      .eq("user_id", userId),
    supabaseAdmin
      .from("job_matches")
      .select("match_score")
      .in(
        "job_id",
        (
          await supabaseAdmin
            .from("jobs")
            .select("id")
            .eq("user_id", userId)
            .limit(200)
        ).data?.map((j) => j.id) ?? []
      ),
    supabaseAdmin
      .from("jobs")
      .select(`
        id, created_at,
        parsed:job_parsed ( parsed_json )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabaseAdmin
      .from("user_preferences")
      .select("auto_apply_enabled, last_discovery_at, last_discovery_count, job_titles")
      .eq("user_id", userId)
      .maybeSingle(),
    supabaseAdmin
      .from("apply_attempts")
      .select("status", { count: "exact" })
      .eq("user_id", userId)
      .eq("status", "submitted"),
  ]);

  const applications = applicationsRes.data ?? [];
  const stageMap = applications.reduce<Record<string, number>>((acc, a) => {
    acc[a.stage] = (acc[a.stage] ?? 0) + 1;
    return acc;
  }, {});

  const scores = (matchesRes.data ?? []).map((m) => m.match_score as number).filter(Boolean);
  const avgScore = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null;

  return {
    totalJobs: jobsRes.count ?? 0,
    avgScore,
    totalApplications: applications.length,
    autoApplied: applyAttemptsRes.count ?? 0,
    offers: stageMap["offer"] ?? 0,
    stageMap,
    recentJobs: recentJobsRes.data ?? [],
    prefs: prefsRes.data ?? null,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10", accent)}>
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
      <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

const STAGE_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  saved:        { label: "Saved",        color: "text-muted-foreground bg-muted",           icon: Clock },
  applied:      { label: "Applied",      color: "text-blue-700 bg-blue-100",                icon: Send },
  interviewing: { label: "Interviewing", color: "text-purple-700 bg-purple-100",            icon: Briefcase },
  offer:        { label: "Offer",        color: "text-desyn-success bg-desyn-success/10",   icon: Trophy },
  rejected:     { label: "Rejected",     color: "text-destructive bg-destructive/10",       icon: XCircle },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const user = await currentUser();
  const firstName = user?.firstName ?? "there";

  if (!user) redirect("/sign-in");

  const { data: resumes } = await supabaseAdmin
    .from("resume_documents")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_archived", false)
    .limit(1);

  if (!resumes || resumes.length === 0) redirect("/onboard");

  const d = await getDashboardData(user.id);
  const prefs = d.prefs;

  const autoOn = prefs?.auto_apply_enabled ?? false;
  const lastDiscovery = prefs?.last_discovery_at
    ? new Date(prefs.last_discovery_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null;
  const lastCount = prefs?.last_discovery_count ?? 0;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wider text-desyn-accent">
              Dashboard
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Welcome back, {firstName}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/discover"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Discover</span>
            </Link>
            <Link
              href="/dashboard/jobs/import"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
              Import job
            </Link>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Briefcase}   label="Jobs imported"     value={d.totalJobs}         sub="all time" />
          <StatCard icon={TrendingUp}  label="Avg match score"   value={d.avgScore != null ? `${d.avgScore}%` : "—"} sub={d.avgScore != null ? `across ${d.totalJobs} jobs` : "import a job to see"} />
          <StatCard icon={Send}        label="Applications sent" value={d.totalApplications} sub={`${d.autoApplied} auto-applied`} />
          <StatCard icon={Trophy}      label="Offers received"   value={d.offers}            sub={d.offers > 0 ? "🎉 great work!" : "keep applying"} />
        </div>

        {/* Main grid */}
        <div className="grid gap-6 lg:grid-cols-3">

          {/* Recent jobs — 2/3 */}
          <section className="lg:col-span-2 rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-semibold">Recent jobs</h2>
              <Link href="/dashboard/jobs" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                View all →
              </Link>
            </div>
            {d.recentJobs.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
                <Sparkles className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No jobs yet.</p>
                <Link
                  href="/dashboard/jobs/import"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  Import your first job <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {d.recentJobs.map((job) => {
                  const parsed = (Array.isArray(job.parsed) ? job.parsed[0] : job.parsed)
                    ?.parsed_json as { title?: string; company?: string } | undefined;
                  const title = parsed?.title ?? "Untitled role";
                  const company = parsed?.company ?? "";
                  return (
                    <li key={job.id}>
                      <Link
                        href={`/dashboard/jobs/${job.id}`}
                        className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-muted/40 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{title}</p>
                          {company && <p className="text-xs text-muted-foreground">{company}</p>}
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {timeAgo(job.created_at)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Right column — 1/3 */}
          <div className="flex flex-col gap-6">

            {/* Auto-apply status */}
            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Auto-apply</h2>
                <span className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                  autoOn ? "bg-desyn-success/10 text-desyn-success" : "bg-muted text-muted-foreground"
                )}>
                  {autoOn ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                  {autoOn ? "Active" : "Off"}
                </span>
              </div>
              {lastDiscovery ? (
                <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                  Last run: <span className="text-foreground font-medium">{lastDiscovery}</span>
                  {lastCount > 0 && <> · {lastCount} jobs found</>}
                </p>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">No discovery runs yet.</p>
              )}
              <Link
                href="/dashboard/preferences"
                className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Manage preferences <ArrowRight className="h-3 w-3" />
              </Link>
            </section>

            {/* Pipeline */}
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-4 font-semibold">Pipeline</h2>
              <div className="space-y-2">
                {(["applied", "interviewing", "offer", "saved", "rejected"] as const).map((stage) => {
                  const meta = STAGE_META[stage];
                  const count = d.stageMap[stage] ?? 0;
                  const Icon = meta.icon;
                  return (
                    <div key={stage} className="flex items-center justify-between">
                      <span className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", meta.color)}>
                        <Icon className="h-3 w-3" />
                        {meta.label}
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-foreground">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
              <Link
                href="/dashboard/applications"
                className="mt-4 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                View all applications <ArrowRight className="h-3 w-3" />
              </Link>
            </section>
          </div>
        </div>

        {/* Quick nav */}
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { href: "/dashboard/resumes",     icon: Briefcase, label: "Resumes",          sub: "Upload & manage"           },
            { href: "/dashboard/analytics",   icon: TrendingUp, label: "Analytics",        sub: "Match trends & skill gaps" },
            { href: "/dashboard/apply-profile", icon: Send,     label: "Apply profile",    sub: "Auto-apply passport"       },
          ].map(({ href, icon: Icon, label, sub }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-sm"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{sub}</p>
              </div>
              <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground/50" />
            </Link>
          ))}
        </div>

      </main>
    </>
  );
}
