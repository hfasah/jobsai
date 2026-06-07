"use client";

import { useState, useCallback, useEffect } from "react";
import { promptUpgrade } from "@/lib/upgrade";
import Link from "next/link";
import {
  Mic2, ChevronRight, RotateCcw, Loader2, Star,
  CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Sparkles,
  Coins, Lock, MessageSquareText, Cpu, Crown, Shuffle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EmptyState, RunningState } from "@/components/job/ats-report";
import { StatRing } from "@/components/ui/stat-ring";
import { TokenBalance } from "@/components/ui/token-balance";
import type { InterviewPrep, InterviewQuestion, InterviewCategory } from "@/types/phase3";
import type { MockEvaluation, SubScores, InterviewType } from "@/app/api/jobs/[jobId]/mock-interview/route";

// ─── Constants ────────────────────────────────────────────────────────────────

const MOCK_Q_COUNT = 5;
const TOKEN_COST = 50; // per written evaluation — keep in sync with TOKEN_COSTS.written_eval

const CATEGORY_META: Record<InterviewCategory, { label: string; color: string }> = {
  behavioral: { label: "Behavioral", color: "bg-primary/15 text-primary" },
  technical:  { label: "Technical",  color: "bg-purple-100 text-purple-700" },
  role:       { label: "Role fit",   color: "bg-desyn-warning/15 text-desyn-warning" },
  culture:    { label: "Culture",    color: "bg-desyn-success/15 text-desyn-success" },
};

const TYPE_OPTIONS: { value: InterviewType; label: string; icon: React.ElementType; cats: InterviewCategory[] }[] = [
  { value: "behavioral", label: "Behavioral", icon: MessageSquareText, cats: ["behavioral", "culture"] },
  { value: "technical",  label: "Technical",  icon: Cpu,               cats: ["technical"] },
  { value: "leadership", label: "Leadership", icon: Crown,             cats: ["role", "behavioral"] },
  { value: "mixed",      label: "Mixed",      icon: Shuffle,           cats: ["behavioral", "technical", "role", "culture"] },
];

const SUBSCORE_LABELS: { key: keyof SubScores; label: string }[] = [
  { key: "technical_accuracy", label: "Technical" },
  { key: "communication",      label: "Communication" },
  { key: "star",               label: "STAR structure" },
  { key: "completeness",       label: "Completeness" },
  { key: "confidence",         label: "Confidence" },
  { key: "grammar",            label: "Grammar" },
];

type Result = { score: number; subscores: SubScores };

// ─── Small parts ───────────────────────────────────────────────────────────────

function ScoreStars({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn("h-5 w-5", n <= score ? "fill-amber-400 text-amber-400" : "text-border")}
        />
      ))}
      <span className="ml-2 text-sm font-semibold text-foreground">{score}/5</span>
    </div>
  );
}

function barTone(v: number) {
  return v >= 75 ? "bg-desyn-success" : v >= 50 ? "bg-amber-500" : "bg-destructive";
}

function SubScoreBars({ subscores }: { subscores: SubScores }) {
  return (
    <div className="grid gap-x-5 gap-y-2.5 sm:grid-cols-2">
      {SUBSCORE_LABELS.map(({ key, label }) => {
        const v = Math.max(0, Math.min(100, Math.round(subscores?.[key] ?? 0)));
        return (
          <div key={key}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-semibold tabular-nums text-foreground">{v}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full transition-all duration-700", barTone(v))}
                style={{ width: `${v}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Feedback card ────────────────────────────────────────────────────────────

function FeedbackCard({
  evaluation, onNext, isLast,
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
    evaluation.score >= 3 ? "text-desyn-warning" : "text-destructive";

  return (
    <div className="space-y-4">
      {/* Score + subscores */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <ScoreStars score={evaluation.score} />
          <span className={cn("text-sm font-semibold", scoreColor)}>{scoreLabel}</span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{evaluation.summary}</p>
        <div className="mt-5 border-t border-border pt-4">
          <SubScoreBars subscores={evaluation.subscores} />
        </div>
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
        <div className="rounded-xl border border-desyn-warning/30 bg-desyn-warning/15 p-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-desyn-warning">
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
            <Sparkles className="h-4 w-4 text-desyn-accent" /> Model answer
          </span>
          {modelOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
        {modelOpen && (
          <div className="border-t border-border px-4 pb-4 pt-3">
            <p className="text-sm leading-relaxed text-muted-foreground">{evaluation.model_answer}</p>
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

// ─── Out-of-tokens upsell ───────────────────────────────────────────────────────

function TokenWall({ balance }: { balance: number }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
        <Lock className="h-4 w-4" /> Out of tokens
      </p>
      <p className="mt-1.5 text-sm text-muted-foreground">
        A written evaluation costs {TOKEN_COST} tokens — you have {balance.toLocaleString()}.
        Upgrade your plan or top up to keep practicing.
      </p>
      <Link
        href="/dashboard/billing"
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        <Coins className="h-4 w-4" /> Get more tokens
      </Link>
    </div>
  );
}

// ─── Summary screen ───────────────────────────────────────────────────────────

function SessionSummary({
  results, avgSubscores, onRestart,
}: {
  results: Result[];
  avgSubscores: SubScores;
  onRestart: () => void;
}) {
  const scores = results.map((r) => r.score);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const rounded = Math.round(avg * 10) / 10;

  const overallLabel =
    avg >= 4.5 ? "Outstanding" :
    avg >= 4   ? "Strong" :
    avg >= 3   ? "Solid" :
    avg >= 2   ? "Developing" : "Needs practice";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Written interview complete
        </p>
        <div className="mt-5 flex justify-center">
          <StatRing
            value={(avg / 5) * 100}
            label={`${rounded}`}
            sublabel="of 5"
            tone={avg >= 4 ? "success" : avg >= 3 ? "warning" : "brand"}
            size={150}
          />
        </div>
        <p className="mt-3 text-lg font-semibold text-foreground">{overallLabel}</p>

        <div className="mt-6 border-t border-border pt-6 text-left">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Average across {results.length} answers
          </p>
          <SubScoreBars subscores={avgSubscores} />
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-6">
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
          <RotateCcw className="mr-1.5 h-4 w-4" /> Practice again
        </Button>
      </div>
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

function avgSub(results: Result[]): SubScores {
  const keys = SUBSCORE_LABELS.map((s) => s.key);
  const acc = Object.fromEntries(keys.map((k) => [k, 0])) as Record<keyof SubScores, number>;
  for (const r of results) {
    for (const k of keys) acc[k] += r.subscores?.[k] ?? 0;
  }
  const n = results.length || 1;
  return Object.fromEntries(keys.map((k) => [k, Math.round(acc[k] / n)])) as unknown as SubScores;
}

export function MockInterviewView({
  jobId, prep, onGenerate, generating,
}: {
  jobId: string;
  prep: InterviewPrep | null;
  onGenerate: () => void;
  generating: boolean;
}) {
  const allQuestions: InterviewQuestion[] = prep?.questions ?? [];
  const [stage, setStage] = useState<Stage>({ type: "intro" });
  const [answer, setAnswer] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [interviewType, setInterviewType] = useState<InterviewType>("mixed");
  const [balance, setBalance] = useState<number | null>(null);
  const [tokenWall, setTokenWall] = useState(false);

  // Filter the question pool to the chosen interview type (fall back to all).
  const typeCats = TYPE_OPTIONS.find((t) => t.value === interviewType)?.cats ?? [];
  const filtered = allQuestions.filter((q) => typeCats.includes(q.category));
  const questions = (filtered.length >= 3 ? filtered : allQuestions).slice(0, MOCK_Q_COUNT);

  useEffect(() => {
    fetch("/api/tokens").then((r) => r.json()).then((j) => { if (j.data) setBalance(j.data.balance); }).catch(() => {});
  }, []);

  const reset = useCallback(() => {
    setStage({ type: "intro" });
    setAnswer("");
    setResults([]);
    setTokenWall(false);
  }, []);

  const submitAnswer = useCallback(async (qIndex: number) => {
    const q = questions[qIndex];
    if (!q || !answer.trim()) return;

    setStage({ type: "evaluating", qIndex });
    setTokenWall(false);

    const res = await fetch(`/api/jobs/${jobId}/mock-interview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q.question, answer: answer.trim(), category: q.category, interview_type: interviewType }),
    });
    const json = await res.json();

    if (res.status === 402 || json.upgrade_required) {
      setBalance(json.balance ?? 0);
      setTokenWall(true);
      promptUpgrade(json.error);
      setStage({ type: "answering", qIndex });
      return;
    }
    if (!res.ok) {
      alert(json.error ?? "Evaluation failed.");
      setStage({ type: "answering", qIndex });
      return;
    }

    const evaluation: MockEvaluation = json.data;
    if (typeof evaluation.balance === "number") setBalance(evaluation.balance);
    setResults((prev) => [...prev, { score: evaluation.score, subscores: evaluation.subscores }]);
    setStage({ type: "feedback", qIndex, evaluation });
    setAnswer("");
  }, [jobId, questions, answer, interviewType]);

  const goNext = useCallback((qIndex: number) => {
    const nextIndex = qIndex + 1;
    if (nextIndex >= questions.length) {
      // Persist the completed session (fire-and-forget) for history / analytics.
      fetch(`/api/jobs/${jobId}/mock-interview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "finalize",
          interview_type: interviewType,
          scores: results.map((r) => r.score),
          subscores: avgSub(results),
          tokens_spent: results.length * TOKEN_COST,
        }),
      }).catch(() => {});
      setStage({ type: "complete" });
    } else {
      setStage({ type: "answering", qIndex: nextIndex });
    }
  }, [questions.length, jobId, interviewType, results]);

  // ── Empty / generate ────────────────────────────────────────────────────────
  if (!prep && !generating) {
    return (
      <EmptyState
        icon={<Mic2 className="h-7 w-7" />}
        title="Practice your interview"
        body="Answer questions one at a time and get instant AI feedback scored across six dimensions — technical accuracy, communication, STAR structure, completeness, confidence, and grammar."
        cta="Generate questions"
        onClick={onGenerate}
      />
    );
  }
  if (generating && !prep) return <RunningState label="Generating interview questions…" />;
  if (!prep || allQuestions.length === 0) return null;

  // ── Intro ────────────────────────────────────────────────────────────────────
  if (stage.type === "intro") {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Mic2 className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-lg font-semibold">AI Written Coach</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Pick an interview style, then answer each question as if it&apos;s the real thing.
          </p>

          {/* Interview type selector */}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {TYPE_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setInterviewType(value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                  interviewType === value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            {questions.length} questions · {TOKEN_COST} tokens per answer
          </p>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Coins className="h-4 w-4 text-desyn-accent" /> Your balance
          </span>
          <TokenBalance value={balance ?? undefined} />
        </div>

        <Button className="w-full" size="lg" onClick={() => setStage({ type: "answering", qIndex: 0 })}>
          Start session <ChevronRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    );
  }

  // ── Complete ─────────────────────────────────────────────────────────────────
  if (stage.type === "complete") {
    return <SessionSummary results={results} avgSubscores={avgSub(results)} onRestart={reset} />;
  }

  const { qIndex } = stage;
  const q = questions[qIndex];
  const meta = CATEGORY_META[q.category] ?? CATEGORY_META.role;
  const progress = (qIndex / questions.length) * 100;

  return (
    <div className="space-y-5">
      {/* Progress + balance */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Question {qIndex + 1} of {questions.length}</span>
          <div className="flex items-center gap-3">
            <TokenBalance value={balance ?? undefined} />
            <button onClick={reset} className="flex items-center gap-1 transition-colors hover:text-foreground">
              <RotateCcw className="h-3 w-3" /> Restart
            </button>
          </div>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-gradient-brand transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Question */}
      <div className="rounded-xl border border-border bg-card p-5">
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", meta.color)}>{meta.label}</span>
        <p className="mt-3 text-base font-semibold leading-snug">{q.question}</p>
        <p className="mt-1 text-xs text-muted-foreground">{q.why_asked}</p>
      </div>

      {/* Answer / evaluating / feedback */}
      {stage.type === "answering" && (
        <div className="space-y-3">
          {tokenWall && balance !== null && <TokenWall balance={balance} />}
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your answer here… treat it like the real thing."
            rows={6}
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{answer.trim().split(/\s+/).filter(Boolean).length} words</span>
            <span>Aim for 100–200 words for most questions</span>
          </div>
          <Button
            className="w-full"
            onClick={() => submitAnswer(qIndex)}
            disabled={answer.trim().split(/\s+/).filter(Boolean).length < 5}
          >
            Submit answer <ChevronRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      )}

      {stage.type === "evaluating" && (
        <div className="flex items-center justify-center gap-3 rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" /> Evaluating your answer…
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
