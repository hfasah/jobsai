"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, Bot, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";

function ConciergeWidget({ jobId, brand }: { jobId: string; brand: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "bot"; text: string }[]>([
    { role: "bot", text: "Hi! I'm the recruiting assistant for this role. Ask me anything about the position, salary, or the hiring process." },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);

  const send = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q) return;
    setInput("");
    const next = [...messages, { role: "user" as const, text: q }];
    setMessages(next);
    setThinking(true);
    try {
      const res = await fetch("/api/enterprise/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, messages: next.map((m) => ({ role: m.role === "bot" ? "assistant" : "user", content: m.text })) }),
      });
      const json = await res.json();
      setMessages((m) => [...m, { role: "bot", text: json.reply ?? "I'm not sure — please email the hiring team." }]);
    } finally { setThinking(false); }
  };

  const SUGGESTED = ["What's the salary range?", "Is this remote?", "What does the interview look like?"];

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      {open && (
        <div className="mb-3 flex h-96 w-80 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3 text-white" style={{ background: brand }}>
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              <p className="text-sm font-semibold">Ask about this role</p>
            </div>
            <button onClick={() => setOpen(false)}><X className="h-4 w-4" /></button>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-sm", m.role === "user" ? "text-white rounded-br-sm" : "bg-slate-100 text-slate-800 rounded-bl-sm")}
                  style={m.role === "user" ? { background: brand } : undefined}>
                  {m.text}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex"><div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-slate-100 px-3 py-2 text-sm text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…</div></div>
            )}
            {messages.length <= 1 && !thinking && (
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED.map((s) => (
                  <button key={s} onClick={() => send(s)}
                    className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2 border-t border-slate-200 p-2">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask anything…"
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2" style={{ "--tw-ring-color": brand } as React.CSSProperties}
              disabled={thinking} />
            <button type="submit" disabled={thinking || !input.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white disabled:opacity-40"
              style={{ background: brand }}>
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)}
        className="flex h-13 w-13 items-center justify-center rounded-full p-3.5 text-white shadow-lg hover:shadow-xl transition-shadow"
        style={{ background: brand }}>
        {open ? <X className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
      </button>
    </div>
  );
}

interface CareerApplyFormProps {
  jobId: string;
  jobTitle: string;
  orgName: string;
  brand: string;
}

export function CareerApplyForm({ jobId, jobTitle, orgName, brand }: CareerApplyFormProps) {
  const [form, setForm] = useState({ candidate_name: "", candidate_email: "", candidate_phone: "", linkedin_url: "", portfolio_url: "", cover_letter: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.candidate_name.trim() || !form.candidate_email.trim()) { setError("Name and email are required."); return; }
    setSubmitting(true); setError("");
    try {
      const res = await fetch(`/api/enterprise/jobs/${jobId}/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source: "careers_page" }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Submission failed. Please try again."); return; }
      setDone(true);
    } finally { setSubmitting(false); }
  };

  if (done) return (
    <div className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center">
      <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-green-500" />
      <h3 className="text-lg font-bold text-slate-900">Application submitted!</h3>
      <p className="mt-2 text-sm text-slate-600">
        Thanks for applying to <strong>{jobTitle}</strong> at {orgName}. We&apos;ll review your application and be in touch.
      </p>
    </div>
  );

  return (
    <>
      <ConciergeWidget jobId={jobId} brand={brand} />
      <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900">Apply for this role</h2>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Full name *</label>
          <input required value={form.candidate_name} onChange={(e) => set("candidate_name", e.target.value)}
            placeholder="Jane Smith"
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
            style={{ "--tw-ring-color": brand } as React.CSSProperties} />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Email *</label>
          <input required type="email" value={form.candidate_email} onChange={(e) => set("candidate_email", e.target.value)}
            placeholder="jane@example.com"
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
            style={{ "--tw-ring-color": brand } as React.CSSProperties} />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Phone</label>
          <input type="tel" value={form.candidate_phone} onChange={(e) => set("candidate_phone", e.target.value)}
            placeholder="+1 555 000 0000"
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
            style={{ "--tw-ring-color": brand } as React.CSSProperties} />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">LinkedIn</label>
          <input value={form.linkedin_url} onChange={(e) => set("linkedin_url", e.target.value)}
            placeholder="https://linkedin.com/in/…"
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
            style={{ "--tw-ring-color": brand } as React.CSSProperties} />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Cover letter</label>
          <textarea value={form.cover_letter} onChange={(e) => set("cover_letter", e.target.value)}
            rows={4} placeholder="Tell us why you're a great fit…"
            className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent placeholder:text-slate-400"
            style={{ "--tw-ring-color": brand } as React.CSSProperties} />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={submitting}
          className="w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-60 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          style={{ background: brand }}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? "Submitting…" : "Submit application"}
        </button>
      </form>
    </>
  );
}
