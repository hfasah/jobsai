"use client";

import { useState } from "react";
import { Building2, Loader2, RefreshCw, Users, Lightbulb, MessageSquare, ThumbsUp, ThumbsDown, Newspaper, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/job/ats-report";
import { cn } from "@/lib/utils";
import type { CompanyResearchResult } from "@/app/api/jobs/[jobId]/company-research/route";

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </div>
  );
}

function BulletList({ items, className }: { items: string[]; className?: string }) {
  return (
    <ul className={cn("space-y-2", className)}>
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
          {item}
        </li>
      ))}
    </ul>
  );
}

function QuestionsAccordion({ questions }: { questions: string[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  return (
    <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
      {questions.map((q, i) => (
        <button
          key={i}
          onClick={() => setExpanded(expanded === i ? null : i)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
        >
          <span className="text-sm text-foreground">{q}</span>
          {expanded === i
            ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
            : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
        </button>
      ))}
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function CompanyResearchView({
  jobId,
  companyName,
}: {
  jobId: string;
  companyName?: string;
}) {
  const [research, setResearch] = useState<CompanyResearchResult | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Lazy-load existing data (called by parent via tab activation)
  const load = async () => {
    if (loaded) return;
    setLoaded(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/company-research`);
      const json = await res.json();
      if (json.data) setResearch(json.data);
    } catch {
      // silent
    }
  };

  // Expose load for parent to call on tab open
  if (!loaded) {
    load();
  }

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/company-research`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) { alert(json.error ?? "Research failed."); return; }
      setResearch(json.data);
    } finally {
      setGenerating(false);
    }
  };

  if (generating) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-xl border border-border bg-card p-12 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        Researching {companyName ?? "the company"}…
      </div>
    );
  }

  if (!research) {
    return (
      <EmptyState
        icon={<Building2 className="h-7 w-7" />}
        title={companyName ? `Research ${companyName}` : "Company Research"}
        body="Get AI-powered insights on company culture, interview tips, common interview questions, pros and cons — all personalised to this role."
        cta="Research this company"
        onClick={generate}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview header */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <h2 className="text-base font-semibold text-foreground">{companyName ?? "Company"}</h2>
          {research.size && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              {research.size}
            </span>
          )}
          {research.industry && (
            <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
              {research.industry}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{research.overview}</p>
      </div>

      {/* Culture + Interview tips — 2-col grid */}
      <div className="grid gap-5 md:grid-cols-2">
        {research.culture_bullets?.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-5">
            <SectionHeader icon={<Lightbulb className="h-3.5 w-3.5" />} title="Culture & Values" />
            <BulletList items={research.culture_bullets} />
          </div>
        )}
        {research.interview_tips?.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-5">
            <SectionHeader icon={<MessageSquare className="h-3.5 w-3.5" />} title="Interview Tips" />
            <BulletList items={research.interview_tips} />
          </div>
        )}
      </div>

      {/* Common interview questions */}
      {research.common_questions?.length > 0 && (
        <div>
          <SectionHeader icon={<MessageSquare className="h-3.5 w-3.5" />} title="Common Interview Questions" />
          <QuestionsAccordion questions={research.common_questions} />
        </div>
      )}

      {/* Pros / Cons */}
      {(research.pros?.length > 0 || research.cons?.length > 0) && (
        <div className="grid gap-5 md:grid-cols-2">
          {research.pros?.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <SectionHeader icon={<ThumbsUp className="h-3.5 w-3.5" />} title="Why People Love It" />
              <BulletList items={research.pros} />
            </div>
          )}
          {research.cons?.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <SectionHeader icon={<ThumbsDown className="h-3.5 w-3.5" />} title="Common Criticisms" />
              <BulletList items={research.cons} />
            </div>
          )}
        </div>
      )}

      {/* Recent context */}
      {research.recent_context && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20 p-5">
          <SectionHeader icon={<Newspaper className="h-3.5 w-3.5" />} title="Recent Context" />
          <p className="text-sm text-muted-foreground leading-relaxed">{research.recent_context}</p>
        </div>
      )}

      {/* Regenerate */}
      <div className="flex items-center justify-end gap-2">
        <p className="text-xs text-muted-foreground">Based on AI knowledge — verify with current sources</p>
        <Button variant="outline" size="sm" onClick={generate} disabled={generating}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>
    </div>
  );
}
