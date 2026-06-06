"use client";

import { useState, useRef, useEffect } from "react";
import { CheckCircle2, Loader2, MapPin, Briefcase, MessageCircle, X, Send, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

interface JobInfo {
  id: string; title: string; department: string | null;
  location: string | null; employment_type: string;
  description: string | null; responsibilities: string | null;
  qualifications: string | null; salary_min: number | null;
  salary_max: number | null; salary_currency: string;
}

// ── AI Concierge Widget ───────────────────────────────────────────────────────
function ConciergeWidget({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "bot"; text: string }[]>([
    { role: "bot", text: "Hi! I'm the recruiting assistant for this role. Ask me anything about the position, salary, remote work, or the hiring process." },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

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
        body: JSON.stringify({
          jobId,
          messages: next.map((m) => ({ role: m.role === "bot" ? "assistant" : "user", content: m.text })),
        }),
      });
      const json = await res.json();
      setMessages((m) => [...m, { role: "bot", text: json.reply ?? "I'm not sure — please email the hiring team directly." }]);
    } finally {
      setThinking(false);
    }
  };

  const SUGGESTED = ["What's the salary range?", "Is this role remote?", "What does the interview process look like?"];

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      {open && (
        <div className="mb-3 flex h-[26rem] w-80 flex-col overflow-hidden rounded-2xl border border-white/10 bg-gray-900 text-white shadow-2xl">
          <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              <p className="text-sm font-semibold">Recruiting Concierge</p>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-md p-0.5 hover:bg-white/15">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-sm", m.role === "user" ? "rounded-br-sm bg-blue-600" : "rounded-bl-sm bg-white/10")}>
                  {m.text}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-white/10 px-3 py-2 text-sm text-white/60">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
                </div>
              </div>
            )}
            {messages.length <= 1 && !thinking && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SUGGESTED.map((s) => (
                  <button key={s} onClick={() => send(s)}
                    className="rounded-full border border-white/20 px-2.5 py-1 text-xs text-white/70 hover:bg-white/10 transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2 border-t border-white/10 p-2">
            <input value={input} onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about the role…"
              className="flex-1 rounded-xl bg-white/10 px-3 py-2 text-sm outline-none placeholder:text-white/40"
              disabled={thinking} />
            <button type="submit" disabled={thinking || !input.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 disabled:opacity-40">
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)}
        className="flex h-13 w-13 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-purple-600 p-3.5 shadow-lg hover:shadow-xl transition-shadow"
        aria-label="Ask about this role">
        {open ? <X className="h-5 w-5 text-white" /> : <MessageCircle className="h-5 w-5 text-white" />}
      </button>
    </div>
  );
}

interface Branding {
  logo_url: string | null;
  brand_color: string;
  tagline: string | null;
  show_powered_by: boolean;
  slug: string | null;
}

export default function ApplyForm({ job, orgName, branding }: { job: JobInfo; orgName: string; branding?: Branding }) {
  const brand = branding?.brand_color ?? "#2563eb";
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
      const res = await fetch(`/api/enterprise/jobs/${job.id}/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source: "direct" }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Submission failed. Please try again."); return; }
      setDone(true);
    } finally { setSubmitting(false); }
  };

  if (done) return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center text-foreground">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/15 mb-6">
        <CheckCircle2 className="h-10 w-10 text-green-400" />
      </div>
      <h1 className="text-2xl font-bold">Application submitted!</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        Thank you for applying to <strong>{job.title}</strong> at {orgName}. We&apos;ll review your application and be in touch soon.
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ConciergeWidget jobId={job.id} />
      {/* Job header */}
      <div className="border-b border-border bg-card px-4 py-8 text-center sm:px-6"
        style={{ background: `linear-gradient(180deg, ${brand}14, transparent)` }}>
        {branding?.logo_url ? (
          <img src={branding.logo_url} alt={orgName} className="mx-auto mb-3 h-12 object-contain" />
        ) : null}
        <p className="text-sm font-semibold" style={{ color: brand }}>{orgName}</p>
        {branding?.tagline && <p className="mt-0.5 text-xs text-muted-foreground">{branding.tagline}</p>}
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{job.title}</h1>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
          {job.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.location}</span>}
          <span className="flex items-center gap-1 capitalize"><Briefcase className="h-3.5 w-3.5" />{job.employment_type}</span>
          {job.salary_min && job.salary_max && (
            <span>${job.salary_min.toLocaleString()}–${job.salary_max.toLocaleString()} {job.salary_currency}</span>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-5">
          {/* Job details */}
          <div className="lg:col-span-2 space-y-4">
            {job.description && (
              <div>
                <h3 className="mb-2 font-semibold">About the role</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{job.description}</p>
              </div>
            )}
            {job.responsibilities && (
              <div>
                <h3 className="mb-2 font-semibold">Responsibilities</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{job.responsibilities}</p>
              </div>
            )}
            {job.qualifications && (
              <div>
                <h3 className="mb-2 font-semibold">Requirements</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{job.qualifications}</p>
              </div>
            )}
          </div>

          {/* Application form */}
          <div className="lg:col-span-3">
            <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-6 space-y-4">
              <h2 className="font-semibold text-lg">Apply for this role</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Full name *</label>
                  <input required value={form.candidate_name} onChange={(e) => set("candidate_name", e.target.value)}
                    placeholder="Jane Smith"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Email *</label>
                  <input required type="email" value={form.candidate_email} onChange={(e) => set("candidate_email", e.target.value)}
                    placeholder="jane@example.com"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Phone</label>
                  <input type="tel" value={form.candidate_phone} onChange={(e) => set("candidate_phone", e.target.value)}
                    placeholder="+1 555 000 0000"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">LinkedIn URL</label>
                  <input value={form.linkedin_url} onChange={(e) => set("linkedin_url", e.target.value)}
                    placeholder="https://linkedin.com/in/…"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Portfolio / website</label>
                <input value={form.portfolio_url} onChange={(e) => set("portfolio_url", e.target.value)}
                  placeholder="https://…"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Cover letter</label>
                <textarea value={form.cover_letter} onChange={(e) => set("cover_letter", e.target.value)}
                  rows={5} placeholder="Tell us why you're a great fit…"
                  className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground" />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <button type="submit" disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ background: brand }}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? "Submitting…" : "Submit application"}
              </button>
            </form>
          </div>
        </div>

        {/* Branded footer */}
        <div className="mt-10 border-t border-border pt-6 text-center">
          {branding?.slug && (
            <a href={`/careers/${branding.slug}`} className="text-sm font-medium hover:underline" style={{ color: brand }}>
              View all {orgName} openings →
            </a>
          )}
          {branding?.show_powered_by !== false && (
            <p className="mt-2 text-xs text-muted-foreground">
              Powered by <a href="https://jobsai.work" target="_blank" rel="noopener noreferrer" className="hover:underline">JobsAI.Work</a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
