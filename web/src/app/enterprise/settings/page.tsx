"use client";

import { useState, useRef, useEffect } from "react";
import {
  Bot, Send, Loader2, Sparkles, Copy, Check, RefreshCw,
  Users, Plus, Trash2, Link2, Download, Shield, Mail,
  CheckCircle2, AlertCircle, RotateCcw, Clock,
  Palette, Code2, ExternalLink,
} from "lucide-react";
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
    "Who should we advance to offer stage?",
  ];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q) return;
    setInput("");
    const next = [...messages, { role: "user" as const, content: q }];
    setMessages(next);
    setThinking(true);
    try {
      const res = await fetch("/api/enterprise/copilot", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, history: messages }),
      });
      const json = await res.json();
      setMessages([...next, { role: "assistant", content: json.reply ?? "I couldn't find an answer." }]);
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
      <div ref={scrollRef} className="h-72 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="mb-2 text-sm text-muted-foreground">Try asking:</p>
            {SUGGESTED.map((s) => (
              <button key={s} onClick={() => send(s)}
                className="rounded-xl border border-border px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            {m.role === "assistant" && (
              <div className="mr-2 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-brand">
                <Bot className="h-3.5 w-3.5 text-white" />
              </div>
            )}
            <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap",
              m.role === "user" ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted")}>
              {m.content}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex justify-start">
            <div className="mr-2 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-brand">
              <Bot className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="flex items-center gap-1.5 rounded-2xl bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
            </div>
          </div>
        )}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2 border-t border-border p-3">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about candidates or hiring data…"
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
  { value: "offer_letter", label: "Offer letter" },
  { value: "rejection", label: "Rejection email" },
  { value: "interview_invite", label: "Interview invitation" },
  { value: "outreach", label: "Proactive outreach" },
  { value: "counter_offer", label: "Counter-offer response" },
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
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ...form }),
    });
    setResult((await res.json()).data);
    setGenerating(false);
  };

  const copy = () => {
    if (!result) return;
    navigator.clipboard.writeText(`Subject: ${result.subject}\n\n${result.body}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="mb-1 font-semibold">AI Outreach Generator</h2>
      <p className="mb-4 text-sm text-muted-foreground">Professional recruiting emails written in seconds.</p>
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
            placeholder="Jane Smith" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Role</label>
          <input value={form.job_title} onChange={(e) => setForm((f) => ({ ...f, job_title: e.target.value }))}
            placeholder="Senior Engineer" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Context (optional)</label>
          <input value={form.extra_context} onChange={(e) => setForm((f) => ({ ...f, extra_context: e.target.value }))}
            placeholder="Salary $120k, start Jan 15" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
      </div>
      <button onClick={generate} disabled={generating}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-4 py-2 text-sm font-semibold text-white shadow-glow disabled:opacity-60">
        {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {generating ? "Generating…" : "Generate email"}
      </button>
      {result && (
        <div className="mt-4 rounded-xl border border-border bg-background/60 p-4">
          <div className="mb-2 flex justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Generated</p>
            <div className="flex gap-2">
              <button onClick={() => setResult(null)} className="rounded p-1 text-muted-foreground hover:text-foreground"><RefreshCw className="h-3.5 w-3.5" /></button>
              <button onClick={copy} className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted">
                {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
          <p className="mb-2 text-sm font-semibold">Subject: {result.subject}</p>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{result.body}</p>
        </div>
      )}
    </div>
  );
}

// ── ATS Integrations ──────────────────────────────────────────────────────────
const PROVIDERS = [
  { id: "greenhouse",  label: "Greenhouse",  logo: "🌿", hint: "Harvest API key from Settings → API Credential Management" },
  { id: "lever",       label: "Lever",       logo: "⚙️", hint: "API key from Settings → Integrations → API Credentials" },
  { id: "ashby",       label: "Ashby",       logo: "🔷", hint: "API key from Settings → Integrations" },
  { id: "bamboohr",    label: "BambooHR",    logo: "🎋", hint: "API key from your BambooHR profile → API Keys. Also enter your subdomain." },
  { id: "workday",     label: "Workday",     logo: "🔵", hint: "Contact your Workday admin for API credentials. Custom integration available on request." },
];

interface Integration { id: string; provider: string; enabled: boolean; last_sync: string | null }

function IntegrationsSettings() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, { api_key: string; subdomain: string }>>({});
  const [syncResults, setSyncResults] = useState<Record<string, { imported: number }>>({});

  useEffect(() => {
    fetch("/api/enterprise/integrations").then((r) => r.json()).then((j) => setIntegrations(j.data ?? []));
  }, []);

  const connect = async (provider: string) => {
    const f = form[provider] ?? {};
    if (!f.api_key?.trim()) return;
    setConnecting(provider);
    const res = await fetch("/api/enterprise/integrations", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, api_key: f.api_key, subdomain: f.subdomain }),
    });
    const json = await res.json();
    if (json.data) setIntegrations((i) => [...i.filter((x) => x.provider !== provider), json.data]);
    setConnecting(null);
  };

  const sync = async (provider: string) => {
    setSyncing(provider);
    const res = await fetch("/api/enterprise/integrations/sync", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
    const json = await res.json();
    if (json.imported !== undefined) setSyncResults((r) => ({ ...r, [provider]: { imported: json.imported } }));
    setIntegrations((i) => i.map((x) => x.provider === provider ? { ...x, last_sync: new Date().toISOString() } : x));
    setSyncing(null);
  };

  const disconnect = async (provider: string) => {
    await fetch("/api/enterprise/integrations", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
    setIntegrations((i) => i.filter((x) => x.provider !== provider));
  };

  return (
    <div className="space-y-4">
      {PROVIDERS.map((p) => {
        const connected = integrations.find((i) => i.provider === p.id);
        const f = form[p.id] ?? { api_key: "", subdomain: "" };
        const syncResult = syncResults[p.id];
        return (
          <div key={p.id} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{p.logo}</span>
                <div>
                  <p className="font-semibold">{p.label}</p>
                  <p className="text-xs text-muted-foreground">{p.hint}</p>
                </div>
              </div>
              {connected && (
                <span className="flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-1 text-xs font-medium text-green-400">
                  <CheckCircle2 className="h-3 w-3" /> Connected
                </span>
              )}
            </div>
            {connected ? (
              <div className="flex flex-wrap items-center gap-2">
                {connected.last_sync && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" /> Last sync: {new Date(connected.last_sync).toLocaleDateString()}
                  </span>
                )}
                {syncResult && <span className="text-xs text-green-400">✓ {syncResult.imported} jobs imported</span>}
                <button onClick={() => sync(p.id)} disabled={syncing === p.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50">
                  {syncing === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                  Sync jobs
                </button>
                <button onClick={() => disconnect(p.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" /> Disconnect
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <input value={f.api_key} onChange={(e) => setForm((fm) => ({ ...fm, [p.id]: { ...f, api_key: e.target.value } }))}
                  placeholder="API key" type="password"
                  className="flex-1 min-w-40 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                {p.id === "bamboohr" && (
                  <input value={f.subdomain} onChange={(e) => setForm((fm) => ({ ...fm, [p.id]: { ...f, subdomain: e.target.value } }))}
                    placeholder="Subdomain (e.g. acme)"
                    className="w-40 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                )}
                <button onClick={() => connect(p.id)} disabled={connecting === p.id || !f.api_key.trim()}
                  className="btn-cta inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60">
                  {connecting === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  Connect
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Email Templates ───────────────────────────────────────────────────────────
interface EmailTemplate { trigger: string; subject: string; body: string; active: boolean }

const TRIGGER_LABELS: Record<string, string> = {
  application_received: "Application received (auto-sent on apply)",
  interview_invited:    "Interview invitation",
  offer_sent:           "Offer extended",
  rejected:             "Rejection",
};

function EmailTemplatesSettings() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/enterprise/email-templates").then((r) => r.json()).then((j) => setTemplates(j.data ?? []));
  }, []);

  const save = async (t: EmailTemplate) => {
    setSaving(true);
    await fetch("/api/enterprise/email-templates", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trigger: t.trigger, subject: t.subject, body: t.body, active: t.active }),
    });
    setSaved(t.trigger);
    setTimeout(() => setSaved(null), 2000);
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Customise the emails sent to candidates at each stage. Use <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{"{{candidate_name}}"}</code>, <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{"{{job_title}}"}</code>, <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{"{{org_name}}"}</code>, <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{"{{interview_link}}"}</code> as variables.
      </p>
      {templates.map((t) => (
        <div key={t.trigger} className="rounded-2xl border border-border bg-card overflow-hidden">
          <button onClick={() => setEditing(editing === t.trigger ? null : t.trigger)}
            className="flex w-full items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-primary" />
              <div className="text-left">
                <p className="text-sm font-medium">{TRIGGER_LABELS[t.trigger] ?? t.trigger}</p>
                <p className="text-xs text-muted-foreground truncate max-w-xs">{t.subject}</p>
              </div>
            </div>
            {saved === t.trigger && <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Saved</span>}
          </button>
          {editing === t.trigger && (
            <div className="border-t border-border px-5 pb-5 pt-4 space-y-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Subject</label>
                <input value={t.subject}
                  onChange={(e) => setTemplates((ts) => ts.map((x) => x.trigger === t.trigger ? { ...x, subject: e.target.value } : x))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Body</label>
                <textarea value={t.body} rows={6}
                  onChange={(e) => setTemplates((ts) => ts.map((x) => x.trigger === t.trigger ? { ...x, body: e.target.value } : x))}
                  className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <button onClick={() => save(t)} disabled={saving}
                className="btn-cta inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save template
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Data & Privacy ────────────────────────────────────────────────────────────
function DataPrivacySettings() {
  const [auditLogs, setAuditLogs] = useState<Array<{ id: string; action: string; user_id: string | null; created_at: string; metadata: Record<string, unknown> }>>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState("");

  useEffect(() => {
    fetch("/api/enterprise/audit-logs?limit=30")
      .then((r) => r.json())
      .then((j) => setAuditLogs(j.data ?? []))
      .finally(() => setLoadingLogs(false));
  }, []);

  const exportData = () => { window.location.href = "/api/enterprise/data"; };

  const deleteCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleting(true);
    const res = await fetch("/api/enterprise/data", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidate_email: deleteEmail }),
    });
    const json = await res.json();
    setDeleteResult(json.message ?? json.error ?? "Done.");
    setDeleting(false);
    setDeleteEmail("");
  };

  return (
    <div className="space-y-6">
      {/* Data export */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Data export</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Download all your organization's data as JSON (GDPR compliant).</p>
          </div>
          <button onClick={exportData}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">
            <Download className="h-4 w-4" /> Export all data
          </button>
        </div>
      </div>

      {/* Candidate data deletion */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-1 font-semibold">Right to erasure (GDPR)</h2>
        <p className="mb-3 text-sm text-muted-foreground">Anonymise a candidate's personal data across all applications and the talent pool.</p>
        <form onSubmit={deleteCandidate} className="flex gap-2">
          <input value={deleteEmail} onChange={(e) => setDeleteEmail(e.target.value)}
            type="email" required placeholder="candidate@email.com"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <button type="submit" disabled={deleting}
            className="inline-flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50">
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Anonymise
          </button>
        </form>
        {deleteResult && <p className="mt-2 text-sm text-green-400">{deleteResult}</p>}
      </div>

      {/* Audit log */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-semibold">Audit log</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Last 30 actions in your organization (SOC2 compliance).</p>
        </div>
        {loadingLogs ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : auditLogs.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">No audit events yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {auditLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-mono text-primary">{log.action}</span>
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {Object.entries(log.metadata).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground shrink-0 ml-4">
                  {new Date(log.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SOC2 readiness checklist */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">SOC2 readiness</h2>
        </div>
        <div className="space-y-2.5">
          {[
            { label: "Audit logging enabled",            done: true },
            { label: "Data export available",             done: true },
            { label: "Right to erasure / GDPR controls",  done: true },
            { label: "Role-based access control (RBAC)",  done: true },
            { label: "Encrypted data at rest (Supabase)", done: true },
            { label: "Team access managed via invitations", done: true },
            { label: "SSO / SAML (via Clerk Enterprise)",  done: false },
            { label: "Penetration test",                   done: false },
            { label: "Formal SOC2 audit",                  done: false },
          ].map(({ label, done }) => (
            <div key={label} className="flex items-center gap-2.5 text-sm">
              {done
                ? <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                : <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />}
              <span className={done ? "text-foreground" : "text-muted-foreground"}>{label}</span>
              {!done && <span className="ml-auto text-[10px] text-amber-400">Pending</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── White-label Branding ──────────────────────────────────────────────────────
function BrandingSettings() {
  const [form, setForm] = useState({ name: "", slug: "", logo_url: "", brand_color: "#2563eb", tagline: "", careers_intro: "", show_powered_by: true, website: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/enterprise/branding").then((r) => r.json()).then((j) => {
      if (j.data) setForm((f) => ({ ...f, ...j.data, logo_url: j.data.logo_url ?? "", tagline: j.data.tagline ?? "", careers_intro: j.data.careers_intro ?? "", website: j.data.website ?? "" }));
    }).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true); setSaved(false);
    await fetch("/api/enterprise/branding", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setSaved(true); setSaving(false);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const careersUrl = typeof window !== "undefined" ? `${window.location.origin}/careers/${form.slug}` : "";

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-1 font-semibold">White-label branding</h2>
        <p className="mb-4 text-sm text-muted-foreground">Your logo and colors appear on the careers portal and every candidate-facing page.</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium">Logo URL</label>
            <input value={form.logo_url} onChange={(e) => setForm((f) => ({ ...f, logo_url: e.target.value }))}
              placeholder="https://yourcompany.com/logo.png"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Brand color</label>
            <div className="flex items-center gap-2">
              <input type="color" value={form.brand_color} onChange={(e) => setForm((f) => ({ ...f, brand_color: e.target.value }))}
                className="h-9 w-12 rounded border border-border bg-background" />
              <input value={form.brand_color} onChange={(e) => setForm((f) => ({ ...f, brand_color: e.target.value }))}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Website</label>
            <input value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
              placeholder="https://yourcompany.com"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium">Tagline</label>
            <input value={form.tagline} onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
              placeholder="Building the future of…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium">Careers page intro</label>
            <textarea value={form.careers_intro} onChange={(e) => setForm((f) => ({ ...f, careers_intro: e.target.value }))} rows={2}
              placeholder="A sentence inviting candidates to apply…"
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
        </div>

        <label className="mt-4 flex cursor-pointer items-center gap-2.5">
          <input type="checkbox" checked={form.show_powered_by} onChange={(e) => setForm((f) => ({ ...f, show_powered_by: e.target.checked }))}
            className="h-4 w-4 rounded border-border accent-primary" />
          <span className="text-sm">Show &quot;Powered by JobsAI&quot; on candidate pages</span>
        </label>

        <button onClick={save} disabled={saving}
          className="btn-cta mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
          {saved ? "Saved" : "Save branding"}
        </button>
      </div>

      {/* Careers portal link */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-1 font-semibold">Branded careers portal</h2>
        <p className="mb-3 text-sm text-muted-foreground">A public, branded page listing all your active jobs. Share this link or embed it on your site.</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 overflow-x-auto rounded-lg border border-border bg-background px-3 py-2 text-xs">{careersUrl}</code>
          <a href={`/careers/${form.slug}`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted">
            <ExternalLink className="h-3.5 w-3.5" /> Open
          </a>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Want a custom domain (careers.yourcompany.com)? Point a CNAME to our servers — contact your account manager.</p>
      </div>
    </div>
  );
}

// ── Enterprise API ────────────────────────────────────────────────────────────
function ApiSettings() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rotating, setRotating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/enterprise/api-key").then((r) => r.json()).then((j) => setApiKey(j.data?.api_key ?? null)).finally(() => setLoading(false));
  }, []);

  const rotate = async () => {
    setRotating(true);
    const res = await fetch("/api/enterprise/api-key", { method: "POST" });
    const json = await res.json();
    if (json.data) setApiKey(json.data.api_key);
    setRotating(false);
  };

  const base = typeof window !== "undefined" ? window.location.origin : "https://jobsai.work";

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-1 font-semibold">API key</h2>
        <p className="mb-4 text-sm text-muted-foreground">Authenticate requests with <code className="rounded bg-muted px-1.5 py-0.5 text-xs">Authorization: Bearer &lt;key&gt;</code>. Owner only.</p>
        {loading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : apiKey ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs">{apiKey}</code>
            <button onClick={() => { navigator.clipboard.writeText(apiKey); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="rounded-lg border border-border p-2 hover:bg-muted">{copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}</button>
            <button onClick={rotate} disabled={rotating} className="rounded-lg border border-border p-2 hover:bg-muted">{rotating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}</button>
          </div>
        ) : (
          <button onClick={rotate} disabled={rotating} className="btn-cta inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60">
            {rotating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Generate API key
          </button>
        )}
        {apiKey && <p className="mt-2 text-xs text-amber-400">Rotating invalidates the old key immediately.</p>}
      </div>

      {/* Docs */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-3 font-semibold">Endpoints</h2>
        <div className="space-y-3 text-xs">
          {[
            { m: "GET", p: "/api/v1/enterprise/jobs", d: "List jobs (?status=active)" },
            { m: "POST", p: "/api/v1/enterprise/jobs", d: "Create a job" },
            { m: "GET", p: "/api/v1/enterprise/jobs/{jobId}/applications", d: "List applications with AI scores" },
            { m: "POST", p: "/api/v1/enterprise/jobs/{jobId}/applications", d: "Push a candidate (auto-screens)" },
            { m: "GET", p: "/api/v1/enterprise/candidates/{appId}", d: "Full candidate record + scores" },
            { m: "PATCH", p: "/api/v1/enterprise/candidates/{appId}", d: "Update stage" },
          ].map((e) => (
            <div key={e.m + e.p} className="flex items-center gap-2.5">
              <span className={cn("w-12 shrink-0 rounded px-1.5 py-0.5 text-center font-mono font-bold",
                e.m === "GET" ? "bg-blue-500/15 text-blue-400" : e.m === "POST" ? "bg-green-500/15 text-green-400" : "bg-amber-500/15 text-amber-400")}>{e.m}</span>
              <code className="shrink-0 text-foreground">{e.p}</code>
              <span className="truncate text-muted-foreground">{e.d}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-lg bg-background/60 p-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Example</p>
          <pre className="overflow-x-auto text-[11px] leading-relaxed text-muted-foreground">{`curl ${base}/api/v1/enterprise/jobs \\
  -H "Authorization: Bearer YOUR_API_KEY"`}</pre>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
type Tab = "copilot" | "outreach" | "branding" | "api" | "integrations" | "emails" | "data";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "copilot",      label: "Copilot",      icon: Bot },
  { id: "outreach",     label: "Outreach",     icon: Sparkles },
  { id: "branding",     label: "Branding",     icon: Palette },
  { id: "api",          label: "API",          icon: Code2 },
  { id: "integrations", label: "Integrations", icon: Link2 },
  { id: "emails",       label: "Emails",       icon: Mail },
  { id: "data",         label: "Data & Privacy", icon: Shield },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("copilot");

  return (
    <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Recruiter tools, team, integrations, and data controls.</p>
        </div>

        {/* Tab bar */}
        <div className="mb-6 flex flex-wrap gap-1 rounded-xl border border-border bg-muted/40 p-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                tab === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {tab === "copilot"      && <RecruiterCopilot />}
        {tab === "outreach"     && <OutreachGenerator />}
        {tab === "branding"     && <BrandingSettings />}
        {tab === "api"          && <ApiSettings />}
        {tab === "integrations" && <IntegrationsSettings />}
        {tab === "emails"       && <EmailTemplatesSettings />}
        {tab === "data"         && <DataPrivacySettings />}
      </div>
    </main>
  );
}
