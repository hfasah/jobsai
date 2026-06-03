"use client";

import { CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
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

export function MatchDetail({ match }: { match: JobMatch }) {
  const breakdown = match.scored_json?.breakdown;
  const strengths = match.scored_json?.strengths ?? [];
  const gaps = match.scored_json?.gaps ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <MatchScoreRing score={match.match_score} />
        <div className="flex-1">
          {match.explanation && (
            <p className="text-sm text-muted-foreground">{match.explanation}</p>
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

      {/* Keyword gaps */}
      <div className="grid gap-4 sm:grid-cols-2">
        <KeywordList
          title="Matched keywords"
          keywords={match.matched_keywords}
          variant="match"
        />
        <KeywordList
          title="Missing keywords"
          keywords={match.missing_keywords}
          variant="missing"
        />
      </div>

      {/* Strengths & gaps */}
      {(strengths.length > 0 || gaps.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {strengths.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-medium text-desyn-success">Strengths</h4>
              <ul className="space-y-1.5">
                {strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-500" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {gaps.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-medium text-desyn-warning">Gaps</h4>
              <ul className="space-y-1.5">
                {gaps.map((g, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-500" />
                    {g}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
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
        <p className="text-xs text-muted-foreground">None</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {keywords.map((k, i) => (
            <span
              key={i}
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                variant === "match"
                  ? "bg-desyn-success/15 text-desyn-success"
                  : "bg-destructive/15 text-destructive"
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
