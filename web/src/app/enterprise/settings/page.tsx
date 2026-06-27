"use client";

import { useState, useRef, useEffect } from "react";
import {
  Bot, Send, Loader2, Sparkles, Copy, Check, RefreshCw,
  Users, Plus, Trash2, Link2, Download, Shield, Mail,
  CheckCircle2, AlertCircle, RotateCcw, Clock,
  Palette, Code2, ExternalLink, Globe, Eye, EyeOff,
  KeyRound, ChevronDown, ChevronRight, AtSign, Inbox as InboxIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ImageUpload } from "./image-upload";

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

// ── Google Calendar card ──────────────────────────────────────────────────────
function GoogleCalendarCard() {
  const [status, setStatus] = useState<{ configured: boolean; connected: boolean; email?: string | null } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    fetch("/api/enterprise/google/status").then((r) => r.json()).then(setStatus);
  }, []);

  const disconnect = async () => {
    setDisconnecting(true);
    await fetch("/api/enterprise/google/status", { method: "DELETE" });
    setStatus((s) => s ? { ...s, connected: false, email: null } : s);
    setDisconnecting(false);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📅</span>
          <div>
            <p className="font-semibold">Google Workspace</p>
            <p className="text-xs text-muted-foreground">Calendar sync + send emails from your Gmail</p>
          </div>
        </div>
        {status?.connected && (
          <span className="flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-1 text-xs font-medium text-green-400">
            <CheckCircle2 className="h-3 w-3" /> Connected
          </span>
        )}
      </div>
      {status === null && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      {status !== null && !status.configured && (
        <p className="text-xs text-amber-400">GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set in environment.</p>
      )}
      {status?.configured && status.connected && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-muted-foreground">{status.email}</span>
          <button onClick={disconnect} disabled={disconnecting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50">
            {disconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Disconnect
          </button>
        </div>
      )}
      {status?.configured && !status.connected && (
        <a href="/api/enterprise/google/connect"
          className="btn-cta inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold">
          <Link2 className="h-4 w-4" /> Connect Google Calendar
        </a>
      )}
    </div>
  );
}

// ── Microsoft Calendar card ───────────────────────────────────────────────────
function MicrosoftCalendarCard() {
  const [status, setStatus] = useState<{ configured: boolean; connected: boolean; email?: string | null } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    fetch("/api/enterprise/microsoft/status").then((r) => r.json()).then(setStatus);
  }, []);

  const disconnect = async () => {
    setDisconnecting(true);
    await fetch("/api/enterprise/microsoft/status", { method: "DELETE" });
    setStatus((s) => s ? { ...s, connected: false, email: null } : s);
    setDisconnecting(false);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🪟</span>
          <div>
            <p className="font-semibold">Microsoft 365 / Outlook</p>
            <p className="text-xs text-muted-foreground">Calendar sync + send emails from your Outlook inbox</p>
          </div>
        </div>
        {status?.connected && (
          <span className="flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-1 text-xs font-medium text-green-400">
            <CheckCircle2 className="h-3 w-3" /> Connected
          </span>
        )}
      </div>
      {status === null && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      {status !== null && !status.configured && (
        <p className="text-xs text-amber-400">MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET not set in environment.</p>
      )}
      {status?.configured && status.connected && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-muted-foreground">{status.email}</span>
          <button onClick={disconnect} disabled={disconnecting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50">
            {disconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Disconnect
          </button>
        </div>
      )}
      {status?.configured && !status.connected && (
        <a href="/api/enterprise/microsoft/connect"
          className="btn-cta inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold">
          <Link2 className="h-4 w-4" /> Connect Microsoft account
        </a>
      )}
    </div>
  );
}

interface PipedriveStatus {
  connected: boolean;
  domain?: string | null;
  company_name?: string | null;
  last_sync?: string | null;
  companies?: number;
  synced?: number;
  contacts?: number;
  syncedContacts?: number;
  deals?: number;
  syncedDeals?: number;
}

// Pipedrive CRM sync — pushes JobsAI CRM companies into Pipedrive as Organizations.
function PipedriveCard() {
  const [status, setStatus] = useState<PipedriveStatus | null>(null);
  const [token, setToken] = useState("");
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState<null | "connect" | "sync" | "disconnect">(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const load = () =>
    fetch("/api/enterprise/integrations/pipedrive")
      .then((r) => r.json())
      .then((j) => setStatus(j.data ?? { connected: false }))
      .catch(() => setStatus({ connected: false }));
  useEffect(() => { load(); }, []);

  const connect = async () => {
    if (!token.trim()) return;
    setBusy("connect"); setMsg(null);
    const res = await fetch("/api/enterprise/integrations/pipedrive", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_token: token, company_domain: domain }),
    });
    const j = await res.json();
    if (res.ok) { setStatus(j.data); setToken(""); setMsg({ kind: "ok", text: `Connected${j.data?.company_name ? ` to ${j.data.company_name}` : ""}.` }); }
    else setMsg({ kind: "err", text: j.error ?? "Couldn't connect." });
    setBusy(null);
  };

  const sync = async () => {
    setBusy("sync"); setMsg(null);
    const res = await fetch("/api/enterprise/integrations/pipedrive/sync", { method: "POST" });
    const j = await res.json();
    if (res.ok) {
      type Sum = { total: number; created: number; updated: number; errors: number };
      const s = j.data as { companies: Sum; contacts: Sum; deals: Sum };
      const part = (label: string, x: Sum) => `${x.total} ${label} (${x.created} new, ${x.updated} updated${x.errors ? `, ${x.errors} failed` : ""})`;
      setMsg({ kind: "ok", text: `Synced ${part("companies", s.companies)}, ${part("contacts", s.contacts)}, and ${part("deals", s.deals)}.` });
      load();
    } else setMsg({ kind: "err", text: j.error ?? "Sync failed." });
    setBusy(null);
  };

  const disconnect = async () => {
    setBusy("disconnect");
    await fetch("/api/enterprise/integrations/pipedrive", { method: "DELETE" });
    setStatus({ connected: false }); setMsg(null); setBusy(null);
  };

  if (!status) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-lg">🔗</span>
        <h2 className="font-semibold">Pipedrive CRM</h2>
        {status.connected && <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-400">Connected</span>}
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Push your CRM companies, contacts, and deals into Pipedrive as Organizations, Persons, and Deals — new and updated records sync automatically, and you can run a full sync any time.
      </p>

      {!status.connected ? (
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium">API token</label>
            <input value={token} onChange={(e) => setToken(e.target.value)} type="password" autoComplete="off"
              placeholder="Pipedrive API token"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            <p className="mt-1 text-xs text-muted-foreground">
              In Pipedrive: <span className="text-foreground">Settings → Personal preferences → API</span> → copy your personal API token.
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Company domain <span className="text-muted-foreground">(optional)</span></label>
            <div className="flex items-center gap-2">
              <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="acme"
                className="w-40 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              <span className="text-sm text-muted-foreground">.pipedrive.com</span>
            </div>
          </div>
          <button onClick={connect} disabled={busy === "connect" || !token.trim()}
            className="btn-cta inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60">
            {busy === "connect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Connect Pipedrive
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
            <div><div className="text-xs text-muted-foreground">Account</div><div className="font-medium">{status.company_name || status.domain || "Pipedrive"}</div></div>
            <div><div className="text-xs text-muted-foreground">Companies synced</div><div className="font-medium">{status.synced ?? 0} / {status.companies ?? 0}</div></div>
            <div><div className="text-xs text-muted-foreground">Contacts synced</div><div className="font-medium">{status.syncedContacts ?? 0} / {status.contacts ?? 0}</div></div>
            <div><div className="text-xs text-muted-foreground">Deals synced</div><div className="font-medium">{status.syncedDeals ?? 0} / {status.deals ?? 0}</div></div>
            <div><div className="text-xs text-muted-foreground">Last full sync</div><div className="font-medium">{status.last_sync ? new Date(status.last_sync).toLocaleString() : "Never"}</div></div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={sync} disabled={busy === "sync"}
              className="btn-cta inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60">
              {busy === "sync" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Sync now
            </button>
            <button onClick={disconnect} disabled={busy === "disconnect"}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted disabled:opacity-60">
              {busy === "disconnect" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Disconnect
            </button>
          </div>
        </div>
      )}

      {msg && <p className={cn("mt-3 text-xs", msg.kind === "ok" ? "text-green-500" : "text-destructive")}>{msg.text}</p>}
    </div>
  );
}

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
      <GoogleCalendarCard />
      <MicrosoftCalendarCard />
      <PipedriveCard />
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
            <p className="mt-0.5 text-sm text-muted-foreground">Download all your organization&apos;s data as JSON (GDPR compliant).</p>
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
        <p className="mb-3 text-sm text-muted-foreground">Anonymise a candidate&apos;s personal data across all applications and the talent pool.</p>
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
  const [form, setForm] = useState({ name: "", slug: "", logo_url: "", brand_color: "#2563eb", portal_title: "", tagline: "", careers_intro: "", show_powered_by: true, website: "", cover_image_url: "", culture_text: "", benefits_raw: "", social_twitter: "", social_linkedin: "", social_instagram: "", custom_domain: "", white_label_email_from: "", reply_to_email: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/enterprise/branding").then((r) => r.json()).then((j) => {
      if (j.data) {
        const d = j.data;
        const sl: Record<string, string> = d.social_links ?? {};
        setForm((f) => ({
          ...f, ...d,
          logo_url: d.logo_url ?? "",
          portal_title: d.portal_title ?? "",
          tagline: d.tagline ?? "",
          careers_intro: d.careers_intro ?? "",
          website: d.website ?? "",
          cover_image_url: d.cover_image_url ?? "",
          culture_text: d.culture_text ?? "",
          benefits_raw: Array.isArray(d.benefits) ? d.benefits.join("\n") : "",
          social_twitter: sl.twitter ?? "",
          social_linkedin: sl.linkedin ?? "",
          social_instagram: sl.instagram ?? "",
          custom_domain: d.custom_domain ?? "",
          white_label_email_from: d.white_label_email_from ?? "",
          reply_to_email: d.reply_to_email ?? "",
        }));
      }
    }).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true); setSaved(false);
    const benefits = form.benefits_raw.split("\n").map((s) => s.trim()).filter(Boolean);
    const social_links = {
      ...(form.social_twitter ? { twitter: form.social_twitter } : {}),
      ...(form.social_linkedin ? { linkedin: form.social_linkedin } : {}),
      ...(form.social_instagram ? { instagram: form.social_instagram } : {}),
    };
    await fetch("/api/enterprise/branding", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, benefits, social_links }),
    });
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
            <label className="mb-1.5 block text-sm font-medium">Portal title</label>
            <input value={form.portal_title} onChange={(e) => setForm((f) => ({ ...f, portal_title: e.target.value }))}
              placeholder={`${form.name || "Your Company"} HR Management & Recruitment Portal`}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            <p className="mt-1 text-xs text-muted-foreground">The bold headline on your portal home page (<code>/e/{form.slug || "your-company"}</code>). Leave blank to use the default.</p>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium">Logo</label>
            <ImageUpload value={form.logo_url} onChange={(url) => setForm((f) => ({ ...f, logo_url: url }))} kind="logo" placeholder="Upload an image or paste a URL" />
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
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium">Cover image</label>
            <ImageUpload value={form.cover_image_url} onChange={(url) => setForm((f) => ({ ...f, cover_image_url: url }))} kind="cover" placeholder="Upload an image or paste a URL" />
            <p className="mt-1 text-xs text-muted-foreground">Hero banner shown at the top of your careers page. Recommended: 1440×400px.</p>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium">Why work here</label>
            <textarea value={form.culture_text} onChange={(e) => setForm((f) => ({ ...f, culture_text: e.target.value }))} rows={3}
              placeholder="Describe your culture, mission, and team…"
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium">Perks & benefits</label>
            <textarea value={form.benefits_raw} onChange={(e) => setForm((f) => ({ ...f, benefits_raw: e.target.value }))} rows={4}
              placeholder={"Remote-first culture\nUnlimited PTO\nHealth & dental insurance\nAnnual learning budget"}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            <p className="mt-1 text-xs text-muted-foreground">One benefit per line. Shown as a grid on your careers page.</p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Twitter / X URL</label>
            <input value={form.social_twitter} onChange={(e) => setForm((f) => ({ ...f, social_twitter: e.target.value }))}
              placeholder="https://x.com/yourcompany"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">LinkedIn URL</label>
            <input value={form.social_linkedin} onChange={(e) => setForm((f) => ({ ...f, social_linkedin: e.target.value }))}
              placeholder="https://linkedin.com/company/…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Instagram URL</label>
            <input value={form.social_instagram} onChange={(e) => setForm((f) => ({ ...f, social_instagram: e.target.value }))}
              placeholder="https://instagram.com/yourcompany"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
        </div>

        <label className="mt-4 flex cursor-pointer items-center gap-2.5">
          <input type="checkbox" checked={form.show_powered_by} onChange={(e) => setForm((f) => ({ ...f, show_powered_by: e.target.checked }))}
            className="h-4 w-4 rounded border-border accent-primary" />
          <span className="text-sm">Show &quot;Powered by JobsAI.Work&quot; on candidate pages</span>
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
      </div>

      {/* Custom domain */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div>
          <h2 className="mb-1 font-semibold">Custom domain</h2>
          <p className="text-sm text-muted-foreground">
            Serve your careers page at <code>careers.yourcompany.com</code> instead of jobsai.work.
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Custom domain</label>
          <input
            value={form.custom_domain}
            onChange={(e) => setForm((f) => ({ ...f, custom_domain: e.target.value.trim().toLowerCase() }))}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="careers.yourcompany.com"
          />
        </div>

        {form.custom_domain && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2 text-xs">
            <p className="font-semibold text-amber-400">DNS setup required</p>
            <p className="text-muted-foreground">Add this CNAME record at your DNS provider:</p>
            <div className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-background p-2 font-mono text-xs">
              <span className="text-muted-foreground">Type</span>
              <span className="text-muted-foreground">Host</span>
              <span className="text-muted-foreground">Value</span>
              <span className="font-semibold">CNAME</span>
              <span className="font-semibold">{form.custom_domain.split(".").slice(0, -2).join(".") || form.custom_domain}</span>
              <span className="font-semibold break-all">cname.jobsai.work</span>
            </div>
            <p className="text-muted-foreground">DNS changes can take up to 24 hours to propagate.</p>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium">Email &quot;From&quot; name</label>
          <input
            value={form.white_label_email_from}
            onChange={(e) => setForm((f) => ({ ...f, white_label_email_from: e.target.value }))}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder={`${form.name || "Acme Corp"} Recruiting`}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Shown as the sender name on all candidate emails. Leave blank to use &quot;{form.name || "Your Company"} Recruiting&quot;.
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          Candidate <span className="font-medium text-foreground">reply-to address</span> is set under <span className="font-medium text-foreground">Settings → Intake</span> (available on every plan).
        </p>

        <button onClick={save} disabled={saving}
          className="btn-cta inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
          {saved ? "Saved" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ── Enterprise API ────────────────────────────────────────────────────────────
// ── Webhooks ──────────────────────────────────────────────────────────────────
interface WebhookEndpoint {
  id: string; url: string; secret: string; active: boolean;
  created_at: string; last_triggered_at: string | null; last_status: number | null;
}

function WebhooksSettings() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUrl, setNewUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/enterprise/webhooks").then((r) => r.json())
      .then((j) => setEndpoints(j.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  const add = async () => {
    if (!newUrl.trim()) return;
    setAdding(true); setError(null);
    const res = await fetch("/api/enterprise/webhooks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: newUrl.trim() }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error); setAdding(false); return; }
    setEndpoints((e) => [json.data, ...e]);
    setNewUrl(""); setAdding(false);
  };

  const remove = async (id: string) => {
    await fetch("/api/enterprise/webhooks", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setEndpoints((e) => e.filter((x) => x.id !== id));
  };

  const copySecret = (id: string, secret: string) => {
    navigator.clipboard.writeText(secret);
    setCopied(id); setTimeout(() => setCopied(null), 1500);
  };

  const toggleReveal = (id: string) => {
    setRevealedSecrets((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
      <div>
        <h2 className="font-semibold">Outbound webhooks</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          POST requests to your endpoints when key events happen. Signed with <code className="rounded bg-muted px-1 py-0.5 text-xs">X-JobsAI-Signature: sha256=…</code>
        </p>
      </div>

      {/* Events reference */}
      <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-1">
        <p className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px] mb-1.5">Events delivered</p>
        {["application.created", "application.stage_changed", "application.hired", "interview.scheduled"].map((e) => (
          <div key={e} className="flex items-center gap-1.5">
            <Globe className="h-3 w-3 text-primary" />
            <code className="text-foreground">{e}</code>
          </div>
        ))}
      </div>

      {/* Add endpoint */}
      <div className="flex gap-2">
        <input value={newUrl} onChange={(e) => setNewUrl(e.target.value)}
          placeholder="https://your-app.com/webhooks/jobsai"
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          onKeyDown={(e) => e.key === "Enter" && add()} />
        <button onClick={add} disabled={adding || !newUrl.trim()}
          className="btn-cta inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60">
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add
        </button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Endpoint list */}
      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : endpoints.length === 0 ? (
        <p className="text-sm text-muted-foreground">No endpoints yet.</p>
      ) : (
        <div className="space-y-3">
          {endpoints.map((ep) => (
            <div key={ep.id} className="rounded-xl border border-border bg-background/60 p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium break-all">{ep.url}</p>
                <button onClick={() => remove(ep.id)}
                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {ep.last_triggered_at && (
                <p className="text-[11px] text-muted-foreground">
                  Last delivery: {new Date(ep.last_triggered_at).toLocaleString()} — HTTP {ep.last_status ?? "?"}
                </p>
              )}
              <div className="flex items-center gap-2">
                <code className="flex-1 overflow-hidden rounded bg-muted px-2 py-1 font-mono text-[11px] truncate">
                  {revealedSecrets.has(ep.id) ? ep.secret : ep.secret.slice(0, 12) + "•".repeat(20)}
                </code>
                <button onClick={() => toggleReveal(ep.id)}
                  className="rounded-lg border border-border p-1.5 hover:bg-muted">
                  {revealedSecrets.has(ep.id) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </button>
                <button onClick={() => copySecret(ep.id, ep.secret)}
                  className="rounded-lg border border-border p-1.5 hover:bg-muted">
                  {copied === ep.id ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
      <WebhooksSettings />
    </div>
  );
}

// ── SSO ───────────────────────────────────────────────────────────────────────
const SSO_PROVIDERS = [
  { value: "okta",      label: "Okta",             hint: "SAML 2.0 via Okta" },
  { value: "azure_ad",  label: "Microsoft Entra ID (Azure AD)", hint: "SAML 2.0 via Azure" },
  { value: "google",    label: "Google Workspace", hint: "SAML 2.0 via Google" },
  { value: "saml",      label: "Generic SAML 2.0", hint: "Any SAML 2.0 IdP" },
  { value: "oidc",      label: "Generic OIDC",     hint: "OpenID Connect IdP" },
];

const PROVIDER_GUIDES: Record<string, { steps: string[] }> = {
  okta: { steps: [
    "In Okta Admin, go to Applications → Create App Integration → SAML 2.0.",
    'Set Single sign-on URL to the ACS URL below.',
    'Set Audience URI (SP Entity ID) to the Entity ID below.',
    "Download the IdP metadata XML or copy the Metadata URL.",
    "Paste the metadata URL or entity ID + SSO URL + certificate below.",
  ]},
  azure_ad: { steps: [
    "In Azure Portal, go to Enterprise Applications → New Application → Create your own.",
    "Choose 'Non-gallery' → Set up Single sign-on → SAML.",
    "Set Reply URL (ACS URL) and Identifier (Entity ID) to the values below.",
    "Download the Federation Metadata XML or copy the App Federation Metadata URL.",
    "Paste the metadata URL below.",
  ]},
  google: { steps: [
    "In Google Admin, go to Apps → Web and mobile apps → Add app → Add custom SAML app.",
    "Download the IdP metadata or copy the SSO URL and certificate.",
    "Set ACS URL and Entity ID to the values below.",
    "Assign the app to your users.",
    "Paste the IdP metadata URL below.",
  ]},
  saml: { steps: [
    "Configure your IdP with the ACS URL and Entity ID shown below.",
    "Obtain the IdP metadata URL (or entity ID + SSO URL + X.509 certificate).",
    "Paste the details in the form below.",
  ]},
  oidc: { steps: [
    "Register a new OIDC application in your identity provider.",
    "Set the redirect URI to the ACS URL shown below.",
    "Obtain the Discovery URL (e.g. https://your-idp.com/.well-known/openid-configuration).",
    "Copy the Client ID and Client Secret.",
  ]},
};

function SsoSettings() {
  type SsoConfig = {
    id?: string;
    sso_domain: string;
    enforce_sso: boolean;
    provider: string;
    status: string;
    status_message?: string;
    idp_metadata_url?: string;
    idp_entity_id?: string;
    idp_sso_url?: string;
    oidc_discovery_url?: string;
    oidc_client_id?: string;
  };
  const [config, setConfig] = useState<SsoConfig | null>(null);
  const [sp, setSp] = useState<{ entity_id: string; acs_url: string; sp_metadata_url: string } | null>(null);
  const [form, setForm] = useState({
    sso_domain: "", provider: "okta", enforce_sso: false,
    idp_metadata_url: "", idp_entity_id: "", idp_sso_url: "",
    oidc_discovery_url: "", oidc_client_id: "", oidc_client_secret: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [showGuide, setShowGuide] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/enterprise/sso").then((r) => r.json()).then((j) => {
      setSp(j.sp ?? null);
      if (j.data) {
        setConfig(j.data);
        setForm((f) => ({
          ...f,
          sso_domain: j.data.sso_domain ?? "",
          provider: j.data.provider ?? "okta",
          enforce_sso: j.data.enforce_sso ?? false,
          idp_metadata_url: j.data.idp_metadata_url ?? "",
          idp_entity_id: j.data.idp_entity_id ?? "",
          idp_sso_url: j.data.idp_sso_url ?? "",
          oidc_discovery_url: j.data.oidc_discovery_url ?? "",
          oidc_client_id: j.data.oidc_client_id ?? "",
        }));
      }
    }).finally(() => setLoading(false));
  }, []);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const save = async () => {
    if (!form.sso_domain.trim()) { setError("Domain is required."); return; }
    setSaving(true); setError(""); setSaved(false);
    const res = await fetch("/api/enterprise/sso", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const j = await res.json();
    if (!res.ok) { setError(j.error ?? "Failed to save."); setSaving(false); return; }
    setConfig(j.data); setSaved(true); setSaving(false);
    setTimeout(() => setSaved(false), 2000);
  };

  const requestActivation = async () => {
    if (!form.sso_domain.trim()) { setError("Save your configuration first."); return; }
    setRequesting(true); setError("");
    const res = await fetch("/api/enterprise/sso", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, action: "request_activation" }),
    });
    const j = await res.json();
    if (!res.ok) { setError(j.error ?? "Failed to request."); setRequesting(false); return; }
    setConfig(j.data); setRequesting(false);
  };

  const deleteConfig = async () => {
    if (!confirm("Remove SSO configuration? This will disable SSO for your domain.")) return;
    await fetch("/api/enterprise/sso", { method: "DELETE" });
    setConfig(null);
    setForm({ sso_domain: "", provider: "okta", enforce_sso: false, idp_metadata_url: "", idp_entity_id: "", idp_sso_url: "", oidc_discovery_url: "", oidc_client_id: "", oidc_client_secret: "" });
  };

  const isSaml = ["okta", "azure_ad", "google", "saml"].includes(form.provider);
  const guide = PROVIDER_GUIDES[form.provider];

  const STATUS_META: Record<string, { color: string; label: string }> = {
    pending: { color: "text-amber-400 bg-amber-500/10 border-amber-500/20", label: "Pending activation" },
    active:  { color: "text-green-400 bg-green-500/10 border-green-500/20", label: "Active" },
    error:   { color: "text-red-400 bg-red-500/10 border-red-500/20", label: "Error" },
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="mb-1 font-semibold">SAML / SSO</h2>
            <p className="text-sm text-muted-foreground">
              Connect your identity provider so team members sign in with their company credentials.
              Supports Okta, Azure AD, Google Workspace, and any SAML 2.0 / OIDC provider.
            </p>
          </div>
          {config && (
            <span className={cn("shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium", STATUS_META[config.status]?.color)}>
              {STATUS_META[config.status]?.label ?? config.status}
            </span>
          )}
        </div>
        {config?.status_message && (
          <p className="mt-2 text-xs text-muted-foreground border border-border rounded-lg px-3 py-2 bg-muted/40">{config.status_message}</p>
        )}
      </div>

      {/* SP metadata — shown when config exists or as a preview */}
      {sp && (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <h3 className="font-semibold text-sm">Service Provider (SP) Metadata</h3>
          <p className="text-xs text-muted-foreground">Copy these values into your identity provider when setting up the application.</p>
          {[
            { label: "ACS URL (Reply URL)", value: sp.acs_url, key: "acs" },
            { label: "Entity ID (Audience URI)", value: sp.entity_id, key: "entity" },
            { label: "SP Metadata URL", value: sp.sp_metadata_url, key: "meta" },
          ].map(({ label, value, key }) => (
            <div key={key}>
              <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 overflow-x-auto rounded-lg border border-border bg-background px-3 py-2 text-xs">{value}</code>
                <button onClick={() => copy(value, key)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border hover:bg-muted">
                  {copiedField === key ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Configuration form */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <h3 className="font-semibold text-sm">IdP Configuration</h3>

        {error && <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</div>}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label-xs">SSO Domain *</label>
            <input
              value={form.sso_domain}
              onChange={(e) => setForm((f) => ({ ...f, sso_domain: e.target.value.trim().toLowerCase() }))}
              className="input-field mt-1"
              placeholder="acme.com"
            />
            <p className="mt-1 text-xs text-muted-foreground">Users with this email domain will be offered SSO login.</p>
          </div>

          <div className="sm:col-span-2">
            <label className="label-xs">Identity Provider</label>
            <select
              value={form.provider}
              onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
              className="input-field mt-1"
            >
              {SSO_PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Setup guide toggle */}
        <button
          onClick={() => setShowGuide((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          {showGuide ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          {showGuide ? "Hide" : "Show"} setup guide for {SSO_PROVIDERS.find((p) => p.value === form.provider)?.label}
        </button>

        {showGuide && guide && (
          <ol className="space-y-1.5 rounded-xl border border-border bg-muted/30 p-4">
            {guide.steps.map((step, i) => (
              <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        )}

        {/* SAML fields */}
        {isSaml && (
          <div className="space-y-3">
            <div>
              <label className="label-xs">IdP Metadata URL <span className="text-muted-foreground">(recommended)</span></label>
              <input
                value={form.idp_metadata_url}
                onChange={(e) => setForm((f) => ({ ...f, idp_metadata_url: e.target.value }))}
                className="input-field mt-1"
                placeholder="https://your-idp.com/app/metadata"
              />
            </div>
            <p className="text-xs text-muted-foreground">Or enter IdP details manually:</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label-xs">IdP Entity ID</label>
                <input value={form.idp_entity_id} onChange={(e) => setForm((f) => ({ ...f, idp_entity_id: e.target.value }))} className="input-field mt-1" placeholder="https://your-idp.com/entity" />
              </div>
              <div>
                <label className="label-xs">IdP SSO URL</label>
                <input value={form.idp_sso_url} onChange={(e) => setForm((f) => ({ ...f, idp_sso_url: e.target.value }))} className="input-field mt-1" placeholder="https://your-idp.com/sso" />
              </div>
            </div>
          </div>
        )}

        {/* OIDC fields */}
        {!isSaml && (
          <div className="space-y-3">
            <div>
              <label className="label-xs">Discovery URL</label>
              <input value={form.oidc_discovery_url} onChange={(e) => setForm((f) => ({ ...f, oidc_discovery_url: e.target.value }))} className="input-field mt-1" placeholder="https://your-idp.com/.well-known/openid-configuration" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label-xs">Client ID</label>
                <input value={form.oidc_client_id} onChange={(e) => setForm((f) => ({ ...f, oidc_client_id: e.target.value }))} className="input-field mt-1" />
              </div>
              <div>
                <label className="label-xs">Client Secret</label>
                <input type="password" value={form.oidc_client_secret} onChange={(e) => setForm((f) => ({ ...f, oidc_client_secret: e.target.value }))} className="input-field mt-1" />
              </div>
            </div>
          </div>
        )}

        {/* Enforce SSO toggle */}
        <label className="flex cursor-pointer items-center gap-2.5 pt-1">
          <input
            type="checkbox"
            checked={form.enforce_sso}
            onChange={(e) => setForm((f) => ({ ...f, enforce_sso: e.target.checked }))}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          <div>
            <span className="text-sm font-medium">Enforce SSO for {form.sso_domain || "this domain"}</span>
            <p className="text-xs text-muted-foreground">When enabled, team members with this domain must sign in via SSO. Password login is disabled for them.</p>
          </div>
        </label>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button onClick={save} disabled={saving} className="btn-cta inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
            {saved ? "Saved" : "Save configuration"}
          </button>

          {config && config.status !== "active" && (
            <button
              onClick={requestActivation}
              disabled={requesting}
              className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/20 disabled:opacity-60"
            >
              {requesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Request activation
            </button>
          )}

          {config && (
            <button onClick={deleteConfig} className="ml-auto rounded-xl border border-border px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10">
              Remove SSO
            </button>
          )}
        </div>

        {!config && (
          <p className="text-xs text-muted-foreground border-t border-border pt-3">
            Save your configuration, then click <strong>Request activation</strong> to notify our team. We&apos;ll enable the SSO connection within 1 business day and update your status to Active.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
// ── Candidate Intake (email + upload) ──────────────────────────────────────────
interface ForwardConfirm { code: string; link: string | null; from: string | null }

function IntakeSettings() {
  const [address, setAddress] = useState("");
  const [handle, setHandle] = useState("");
  const [domain, setDomain] = useState("apply.jobsai.work");
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [replyToSaving, setReplyToSaving] = useState(false);
  const [replyToSaved, setReplyToSaved] = useState(false);
  const [replyToErr, setReplyToErr] = useState<string | null>(null);
  const [fwd, setFwd] = useState<ForwardConfirm | null>(null);
  const [fwdCopied, setFwdCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/enterprise/inbox/intake")
      .then((r) => r.json())
      .then((j) => {
        if (j.data) {
          setAddress(j.data.address); setHandle(j.data.handle); setDraft(j.data.handle); setDomain(j.data.domain);
          setReplyTo(j.data.reply_to_email ?? "");
          setFwd(j.data.forward_confirm ?? null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true); setMsg(null);
    const res = await fetch("/api/enterprise/inbox/intake", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ handle: draft }),
    });
    const j = await res.json();
    if (res.ok) { setAddress(j.data.address); setHandle(j.data.handle); setMsg({ kind: "ok", text: "Saved." }); }
    else setMsg({ kind: "err", text: j.error ?? "Couldn't save." });
    setSaving(false);
  };

  const saveReplyTo = async () => {
    setReplyToSaving(true); setReplyToSaved(false); setReplyToErr(null);
    const res = await fetch("/api/enterprise/inbox/intake", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reply_to_email: replyTo }),
    });
    const j = await res.json();
    if (res.ok) { setReplyTo(j.data.reply_to_email ?? ""); setReplyToSaved(true); setTimeout(() => setReplyToSaved(false), 2000); }
    else setReplyToErr(j.error ?? "Couldn't save.");
    setReplyToSaving(false);
  };

  const dismissFwd = async () => {
    setFwd(null);
    await fetch("/api/enterprise/inbox/intake", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clear_forward_confirm: true }),
    });
  };

  const copyCode = () => { if (fwd) { navigator.clipboard.writeText(fwd.code); setFwdCopied(true); setTimeout(() => setFwdCopied(false), 1500); } };
  const copy = () => { navigator.clipboard.writeText(address); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  if (loading) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;

  return (
    <div className="space-y-6">
      {fwd && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5">
          <h2 className="mb-1 font-semibold text-amber-300">Confirm email forwarding</h2>
          <p className="mb-3 text-sm text-amber-100/80">
            Your mail host asked you to confirm forwarding{fwd.from ? <> from <span className="font-medium text-amber-100">{fwd.from}</span></> : null} to your intake address.{" "}
            {fwd.code ? "Enter this code in your mailbox's forwarding settings" : "Open the verify link to confirm"}
            {fwd.code && fwd.link ? ", or open the verify link" : ""}.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {fwd.code && (
              <>
                <code className="rounded-lg border border-amber-500/30 bg-background/40 px-3 py-2 text-lg font-bold tracking-widest text-amber-100">{fwd.code}</code>
                <button onClick={copyCode} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 px-3 py-2 text-sm hover:bg-amber-500/10">
                  {fwdCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  {fwdCopied ? "Copied" : "Copy code"}
                </button>
              </>
            )}
            {fwd.link && (
              <a href={fwd.link} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-black hover:bg-amber-400">
                Confirm forwarding →
              </a>
            )}
            <button onClick={dismissFwd} className="ml-auto text-sm text-amber-100/70 underline hover:text-amber-100">Dismiss</button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-1 flex items-center gap-2">
          <AtSign className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Your candidate intake address</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Resumes sent here are parsed and dropped into your <span className="font-medium text-foreground">Candidate Inbox</span> automatically (under the <span className="font-medium text-foreground">General Applications</span> pool).
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm font-medium">{address}</code>
          <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        {/* Customise the handle */}
        <div className="mt-4 border-t border-border pt-4">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Customise the address</label>
          <div className="flex items-center gap-2">
            <input value={draft} onChange={(e) => setDraft(e.target.value)}
              className="w-40 rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder={handle} />
            <span className="text-sm text-muted-foreground">@{domain}</span>
            <button onClick={save} disabled={saving || draft === handle || !draft}
              className="ml-auto rounded-lg bg-gradient-brand px-3 py-2 text-sm font-semibold text-white shadow-glow disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
          {msg && <p className={cn("mt-2 text-xs", msg.kind === "ok" ? "text-green-500" : "text-destructive")}>{msg.text}</p>}
        </div>
      </div>

      {/* Reply-to — available to every org, not just white-label */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-1 flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Reply-to address</h2>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          When a candidate replies to a platform email (interview invites, offers, reminders), it goes here — your team&apos;s monitored inbox. Leave blank to use your org contact email.
        </p>
        <div className="flex items-center gap-2">
          <input type="email" value={replyTo} onChange={(e) => setReplyTo(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="hr@yourcompany.com" />
          <button onClick={saveReplyTo} disabled={replyToSaving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-brand px-3 py-2 text-sm font-semibold text-white shadow-glow disabled:opacity-50">
            {replyToSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : replyToSaved ? <Check className="h-4 w-4" /> : null}
            {replyToSaved ? "Saved" : "Save"}
          </button>
        </div>
        {replyToErr && <p className="mt-2 text-xs text-destructive">{replyToErr}</p>}
      </div>

      {/* Forwarding instructions */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-1 font-semibold">Forward from your own inbox</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Already publish <span className="font-medium text-foreground">hr@yourcompany.com</span> or <span className="font-medium text-foreground">careers@…</span>? Set up a forwarding rule to your intake address and every resume — plus anything your recruiters forward — lands in the inbox.
        </p>
        <ol className="space-y-1.5 text-sm text-muted-foreground">
          <li>1. In Google Workspace / Microsoft 365, open the settings for your hiring mailbox.</li>
          <li>2. Add a forwarding rule (or alias) to <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">{address}</code>.</li>
          <li>3. Recruiters can also just <span className="font-medium text-foreground">forward any candidate email</span> there — the attached resume is parsed automatically.</li>
        </ol>
      </div>
    </div>
  );
}

type Tab = "copilot" | "outreach" | "intake" | "branding" | "api" | "integrations" | "emails" | "data" | "sso";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "copilot",      label: "Copilot",      icon: Bot },
  { id: "outreach",     label: "Outreach",     icon: Sparkles },
  { id: "intake",       label: "Intake",       icon: InboxIcon },
  { id: "branding",     label: "Branding",     icon: Palette },
  { id: "api",          label: "API",          icon: Code2 },
  { id: "integrations", label: "Integrations", icon: Link2 },
  { id: "emails",       label: "Emails",       icon: Mail },
  { id: "data",         label: "Data & Privacy", icon: Shield },
  { id: "sso",          label: "SSO",            icon: KeyRound },
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
        {tab === "intake"       && <IntakeSettings />}
        {tab === "branding"     && <BrandingSettings />}
        {tab === "api"          && <ApiSettings />}
        {tab === "integrations" && <IntegrationsSettings />}
        {tab === "emails"       && <EmailTemplatesSettings />}
        {tab === "data"         && <DataPrivacySettings />}
        {tab === "sso"          && <SsoSettings />}
      </div>
    </main>
  );
}
