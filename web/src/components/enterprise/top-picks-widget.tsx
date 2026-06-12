"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles, ArrowRight, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface Pick {
  application_id: string;
  candidate_name: string;
  candidate_email?: string;
  stage: string;
  match_score: number | null;
  ai_recommendation: string | null;
  reason: string;
  next_action: string;
}

const REC_COLOR: Record<string, string> = {
  strong_yes: "text-green-400 bg-green-500/10 border-green-500/30",
  yes:        "text-blue-400 bg-blue-500/10 border-blue-500/30",
  maybe:      "text-amber-400 bg-amber-500/10 border-amber-500/30",
  no:         "text-red-400 bg-red-500/10 border-red-500/30",
};

const REC_LABEL: Record<string, string> = {
  strong_yes: "Strong Yes", yes: "Yes", maybe: "Maybe", no: "No",
};

const ACTION_COLOR: Record<string, string> = {
  "Schedule interview": "bg-violet-500/10 text-violet-400",
  "Send offer": "bg-green-500/10 text-green-400",
  "Phone screen": "bg-blue-500/10 text-blue-400",
  "Request CV": "bg-amber-500/10 text-amber-400",
  "Screen with AI": "bg-primary/10 text-primary",
};

export function TopPicksWidget({ jobId, onViewCandidate }: { jobId: string; onViewCandidate?: (appId: string) => void }) {
  const [picks, setPicks] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await fetch(`/api/enterprise/jobs/${jobId}/top-candidates`);
      const json = await res.json();
      setPicks(json.picks ?? []);
      setMessage(json.message ?? "");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [jobId]);

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-brand">
            <Sparkles className="h-6 w-6 text-white animate-pulse" />
          </div>
          <p className="text-sm text-muted-foreground">AI is reviewing your candidates…</p>
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-brand">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="font-semibold">AI Top Picks</h2>
              <p className="text-xs text-muted-foreground">The candidates you should focus on right now</p>
            </div>
          </div>
          <button onClick={() => load(true)} disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40">
            <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
            Refresh
          </button>
        </div>

        {message && picks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-16 text-center">
            <Sparkles className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {picks.map((pick, i) => (
              <div key={pick.application_id}
                className="relative rounded-2xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:bg-primary/5">
                {/* Rank badge */}
                <div className={cn(
                  "absolute -left-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white",
                  i === 0 ? "bg-gradient-brand shadow-glow" : "bg-muted-foreground/50"
                )}>
                  {i + 1}
                </div>

                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                    {pick.candidate_name.charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{pick.candidate_name}</span>
                      {pick.match_score !== null && (
                        <span className={cn("text-xs font-bold tabular-nums",
                          pick.match_score >= 75 ? "text-green-400" : pick.match_score >= 50 ? "text-amber-400" : "text-muted-foreground"
                        )}>
                          {pick.match_score}%
                        </span>
                      )}
                      {pick.ai_recommendation && (
                        <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", REC_COLOR[pick.ai_recommendation] ?? "text-muted-foreground")}>
                          {REC_LABEL[pick.ai_recommendation] ?? pick.ai_recommendation}
                        </span>
                      )}
                      <span className="capitalize rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {pick.stage}
                      </span>
                    </div>

                    {/* Reason */}
                    <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{pick.reason}</p>

                    {/* Next action + view */}
                    <div className="mt-2.5 flex items-center gap-2">
                      <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", ACTION_COLOR[pick.next_action] ?? "bg-muted text-muted-foreground")}>
                        → {pick.next_action}
                      </span>
                      {onViewCandidate && (
                        <button onClick={() => onViewCandidate(pick.application_id)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
                          View profile <ArrowRight className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {picks.length > 0 && (
          <p className="text-center text-[11px] text-muted-foreground">
            AI rankings update on refresh · scores are based on match, skills, experience, and risk assessment
          </p>
        )}
      </div>
    </div>
  );
}
