"use client";

import { use, useEffect, useState } from "react";
import { CheckCircle2, Loader2, MessageSquareQuote } from "lucide-react";

export default function ReferenceFormPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<{ referee_name: string; candidate_name: string; questions: { id: string; question: string }[] } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/enterprise/reference/${token}`).then((r) => r.json()).then((j) => {
      if (j.data) setData(j.data); else setError(j.error ?? "Not found.");
    });
  }, [token]);

  const submit = async () => {
    if (!data) return;
    const responses = data.questions.map((q) => ({ question: q.question, answer: answers[q.id] ?? "" }));
    if (responses.some((r) => !r.answer.trim())) { setError("Please answer all questions."); return; }
    setSubmitting(true); setError("");
    const res = await fetch(`/api/enterprise/reference/${token}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ responses }),
    });
    if (res.ok) setDone(true); else setError("Submission failed.");
    setSubmitting(false);
  };

  if (done) return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center text-foreground">
      <CheckCircle2 className="mb-4 h-14 w-14 text-green-400" />
      <h1 className="text-2xl font-bold">Thank you!</h1>
      <p className="mt-2 max-w-md text-muted-foreground">Your reference has been submitted. We appreciate your time.</p>
    </div>
  );

  if (error && !data) return (
    <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">{error}</div>
  );
  if (!data) return (
    <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border bg-card px-4 py-8 text-center">
        <MessageSquareQuote className="mx-auto mb-2 h-7 w-7 text-primary" />
        <h1 className="text-xl font-bold">Reference for {data.candidate_name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Hi {data.referee_name} — please answer honestly. Takes ~3 minutes.</p>
      </div>
      <div className="mx-auto max-w-xl px-4 py-8 space-y-5">
        {data.questions.map((q, i) => (
          <div key={q.id} className="rounded-2xl border border-border bg-card p-5">
            <p className="mb-2 text-sm font-medium">{i + 1}. {q.question}</p>
            <textarea value={answers[q.id] ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
              rows={3} placeholder="Your answer…"
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
        ))}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button onClick={submit} disabled={submitting}
          className="btn-cta flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold disabled:opacity-60">
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Submit reference
        </button>
      </div>
    </div>
  );
}
