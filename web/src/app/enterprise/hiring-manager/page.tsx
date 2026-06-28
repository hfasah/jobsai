"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2, ClipboardCheck, Briefcase, Users, CalendarDays, MessageSquare,
  CheckCircle2, XCircle, HelpCircle, ChevronDown, ChevronUp, Star,
  ArrowRight, AlertTriangle, Clock, ThumbsUp, ThumbsDown, MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkspaceJob {
  id: string; title: string; department: string | null; status: string;
  total_applicants: number; awaiting_decision: number; offer_stage: number; hired: number;
}

interface PendingApp {
  id: string; candidate_name: string; candidate_email: string; stage: string;
  match_score: number | null; skills_score: number | null; experience_score: number | null;
  ai_recommendation: string | null; ai_summary: string | null; notes: string | null;
  hm_notes: string | null; tags: string[] | null; risk_flags: string[] | null;
  resume_url: string | null; resume_storage_key: string | null; source: string; created_at: string;
  job: { id: string; title: string } | null;
}

interface UpcomingInterview {
  id: string; candidate_name: string; title: string; scheduled_at: string;
  duration_min: number; meeting_link: string | null; status: string; interview_type: string;
  application_id: string | null; job: { id: string; title: string } | null;
}

interface PendingFeedback {
  id: string; candidate_name: string; scheduled_at: string;
  application_id: string | null; job: { id: string; title: string } | null;
}

interface WorkspaceData {
  stats: { my_jobs: number; awaiting_decision: number; upcoming_interviews: number; pending_feedback: number };
  jobs: WorkspaceJob[];
  pending_applications: PendingApp[];
  upcoming_interviews: UpcomingInterview[];
  pending_feedback: PendingFeedback[];
  role: string;
}

const REC_LABEL: Record<string, string> = { strong_yes: "Strong Yes", yes: "Yes", maybe: "Maybe", no: "No" };
const REC_COLOR: Record<string, string> = {
  strong_yes: "text-green-400 bg-green-500/10 border-green-500/30",
  yes:        "text-blue-400 bg-blue-500/10 border-blue-500/30",
  maybe:      "text-amber-400 bg-amber-500/10 border-amber-500/30",
  no:         "text-red-400 bg-red-500/10 border-red-500/30",
};
const SCORE_COLOR = (n: number) => n >= 75 ? "text-green-400" : n >= 50 ? "text-amber-400" : "text-red-400";

function CandidateDecisionCard({ app, onDecision }: {
  app: PendingApp;
  onDecision: (appId: string, action: string, notes?: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [acting, setActing] = useState<string | null>(null);

  const act = async (action: string, notes?: string) => {
    setActing(action);
    await onDecision(app.id, action, notes);
    setActing(null);
    setNoteOpen(false);
  };

  const jobTitle = app.job?.title ?? "Unknown role";

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Card header */}
      <div className="flex items-start gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
          {app.candidate_name.charAt(0).toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{app.candidate_name}</span>
            {app.match_score !== null && (
              <span className={cn("text-sm font-bold tabular-nums", SCORE_COLOR(app.match_score))}>
                {app.match_score}%
              </span>
            )}
            {app.ai_recommendation && (
              <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", REC_COLOR[app.ai_recommendation])}>
                {REC_LABEL[app.ai_recommendation]}
              </span>
            )}
            <span className="text-xs text-muted-foreground">· {jobTitle}</span>
            <span className="capitalize text-xs text-muted-foreground">· {app.stage}</span>
          </div>

          {app.ai_summary && (
            <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2 leading-relaxed">
              {app.ai_summary}
            </p>
          )}

          {app.risk_flags && app.risk_flags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {app.risk_flags.map((f) => (
                <span key={f} className="inline-flex items-center gap-1 rounded-full bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-[10px] text-red-400">
                  <AlertTriangle className="h-2.5 w-2.5" />{f}
                </span>
              ))}
            </div>
          )}
        </div>

        <button onClick={() => setExpanded((v) => !v)}
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-3">
          {/* Score breakdown */}
          {(app.skills_score !== null || app.experience_score !== null) && (
            <div className="grid grid-cols-2 gap-3">
              {[["Skills", app.skills_score], ["Experience", app.experience_score]].map(([label, val]) => (
                val !== null && (
                  <div key={label as string}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-muted-foreground">{label}</span>
                      <span className={cn("font-semibold", SCORE_COLOR(val as number))}>{val}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted">
                      <div className={cn("h-full rounded-full", (val as number) >= 75 ? "bg-green-500" : (val as number) >= 50 ? "bg-amber-500" : "bg-red-500")}
                        style={{ width: `${val}%` }} />
                    </div>
                  </div>
                )
              ))}
            </div>
          )}

          {/* Recruiter notes */}
          {app.notes && (
            <div className="rounded-xl bg-muted/50 p-3">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Recruiter notes</p>
              <p className="text-sm text-foreground leading-relaxed">{app.notes}</p>
            </div>
          )}

          {/* Tags */}
          {app.tags && app.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {app.tags.map((t) => (
                <span key={t} className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{t}</span>
              ))}
            </div>
          )}

          {/* External links */}
          <div className="flex flex-wrap gap-2">
            {(app.resume_storage_key || app.resume_url) && (
              <a href={`/api/enterprise/inbox/applications/${app.id}/resume`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
                View resume <ArrowRight className="h-3 w-3" />
              </a>
            )}
            <Link href={`/enterprise/jobs/${app.job?.id}`}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              Full profile <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* HM notes input */}
          {noteOpen && (
            <div className="space-y-2">
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                placeholder="Add a note for the recruiter…"
                className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          )}
        </div>
      )}

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/30 px-4 py-3">
        <button onClick={() => act("approve", note || undefined)} disabled={!!acting}
          className="inline-flex items-center gap-1.5 rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs font-semibold text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-40">
          {acting === "approve" ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsUp className="h-3 w-3" />}
          Approve → Offer
        </button>

        <button onClick={() => act("move_stage", "interview")} disabled={!!acting}
          className="inline-flex items-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-400 hover:bg-violet-500/20 transition-colors disabled:opacity-40">
          {acting === "interview" ? <Loader2 className="h-3 w-3 animate-spin" /> : <CalendarDays className="h-3 w-3" />}
          Move to Interview
        </button>

        <button onClick={() => { setNoteOpen((v) => !v); setExpanded(true); }} disabled={!!acting}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40">
          <MessageSquare className="h-3 w-3" />
          {noteOpen ? "Hide note" : "Request info"}
        </button>

        {noteOpen && note.trim() && (
          <button onClick={() => act("more_info", note)} disabled={!!acting}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-40">
            {acting === "more_info" ? <Loader2 className="h-3 w-3 animate-spin" /> : <HelpCircle className="h-3 w-3" />}
            Send to recruiter
          </button>
        )}

        <button onClick={() => act("reject", note || undefined)} disabled={!!acting}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-40">
          {acting === "reject" ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsDown className="h-3 w-3" />}
          Reject
        </button>
      </div>
    </div>
  );
}

export default function HiringManagerWorkspace() {
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<"decision" | "interviews" | "feedback" | "jobs">("decision");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/enterprise/hiring-manager/workspace");
      const json = await res.json();
      if (!res.ok || json.error) { setLoading(false); return; }
      setData(json);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDecision = async (appId: string, action: string, notes?: string) => {
    await fetch(`/api/enterprise/hiring-manager/applications/${appId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, notes }),
    });
    setDismissed((d) => new Set([...d, appId]));
  };

  if (loading) return (
    <main className="flex flex-1 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </main>
  );

  if (!data) return null;

  const { stats, jobs = [], pending_applications = [], upcoming_interviews = [], pending_feedback = [] } = data;
  const visibleApps = pending_applications.filter((a) => !dismissed.has(a.id));

  const SECTIONS = [
    { key: "decision",   label: "Awaiting Decision", count: visibleApps.length,         color: "text-amber-400" },
    { key: "interviews", label: "My Interviews",      count: upcoming_interviews.length,  color: "text-violet-400" },
    { key: "feedback",   label: "Pending Feedback",   count: pending_feedback.length,     color: "text-red-400" },
    { key: "jobs",       label: "My Jobs",            count: jobs.length,                 color: "text-primary" },
  ] as const;

  return (
    <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ClipboardCheck className="h-6 w-6 text-primary" /> My Workspace
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Candidates awaiting your decision, upcoming interviews, and roles you manage.
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { label: "My jobs",          value: stats.my_jobs,              icon: Briefcase,    color: "text-primary" },
            { label: "Awaiting decision", value: visibleApps.length,         icon: ClipboardCheck, color: "text-amber-400" },
            { label: "Upcoming interviews", value: stats.upcoming_interviews, icon: CalendarDays, color: "text-violet-400" },
            { label: "Pending feedback", value: pending_feedback.length,     icon: Star,         color: "text-red-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Icon className={cn("h-4 w-4", color)} />
                <span className="text-xs">{label}</span>
              </div>
              <p className={cn("mt-1.5 text-2xl font-bold tabular-nums", value > 0 ? color : "")}>{value}</p>
            </div>
          ))}
        </div>

        {/* Section tabs */}
        <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
          {SECTIONS.map(({ key, label, count, color }) => (
            <button key={key} onClick={() => setActiveSection(key as typeof activeSection)}
              className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                activeSection === key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>
              {label}
              {count > 0 && (
                <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums", activeSection === key ? "bg-primary text-white" : "bg-muted", color)}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Awaiting Decision */}
        {activeSection === "decision" && (
          <div className="space-y-3">
            {visibleApps.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border py-16 text-center">
                <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-green-400/40" />
                <p className="font-semibold text-muted-foreground">You're all caught up!</p>
                <p className="mt-1 text-sm text-muted-foreground">No candidates awaiting your decision right now.</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  {visibleApps.length} candidate{visibleApps.length !== 1 ? "s" : ""} in screened or interview stage waiting for your review
                </p>
                {visibleApps.map((app) => (
                  <CandidateDecisionCard key={app.id} app={app} onDecision={handleDecision} />
                ))}
              </>
            )}
          </div>
        )}

        {/* My Interviews */}
        {activeSection === "interviews" && (
          <div className="space-y-3">
            {upcoming_interviews.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border py-16 text-center">
                <CalendarDays className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No upcoming interviews in the next 7 days.</p>
              </div>
            ) : (
              upcoming_interviews.map((iv) => {
                const dt = new Date(iv.scheduled_at);
                const isToday = dt.toDateString() === new Date().toDateString();
                const jobTitle = (iv.job as unknown as { title: string } | null)?.title ?? "";
                return (
                  <div key={iv.id} className={cn(
                    "rounded-2xl border bg-card p-4",
                    isToday ? "border-violet-500/30 bg-violet-500/5" : "border-border"
                  )}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          {isToday && <span className="rounded-full bg-violet-500 px-2 py-0.5 text-[10px] font-bold text-white">TODAY</span>}
                          <span className="font-semibold">{iv.candidate_name}</span>
                        </div>
                        <p className="mt-0.5 text-sm text-muted-foreground">{iv.title}{jobTitle ? ` · ${jobTitle}` : ""}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{dt.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} at {dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          <span>{iv.duration_min} min</span>
                          <span className="capitalize">{iv.interview_type}</span>
                        </div>
                      </div>
                      {iv.meeting_link && (
                        <a href={iv.meeting_link} target="_blank" rel="noopener noreferrer"
                          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-gradient-brand px-3 py-2 text-xs font-semibold text-white shadow-glow hover:opacity-90">
                          Join <ArrowRight className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Pending Feedback */}
        {activeSection === "feedback" && (
          <div className="space-y-3">
            {pending_feedback.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border py-16 text-center">
                <Star className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No pending interview feedback.</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Submit feedback so recruiters can move these candidates forward
                </p>
                {pending_feedback.map((pf) => {
                  const jobTitle = (pf.job as unknown as { title: string } | null)?.title ?? "";
                  const jobId = (pf.job as unknown as { id: string } | null)?.id;
                  return (
                    <div key={pf.id} className="flex items-center gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
                        <Star className="h-4 w-4 text-amber-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{pf.candidate_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {jobTitle} · Interviewed {new Date(pf.scheduled_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                        </p>
                      </div>
                      {jobId && pf.application_id && (
                        <Link href={`/enterprise/schedule`}
                          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 px-3 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-500/10 transition-colors">
                          Submit feedback <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* My Jobs */}
        {activeSection === "jobs" && (
          <div className="space-y-3">
            {jobs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border py-16 text-center">
                <Briefcase className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="font-semibold text-muted-foreground">No jobs assigned to you yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Ask a recruiter to assign you as hiring manager on a role.</p>
              </div>
            ) : (
              jobs.map((job) => (
                <Link key={job.id} href={`/enterprise/jobs/${job.id}`}
                  className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-primary/5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Briefcase className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{job.title}</p>
                    <p className="text-xs text-muted-foreground">{job.department ?? "—"} · {job.total_applicants} applicants</p>
                  </div>
                  <div className="flex items-center gap-3 text-center">
                    {job.awaiting_decision > 0 && (
                      <div>
                        <p className="text-lg font-bold text-amber-400 tabular-nums">{job.awaiting_decision}</p>
                        <p className="text-[10px] text-muted-foreground">to review</p>
                      </div>
                    )}
                    {job.offer_stage > 0 && (
                      <div>
                        <p className="text-lg font-bold text-cyan-400 tabular-nums">{job.offer_stage}</p>
                        <p className="text-[10px] text-muted-foreground">in offer</p>
                      </div>
                    )}
                    {job.hired > 0 && (
                      <div>
                        <p className="text-lg font-bold text-green-400 tabular-nums">{job.hired}</p>
                        <p className="text-[10px] text-muted-foreground">hired</p>
                      </div>
                    )}
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </div>
    </main>
  );
}
