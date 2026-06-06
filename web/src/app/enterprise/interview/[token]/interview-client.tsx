"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type Question = { id: string; type: string; question: string; max_score: number };

const TYPE_BADGE: Record<string, string> = {
  behavioral:   "bg-blue-500/15 text-blue-400",
  technical:    "bg-purple-500/15 text-purple-400",
  leadership:   "bg-amber-500/15 text-amber-400",
  situational:  "bg-cyan-500/15 text-cyan-400",
  culture:      "bg-green-500/15 text-green-400",
};

export default function InterviewClient({
  token, candidateName, jobTitle, orgName, questions,
}: {
  token: string; candidateName: string; jobTitle: string; orgName: string;
  questions: Question[];
}) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const q = questions[current];
  const answered = questions.filter((q) => (answers[q.id] ?? "").trim().length > 50).length;
  const progress = Math.round((answered / questions.length) * 100);

  const submit = async () => {
    const missing = questions.filter((q) => !(answers[q.id]?.trim()));
    if (missing.length > 0) { setError(`Please answer all questions. ${missing.length} remaining.`); return; }
    setSubmitting(true); setError("");
    try {
      const res = await fetch(`/api/enterprise/interview/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Submission failed."); return; }
      setDone(true);
    } finally { setSubmitting(false); }
  };

  if (done) return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center text-foreground">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/15 mb-5">
        <CheckCircle2 className="h-10 w-10 text-green-400" />
      </div>
      <h1 className="text-2xl font-bold">Interview submitted!</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        Thank you, {candidateName}. Your responses have been sent to {orgName}. They will review and be in touch soon.
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 py-4 text-center sm:px-6">
        <p className="text-sm font-semibold text-primary">{orgName}</p>
        <h1 className="mt-1 text-lg font-bold">{jobTitle} — Interview</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Hi {candidateName} — take your time, be specific and give examples.</p>
      </div>

      {/* Progress */}
      <div className="border-b border-border bg-card px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
          <div className="flex-1">
            <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
              <span>{answered}/{questions.length} answered</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="flex gap-1">
            {questions.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)}
                className={cn("h-2.5 w-2.5 rounded-full transition-colors", i === current ? "bg-primary" : (answers[questions[i].id]?.trim().length ?? 0) > 50 ? "bg-green-400" : "bg-muted")} />
            ))}
          </div>
        </div>
      </div>

      {/* Question */}
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold capitalize", TYPE_BADGE[q?.type ?? "behavioral"] ?? TYPE_BADGE.behavioral)}>
              {q?.type}
            </span>
            <span className="text-xs text-muted-foreground">Question {current + 1} of {questions.length}</span>
          </div>

          <h2 className="text-lg font-semibold leading-snug">{q?.question}</h2>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {q?.type === "behavioral" ? "Use the STAR method: Situation, Task, Action, Result." : "Be specific and use concrete examples."}
          </p>

          <textarea
            value={answers[q?.id ?? ""] ?? ""}
            onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
            placeholder="Type your answer here…"
            rows={8}
            className="mt-4 w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
          />
          <div className="mt-1.5 flex justify-end">
            <span className={cn("text-xs", (answers[q?.id ?? ""]?.length ?? 0) < 50 ? "text-muted-foreground/60" : "text-muted-foreground")}>
              {answers[q?.id ?? ""]?.length ?? 0} chars {(answers[q?.id ?? ""]?.length ?? 0) < 50 ? "(min ~50)" : ""}
            </span>
          </div>
        </div>

        {/* Nav */}
        <div className="mt-4 flex items-center justify-between">
          <button onClick={() => setCurrent((c) => Math.max(0, c - 1))} disabled={current === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors">
            <ChevronLeft className="h-4 w-4" /> Previous
          </button>

          {current < questions.length - 1 ? (
            <button onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}
              className="btn-cta inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold">
              Next <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={submit} disabled={submitting}
              className="btn-cta inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold disabled:opacity-60">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {submitting ? "Submitting…" : "Submit interview"}
            </button>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        {/* Question overview */}
        <div className="mt-8 rounded-2xl border border-border bg-card p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">All questions</p>
          <div className="space-y-1.5">
            {questions.map((question, i) => (
              <button key={question.id} onClick={() => setCurrent(i)}
                className={cn("flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  i === current ? "bg-primary/10 text-primary" : "hover:bg-muted")}>
                <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  (answers[question.id]?.trim().length ?? 0) > 50 ? "bg-green-500 text-white" : "bg-muted text-muted-foreground")}>
                  {(answers[question.id]?.trim().length ?? 0) > 50 ? "✓" : i + 1}
                </span>
                <span className="truncate text-xs">{question.question.slice(0, 70)}…</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
