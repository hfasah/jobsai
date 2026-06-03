"use client";

import { useState } from "react";
import {
  BrainCircuit, ChevronDown, ChevronUp, Eye, EyeOff,
  Loader2, RefreshCw, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EmptyState, RunningState } from "@/components/job/ats-report";
import type { InterviewPrep, InterviewQuestion, InterviewCategory, StarAnswer } from "@/types/phase3";

const CATEGORY_META: Record<InterviewCategory, { label: string; color: string }> = {
  behavioral: { label: "Behavioral", color: "bg-primary/15 text-primary" },
  technical:  { label: "Technical",  color: "bg-purple-100 text-purple-700" },
  role:       { label: "Role fit",   color: "bg-desyn-warning/15 text-desyn-warning" },
  culture:    { label: "Culture",    color: "bg-desyn-success/15 text-desyn-success" },
};

const CATEGORY_ORDER: InterviewCategory[] = ["behavioral", "technical", "role", "culture"];

const STAR_META: { key: keyof StarAnswer; label: string; letter: string; color: string; bg: string }[] = [
  { key: "situation", label: "Situation", letter: "S", color: "text-primary",   bg: "bg-primary/10 border-primary/30" },
  { key: "task",      label: "Task",      letter: "T", color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
  { key: "action",    label: "Action",    letter: "A", color: "text-desyn-warning",  bg: "bg-desyn-warning/15 border-desyn-warning/30" },
  { key: "result",    label: "Result",    letter: "R", color: "text-desyn-success",  bg: "bg-desyn-success/15 border-desyn-success/30" },
];

function StarBlock({ star }: { star: StarAnswer }) {
  return (
    <div className="mt-4 space-y-2.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        STAR answer
      </p>
      {STAR_META.map(({ key, label, letter, color, bg }) => (
        <div key={key} className={cn("rounded-lg border p-3", bg)}>
          <div className="flex items-center gap-2">
            <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold", color, "bg-card border border-current")}>
              {letter}
            </span>
            <span className={cn("text-xs font-semibold uppercase tracking-wide", color)}>{label}</span>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground">{star[key]}</p>
        </div>
      ))}
    </div>
  );
}

function QuestionCard({
  q,
  practiceMode,
  defaultOpen,
}: {
  q: InterviewQuestion;
  practiceMode: boolean;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [revealed, setRevealed] = useState(false);
  const meta = CATEGORY_META[q.category] ?? CATEGORY_META.role;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <button
        onClick={() => { setOpen((v) => !v); if (!open) setRevealed(false); }}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        <span className={cn("mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", meta.color)}>
          {meta.label}
        </span>
        <p className="flex-1 text-sm font-medium leading-snug">{q.question}</p>
        <span className="mt-0.5 shrink-0 text-muted-foreground">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Why asked: </span>
            {q.why_asked}
          </p>

          {practiceMode && !revealed ? (
            <button
              onClick={() => setRevealed(true)}
              className="mt-4 flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors w-full justify-center"
            >
              <Eye className="h-4 w-4" />
              Reveal answer
            </button>
          ) : (
            <>
              {q.star ? (
                <StarBlock star={q.star} />
              ) : (
                <>
                  {q.talking_points.length > 0 && (
                    <div className="mt-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Talking points
                      </p>
                      <ul className="space-y-1.5">
                        {q.talking_points.map((pt, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                            {pt}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Sample answer
                    </p>
                    <p className="text-sm leading-relaxed text-muted-foreground">{q.sample_answer}</p>
                  </div>
                </>
              )}

              {practiceMode && revealed && (
                <button
                  onClick={() => setRevealed(false)}
                  className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <EyeOff className="h-3.5 w-3.5" />
                  Hide
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function InterviewPrepView({
  prep,
  onGenerate,
  running,
}: {
  prep: InterviewPrep | null;
  onGenerate: () => void;
  running: boolean;
}) {
  const [practiceMode, setPracticeMode] = useState(false);

  if (!prep && !running) {
    return (
      <EmptyState
        icon={<BrainCircuit className="h-7 w-7" />}
        title="Prepare for your interview"
        body="Get 10 tailored interview questions with talking points and sample answers drawn from your real experience and this job's requirements."
        cta="Generate questions"
        onClick={onGenerate}
      />
    );
  }

  if (running && !prep) {
    return <RunningState label="Generating your interview questions…" />;
  }

  if (!prep) return null;

  const grouped = CATEGORY_ORDER.reduce<Record<InterviewCategory, InterviewQuestion[]>>(
    (acc, cat) => {
      acc[cat] = prep.questions.filter((q) => q.category === cat);
      return acc;
    },
    { behavioral: [], technical: [], role: [], culture: [] }
  );

  const totalQ = prep.questions.length;

  return (
    <div className="space-y-8">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Interview prep
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {totalQ} questions tailored to this role and your background
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPracticeMode((v) => !v)}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
              practiceMode
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {practiceMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {practiceMode ? "Practice on" : "Practice mode"}
          </button>
          <Button variant="outline" size="sm" onClick={onGenerate} disabled={running}>
            {running
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <RefreshCw className="mr-2 h-4 w-4" />}
            Regenerate
          </Button>
        </div>
      </div>

      {/* Category groups */}
      {CATEGORY_ORDER.map((cat) => {
        const questions = grouped[cat];
        if (questions.length === 0) return null;
        const meta = CATEGORY_META[cat];
        return (
          <section key={cat}>
            <div className="mb-3 flex items-center gap-2">
              <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", meta.color)}>
                {meta.label}
              </span>
              <span className="text-xs text-muted-foreground">{questions.length} questions</span>
            </div>
            <div className="space-y-2.5">
              {questions.map((q, i) => (
                <QuestionCard
                  key={q.id}
                  q={q}
                  practiceMode={practiceMode}
                  defaultOpen={i === 0 && cat === "behavioral"}
                />
              ))}
            </div>
          </section>
        );
      })}

      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4 shrink-0 text-desyn-accent" />
        <span>
          Tip: in practice mode, read each question out loud and try to answer it — for behavioral questions, structure your answer using the STAR method (Situation → Task → Action → Result) before revealing.
        </span>
      </div>
    </div>
  );
}
