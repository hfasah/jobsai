"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Users, Sparkles, Loader2, ChevronRight,
  CheckCircle2, AlertCircle, Tag, SlidersHorizontal,
  ExternalLink, MoreHorizontal, XCircle, Mail,
  Share2, BarChart3, Copy, Check, TrendingUp, Mic, Send,
  ClipboardList, Scale, FileText, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { EnterpriseJob, EnterpriseApplication, AppStage } from "@/types/enterprise";
import { ATS_TIERS, atsTier } from "@/types/enterprise";
import { STAGES, STAGE_LABELS, STAGE_COLORS } from "@/types/enterprise";
import type { CompetencyFramework, RoleType } from "@/types/interview-intelligence";
import { ROLE_TYPE_LABELS, ROLE_TYPE_COLORS } from "@/types/interview-intelligence";
import { CandidateReportModal } from "@/components/enterprise/candidate-report-modal";
import { CompareModal } from "@/components/enterprise/compare-modal";
import { SmsModal } from "@/components/enterprise/sms-modal";
import { VoiceScreenModal } from "@/components/enterprise/voice-screen-modal";
import { CandidateSearch } from "@/components/enterprise/candidate-search";
import { KanbanBoard } from "@/components/enterprise/kanban-board";
import { PoolsPanel } from "@/components/enterprise/pools-panel";
import { PreboardingModal } from "@/components/enterprise/preboarding-modal";

const PIPELINE_STAGES: AppStage[] = ["applied", "screened", "interview", "offer", "hired"];

const SCORE_COLOR = (n: number) =>
  n >= 75 ? "text-green-400" : n >= 50 ? "text-amber-400" : "text-red-400";

const REC_BADGE: Record<string, string> = {
  strong_yes: "bg-green-500/20 text-green-400",
  yes:        "bg-blue-500/20 text-blue-400",
  maybe:      "bg-amber-500/20 text-amber-400",
  no:         "bg-red-500/20 text-red-400",
};

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null;
  const color = value >= 75 ? "bg-green-500" : value >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("font-semibold", SCORE_COLOR(value))}>{value}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function CandidateCard({
  app, selected, onSelect, onMove, onScreen, screening, onAddToPool, onReport, onVoiceScreen,
}: {
  app: EnterpriseApplication;
  selected: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, stage: AppStage) => void;
  onScreen: (id: string) => void;
  screening: boolean;
  onAddToPool: (id: string) => void;
  onReport: (app: EnterpriseApplication) => void;
  onVoiceScreen: (app: EnterpriseApplication) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn("rounded-xl border bg-card transition-colors", selected ? "border-primary/50 bg-primary/5" : "border-border hover:border-border/80")}>
      {/* Card header */}
      <div className="flex items-start gap-2.5 p-3">
        <input type="checkbox" checked={selected} onChange={() => onSelect(app.id)}
          className="mt-0.5 h-3.5 w-3.5 rounded border-border accent-primary" />
        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setExpanded((e) => !e)}>
          <div className="flex items-center justify-between gap-1">
            <p className="truncate text-sm font-semibold">{app.candidate_name}</p>
            {app.match_score !== null && (
              <span className={cn("text-xs font-bold tabular-nums shrink-0", SCORE_COLOR(app.match_score))}>
                {app.match_score}%
              </span>
            )}
          </div>
          <p className="truncate text-[11px] text-muted-foreground">{app.candidate_email}</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {app.source !== "direct" && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{app.source}</span>
            )}
            {app.is_duplicate && (
              <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-400">duplicate</span>
            )}
            {app.ai_recommendation && (
              <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize", REC_BADGE[app.ai_recommendation])}>
                {app.ai_recommendation.replace("_", " ")}
              </span>
            )}
            {app.tags.map((t) => (
              <span key={t} className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">{t}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border px-3 pb-3 pt-2 space-y-3">
          {app.ai_summary && (
            <p className="text-xs text-muted-foreground leading-relaxed">{app.ai_summary}</p>
          )}
          {(app.match_score !== null) && (
            <div className="space-y-2">
              <ScoreBar label="ATS keyword match" value={app.ats_score} />
              <ScoreBar label="Match" value={app.match_score} />
              <ScoreBar label="Skills" value={app.skills_score} />
              <ScoreBar label="Experience" value={app.experience_score} />
              <ScoreBar label="Culture" value={app.culture_score} />
            </div>
          )}
          {app.ats_keywords_missing?.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-red-400 mb-1">Missing ATS keywords</p>
              <div className="flex flex-wrap gap-1">
                {app.ats_keywords_missing.slice(0, 6).map((k) => (
                  <span key={k} className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-400">{k}</span>
                ))}
              </div>
            </div>
          )}
          {app.risk_flags.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-amber-400 mb-1">Risk flags</p>
              {app.risk_flags.map((f) => (
                <p key={f} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <AlertCircle className="h-2.5 w-2.5 text-amber-400 shrink-0" /> {f}
                </p>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {!app.screened_at && (
              <button onClick={() => onScreen(app.id)} disabled={screening}
                className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/20 disabled:opacity-50">
                {screening ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                Screen with AI
              </button>
            )}
            <button onClick={() => onReport(app)}
              className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/20">
              <ClipboardList className="h-3 w-3" /> Reports
            </button>
            <button onClick={() => onVoiceScreen(app)}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium",
                (app as unknown as Record<string, unknown>).voice_screen_status === "complete"
                  ? "bg-green-500/10 text-green-400 hover:bg-green-500/20"
                  : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80",
              )}>
              <Mic className="h-3 w-3" />
              {(app as unknown as Record<string, unknown>).voice_screen_status === "complete" ? "Voice result" : "Voice screen"}
            </button>
            {(app.match_score ?? 0) >= 50 && (
              <button onClick={() => onAddToPool(app.id)}
                className="inline-flex items-center gap-1 rounded-lg bg-green-500/10 px-2.5 py-1 text-[11px] font-medium text-green-400 hover:bg-green-500/20">
                + Talent pool
              </button>
            )}
            {app.linkedin_url && (
              <a href={app.linkedin_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground">
                <ExternalLink className="h-3 w-3" /> LinkedIn
              </a>
            )}
          </div>

          {/* Move stage */}
          <div>
            <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Move to</p>
            <div className="flex flex-wrap gap-1">
              {([...PIPELINE_STAGES, "rejected"] as AppStage[]).filter((s) => s !== app.stage).map((s) => (
                <button key={s} onClick={() => onMove(app.id, s)}
                  className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors hover:opacity-80", STAGE_COLORS[s])}>
                  {STAGE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Competency Scorecard Panel ────────────────────────────────────────────────
function ScorecardPanel({
  jobId, framework, onChange,
}: {
  jobId: string;
  framework: CompetencyFramework | null;
  onChange: (f: CompetencyFramework) => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [companyValues, setCompanyValues] = useState(framework?.company_values ?? "");
  const [error, setError] = useState("");

  const generate = async () => {
    setGenerating(true); setError("");
    const res = await fetch(`/api/enterprise/jobs/${jobId}/framework`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company_values: companyValues }),
    });
    const json = await res.json();
    if (!res.ok) setError(json.error ?? "Failed to generate."); else onChange(json.data);
    setGenerating(false);
  };

  const roleType = (framework?.role_type ?? "general") as RoleType;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">AI Competency Scorecard</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                The AI identifies the role type and builds a weighted scorecard. Interview reports score candidates against it.
              </p>
            </div>
            <button onClick={generate} disabled={generating}
              className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-4 py-2 text-sm font-semibold text-white shadow-glow disabled:opacity-60">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? "Generating…" : framework ? "Regenerate" : "Generate scorecard"}
            </button>
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-medium">Company values (optional — shapes culture-fit competencies)</label>
            <input value={companyValues} onChange={(e) => setCompanyValues(e.target.value)}
              placeholder="e.g. Customer obsession, ownership, bias for action"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </div>

        {!framework ? (
          <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
            <Scale className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
            No scorecard yet. Generate one to unlock interview reports for this role.
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold", ROLE_TYPE_COLORS[roleType])}>
                {framework.role_type_label ?? ROLE_TYPE_LABELS[roleType]}
              </span>
              <span className="text-xs text-muted-foreground">{framework.competencies.length} competencies · weights sum to 100%</span>
            </div>

            <div className="space-y-4">
              {framework.competencies.map((c, i) => (
                <div key={i}>
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-sm font-semibold">{c.name}</p>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary tabular-nums">{c.weight}%</span>
                  </div>
                  <div className="mb-1.5 h-1.5 w-full rounded-full bg-muted">
                    <div className="h-full rounded-full bg-gradient-brand" style={{ width: `${c.weight}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">{c.description}</p>
                  {c.what_to_look_for && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground/80 italic">Look for: {c.what_to_look_for}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ATS Score Panel ───────────────────────────────────────────────────────────
function AtsScorePanel({
  apps, onScreen, screeningIds, onScreenAll,
}: {
  apps: EnterpriseApplication[];
  onScreen: (id: string) => void;
  screeningIds: Set<string>;
  onScreenAll: () => void;
}) {
  const unscored = apps.filter((a) => a.ats_score === null || a.ats_score === undefined);
  const scored = apps.filter((a) => a.ats_score !== null && a.ats_score !== undefined);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">ATS score against this job description</h2>
            <p className="text-sm text-muted-foreground">
              Candidates grouped by how well their resume matches the role&apos;s required keywords.
            </p>
          </div>
          {unscored.length > 0 && (
            <button onClick={onScreenAll}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-white shadow-glow">
              <Sparkles className="h-3.5 w-3.5" /> Score {unscored.length} unscored
            </button>
          )}
        </div>

        {scored.length > 0 && (
          <div className="mb-6 flex h-3 w-full overflow-hidden rounded-full bg-muted">
            {ATS_TIERS.map((tier) => {
              const count = scored.filter((a) => atsTier(a.ats_score)?.id === tier.id).length;
              const pct = Math.round((count / scored.length) * 100);
              if (pct === 0) return null;
              return <div key={tier.id} className={tier.dot} style={{ width: `${pct}%` }} title={`${tier.label}: ${count}`} />;
            })}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {ATS_TIERS.map((tier) => {
            const tierApps = scored
              .filter((a) => atsTier(a.ats_score)?.id === tier.id)
              .sort((a, b) => (b.ats_score ?? 0) - (a.ats_score ?? 0));
            return (
              <div key={tier.id} className="rounded-2xl border border-border bg-card/40 p-3">
                <div className="mb-3 flex items-center justify-between px-1">
                  <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold", tier.color)}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", tier.dot)} />
                    {tier.label}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">{tierApps.length}</span>
                </div>
                <div className="space-y-2">
                  {tierApps.map((app) => (
                    <div key={app.id} className="rounded-xl border border-border bg-card p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold">{app.candidate_name}</p>
                        <span className={cn("shrink-0 text-sm font-bold tabular-nums",
                          (app.ats_score ?? 0) >= 70 ? "text-green-400" : (app.ats_score ?? 0) >= 50 ? "text-amber-400" : "text-red-400")}>
                          {app.ats_score}
                        </span>
                      </div>
                      <p className="truncate text-[11px] text-muted-foreground">{app.candidate_email}</p>
                      {(app.ats_keywords_matched?.length || app.ats_keywords_missing?.length) ? (
                        <div className="mt-2 space-y-1">
                          {app.ats_keywords_matched?.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {app.ats_keywords_matched.slice(0, 4).map((k) => (
                                <span key={k} className="rounded bg-green-500/10 px-1.5 py-0.5 text-[10px] text-green-400">{k}</span>
                              ))}
                            </div>
                          )}
                          {app.ats_keywords_missing?.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {app.ats_keywords_missing.slice(0, 3).map((k) => (
                                <span key={k} className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-400 line-through">{k}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ))}
                  {tierApps.length === 0 && (
                    <p className="px-1 py-4 text-center text-xs text-muted-foreground/50">None</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {unscored.length > 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-border p-4">
            <p className="mb-3 text-sm font-medium text-muted-foreground">{unscored.length} candidates not yet ATS-scored</p>
            <div className="flex flex-wrap gap-2">
              {unscored.map((app) => (
                <button key={app.id} onClick={() => onScreen(app.id)} disabled={screeningIds.has(app.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs hover:bg-muted disabled:opacity-50">
                  {screeningIds.has(app.id) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-primary" />}
                  {app.candidate_name}
                </button>
              ))}
            </div>
          </div>
        )}

        {apps.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
            No applications yet. ATS scores appear here as candidates apply and are screened.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Interview Kit Panel ───────────────────────────────────────────────────────
interface KitQuestion { id: string; type: string; question: string; rubric: string; max_score: number }

function InterviewKitPanel({ jobId, apps }: { jobId: string; apps: EnterpriseApplication[] }) {
  const [kit, setKit] = useState<{ questions: KitQuestion[] } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [inviteUrls, setInviteUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(`/api/enterprise/jobs/${jobId}/interview-kit`)
      .then((r) => r.json())
      .then((j) => { if (j.data) setKit(j.data); });
  }, [jobId]);

  const generate = async () => {
    setGenerating(true);
    const res = await fetch(`/api/enterprise/jobs/${jobId}/interview-kit`, { method: "POST" });
    const json = await res.json();
    if (json.data) setKit(json.data);
    setGenerating(false);
  };

  const invite = async (appId: string) => {
    setInviting(appId);
    const res = await fetch(`/api/enterprise/jobs/${jobId}/applications/${appId}/invite-interview`, { method: "POST" });
    const json = await res.json();
    if (json.data) {
      setInvitedIds((s) => new Set(s).add(appId));
      if (json.interviewUrl) setInviteUrls((m) => ({ ...m, [appId]: json.interviewUrl }));
    }
    setInviting(null);
  };

  const eligibleApps = apps.filter((a) => ["screened", "interview"].includes(a.stage));
  const TYPE_COLORS: Record<string, string> = {
    behavioral: "bg-blue-500/15 text-blue-400", technical: "bg-purple-500/15 text-purple-400",
    leadership: "bg-amber-500/15 text-amber-400", situational: "bg-cyan-500/15 text-cyan-400",
    culture: "bg-green-500/15 text-green-400",
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Kit generator */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold">AI Interview Kit</h2>
              <p className="text-sm text-muted-foreground mt-0.5">9 role-specific questions with scoring rubrics.</p>
            </div>
            <button onClick={generate} disabled={generating}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-4 py-2 text-sm font-semibold text-white shadow-glow disabled:opacity-60">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? "Generating…" : kit ? "Regenerate" : "Generate kit"}
            </button>
          </div>

          {!kit && !generating && (
            <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              Click "Generate kit" to create 9 tailored interview questions with AI scoring rubrics.
            </div>
          )}

          {kit && (
            <div className="space-y-3">
              {kit.questions.map((q, i) => (
                <div key={q.id} className="rounded-xl border border-border p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", TYPE_COLORS[q.type] ?? TYPE_COLORS.behavioral)}>
                          {q.type}
                        </span>
                        <span className="text-xs text-muted-foreground">{q.max_score} pts</span>
                      </div>
                      <p className="text-sm font-medium">{q.question}</p>
                      <p className="mt-1.5 text-xs text-muted-foreground italic">{q.rubric}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Send invitations */}
        {kit && (
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="mb-1 font-semibold">Send interview invitations</h2>
            <p className="mb-4 text-sm text-muted-foreground">Candidates in "Screened" or "Interview" stage receive a unique link valid for 7 days.</p>
            {eligibleApps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No candidates in "Screened" or "Interview" stage yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {eligibleApps.map((app) => (
                  <div key={app.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium">{app.candidate_name}</p>
                      <p className="text-xs text-muted-foreground">{app.candidate_email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {inviteUrls[app.id] && (
                        <button onClick={() => { navigator.clipboard.writeText(inviteUrls[app.id]); }}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                          <Copy className="h-3.5 w-3.5" /> Copy link
                        </button>
                      )}
                      {invitedIds.has(app.id) ? (
                        <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle2 className="h-3.5 w-3.5" /> Invited</span>
                      ) : (
                        <button onClick={() => invite(app.id)} disabled={inviting === app.id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50">
                          {inviting === app.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                          Invite
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Distribution Panel ────────────────────────────────────────────────────────
const PLATFORM_META: Record<string, { label: string; color: string; icon: string }> = {
  linkedin:    { label: "LinkedIn",     color: "text-blue-400",   icon: "in" },
  indeed:      { label: "Indeed",       color: "text-indigo-400", icon: "id" },
  twitter:     { label: "Twitter / X",  color: "text-sky-400",    icon: "x" },
  email:       { label: "Email blast",  color: "text-green-400",  icon: "em" },
  google_jobs: { label: "Google Jobs",  color: "text-amber-400",  icon: "g" },
};

function DistributePanel({ jobId }: { jobId: string }) {
  const [distributions, setDistributions] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>("linkedin");

  useEffect(() => {
    fetch(`/api/enterprise/jobs/${jobId}/distribute`)
      .then((r) => r.json())
      .then((j) => {
        const map: Record<string, string> = {};
        for (const d of j.data ?? []) map[d.platform] = d.content;
        setDistributions(map);
      });
  }, [jobId]);

  const generate = async () => {
    setGenerating(true);
    const res = await fetch(`/api/enterprise/jobs/${jobId}/distribute`, { method: "POST" });
    const json = await res.json();
    const map: Record<string, string> = {};
    for (const d of json.data ?? []) map[d.platform] = d.content;
    setDistributions(map);
    setGenerating(false);
  };

  const copyContent = (platform: string) => {
    navigator.clipboard.writeText(distributions[platform] ?? "");
    setCopied(platform);
    setTimeout(() => setCopied(null), 2000);
  };

  const hasContent = Object.keys(distributions).length > 0;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Multi-platform distribution</h2>
            <p className="text-sm text-muted-foreground">AI generates optimised copy for each platform. Copy, paste, and post.</p>
          </div>
          <button onClick={generate} disabled={generating}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-4 py-2 text-sm font-semibold text-white shadow-glow disabled:opacity-60">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? "Generating…" : hasContent ? "Regenerate all" : "Generate all"}
          </button>
        </div>

        {generating && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">
            <Sparkles className="h-4 w-4 animate-pulse" />
            Generating optimised content for all platforms…
          </div>
        )}

        {!hasContent && !generating && (
          <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
            Click "Generate all" to create platform-optimised job posts with AI tracking links.
          </div>
        )}

        <div className="space-y-3">
          {Object.entries(PLATFORM_META).map(([platform, meta]) => {
            const content = distributions[platform];
            if (!content) return null;
            const isOpen = expanded === platform;
            return (
              <div key={platform} className="rounded-2xl border border-border bg-card overflow-hidden">
                <button onClick={() => setExpanded(isOpen ? null : platform)}
                  className="flex w-full items-center justify-between px-5 py-4 hover:bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-xs font-bold uppercase", meta.color)}>
                      {meta.icon}
                    </div>
                    <p className="font-medium">{meta.label}</p>
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                  </div>
                  <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-90")} />
                </button>
                {isOpen && (
                  <div className="border-t border-border px-5 pb-4">
                    <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-background/60 px-4 py-3 text-xs leading-relaxed text-foreground font-sans">
                      {content}
                    </pre>
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => copyContent(platform)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                        {copied === platform ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied === platform ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Analytics Panel ───────────────────────────────────────────────────────────
interface SourceRow {
  source: string; views: number; clicks: number; applicants: number;
  hired: number; avg_match_score: number | null; conversion_rate: number | null;
}

function AnalyticsPanel({ jobId }: { jobId: string }) {
  const [data, setData] = useState<{ by_source: SourceRow[]; totals: { views: number; applicants: number; hired: number } } | null>(null);
  const [recommendation, setRecommendation] = useState<string | null>(null);
  const [loadingRec, setLoadingRec] = useState(false);

  useEffect(() => {
    fetch(`/api/enterprise/jobs/${jobId}/analytics`)
      .then((r) => r.json())
      .then((j) => setData(j.data));
  }, [jobId]);

  const getRecommendation = async () => {
    setLoadingRec(true);
    const res = await fetch(`/api/enterprise/jobs/${jobId}/analytics`, { method: "POST" });
    const json = await res.json();
    setRecommendation(json.recommendation);
    setLoadingRec(false);
  };

  const SOURCE_LABELS: Record<string, string> = {
    direct: "Direct / Apply link", linkedin: "LinkedIn", indeed: "Indeed",
    twitter: "Twitter / X", email: "Email blast", referral: "Referral", jobsai: "JobsAI",
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Totals */}
        {data && (
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "Total views",      value: data.totals.views },
              { label: "Total applicants", value: data.totals.applicants },
              { label: "Total hired",      value: data.totals.hired },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-2xl border border-border bg-card p-5">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Source table */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-semibold">Performance by source</h2>
          </div>
          {!data || data.by_source.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              No tracking data yet. Share your tracked links from the Distribution tab.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  {["Source","Views","Applicants","Conv. rate","Avg score","Hired"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.by_source.map((row) => (
                  <tr key={row.source} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium capitalize">{SOURCE_LABELS[row.source] ?? row.source}</td>
                    <td className="px-4 py-3 tabular-nums">{row.views}</td>
                    <td className="px-4 py-3 tabular-nums">{row.applicants}</td>
                    <td className="px-4 py-3 tabular-nums">{row.conversion_rate !== null ? `${row.conversion_rate}%` : "—"}</td>
                    <td className="px-4 py-3">
                      {row.avg_match_score !== null
                        ? <span className={cn("font-bold tabular-nums", row.avg_match_score >= 70 ? "text-green-400" : row.avg_match_score >= 50 ? "text-amber-400" : "text-red-400")}>
                            {row.avg_match_score}%
                          </span>
                        : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{row.hired}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* AI Budget Recommendation */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold">AI budget recommendation</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Where should you focus your recruiting spend?</p>
            </div>
            <button onClick={getRecommendation} disabled={loadingRec || !data?.by_source.length}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-white shadow-glow disabled:opacity-50">
              {loadingRec ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {loadingRec ? "Analysing…" : "Analyse"}
            </button>
          </div>
          {recommendation ? (
            <div className="rounded-xl bg-background/60 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
              {recommendation}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Click "Analyse" to get AI recommendations on where to allocate your recruiting budget based on source performance.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function JobDetailPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params);
  const [job, setJob] = useState<EnterpriseJob | null>(null);
  const [apps, setApps] = useState<EnterpriseApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [screeningIds, setScreeningIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"pools" | "pipeline" | "ats" | "all" | "scorecard" | "distribute" | "analytics" | "interviews" | "search">("pools");
  const [compareOpen, setCompareOpen] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);
  const [voiceScreenApp, setVoiceScreenApp] = useState<EnterpriseApplication | null>(null);
  const [framework, setFramework] = useState<CompetencyFramework | null>(null);
  const [reportApp, setReportApp] = useState<EnterpriseApplication | null>(null);
  const [preboardApp, setPreboardApp] = useState<EnterpriseApplication | null>(null);

  const load = useCallback(async () => {
    const [jRes, aRes, fRes] = await Promise.all([
      fetch(`/api/enterprise/jobs/${jobId}`).then((r) => r.json()),
      fetch(`/api/enterprise/jobs/${jobId}/applications`).then((r) => r.json()),
      fetch(`/api/enterprise/jobs/${jobId}/framework`).then((r) => r.json()),
    ]);
    setJob(jRes.data);
    setApps(aRes.data ?? []);
    setFramework(fRes.data ?? null);
    setLoading(false);
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  const toggleSelect = (id: string) => {
    setSelectedIds((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const moveApp = async (id: string, stage: AppStage) => {
    const res = await fetch(`/api/enterprise/jobs/${jobId}/applications/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage, send_email: true }),
    });
    if (res.ok) setApps((a) => a.map((x) => x.id === id ? { ...x, stage, stage_updated_at: new Date().toISOString() } : x));
  };

  const addToPool = async (id: string) => {
    await fetch("/api/enterprise/talent-pool", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ application_id: id }),
    });
  };

  const screenApp = async (id: string) => {
    setScreeningIds((s) => new Set(s).add(id));
    const res = await fetch(`/api/enterprise/jobs/${jobId}/applications/${id}/screen`, { method: "POST" });
    const json = await res.json();
    if (json.data) setApps((a) => a.map((x) => x.id === id ? json.data : x));
    setScreeningIds((s) => { const n = new Set(s); n.delete(id); return n; });
  };

  const screenAll = async () => {
    const unscreened = apps.filter((a) => !a.screened_at && a.stage === "applied").map((a) => a.id);
    for (const id of unscreened) await screenApp(id);
  };

  const bulkMove = async (stage: AppStage) => {
    if (!selectedIds.size) return;
    setBulkLoading(true);
    await fetch(`/api/enterprise/jobs/${jobId}/applications/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selectedIds], action: "move_stage", stage }),
    });
    setApps((a) => a.map((x) => selectedIds.has(x.id) ? { ...x, stage } : x));
    setSelectedIds(new Set());
    setBulkLoading(false);
  };

  const byStage = (stage: AppStage) => apps.filter((a) => a.stage === stage)
    .sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0));

  if (loading) return <main className="flex flex-1 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></main>;
  if (!job) return <main className="flex flex-1 items-center justify-center"><p className="text-muted-foreground">Job not found.</p></main>;

  const unscreenedCount = apps.filter((a) => !a.screened_at && a.stage === "applied").length;

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-start gap-3">
            <Link href="/enterprise/jobs" className="mt-0.5 rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold">{job.title}</h1>
                <span className={cn("rounded-full border px-2 py-0.5 text-xs font-semibold", STAGE_COLORS["applied"])}>
                  {job.status}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {[job.department, job.location, job.employment_type].filter(Boolean).join(" · ")}
                {job.salary_min && job.salary_max ? ` · $${job.salary_min.toLocaleString()}–$${job.salary_max.toLocaleString()}` : ""}
              </p>
              {(job.description || job.qualifications) && (
                <details className="mt-1.5 group">
                  <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-primary hover:underline">
                    <FileText className="h-3.5 w-3.5" /> View job description
                    <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-2 max-w-3xl space-y-2.5 rounded-xl border border-border bg-card/60 p-4 text-sm">
                    {job.description && <div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Overview</p><p className="whitespace-pre-wrap text-muted-foreground leading-relaxed">{job.description}</p></div>}
                    {job.responsibilities && <div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Responsibilities</p><p className="whitespace-pre-wrap text-muted-foreground leading-relaxed">{job.responsibilities}</p></div>}
                    {job.qualifications && <div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Required criteria</p><p className="whitespace-pre-wrap text-muted-foreground leading-relaxed">{job.qualifications}</p></div>}
                    {job.nice_to_have && <div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nice to have</p><p className="whitespace-pre-wrap text-muted-foreground leading-relaxed">{job.nice_to_have}</p></div>}
                    <Link href={`/enterprise/jobs/${jobId}/apply`} target="_blank" className="inline-flex items-center gap-1 pt-1 text-xs text-primary hover:underline">
                      <ExternalLink className="h-3 w-3" /> Public application page
                    </Link>
                  </div>
                </details>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                <Users className="h-4 w-4 text-muted-foreground" />
                {apps.length}
              </div>
              {unscreenedCount > 0 && (
                <button onClick={screenAll}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-white shadow-glow">
                  <Sparkles className="h-3.5 w-3.5" />
                  Screen {unscreenedCount} with AI
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-3 flex flex-wrap gap-1">
            {([
              { key: "pools",      label: "Pools" },
              { key: "pipeline",   label: "Pipeline" },
              { key: "ats",        label: "ATS Score" },
              { key: "scorecard",  label: "Scorecard" },
              { key: "all",        label: `All (${apps.length})` },
              { key: "search",     label: "AI Search" },
              { key: "distribute", label: "Distribution" },
              { key: "analytics",  label: "Analytics" },
              { key: "interviews", label: "Interview Kit" },
            ] as const).map(({ key, label }) => (
              <button key={key} onClick={() => setActiveTab(key)}
                className={cn("rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  activeTab === key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="border-b border-border bg-card/80 px-4 py-2 sm:px-6 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center gap-3 flex-wrap">
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            {PIPELINE_STAGES.map((s) => (
              <button key={s} onClick={() => bulkMove(s)} disabled={bulkLoading}
                className={cn("rounded-full border px-2.5 py-1 text-xs font-medium", STAGE_COLORS[s])}>
                → {STAGE_LABELS[s]}
              </button>
            ))}
            <button onClick={() => bulkMove("rejected")} disabled={bulkLoading}
              className={cn("rounded-full border px-2.5 py-1 text-xs font-medium", STAGE_COLORS["rejected"])}>
              <XCircle className="mr-1 inline h-3 w-3" />Reject
            </button>
            {selectedIds.size >= 2 && selectedIds.size <= 3 && (
              <button onClick={() => setCompareOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20">
                <Scale className="h-3 w-3" /> Compare {selectedIds.size}
              </button>
            )}
            <button onClick={() => setSmsOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              <Send className="h-3 w-3" /> Message
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-muted-foreground hover:text-foreground">
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Pools — primary workspace */}
      {activeTab === "pools" && (
        <PoolsPanel jobId={jobId} onReport={setReportApp} onPreboard={setPreboardApp} />
      )}

      {/* ATS Score grouping */}
      {activeTab === "ats" && (
        <AtsScorePanel apps={apps} onScreen={screenApp} screeningIds={screeningIds} onScreenAll={screenAll} />
      )}

      {/* Competency scorecard */}
      {activeTab === "scorecard" && (
        <ScorecardPanel jobId={jobId} framework={framework} onChange={setFramework} />
      )}

      {/* Pipeline — drag-and-drop kanban */}
      {activeTab === "pipeline" && (
        <KanbanBoard
          apps={apps}
          onMove={moveApp}
          onScreen={screenApp}
          screeningIds={screeningIds}
          onReport={setReportApp}
          onVoiceScreen={setVoiceScreenApp}
        />
      )}

      {/* Interview Kit tab */}
      {activeTab === "interviews" && (
        <InterviewKitPanel jobId={jobId} apps={apps} />
      )}

      {/* Distribution tab */}
      {activeTab === "distribute" && (
        <DistributePanel jobId={jobId} />
      )}

      {/* Analytics tab */}
      {activeTab === "analytics" && (
        <AnalyticsPanel jobId={jobId} />
      )}

      {/* All candidates table */}
      {activeTab === "all" && (
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <div className="overflow-hidden rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40">
                  <tr>
                    <th className="w-10 px-3 py-3 text-left"></th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Candidate</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Stage</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Score</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Source</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Applied</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {apps.sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0)).map((app) => (
                    <tr key={app.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-3">
                        <input type="checkbox" checked={selectedIds.has(app.id)} onChange={() => toggleSelect(app.id)}
                          className="h-3.5 w-3.5 rounded border-border accent-primary" />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{app.candidate_name}</p>
                        <p className="text-xs text-muted-foreground">{app.candidate_email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", STAGE_COLORS[app.stage])}>
                          {STAGE_LABELS[app.stage]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {app.match_score !== null
                          ? <span className={cn("font-bold tabular-nums", SCORE_COLOR(app.match_score))}>{app.match_score}%</span>
                          : <button onClick={() => screenApp(app.id)} disabled={screeningIds.has(app.id)}
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50">
                              {screeningIds.has(app.id) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                              Screen
                            </button>
                        }
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground capitalize">{app.source}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(app.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {apps.length === 0 && (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No applications yet.{" "}
                  <Link href={`/enterprise/jobs/${jobId}/apply`} target="_blank" className="text-primary hover:underline">
                    Share the application link →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Candidate Search tab */}
      {activeTab === "search" && (
        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <div className="mb-5">
              <h2 className="font-semibold">AI Candidate Search</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Ask in plain English — find candidates by skills, score, stage, or any criteria.
              </p>
            </div>
            <CandidateSearch jobId={jobId} />
          </div>
        </div>
      )}

      {/* Candidate report modal */}
      {reportApp && (
        <CandidateReportModal
          jobId={jobId}
          app={reportApp}
          hasFramework={!!framework}
          onClose={() => setReportApp(null)}
        />
      )}

      {/* AI Compare modal */}
      {compareOpen && (
        <CompareModal
          apps={apps.filter((a) => selectedIds.has(a.id))}
          jobId={jobId}
          onClose={() => setCompareOpen(false)}
        />
      )}

      {/* SMS / WhatsApp modal */}
      {smsOpen && (
        <SmsModal
          apps={apps.filter((a) => selectedIds.has(a.id))}
          jobId={jobId}
          onClose={() => setSmsOpen(false)}
        />
      )}

      {/* AI Voice Screen modal */}
      {voiceScreenApp && (
        <VoiceScreenModal
          app={voiceScreenApp}
          jobId={jobId}
          onClose={() => setVoiceScreenApp(null)}
          onUpdate={(patch) => {
            setApps((prev) => prev.map((a) => a.id === voiceScreenApp.id ? { ...a, ...patch } as EnterpriseApplication : a));
            setVoiceScreenApp((prev) => prev ? { ...prev, ...patch } as EnterpriseApplication : null);
          }}
        />
      )}

      {/* Pre-boarding modal */}
      {preboardApp && (
        <PreboardingModal app={preboardApp} onClose={() => setPreboardApp(null)} />
      )}
    </main>
  );
}
