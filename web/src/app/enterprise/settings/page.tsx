"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, Send, Loader2, Sparkles, Copy, Check, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Recruiter Copilot ─────────────────────────────────────────────────────────
function RecruiterCopilot() {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const SUGGESTED = [
    "Find candidates with a match score above 70%",
    "Compare the top 3 candidates for any open role",
    "Which source is generating the best quality applicants?",
    "Show me all candidates in the interview stage",
    "Who should we advance to offer stage?",
  ];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q) return;
    setInput("");
    const newMessages = [...messages, { role: "user" as const, content: q }];
    setMessages(newMessages);
    setThinking(true);
    try {
      const res = await fetch("/api/enterprise/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, history: messages }),
      });
      const json = await res.json();
      setMessages([...newMessages, { role: "assistant", content: json.reply ?? "I couldn't find an answer." }]);
    } finally { setThinking(false); }
  };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border bg-gradient-brand px-5 py-4">
        <Bot className="h-5 w-5 text-white" />
        <div>
          <p className="font-semibold text-white">Recruiter Copilot</p>
          <p className="text-xs text-white/70">Ask anything about your candidates, pipeline, or hiring data</p>
        </div>
      </div>

      <div ref={scrollRef} className="h-80 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div>
            <p className="mb-3 text-sm text-muted-foreground">Try asking:</p>
            <div className="flex flex-col gap-1.5">
              {SUGGESTED.map((s) => (
                <button key={s} onClick={() => send(s)}
                  className="rounded-xl border border-border px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            {m.role === "assistant" && (
              <div className="mr-2 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-brand">
                <Bot className="h-3.5 w-3.5 text-white" />
              </div>
            )}
            <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed",
              m.role === "user" ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted")}>
              {m.content}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex justify-start">
            <div className="mr-2 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-brand">
              <Bot className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching candidates…
            </div>
          </div>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(); }}
        className="flex gap-2 border-t border-border p-3">
        <input value={input} onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about candidates, pipeline, or hiring data…"
          className="h-10 flex-1 rounded-xl border border-border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
          disabled={thinking} />
        <button type="submit" disabled={thinking || !input.trim()}
          className="btn-cta flex h-10 w-10 items-center justify-center rounded-xl disabled:opacity-40">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

// ── AI Outreach Generator ─────────────────────────────────────────────────────
const OUTREACH_TYPES = [
  { value: "offer_letter",      label: "Offer letter" },
  { value: "rejection",         label: "Rejection email" },
  { value: "interview_invite",  label: "Interview invitation" },
  { value: "outreach",          label: "Proactive outreach" },
  { value: "counter_offer",     label: "Counter-offer response" },
  { value: "reference_request", label: "Reference request" },
];

function OutreachGenerator() {
  const [type, setType] = useState("offer_letter");
  const [form, setForm] = useState({ candidate_name: "", job_title: "", extra_context: "" });
  const [result, setResult] = useState<{ subject: string; body: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setGenerating(true);
    const res = await fetch("/api/enterprise/outreach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ...form }),
    });
    const json = await res.json();
    setResult(json.data);
    setGenerating(false);
  };

  const copy = () => {
    if (!result) return;
    navigator.clipboard.writeText(`Subject: ${result.subject}\n\n${result.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-5">
        <h2 className="font-semibold">AI Outreach Generator</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">Generate professional recruiting emails and letters in seconds.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Email type</label>
          <select value={type} onChange={(e) => setType(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            {OUTREACH_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Candidate name</label>
          <input value={form.candidate_name} onChange={(e) => setForm((f) => ({ ...f, candidate_name: e.target.value }))}
            placeholder="Jane Smith"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Role</label>
          <input value={form.job_title} onChange={(e) => setForm((f) => ({ ...f, job_title: e.target.value }))}
            placeholder="Senior Full-Stack Engineer"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Extra context</label>
          <input value={form.extra_context} onChange={(e) => setForm((f) => ({ ...f, extra_context: e.target.value }))}
            placeholder="Salary $120k, start Jan 15…"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
      </div>

      <button onClick={generate} disabled={generating}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-4 py-2 text-sm font-semibold text-white shadow-glow disabled:opacity-60">
        {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {generating ? "Generating…" : "Generate email"}
      </button>

      {result && (
        <div className="mt-5 rounded-xl border border-border bg-background/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Generated email</p>
            <div className="flex gap-2">
              <button onClick={() => setResult(null)} className="rounded p-1 text-muted-foreground hover:text-foreground">
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
              <button onClick={copy} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">
                {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
          <p className="mb-3 text-sm font-semibold">Subject: {result.subject}</p>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{result.body}</p>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  return (
    <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recruiter Tools</h1>
          <p className="mt-1 text-sm text-muted-foreground">AI tools to supercharge your recruiting workflow.</p>
        </div>
        <RecruiterCopilot />
        <OutreachGenerator />
      </div>
    </main>
  );
}
