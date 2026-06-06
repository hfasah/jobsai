"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Users, Sparkles, Loader2, ChevronRight,
  CheckCircle2, AlertCircle, Tag, SlidersHorizontal,
  ExternalLink, MoreHorizontal, XCircle, Mail,
  Share2, BarChart3, Copy, Check, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { EnterpriseJob, EnterpriseApplication, AppStage } from "@/types/enterprise";
import { STAGES, STAGE_LABELS, STAGE_COLORS } from "@/types/enterprise";

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
  app, selected, onSelect, onMove, onScreen, screening, onAddToPool,
}: {
  app: EnterpriseApplication;
  selected: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, stage: AppStage) => void;
  onScreen: (id: string) => void;
  screening: boolean;
  onAddToPool: (id: string) => void;
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
              <ScoreBar label="Match" value={app.match_score} />
              <ScoreBar label="Skills" value={app.skills_score} />
              <ScoreBar label="Experience" value={app.experience_score} />
              <ScoreBar label="Culture" value={app.culture_score} />
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
  const [activeTab, setActiveTab] = useState<"pipeline" | "all" | "distribute" | "analytics">("pipeline");

  const load = useCallback(async () => {
    const [jRes, aRes] = await Promise.all([
      fetch(`/api/enterprise/jobs/${jobId}`).then((r) => r.json()),
      fetch(`/api/enterprise/jobs/${jobId}/applications`).then((r) => r.json()),
    ]);
    setJob(jRes.data);
    setApps(aRes.data ?? []);
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
              </p>
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
              { key: "pipeline",   label: "Pipeline" },
              { key: "all",        label: `All (${apps.length})` },
              { key: "distribute", label: "Distribution" },
              { key: "analytics",  label: "Analytics" },
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
            <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-muted-foreground hover:text-foreground">
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Pipeline */}
      {activeTab === "pipeline" && (
        <div className="flex-1 overflow-x-auto">
          <div className="inline-flex min-w-full gap-4 p-4 sm:p-6">
            {PIPELINE_STAGES.map((stage) => {
              const stageApps = byStage(stage);
              return (
                <div key={stage} className="w-64 shrink-0">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={cn("rounded-full border px-2 py-0.5 text-xs font-semibold", STAGE_COLORS[stage])}>
                        {STAGE_LABELS[stage]}
                      </span>
                      <span className="text-xs text-muted-foreground">{stageApps.length}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {stageApps.map((app) => (
                      <CandidateCard key={app.id} app={app}
                        selected={selectedIds.has(app.id)}
                        onSelect={toggleSelect}
                        onMove={moveApp}
                        onScreen={screenApp}
                        screening={screeningIds.has(app.id)}
                        onAddToPool={addToPool}
                      />
                    ))}
                    {stageApps.length === 0 && (
                      <div className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                        No candidates
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Rejected column */}
            <div className="w-64 shrink-0">
              <div className="mb-3 flex items-center gap-2">
                <span className={cn("rounded-full border px-2 py-0.5 text-xs font-semibold", STAGE_COLORS["rejected"])}>
                  Rejected
                </span>
                <span className="text-xs text-muted-foreground">{byStage("rejected").length}</span>
              </div>
              <div className="space-y-2 opacity-60">
                {byStage("rejected").map((app) => (
                  <CandidateCard key={app.id} app={app}
                    selected={selectedIds.has(app.id)}
                    onSelect={toggleSelect}
                    onMove={moveApp}
                    onScreen={screenApp}
                    onAddToPool={addToPool}
                    screening={screeningIds.has(app.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
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
    </main>
  );
}
