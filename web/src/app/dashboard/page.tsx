import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  Briefcase, TrendingUp, Send, Trophy,
  Sparkles, Plus, Search, FileText, MessageSquareText, Mic, Video,
  CheckCircle2, Clock, XCircle, ArrowRight, Coins,
} from "lucide-react";

import { supabaseAdmin } from "@/lib/supabase";
import { getTokenAccount } from "@/lib/tokens";
import { getUserBilling } from "@/lib/billing";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ui/glass-card";
import { SectionBadge } from "@/components/ui/section-badge";
import { GradientBg } from "@/components/ui/gradient-bg";
import { StatRing } from "@/components/ui/stat-ring";
import { TokenBalance } from "@/components/ui/token-balance";
import { Journey, type JourneyStep } from "@/components/dashboard/journey";
import { OpportunitySnapshot } from "@/components/dashboard/opportunity-snapshot";

// ─── Data ───────────────────────────────────────────────────────────────────

async function getDashboardData(userId: string) {
  const [jobsRes, applicationsRes, matchesRes, recentJobsRes, prefsRes, applyAttemptsRes, sessionsRes] =
    await Promise.all([
      supabaseAdmin.from("jobs").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabaseAdmin.from("applications").select("stage").eq("user_id", userId),
      supabaseAdmin
        .from("job_matches")
        .select("match_score")
        .in("job_id", (await supabaseAdmin.from("jobs").select("id").eq("user_id", userId).limit(200)).data?.map((j) => j.id) ?? []),
      supabaseAdmin
        .from("jobs")
        .select(`id, created_at, status, parsed:job_parsed ( parsed_json )`)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabaseAdmin
        .from("user_preferences")
        .select("auto_apply_enabled, last_discovery_at, last_discovery_count, job_titles")
        .eq("user_id", userId)
        .maybeSingle(),
      supabaseAdmin.from("apply_attempts").select("status", { count: "exact" }).eq("user_id", userId).eq("status", "submitted"),
      supabaseAdmin.from("interview_sessions").select("mode, overall_score").eq("user_id", userId),
    ]);

  const applications = applicationsRes.data ?? [];
  const stageMap = applications.reduce<Record<string, number>>((acc, a) => { acc[a.stage] = (acc[a.stage] ?? 0) + 1; return acc; }, {});

  const scores = (matchesRes.data ?? []).map((m) => m.match_score as number).filter(Boolean);
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  const sessions = sessionsRes.data ?? [];
  const byMode = (m: string) => sessions.filter((s) => s.mode === m).length;
  const bestScore = sessions.reduce((max, s) => Math.max(max, (s.overall_score as number) ?? 0), 0);
  const practiceStats = {
    total: sessions.length,
    written: byMode("written"),
    voice: byMode("voice"),
    avatar: byMode("avatar"),
    best: Math.round(bestScore * 10) / 10,
  };

  const recentJobs = recentJobsRes.data ?? [];
  const practiceJobId = (recentJobs.find((j) => j.status === "ready") ?? recentJobs[0])?.id as string | undefined;

  return {
    totalJobs: jobsRes.count ?? 0,
    avgScore,
    totalApplications: applications.length,
    autoApplied: applyAttemptsRes.count ?? 0,
    offers: stageMap["offer"] ?? 0,
    interviewing: stageMap["interviewing"] ?? 0,
    stageMap,
    recentJobs,
    prefs: prefsRes.data ?? null,
    practiceStats,
    practiceJobId,
  };
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string | number; sub?: string }) {
  return (
    <GlassCard interactive className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
      <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </GlassCard>
  );
}

const STAGE_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  saved:        { label: "Saved",        color: "text-muted-foreground bg-muted",         icon: Clock },
  applied:      { label: "Applied",      color: "text-primary bg-primary/15",              icon: Send },
  interviewing: { label: "Interviewing", color: "text-purple-700 bg-purple-100",          icon: Briefcase },
  offer:        { label: "Offer",        color: "text-desyn-success bg-desyn-success/10", icon: Trophy },
  rejected:     { label: "Rejected",     color: "text-destructive bg-destructive/10",     icon: XCircle },
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

  const hasResume = (resumes?.length ?? 0) > 0;

  const [d, tokenAccount, billing] = await Promise.all([
    getDashboardData(user.id),
    getTokenAccount(user.id).catch(() => null),
    getUserBilling(user.id).catch(() => null),
  ]);
  const isPaid = (billing?.plan ?? "free") !== "free";
  const prefs = d.prefs;
  const autoOn = prefs?.auto_apply_enabled ?? false;
  const lastDiscovery = prefs?.last_discovery_at
    ? new Date(prefs.last_discovery_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null;
  const lastCount = prefs?.last_discovery_count ?? 0;

  const ps = d.practiceStats;
  const jobHref = (suffix: string) => (d.practiceJobId ? `/dashboard/jobs/${d.practiceJobId}${suffix}` : "/dashboard/jobs/import");

  const journey: JourneyStep[] = [
    { key: "resume",   label: "Resume",    sub: hasResume ? "done" : "upload",  icon: FileText,  href: "/dashboard/resumes", done: hasResume },
    { key: "written",  label: "Written",   sub: "practice now", icon: MessageSquareText, href: jobHref(""),                   done: ps.written > 0 },
    { key: "voice",    label: "Voice",     sub: "try it",       icon: Mic,               href: jobHref("/voice-interview"),   done: ps.voice > 0 },
    { key: "avatar",   label: "Avatar",    sub: "go live",      icon: Video,             href: jobHref("/avatar-interview"),  done: ps.avatar > 0 },
    { key: "interview",label: "Interview", sub: "land one",     icon: Briefcase,         href: "/dashboard/applications",     done: d.interviewing > 0 || d.offers > 0 },
    { key: "offer",    label: "Offer",     sub: "the goal",     icon: Trophy,            href: "/dashboard/applications",     done: d.offers > 0 },
  ];

  return (
    <>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wider text-desyn-accent">Dashboard</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Welcome back, {firstName}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/billing" className="hidden sm:block">
              <TokenBalance value={tokenAccount?.balance} />
            </Link>
            <Link
              href="/dashboard/job-search"
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/50 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Job Search</span>
            </Link>
            <Link href="/dashboard/jobs/import" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
              <Plus className="h-3.5 w-3.5" /> Import job
            </Link>
          </div>
        </div>

        {/* Set Up Profile prompt — the 3 essentials before applying */}
        {!hasResume && (
          <Link href="/dashboard/setup"
            className="flex items-center justify-between gap-4 rounded-2xl border border-primary/40 bg-primary/5 px-5 py-4 transition-colors hover:bg-primary/10">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="font-semibold text-foreground">Set up your profile to start applying</p>
                <p className="text-sm text-muted-foreground">Add a résumé (name one per role), set your preferences, and complete your apply profile. You can search jobs meanwhile.</p>
              </div>
            </div>
            <span className="btn-cta shrink-0 rounded-xl px-4 py-2 text-sm font-semibold">Set up now →</span>
          </Link>
        )}

        {/* Top Row: Opportunity Snapshot + Journey */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Opportunity Snapshot — Compact half-width */}
          <div>
            <OpportunitySnapshot
              hasResume={hasResume}
              hasJobPreferences={prefs != null}
              hasApplyProfile={false}
            />
          </div>

          {/* Journey */}
          <GlassCard className="relative overflow-hidden p-6">
            <GradientBg variant="mesh" className="opacity-60" />
            <div className="mb-5 flex items-center justify-between">
              <div>
                <SectionBadge variant="soft" icon={Sparkles}>Your path to an offer</SectionBadge>
                <p className="mt-2 text-sm text-muted-foreground">Practice like it&apos;s the real thing — each level gets you closer.</p>
              </div>
            </div>
            <Journey steps={journey} />
          </GlassCard>
        </div>

        {/* Stat cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Briefcase}  label="Jobs imported"     value={d.totalJobs}        sub="all time" />
          <StatCard icon={TrendingUp} label="Avg match score"   value={d.avgScore != null ? `${d.avgScore}%` : "—"} sub={d.avgScore != null ? `across ${d.totalJobs} jobs` : "import a job to see"} />
          <StatCard icon={Send}       label="Applications sent" value={d.totalApplications} sub={`${d.autoApplied} auto-applied`} />
          <StatCard icon={Trophy}     label="Offers received"   value={d.offers}           sub={d.offers > 0 ? "🎉 great work!" : "keep going"} />
        </div>

        {/* Main grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent jobs — 2/3 */}
          <GlassCard className="lg:col-span-2">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-semibold">Recent jobs</h2>
              <Link href="/dashboard/jobs" className="text-xs text-muted-foreground transition-colors hover:text-foreground">View all →</Link>
            </div>
            {d.recentJobs.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
                <Sparkles className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No jobs yet.</p>
                <Link href="/dashboard/jobs/import" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                  Import your first job <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {d.recentJobs.map((job) => {
                  const parsed = (Array.isArray(job.parsed) ? job.parsed[0] : job.parsed)?.parsed_json as { title?: string; company?: string } | undefined;
                  return (
                    <li key={job.id}>
                      <Link href={`/dashboard/jobs/${job.id}`} className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-muted/40">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{parsed?.title ?? "Untitled role"}</p>
                          {parsed?.company && <p className="text-xs text-muted-foreground">{parsed.company}</p>}
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(job.created_at)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </GlassCard>

          {/* Right column */}
          <div className="flex flex-col gap-6">
            {/* Interview practice */}
            <GlassCard className="p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Interview practice</h2>
                <SectionBadge variant="outline">{ps.total} session{ps.total !== 1 ? "s" : ""}</SectionBadge>
              </div>
              {ps.total === 0 ? (
                <div className="mt-4 text-center">
                  <p className="text-sm text-muted-foreground">No practice yet — start with the written coach.</p>
                  <Link href={jobHref("")} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
                    Start practicing <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-4">
                  <StatRing value={(ps.best / 5) * 100} label={`${ps.best}`} sublabel="best" tone={ps.best >= 4 ? "success" : ps.best >= 3 ? "warning" : "brand"} size={104} strokeWidth={9} />
                  <div className="flex-1 space-y-1.5 text-sm">
                    <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-muted-foreground"><MessageSquareText className="h-3.5 w-3.5" /> Written</span><span className="font-semibold tabular-nums">{ps.written}</span></div>
                    <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-muted-foreground"><Mic className="h-3.5 w-3.5" /> Voice</span><span className="font-semibold tabular-nums">{ps.voice}</span></div>
                    <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-muted-foreground"><Video className="h-3.5 w-3.5" /> Avatar</span><span className="font-semibold tabular-nums">{ps.avatar}</span></div>
                  </div>
                </div>
              )}
            </GlassCard>

            {/* Auto-apply */}
            <GlassCard className="p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Auto-apply</h2>
                <span className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", autoOn ? "bg-desyn-success/10 text-desyn-success" : "bg-muted text-muted-foreground")}>
                  {autoOn ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}{autoOn ? "Active" : "Off"}
                </span>
              </div>
              {lastDiscovery ? (
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  Last run: <span className="font-medium text-foreground">{lastDiscovery}</span>{lastCount > 0 && <> · {lastCount} jobs found</>}
                </p>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">No discovery runs yet.</p>
              )}
              <Link href="/dashboard/preferences" className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                Manage preferences <ArrowRight className="h-3 w-3" />
              </Link>
            </GlassCard>

            {/* Pipeline */}
            <GlassCard className="p-5">
              <h2 className="mb-4 font-semibold">Pipeline</h2>
              <div className="space-y-2">
                {(["applied", "interviewing", "offer", "saved", "rejected"] as const).map((stage) => {
                  const m = STAGE_META[stage];
                  const Icon = m.icon;
                  return (
                    <div key={stage} className="flex items-center justify-between">
                      <span className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", m.color)}><Icon className="h-3 w-3" />{m.label}</span>
                      <span className="text-sm font-semibold tabular-nums text-foreground">{d.stageMap[stage] ?? 0}</span>
                    </div>
                  );
                })}
              </div>
              <Link href="/dashboard/applications" className="mt-4 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                View all applications <ArrowRight className="h-3 w-3" />
              </Link>
            </GlassCard>
          </div>
        </div>

        {/* Quick nav */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: "/dashboard/resumes",       icon: FileText,     label: "Resumes",        sub: "Upload & manage" },
            { href: "/dashboard/skills",         icon: TrendingUp,   label: "Skills Gap",     sub: "What to learn next" },
            { href: "/dashboard/approve",        icon: CheckCircle2, label: "Approval Queue", sub: "Review before we apply" },
            { href: "/dashboard/billing",        icon: Coins,        label: "Plan & Tokens",  sub: "Upgrade or top up" },
          ].map(({ href, icon: Icon, label, sub }) => (
            <Link key={href} href={href}>
              <GlassCard interactive className="flex items-center gap-3 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10"><Icon className="h-4 w-4 text-primary" /></div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{sub}</p>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground/50" />
              </GlassCard>
            </Link>
          ))}
        </div>

      </main>
    </>
  );
}
