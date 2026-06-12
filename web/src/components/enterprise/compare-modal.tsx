"use client";

import { useState } from "react";
import { Scale, Sparkles, Loader2, X, Trophy, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, MinusCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EnterpriseApplication } from "@/types/enterprise";
import type { ComparisonResult, CandidateComparison } from "@/app/api/enterprise/jobs/[jobId]/applications/compare/route";

const REC_ICON = {
  advance: <CheckCircle2 className="h-4 w-4 text-green-400" />,
  hold:    <MinusCircle  className="h-4 w-4 text-amber-400" />,
  reject:  <XCircle     className="h-4 w-4 text-red-400"   />,
};
const REC_COLOR = {
  advance: "border-green-500/30 bg-green-500/10 text-green-400",
  hold:    "border-amber-500/30 bg-amber-500/10 text-amber-400",
  reject:  "border-red-500/30   bg-red-500/10   text-red-400",
};

const AVATAR_GRADIENTS = [
  "from-violet-500 to-purple-600",
  "from-blue-500 to-cyan-600",
  "from-amber-500 to-orange-600",
];

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function ScorePill({ value, label }: { value: number | null; label: string }) {
  if (value === null) return <span className="text-xs text-muted-foreground">—</span>;
  const color = value >= 75 ? "text-green-400" : value >= 50 ? "text-amber-400" : "text-red-400";
  return (
    <div className="text-center">
      <p className={cn("text-lg font-bold tabular-nums", color)}>{value}%</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

interface CompareModalProps {
  apps: EnterpriseApplication[];
  jobId: string;
  onClose: () => void;
}

export function CompareModal({ apps, jobId, onClose }: CompareModalProps) {
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/enterprise/jobs/${jobId}/applications/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appIds: apps.map((a) => a.id) }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? "Failed"); setLoading(false); return; }
    setResult(json.data);
    setLoading(false);
  };

  // Map result back to apps order for stable columns
  const compMap = new Map<string, CandidateComparison>(
    (result?.candidates ?? []).map((c) => [c.id, c]),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 backdrop-blur-sm p-4 pt-10">
      <div className="w-full max-w-5xl rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Scale className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">AI Candidate Comparison</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {apps.length} candidates
            </span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6">
          {/* Candidate columns — always shown */}
          <div className={cn("grid gap-4", apps.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
            {apps.map((app, i) => {
              const comp = compMap.get(app.id);
              const isWinner = result?.winner_id === app.id;
              return (
                <div key={app.id} className={cn(
                  "relative rounded-xl border p-4 transition-all",
                  isWinner ? "border-primary/60 bg-primary/5 ring-2 ring-primary/20" : "border-border bg-card/60",
                )}>
                  {isWinner && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold text-white shadow-glow">
                        <Trophy className="h-2.5 w-2.5" /> Top pick
                      </span>
                    </div>
                  )}

                  {/* Avatar + name */}
                  <div className="mb-3 flex flex-col items-center gap-2 text-center">
                    <div className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white shadow-md",
                      AVATAR_GRADIENTS[i],
                    )}>
                      {initials(app.candidate_name)}
                    </div>
                    <div>
                      <p className="font-semibold leading-tight">{app.candidate_name}</p>
                      <p className="text-[11px] text-muted-foreground">{app.candidate_email}</p>
                    </div>
                  </div>

                  {/* Score grid */}
                  <div className="mb-3 grid grid-cols-4 gap-1 rounded-lg bg-muted/40 p-2">
                    <ScorePill value={app.match_score} label="Match" />
                    <ScorePill value={app.skills_score} label="Skills" />
                    <ScorePill value={app.experience_score} label="Exp" />
                    <ScorePill value={app.culture_score} label="Culture" />
                  </div>

                  {/* AI comparison results */}
                  {comp && (
                    <div className="space-y-3">
                      {/* Recommendation badge */}
                      <div className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold capitalize", REC_COLOR[comp.recommendation])}>
                        {REC_ICON[comp.recommendation]}
                        {comp.recommendation}
                      </div>

                      {/* Fit summary */}
                      <p className="text-xs leading-relaxed text-muted-foreground">{comp.fit_summary}</p>

                      {/* Strengths */}
                      {comp.strengths.length > 0 && (
                        <div>
                          <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-green-400">
                            <TrendingUp className="h-3 w-3" /> Strengths
                          </p>
                          <ul className="space-y-0.5">
                            {comp.strengths.map((s, j) => (
                              <li key={j} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Weaknesses */}
                      {comp.weaknesses.length > 0 && (
                        <div>
                          <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-400">
                            <TrendingDown className="h-3 w-3" /> Gaps
                          </p>
                          <ul className="space-y-0.5">
                            {comp.weaknesses.map((w, j) => (
                              <li key={j} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                                {w}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Risks */}
                      {comp.risks.length > 0 && (
                        <div>
                          <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-red-400">
                            <AlertTriangle className="h-3 w-3" /> Risks
                          </p>
                          <ul className="space-y-0.5">
                            {comp.risks.map((r, j) => (
                              <li key={j} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                                {r}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Hiring recommendation banner */}
          {result?.hiring_recommendation && (
            <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">AI Hiring Recommendation</p>
              <p className="text-sm leading-relaxed">{result.hiring_recommendation}</p>
            </div>
          )}

          {error && (
            <p className="mt-3 text-sm text-destructive">{error}</p>
          )}

          {/* CTA */}
          {!result && (
            <button
              onClick={run}
              disabled={loading}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-brand py-3 text-sm font-semibold text-white shadow-glow disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? "Analysing candidates…" : "Run AI Comparison"}
            </button>
          )}
          {result && (
            <button
              onClick={run}
              disabled={loading}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              Re-run
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
