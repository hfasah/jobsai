"use client";

import { CheckCircle, Lightbulb, TrendingUp, Sparkles, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { JobMatch } from "@/types/job";

export function MatchScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 75 ? "#16a34a" : score >= 50 ? "#ca8a04" : "#dc2626";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={8}
          className="text-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold" style={{ color }}>{score}</span>
        <span className="text-xs text-muted-foreground">match</span>
      </div>
    </div>
  );
}

function scoreLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "Excellent fit", color: "text-desyn-success" };
  if (score >= 65) return { label: "Strong contender", color: "text-desyn-success" };
  if (score >= 50) return { label: "Good potential", color: "text-amber-500" };
  return { label: "Worth a shot", color: "text-amber-500" };
}

export function MatchDetail({ match, jobId }: { match: JobMatch; jobId?: string }) {
  const breakdown = match.scored_json?.breakdown;
  const strengths = match.scored_json?.strengths ?? [];
  const gaps = match.scored_json?.gaps ?? [];
  const coachNote = match.scored_json?.coach_note;
  const interviewTip = match.scored_json?.interview_tip;
  const { label, color } = scoreLabel(match.match_score);

  return (
    <div className="space-y-6">
      {/* Score + explanation */}
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="flex flex-col items-center gap-1">
          <MatchScoreRing score={match.match_score} />
          <span className={cn("text-xs font-semibold", color)}>{label}</span>
        </div>
        <div className="flex-1">
          {match.explanation && (
            <p className="text-sm leading-relaxed text-foreground">{match.explanation}</p>
          )}
          {breakdown && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Skills" value={breakdown.skills} />
              <Stat label="Experience" value={breakdown.experience} />
              <Stat label="Title" value={breakdown.title} />
              <Stat label="Keywords" value={breakdown.keywords} />
            </div>
          )}
        </div>
      </div>

      {/* Coach note — personal pep talk */}
      {coachNote && (
        <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-sm leading-relaxed text-foreground">{coachNote}</p>
        </div>
      )}

      {/* Keywords */}
      <div className="grid gap-4 sm:grid-cols-2">
        <KeywordList title="Your matched keywords" keywords={match.matched_keywords} variant="match" />
        <KeywordList title="Keywords to add to your résumé" keywords={match.missing_keywords} variant="missing" />
      </div>

      {/* Strengths & growth areas */}
      {(strengths.length > 0 || gaps.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {strengths.length > 0 && (
            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-desyn-success">
                <CheckCircle className="h-3.5 w-3.5" /> Why you stand out
              </h4>
              <ul className="space-y-2">
                {strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-desyn-success" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {gaps.length > 0 && (
            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-amber-500">
                <TrendingUp className="h-3.5 w-3.5" /> Areas to prepare
              </h4>
              <ul className="space-y-2">
                {gaps.map((g, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                    {g}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Interview tip */}
      {interviewTip && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-500 mb-0.5">If you land the interview</p>
            <p className="text-sm leading-relaxed text-foreground">{interviewTip}</p>
          </div>
        </div>
      )}

      {/* Platform upsell — interview tools */}
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Get interview-ready with JobsAI</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            {
              href: jobId ? `/dashboard/jobs/${jobId}?tab=interview-prep` : "/dashboard/jobs",
              label: "Interview Prep",
              desc: "AI-generated Q&A tailored to this exact role",
            },
            {
              href: jobId ? `/dashboard/jobs/${jobId}?tab=mock` : "/dashboard/jobs",
              label: "Mock Interview",
              desc: "Practice with an AI interviewer and get scored feedback",
            },
            {
              href: "/dashboard/voice-interview",
              label: "Live Interview Agent",
              desc: "Real-time AI whispers answers during your live interview call",
            },
          ].map(({ href, label, desc }) => (
            <Link
              key={label}
              href={href}
              className="group flex flex-col gap-0.5 rounded-lg border border-border bg-card p-3 hover:border-primary/40 hover:bg-primary/5 transition-colors"
            >
              <span className="flex items-center gap-1 text-xs font-semibold text-foreground group-hover:text-primary">
                {label} <ArrowRight className="h-3 w-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </span>
              <span className="text-[11px] text-muted-foreground leading-snug">{desc}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  if (value === undefined) return null;
  return (
    <div className="rounded-lg border border-border p-2.5 text-center">
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function KeywordList({
  title,
  keywords,
  variant,
}: {
  title: string;
  keywords: string[];
  variant: "match" | "missing";
}) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-medium">{title}</h4>
      {keywords.length === 0 ? (
        <p className="text-xs text-muted-foreground">None identified</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {keywords.map((k, i) => (
            <span
              key={i}
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                variant === "match"
                  ? "bg-desyn-success/15 text-desyn-success"
                  : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
              )}
            >
              {k}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
