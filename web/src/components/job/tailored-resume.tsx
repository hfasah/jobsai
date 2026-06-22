"use client";

import { useState } from "react";
import Link from "next/link";
import { Wand2, Loader2, RefreshCw, ArrowRight, Plus, Copy, Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, RunningState } from "@/components/job/ats-report";
import { cn } from "@/lib/utils";
import type { TailoredResume } from "@/types/phase3";

type Detail = "concise" | "expanded";

// Split a skills string into individual skills for chip rendering. Handles
// comma/semicolon/newline/bullet separators; falls back to the whole string.
function splitSkills(text: unknown): string[] {
  return String(text ?? "").split(/[,;\n•|]+/).map((s) => s.trim()).filter(Boolean);
}

export function TailoredResumeView({
  tailored,
  onRun,
  running,
  jobId,
}: {
  tailored: TailoredResume | null;
  onRun: (detail: Detail) => void;
  running: boolean;
  jobId: string;
}) {
  const [copied, setCopied] = useState(false);
  const [detail, setDetail] = useState<Detail>("concise");

  const lengthToggle = (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Length</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setDetail("concise")}
          className={cn("rounded-xl border p-3 text-left transition-colors", detail === "concise" ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/40")}
        >
          <p className="text-sm font-semibold">Concise</p>
          <p className="text-xs text-muted-foreground">1 page · 3–4 bullets/role</p>
        </button>
        <button
          type="button"
          onClick={() => setDetail("expanded")}
          className={cn("rounded-xl border p-3 text-left transition-colors", detail === "expanded" ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/40")}
        >
          <p className="text-sm font-semibold">Expanded</p>
          <p className="text-xs text-muted-foreground">2 pages · 5–7 bullets/role</p>
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Expanded writes more detail per role — truthfully, from your real experience (it won&apos;t invent content).</p>
    </div>
  );

  if (!tailored && !running) {
    return (
      <div className="space-y-5">
        {lengthToggle}
        <EmptyState
          icon={<Wand2 className="h-7 w-7" />}
          title="Tailor your resume to this job"
          body="AI rewrites your summary, bullets, and skills to match the role's language and surface your most relevant experience — truthfully, never inventing anything."
          cta="Tailor my resume"
          onClick={() => onRun(detail)}
        />
      </div>
    );
  }
  if (running && !tailored) return <RunningState label="Tailoring your resume to this role…" />;
  if (!tailored) return null;

  const tj = tailored.tailored_json;

  const copyText = () => {
    const parts: string[] = [];
    if (tj.headline) parts.push(tj.headline, "");
    if (tj.summary) parts.push("SUMMARY", tj.summary, "");
    if (tj.experience?.length) {
      parts.push("EXPERIENCE");
      tj.experience.forEach((e) => {
        const dates = e.start_date || e.end_date || e.is_current
          ? `  (${e.start_date ?? "?"} – ${e.is_current ? "Present" : (e.end_date ?? "?")})`
          : "";
        parts.push(`${e.title} — ${e.company}${dates}`);
        e.bullets?.forEach((b) => parts.push(`• ${b}`));
        parts.push("");
      });
    }
    if (tj.skills?.length) parts.push("SKILLS", tj.skills.join(", "));
    navigator.clipboard.writeText(parts.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Keywords added banner */}
      {tailored.keywords_added?.length > 0 && (
        <div className="reveal reveal-1 rounded-2xl border border-border report-surface p-5">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Plus className="h-4 w-4 text-desyn-success" />
            Keywords now surfaced for this job
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tailored.keywords_added.map((k, i) => (
              <span key={i} className="rounded-full bg-desyn-success/15 px-2 py-0.5 text-xs font-medium text-desyn-success">
                {k}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tailored resume preview */}
      <div className="reveal reveal-2 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="font-display text-lg">Tailored resume</h3>
          <Button variant="outline" size="sm" onClick={copyText}>
            {copied ? <Check className="mr-1.5 h-3.5 w-3.5 text-desyn-success" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <div className="space-y-5 p-6">
          {tj.headline && <p className="font-display text-xl">{tj.headline}</p>}
          {tj.summary && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Summary</p>
              <p className="text-sm leading-relaxed text-foreground/90">{tj.summary}</p>
            </div>
          )}
          {tj.experience?.map((exp, i) => {
            const dates = exp.start_date || exp.end_date || exp.is_current
              ? `${exp.start_date ?? "?"} – ${exp.is_current ? "Present" : (exp.end_date ?? "?")}`
              : null;
            return (
            <div key={i}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-semibold">{exp.title} — <span className="text-muted-foreground">{exp.company}</span></p>
                {dates && <p className="shrink-0 text-xs text-muted-foreground tabular-nums">{dates}</p>}
              </div>
              <ul className="mt-1.5 space-y-1">
                {exp.bullets?.map((b, j) => (
                  <li key={j} className="flex gap-2 text-sm text-foreground/90">
                    <span className="text-desyn-accent">•</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
            );
          })}
          {tj.skills?.length ? (
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {tj.skills.map((s, i) => (
                  <span key={i} className="rounded-full border border-border px-2.5 py-0.5 text-xs">{s}</span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Before / after changes */}
      {tailored.changes?.length > 0 && (
        <section className="reveal reveal-3">
          <h3 className="mb-3 font-display text-lg">What changed & why</h3>
          <div className="space-y-3">
            {tailored.changes.map((c, i) => {
              const isSkills = String(c.section ?? "").toLowerCase() === "skills";
              return (
              <div key={i} className="rounded-xl border border-border bg-card p-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{c.section}</p>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                  {isSkills ? (
                    <div className="flex flex-wrap gap-1.5 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2">
                      {splitSkills(c.before).map((s, j) => (
                        <span key={j} className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-muted-foreground line-through decoration-destructive/50">{s}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-muted-foreground line-through decoration-destructive/50">
                      {c.before}
                    </p>
                  )}
                  <ArrowRight className="mx-auto hidden h-4 w-4 text-muted-foreground sm:block" />
                  {isSkills ? (
                    <div className="flex flex-wrap gap-1.5 rounded-lg border border-desyn-success/30 bg-desyn-success/10 px-3 py-2">
                      {splitSkills(c.after).map((s, j) => (
                        <span key={j} className="rounded-full bg-desyn-success/15 px-2 py-0.5 text-xs font-medium text-foreground">{s}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-desyn-success/30 bg-desyn-success/10 px-3 py-2 text-sm font-medium text-foreground">
                      {c.after}
                    </p>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{c.reason}</p>
              </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
        {lengthToggle}
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onRun(detail)} disabled={running}>
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Re-tailor
          </Button>
          <Button size="sm" render={<Link href={`/dashboard/jobs/${jobId}/resume-preview`} target="_blank" />}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Download PDF
          </Button>
        </div>
      </div>
    </div>
  );
}
