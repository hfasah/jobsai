"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Loader2, Sparkles, Plus, ChevronDown, ChevronRight, FileUser,
  Mail, Phone, ExternalLink, Users, ClipboardList, MessageSquareText,
  Move, Check, Settings2, X, CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { EnterpriseApplication, EnterprisePool } from "@/types/enterprise";
import { POOL_COLORS } from "@/types/enterprise";

const SCORE_COLOR = (n: number) => n >= 75 ? "text-green-400" : n >= 50 ? "text-amber-400" : "text-red-400";

const QTYPE_COLOR: Record<string, string> = {
  behavioral: "bg-blue-500/15 text-blue-400", technical: "bg-purple-500/15 text-purple-400",
  situational: "bg-cyan-500/15 text-cyan-400", motivation: "bg-amber-500/15 text-amber-400",
  culture: "bg-green-500/15 text-green-400",
};

function CandidateRow({
  app, pools, onMove, onReport, onPreboard,
}: {
  app: EnterpriseApplication;
  pools: EnterprisePool[];
  onMove: (appId: string, poolId: string) => void;
  onReport: (app: EnterpriseApplication) => void;
  onPreboard: (app: EnterpriseApplication) => void;
}) {
  const [open, setOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 p-2.5">
        <button onClick={() => setOpen((o) => !o)} className="min-w-0 flex-1 text-left">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold">{app.candidate_name}</p>
            <div className="flex items-center gap-1.5 shrink-0">
              {app.ats_score !== null && app.ats_score !== undefined && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">ATS {app.ats_score}</span>
              )}
              {app.match_score !== null && (
                <span className={cn("text-xs font-bold tabular-nums", SCORE_COLOR(app.match_score))}>{app.match_score}</span>
              )}
              <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
            </div>
          </div>
          <p className="truncate text-[11px] text-muted-foreground">{app.candidate_email}</p>
        </button>
      </div>

      {open && (
        <div className="border-t border-border px-2.5 pb-2.5 pt-2 space-y-2.5">
          {/* contact */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <a href={`mailto:${app.candidate_email}`} className="flex items-center gap-1 hover:text-foreground"><Mail className="h-3 w-3" />Email</a>
            {app.candidate_phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{app.candidate_phone}</span>}
            {app.linkedin_url && <a href={app.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground"><ExternalLink className="h-3 w-3" />LinkedIn</a>}
          </div>

          {app.ai_summary && <p className="text-[11px] text-muted-foreground leading-relaxed">{app.ai_summary}</p>}

          {/* Resume — inline, always available in the pool */}
          {(app.resume_text || app.resume_url) && (
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] font-medium text-primary hover:underline">
                <FileUser className="h-3 w-3" /> View resume
                {app.resume_url && <a href={app.resume_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground underline">· download</a>}
              </summary>
              {app.resume_text && (
                <pre className="mt-1.5 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-background p-2.5 text-[11px] leading-relaxed font-sans">
                  {app.resume_text}
                </pre>
              )}
            </details>
          )}

          {/* cover letter */}
          {app.cover_letter && (
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] font-medium text-primary hover:underline">
                <MessageSquareText className="h-3 w-3" /> View cover letter
              </summary>
              <p className="mt-1.5 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-background p-2.5 text-[11px] leading-relaxed">
                {app.cover_letter}
              </p>
            </details>
          )}

          {/* actions */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <button onClick={() => onReport(app)}
              className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/20">
              <ClipboardList className="h-3 w-3" /> Reports
            </button>
            {(app.stage === "offer" || app.stage === "hired") && (
              <button onClick={() => onPreboard(app)}
                className="inline-flex items-center gap-1 rounded-lg bg-green-500/10 px-2 py-1 text-[11px] font-medium text-green-400 hover:bg-green-500/20">
                <CalendarClock className="h-3 w-3" /> Pre-boarding
              </button>
            )}
            <div className="relative">
              <button onClick={() => setMoveOpen((m) => !m)}
                className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">
                <Move className="h-3 w-3" /> Move
              </button>
              {moveOpen && (
                <div className="absolute left-0 top-full z-10 mt-1 w-48 rounded-lg border border-border bg-card p-1 shadow-xl">
                  {pools.filter((p) => p.id !== app.pool_id).map((p) => (
                    <button key={p.id} onClick={() => { onMove(app.id, p.id); setMoveOpen(false); }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted">
                      <span className={cn("h-2 w-2 rounded-full", POOL_COLORS[p.color]?.split(" ").find((c) => c.startsWith("text"))?.replace("text", "bg"))} />
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PoolColumn({
  pool, apps, allPools, onMove, onReport, onPreboard, jobId, onPoolUpdate,
}: {
  pool: EnterprisePool;
  apps: EnterpriseApplication[];
  allPools: EnterprisePool[];
  onMove: (appId: string, poolId: string) => void;
  onReport: (app: EnterpriseApplication) => void;
  onPreboard: (app: EnterpriseApplication) => void;
  jobId: string;
  onPoolUpdate: (p: EnterprisePool) => void;
}) {
  const [showQuestions, setShowQuestions] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [criteria, setCriteria] = useState(pool.criteria ?? "");
  const [context, setContext] = useState(pool.additional_context ?? "");
  const [editOpen, setEditOpen] = useState(false);

  const colorClass = POOL_COLORS[pool.color] ?? POOL_COLORS.slate;

  const generateQuestions = async () => {
    setGenerating(true);
    const res = await fetch(`/api/enterprise/pools/${pool.id}/questions`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ criteria, additional_context: context }),
    });
    const json = await res.json();
    if (json.data) { onPoolUpdate(json.data); setShowQuestions(true); }
    setGenerating(false);
  };

  return (
    <div className="w-80 shrink-0">
      <div className={cn("mb-2 rounded-xl border p-2.5", colorClass)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            <span className="text-sm font-semibold">{pool.name}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs tabular-nums opacity-80">{apps.length}</span>
            <button onClick={() => setEditOpen((e) => !e)} className="opacity-70 hover:opacity-100">
              <Settings2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {pool.description && <p className="mt-0.5 text-[11px] opacity-70">{pool.description}</p>}
      </div>

      {/* Pool-level criteria + question generation */}
      {editOpen && (
        <div className="mb-2 rounded-xl border border-border bg-card p-3 space-y-2">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Extra criteria for questions</label>
            <input value={criteria} onChange={(e) => setCriteria(e.target.value)}
              placeholder="e.g. Must have managed enterprise accounts"
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Hiring-manager context</label>
            <textarea value={context} onChange={(e) => setContext(e.target.value)} rows={2}
              placeholder="Anything else interviewers should probe…"
              className="w-full resize-none rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <button onClick={generateQuestions} disabled={generating}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-white shadow-glow disabled:opacity-60">
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {pool.question_set?.length ? "Regenerate questions" : "Generate pool questions"}
          </button>
        </div>
      )}

      {/* Standardized questions */}
      {pool.question_set?.length > 0 && (
        <div className="mb-2 rounded-xl border border-border bg-card">
          <button onClick={() => setShowQuestions((s) => !s)}
            className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium hover:bg-muted/30">
            <span className="flex items-center gap-1.5"><MessageSquareText className="h-3.5 w-3.5 text-primary" /> {pool.question_set.length} pool questions</span>
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showQuestions && "rotate-180")} />
          </button>
          {showQuestions && (
            <div className="border-t border-border px-3 py-2 space-y-2">
              <p className="text-[10px] text-muted-foreground">Same questions asked to every candidate in this pool.</p>
              {pool.question_set.map((q, i) => (
                <div key={q.id ?? i} className="flex gap-2">
                  <span className={cn("h-fit rounded px-1.5 py-0.5 text-[9px] font-medium capitalize shrink-0", QTYPE_COLOR[q.type] ?? QTYPE_COLOR.behavioral)}>{q.type}</span>
                  <p className="text-[11px]">{q.question}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Candidates */}
      <div className="space-y-2">
        {apps.map((app) => (
          <CandidateRow key={app.id} app={app} pools={allPools} onMove={onMove} onReport={onReport} onPreboard={onPreboard} />
        ))}
        {apps.length === 0 && (
          <div className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
            Empty pool
          </div>
        )}
      </div>
    </div>
  );
}

export function PoolsPanel({ jobId, onReport, onPreboard }: { jobId: string; onReport: (app: EnterpriseApplication) => void; onPreboard: (app: EnterpriseApplication) => void }) {
  const [pools, setPools] = useState<EnterprisePool[]>([]);
  const [apps, setApps] = useState<EnterpriseApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPoolOpen, setNewPoolOpen] = useState(false);
  const [newPool, setNewPool] = useState({ name: "", description: "" });

  const load = useCallback(async () => {
    const res = await fetch(`/api/enterprise/jobs/${jobId}/pools`);
    const json = await res.json();
    setPools(json.data?.pools ?? []);
    setApps(json.data?.applications ?? []);
    setLoading(false);
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  const move = async (appId: string, poolId: string) => {
    setApps((a) => a.map((x) => x.id === appId ? { ...x, pool_id: poolId, triaged: true } : x));
    await fetch(`/api/enterprise/applications/${appId}/move-pool`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pool_id: poolId }),
    });
  };

  const createPool = async () => {
    if (!newPool.name.trim()) return;
    const res = await fetch(`/api/enterprise/jobs/${jobId}/pools`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newPool),
    });
    const json = await res.json();
    if (json.data) setPools((p) => [...p, json.data]);
    setNewPool({ name: "", description: "" });
    setNewPoolOpen(false);
  };

  const updatePool = (updated: EnterprisePool) => setPools((p) => p.map((x) => x.id === updated.id ? updated : x));

  if (loading) return <div className="flex flex-1 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const sorted = [...pools].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="flex-1 overflow-x-auto">
      <div className="inline-flex min-w-full gap-4 p-4 sm:p-6">
        {sorted.map((pool) => (
          <PoolColumn key={pool.id} pool={pool}
            apps={apps.filter((a) => a.pool_id === pool.id)}
            allPools={pools} onMove={move} onReport={onReport} onPreboard={onPreboard}
            jobId={jobId} onPoolUpdate={updatePool} />
        ))}

        {/* New custom pool */}
        <div className="w-72 shrink-0">
          {newPoolOpen ? (
            <div className="rounded-xl border border-border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">New pool</p>
                <button onClick={() => setNewPoolOpen(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
              </div>
              <input value={newPool.name} onChange={(e) => setNewPool((p) => ({ ...p, name: e.target.value }))}
                placeholder="Pool name (e.g. Shortlist)"
                className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              <input value={newPool.description} onChange={(e) => setNewPool((p) => ({ ...p, description: e.target.value }))}
                placeholder="Description (optional)"
                className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
              <button onClick={createPool} className="btn-cta w-full rounded-lg py-1.5 text-xs font-semibold">Create pool</button>
            </div>
          ) : (
            <button onClick={() => setNewPoolOpen(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-3 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors">
              <Plus className="h-4 w-4" /> New pool
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
