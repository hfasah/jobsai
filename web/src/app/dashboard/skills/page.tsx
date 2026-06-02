"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft, Loader2, RefreshCw, TrendingUp, Zap,
  BookOpen, CheckCircle2, AlertCircle, ChevronRight,
} from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SkillsGapResult, SkillGap, SkillCategory, QuickWin } from "@/app/api/skills-gap/route";

// ─── Sub-components ───────────────────────────────────────────────────────────

function MatchRing({ percent }: { percent: number }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const dash = (percent / 100) * circ;

  const color =
    percent >= 75 ? "text-desyn-success" :
    percent >= 50 ? "text-amber-500" :
    "text-destructive";

  return (
    <div className="relative flex items-center justify-center">
      <svg width="120" height="120" className="-rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" className="stroke-muted" />
        <circle
          cx="60" cy="60" r={r} fill="none" strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          className={cn("transition-all duration-700", {
            "stroke-desyn-success": percent >= 75,
            "stroke-amber-500": percent >= 50 && percent < 75,
            "stroke-destructive": percent < 50,
          })}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={cn("text-2xl font-bold", color)}>{percent}%</span>
        <span className="text-[10px] text-muted-foreground">match</span>
      </div>
    </div>
  );
}

const PRIORITY_META = {
  high:   { label: "High",   color: "bg-destructive/10 text-destructive border-destructive/20" },
  medium: { label: "Medium", color: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50" },
  low:    { label: "Low",    color: "bg-muted text-muted-foreground border-border" },
};

function GapCard({ gap }: { gap: SkillGap }) {
  const [open, setOpen] = useState(false);
  const meta = PRIORITY_META[gap.priority];
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{gap.skill}</span>
            <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", meta.color)}>
              {meta.label}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{gap.reason}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-2 py-0.5 font-medium">{gap.frequency} jobs</span>
          <ChevronRight className={cn("h-4 w-4 transition-transform", open && "rotate-90")} />
        </div>
      </button>
      {open && gap.learn_how?.length > 0 && (
        <div className="border-t border-border bg-muted/20 px-4 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">How to learn</p>
          <ul className="space-y-1">
            {gap.learn_how.map((r, i) => (
              <li key={i} className="flex items-center gap-2 text-xs text-foreground">
                <BookOpen className="h-3 w-3 shrink-0 text-primary" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CategoryBar({ cat }: { cat: SkillCategory }) {
  const color =
    cat.score >= 75 ? "bg-desyn-success" :
    cat.score >= 50 ? "bg-amber-500" :
    "bg-destructive";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">{cat.name}</span>
        <span className="text-muted-foreground">{cat.score}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${cat.score}%` }} />
      </div>
      <div className="flex flex-wrap gap-1">
        {cat.matched.map((s, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-full bg-desyn-success/10 px-2 py-0.5 text-[11px] font-medium text-desyn-success">
            <CheckCircle2 className="h-2.5 w-2.5" />{s}
          </span>
        ))}
        {cat.missing.map((s, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
            <AlertCircle className="h-2.5 w-2.5" />{s}
          </span>
        ))}
      </div>
    </div>
  );
}

function QuickWinCard({ win }: { win: QuickWin }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Zap className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{win.skill}</p>
          <p className="text-xs text-muted-foreground">{win.reason}</p>
        </div>
        <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
      </button>
      {open && win.learn_how?.length > 0 && (
        <div className="border-t border-border bg-muted/20 px-4 py-3">
          <ul className="space-y-1">
            {win.learn_how.map((r, i) => (
              <li key={i} className="flex items-center gap-2 text-xs text-foreground">
                <BookOpen className="h-3 w-3 shrink-0 text-primary" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SkillsGapPage() {
  const [result, setResult] = useState<SkillsGapResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/skills-gap")
      .then((r) => r.json())
      .then((j) => { setResult(j.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const analyze = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch("/api/skills-gap", { method: "POST" });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Analysis failed."); return; }
      setResult(json.data);
    } finally {
      setAnalyzing(false);
    }
  };

  const analyzedDate = result?.analyzed_at
    ? new Date(result.analyzed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>

        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Skills Gap Analysis</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              What skills you need to land more of your target roles
            </p>
          </div>
          {result && (
            <Button variant="outline" size="sm" onClick={analyze} disabled={analyzing}>
              {analyzing
                ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                : <RefreshCw className="mr-1.5 h-4 w-4" />}
              Refresh
            </Button>
          )}
        </div>

        {loading ? (
          <div className="mt-12 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : analyzing ? (
          <div className="mt-12 flex flex-col items-center gap-3 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Analyzing your skills against {result?.job_count ?? "your"} jobs…</p>
            <p className="text-xs text-muted-foreground">This takes about 10–15 seconds</p>
          </div>
        ) : !result ? (
          <div className="mt-12 flex flex-col items-center gap-5 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Run your first analysis</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                We&apos;ll look at your resume skills against all your imported jobs and tell you exactly what to learn.
              </p>
            </div>
            {error && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <Button onClick={analyze} disabled={analyzing}>
              <Zap className="mr-2 h-4 w-4" />
              Analyze my skills
            </Button>
          </div>
        ) : (
          <div className="mt-8 space-y-8">

            {/* Summary card */}
            <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 sm:flex-row sm:items-center">
              <MatchRing percent={result.match_percent} />
              <div className="flex-1">
                <p className="text-sm leading-relaxed text-muted-foreground">{result.summary}</p>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                  <span><span className="font-semibold text-foreground">{result.job_count}</span> jobs analyzed</span>
                  <span><span className="font-semibold text-foreground">{result.your_skills?.length ?? 0}</span> skills on your resume</span>
                  <span><span className="font-semibold text-foreground">{result.top_gaps?.length ?? 0}</span> skill gaps found</span>
                  {analyzedDate && <span>Updated {analyzedDate}</span>}
                </div>
              </div>
            </div>

            {/* Your skills */}
            {result.your_skills?.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Skills you have
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {result.your_skills.map((s, i) => (
                    <span key={i} className="rounded-full border border-desyn-success/30 bg-desyn-success/10 px-2.5 py-1 text-xs font-medium text-desyn-success">
                      {s}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Category breakdown */}
            {result.categories?.length > 0 && (
              <section>
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Coverage by category
                </h2>
                <div className="space-y-5 rounded-xl border border-border bg-card p-5">
                  {result.categories.map((cat, i) => (
                    <CategoryBar key={i} cat={cat} />
                  ))}
                </div>
              </section>
            )}

            {/* Top gaps */}
            {result.top_gaps?.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Top skill gaps
                </h2>
                <div className="space-y-2">
                  {result.top_gaps.map((gap, i) => (
                    <GapCard key={i} gap={gap} />
                  ))}
                </div>
              </section>
            )}

            {/* Quick wins */}
            {result.quick_wins?.length > 0 && (
              <section>
                <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Quick wins
                </h2>
                <p className="mb-3 text-xs text-muted-foreground">
                  Skills you can pick up fast given your existing background
                </p>
                <div className="space-y-2">
                  {result.quick_wins.map((win, i) => (
                    <QuickWinCard key={i} win={win} />
                  ))}
                </div>
              </section>
            )}

          </div>
        )}
      </main>
    </>
  );
}
