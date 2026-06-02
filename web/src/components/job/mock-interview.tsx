"use client";

import { useState, useCallback } from "react";
import {
  Mic2, ChevronRight, RotateCcw, Loader2, Star,
  CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EmptyState, RunningState } from "@/components/job/ats-report";
import type { InterviewPrep, InterviewQuestion, InterviewCategory } from "@/types/phase3";
import type { MockEvaluation } from "@/app/api/jobs/[jobId]/mock-interview/route";

// ─── Constants ────────────────────────────────────────────────────────────────

const MOCK_Q_COUNT = 5;

const CATEGORY_META: Record<InterviewCategory, { label: string; color: string }> = {
  behavioral: { label: "Behavioral", color: "bg-blue-100 text-blue-700" },
  technical:  { label: "Technical",  color: "bg-purple-100 text-purple-700" },
  role:       { label: "Role fit",   color: "bg-amber-100 text-amber-700" },
  culture:    { label: "Culture",    color: "bg-green-100 text-green-700" },
};

// ─── Star rating ─────────────────────────────────────────────────────────────

function ScoreStars({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            "h-5 w-5",
            n <= score ? "fill-amber-400 text-amber-400" : "text-border"
          )}
        />
      ))}
      <span className="ml-2 text-sm font-semibold text-foreground">{score}/5</span>
    </div>
  );
}

// ─── Feedback card ────────────────────────────────────────────────────────────

function FeedbackCard({
  evaluation,
  onNext,
  isLast,
}: {
  evaluation: MockEvaluation;
  onNext: () => void;
  isLast: boolean;
}) {
  const [modelOpen, setModelOpen] = useState(false);

  const scoreLabel =
    evaluation.score >= 5 ? "Excellent" :
    evaluation.score >= 4 ? "Good" :
    evaluation.score >= 3 ? "Average" :
    evaluation.score >= 2 ? "Needs work" : "Very weak";

  const scoreColor =
    evaluation.score >= 4 ? "text-desyn-success" :
    evaluation.score >= 3 ? "text-amber-600" : "text-destructive";

  return (
    <div className="space-y-4">
      {/* Score */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <ScoreStars score={evaluation.score} />
          <span className={cn("text-sm font-semibold", scoreColor)}>{scoreLabel}</span>
        </div>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          {evaluation.summary}
        </p>
      </div>

      {/* Strengths + improvements */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-desyn-success/30 bg-desyn-success/5 p-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-desyn-success">
            <CheckCircle2 className="h-3.5 w-3.5" /> Strengths
          </p>
          <ul className="space-y-1.5">
            {evaluation.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-desyn-success" />
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-700">
            <AlertCircle className="h-3.5 w-3.5" /> Improve
          </p>
          <ul className="space-y-1.5">
            {evaluation.improvements.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Model answer */}
      <div className="rounded-xl border border-border bg-card">
        <button
          onClick={() => setModelOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
        >
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-desyn-accent" />
            Model answer
          </span>
          {modelOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
        {modelOpen && (
          <div className="border-t border-border px-4 pb-4 pt-3">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {evaluation.model_answer}
            </p>
          </div>
        )}
      </div>

      <Button className="w-full" onClick={onNext}>
        {isLast ? "See results" : "Next question"}
        <ChevronRight className="ml-1.5 h-4 w-4" />
      </Button>
    </div>
  );
}

// ─── Summary screen ───────────────────────────────────────────────────────────

function SessionSummary({
  scores,
  onRestart,
}: {
  scores: number[];
  onRestart: () => void;
}) {
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const rounded = Math.round(avg * 10) / 10;

  const overallLabel =
    avg >= 4.5 ? "Outstanding" :
    avg >= 4   ? "Strong" :
    avg >= 3   ? "Solid" :
    avg >= 2   ? "Developing" : "Needs practice";

  const overallColor =
    avg >= 4 ? "text-desyn-success" :
    avg >= 3 ? "text-amber-600" : "text-destructive";

  return (
    <div className="space-y-6 text-center">
      <div className="rounded-2xl border border-border bg-card p-8">
        <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Mock interview complete
        </p>
        <p className="font-display mt-3 text-6xl font-bold text-foreground">
          {rounded}
          <span className="text-2xl text-muted-foreground">/5</span>
        </p>
        <p className={cn("mt-2 text-lg font-semibold", overallColor)}>{overallLabel}</p>

        <div className="mt-6 flex justify-center gap-6">
          {scores.map((s, i) => (
            <div key={i} className="text-center">
              <p className="text-xs text-muted-foreground">Q{i + 1}</p>
              <ScoreStars score={s} />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" onClick={onRestart}>
          <RotateCcw className="mr-1.5 h-4 w-4" />
          Practice again
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Tip: use the Interview Prep tab to review model answers for each question type.
      </p>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

type Stage =
  | { type: "intro" }
  | { type: "answering"; qIndex: number }
  | { type: "evaluating"; qIndex: number }
  | { type: "feedback"; qIndex: number; evaluation: MockEvaluation }
  | { type: "complete" };

export function MockInterviewView({
  jobId,
  prep,
  onGenerate,
  generating,
}: {
  jobId: string;
  prep: InterviewPrep | null;
  onGenerate: () => void;
  generating: boolean;
}) {
  const questions: InterviewQuestion[] = (prep?.questions ?? []).slice(0, MOCK_Q_COUNT);
  const [stage, setStage] = useState<Stage>({ type: "intro" });
  const [answer, setAnswer] = useState("");
  const [scores, setScores] = useState<number[]>([]);

  const reset = useCallback(() => {
    setStage({ type: "intro" });
    setAnswer("");
    setScores([]);
  }, []);

  const submitAnswer = useCallback(async (qIndex: number) => {
    const q = questions[qIndex];
    if (!q || !answer.trim()) return;

    setStage({ type: "evaluating", qIndex });

    const res = await fetch(`/api/jobs/${jobId}/mock-interview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q.question, answer: answer.trim(), category: q.category }),
    });

    const json = await res.json();

    if (!res.ok) {
      alert(json.error ?? "Evaluation failed.");
      setStage({ type: "answering", qIndex });
      return;
    }

    const evaluation: MockEvaluation = json.data;
    setScores((prev) => [...prev, evaluation.score]);
    setStage({ type: "feedback", qIndex, evaluation });
    setAnswer("");
  }, [jobId, questions, answer]);

  const goNext = useCallback((qIndex: number) => {
    const nextIndex = qIndex + 1;
    if (nextIndex >= questions.length) {
      setStage({ type: "complete" });
    } else {
      setStage({ type: "answering", qIndex: nextIndex });
    }
  }, [questions.length]);

  // ── Empty / generate state ────────────────────────────────────────────────
  if (!prep && !generating) {
    return (
      <EmptyState
        icon={<Mic2 className="h-7 w-7" />}
        title="Practice your interview"
        body="Answer 5 questions one at a time and get instant AI feedback on your score, strengths, and how to improve each answer."
        cta="Generate questions"
        onClick={onGenerate}
      />
    );
  }

  if (generating && !prep) {
    return <RunningState label="Generating interview questions…" />;
  }

  if (!prep || questions.length === 0) return null;

  // ── Intro ──────────────────────────────────────────────────────────────────
  if (stage.type === "intro") {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Mic2 className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-lg font-semibold">Mock interview session</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {questions.length} questions · Answer each one as if you&apos;re in a real interview · Get instant AI feedback
          </p>

          <div className="mt-5 flex justify-center gap-4 text-sm text-muted-foreground">
            {(["behavioral", "technical", "role", "culture"] as InterviewCategory[]).map((cat) => {
              const count = questions.filter((q) => q.category === cat).length;
              if (!count) return null;
              const meta = CATEGORY_META[cat];
              return (
                <span key={cat} className={cn("rounded-full px-2.5 py-1 text-xs font-medium", meta.color)}>
                  {count}× {meta.label}
                </span>
              );
            })}
          </div>
        </div>
        <Button className="w-full" size="lg" onClick={() => setStage({ type: "answering", qIndex: 0 })}>
          Start session
          <ChevronRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    );
  }

  // ── Complete ──────────────────────────────────────────────────────────────
  if (stage.type === "complete") {
    return <SessionSummary scores={scores} onRestart={reset} />;
  }

  const { qIndex } = stage;
  const q = questions[qIndex];
  const meta = CATEGORY_META[q.category] ?? CATEGORY_META.role;
  const progress = ((qIndex) / questions.length) * 100;

  return (
    <div className="space-y-5">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Question {qIndex + 1} of {questions.length}</span>
          <button onClick={reset} className="flex items-center gap-1 hover:text-foreground transition-colors">
            <RotateCcw className="h-3 w-3" /> Restart
          </button>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question card */}
      <div className="rounded-xl border border-border bg-card p-5">
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", meta.color)}>
          {meta.label}
        </span>
        <p className="mt-3 text-base font-semibold leading-snug">{q.question}</p>
        <p className="mt-1 text-xs text-muted-foreground">{q.why_asked}</p>
      </div>

      {/* Answer / evaluating / feedback */}
      {stage.type === "answering" && (
        <div className="space-y-3">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your answer here… treat it like the real thing."
            rows={6}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            autoFocus
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{answer.trim().split(/\s+/).filter(Boolean).length} words</span>
            <span>Aim for 100–200 words for most questions</span>
          </div>
          <Button
            className="w-full"
            onClick={() => submitAnswer(qIndex)}
            disabled={answer.trim().split(/\s+/).length < 5}
          >
            Submit answer
            <ChevronRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      )}

      {stage.type === "evaluating" && (
        <div className="flex items-center justify-center gap-3 rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Evaluating your answer…
        </div>
      )}

      {stage.type === "feedback" && (
        <FeedbackCard
          evaluation={stage.evaluation}
          onNext={() => goNext(qIndex)}
          isLast={qIndex === questions.length - 1}
        />
      )}
    </div>
  );
}
