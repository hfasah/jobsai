"use client";

import React from "react";
import {
  ShieldCheck, AlertTriangle, Sparkles, Loader2, RefreshCw,
  CheckCircle2, CircleAlert, CircleX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AtsScan } from "@/types/phase3";

type NumericBreakdownKey = "keyword_alignment" | "experience_relevance" | "formatting" | "readability" | "buzzwords_penalty";
const BREAKDOWN_META: { key: NumericBreakdownKey; label: string; max: number }[] = [
  { key: "keyword_alignment", label: "Keyword alignment", max: 40 },
  { key: "experience_relevance", label: "Experience relevance", max: 25 },
  { key: "formatting", label: "Formatting", max: 20 },
  { key: "readability", label: "Readability", max: 10 },
];

function grade(score: number) {
  if (score >= 80) return { label: "Strong", color: "var(--desyn-success)" };
  if (score >= 60) return { label: "Solid", color: "var(--desyn-accent)" };
  if (score >= 40) return { label: "Needs work", color: "var(--desyn-warning)" };
  return { label: "Weak", color: "var(--destructive)" };
}

const sevIcon = {
  high: <CircleX className="h-4 w-4 text-red-500" />,
  medium: <CircleAlert className="h-4 w-4 text-amber-500" />,
  low: <CheckCircle2 className="h-4 w-4 text-muted-foreground" />,
};

export function AtsReport({
  scan,
  onRun,
  running,
}: {
  scan: AtsScan | null;
  onRun: () => void;
  running: boolean;
}) {
  if (!scan && !running) {
    return (
      <EmptyState
        icon={<ShieldCheck className="h-7 w-7" />}
        title="Scan your resume for ATS readiness"
        body="Get a 0–100 score with keyword coverage, formatting risks, and the exact fixes that move the needle for this job."
        cta="Run ATS scan"
        onClick={onRun}
      />
    );
  }

  if (running && !scan) {
    return <RunningState label="Scanning your resume against this job…" />;
  }

  if (!scan) return null;
  const g = grade(scan.score);

  return (
    <div className="space-y-8">
      {/* Hero score */}
      <div className="report-surface reveal reveal-1 overflow-hidden rounded-2xl border border-border p-7">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              ATS readiness
            </p>
            <div className="mt-2 flex items-end gap-3">
              <span
                className="score-pop font-display text-7xl font-semibold leading-none"
                style={{ color: g.color }}
              >
                {scan.score}
              </span>
              <span className="mb-2 text-lg text-muted-foreground">/ 100</span>
            </div>
            <p className="mt-1 font-display text-xl" style={{ color: g.color }}>
              {g.label}
            </p>
          </div>

          {/* Breakdown bars */}
          <div className="w-full max-w-xs space-y-2.5">
            {BREAKDOWN_META.map(({ key, label, max }) => {
              const val = scan.breakdown?.[key] ?? 0;
              const pct = Math.round((val / max) * 100);
              return (
                <div key={key}>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium tabular-nums">{val}/{max}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{ width: `${pct}%`, background: g.color }}
                    />
                  </div>
                </div>
              );
            })}
            {scan.breakdown?.buzzwords_penalty ? (
              <p className="pt-1 text-xs text-red-500">
                Buzzword penalty: {scan.breakdown.buzzwords_penalty}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Keyword coverage */}
      <div className="reveal reveal-2 grid gap-4 sm:grid-cols-2">
        <KeywordCard
          title="Matched keywords"
          tone="match"
          items={scan.keyword_coverage?.matched ?? []}
        />
        <KeywordCard
          title="Missing keywords"
          tone="missing"
          items={scan.keyword_coverage?.missing ?? []}
        />
      </div>

      {/* Top fixes */}
      {scan.fixes?.length > 0 && (
        <section className="reveal reveal-3">
          <h3 className="mb-3 flex items-center gap-2 font-display text-lg">
            <Sparkles className="h-4 w-4 text-desyn-accent" />
            Priority fixes
          </h3>
          <ol className="space-y-2.5">
            {scan.fixes.map((fix, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-xl border border-border bg-card p-3.5"
              >
                <span className="mt-0.5">{sevIcon[fix.severity] ?? sevIcon.low}</span>
                <div>
                  <p className="text-sm">{fix.suggestion}</p>
                  <p className="mt-0.5 text-xs uppercase tracking-wide text-muted-foreground">
                    {fix.section} · {fix.severity}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Weaknesses + formatting + risks */}
      <div className="reveal reveal-4 grid gap-4 sm:grid-cols-2">
        {scan.weaknesses?.length > 0 && (
          <MiniList
            title="Weak sections"
            icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
            items={scan.weaknesses.map((w) => `${w.section}: ${w.issue}`)}
          />
        )}
        {scan.formatting_issues?.length > 0 && (
          <MiniList
            title="Formatting risks"
            icon={<CircleAlert className="h-4 w-4 text-amber-500" />}
            items={scan.formatting_issues.map((f) => f.detail)}
          />
        )}
      </div>

      {scan.buzzwords?.length > 0 && (
        <section className="reveal reveal-5">
          <h3 className="mb-3 font-display text-lg">Buzzwords to replace</h3>
          <div className="space-y-2">
            {scan.buzzwords.map((b, i) => (
              <div key={i} className="rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm">
                <span className="font-medium text-red-500 line-through">{b.phrase}</span>
                <span className="mx-2 text-muted-foreground">→</span>
                <span className="text-muted-foreground">{b.suggestion}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={onRun} disabled={running}>
          {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Re-scan
        </Button>
      </div>
    </div>
  );
}

function KeywordCard({ title, tone, items }: { title: string; tone: "match" | "missing"; items: string[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h4 className="mb-2.5 text-sm font-medium">{title}</h4>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">None</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((k, i) => (
            <span
              key={i}
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                tone === "match" ? "bg-desyn-success/15 text-desyn-success" : "bg-destructive/15 text-destructive"
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

function MiniList({ title, icon, items }: { title: string; icon: React.ReactNode; items: string[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h4 className="mb-2.5 flex items-center gap-2 text-sm font-medium">{icon}{title}</h4>
      <ul className="space-y-1.5 text-sm text-muted-foreground">
        {items.map((it, i) => <li key={i} className="leading-snug">{it}</li>)}
      </ul>
    </div>
  );
}

export function EmptyState({
  icon, title, body, cta, onClick,
}: {
  icon: React.ReactNode; title: string; body: string; cta: string; onClick: () => void;
}) {
  return (
    <div className="report-surface flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="mt-4 font-display text-2xl">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{body}</p>
      <Button className="mt-6" onClick={onClick}>
        <Sparkles className="mr-2 h-4 w-4" />
        {cta}
      </Button>
    </div>
  );
}

export function RunningState({ label }: { label: string }) {
  return (
    <div className="report-surface flex flex-col items-center rounded-2xl border border-border px-6 py-16 text-center">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
        <Sparkles className="h-7 w-7 animate-pulse text-primary" />
      </div>
      <p className="mt-5 font-display text-xl">{label}</p>
      <p className="mt-1 text-sm text-muted-foreground">This takes about 10–15 seconds.</p>
    </div>
  );
}
