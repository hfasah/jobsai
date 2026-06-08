"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Mail, RefreshCw, Loader2, Send, Sparkles, Inbox as InboxIcon,
  Reply, Building2, Clock, Plug, AlertCircle, Check, Trash2, Filter, CalendarPlus,
} from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { CLASS_LABELS, type InboxClass } from "@/lib/inbox";

type Msg = {
  id: string; direction: "inbound" | "outbound";
  from_email: string | null; from_name: string | null; to_email: string | null;
  subject: string | null; body_text: string | null; classification: InboxClass;
  is_read: boolean; received_at: string;
};
type InboxData = { connected: boolean; email: string | null; lastSynced: string | null; messages: Msg[]; unread: number };

const CLASS_TONE: Record<InboxClass, string> = {
  interview: "bg-emerald-500/15 text-emerald-400",
  confirmation: "bg-primary/15 text-primary",
  otp: "bg-[var(--cta)]/15 text-[var(--cta)]",
  rejection: "bg-destructive/15 text-destructive",
  update: "bg-muted text-foreground/70",
  other: "bg-muted text-foreground/70",
};

const FILTERS: (InboxClass | "all")[] = ["all", "interview", "confirmation", "rejection", "otp", "update", "other"];

function ago(iso: string): string {
  const d = Date.parse(iso);
  if (Number.isNaN(d)) return "";
  const m = Math.floor((Date.now() - d) / 60000);
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 1440)}d`;
}

export default function InboxPage() {
  const [data, setData] = useState<InboxData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selected, setSelected] = useState<Msg | null>(null);
  const [filter, setFilter] = useState<InboxClass | "all">("all");
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyState, setReplyState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [aiLoading, setAiLoading] = useState(false);
  const [schedState, setSchedState] = useState<"idle" | "loading" | "added" | "none" | "error">("idle");
  const [schedLink, setSchedLink] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/inbox");
    const json = await res.json();
    setData(json.data as InboxData);
  }, []);

  /* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */

  async function sync() {
    setSyncing(true);
    try { await fetch("/api/inbox/sync", { method: "POST" }); await load(); }
    finally { setSyncing(false); }
  }

  async function tidy() {
    setSyncing(true);
    try { await fetch("/api/inbox/cleanup", { method: "POST" }); setSelected(null); await load(); }
    finally { setSyncing(false); }
  }

  async function del(m: Msg) {
    await fetch(`/api/inbox/${m.id}`, { method: "DELETE" }).catch(() => {});
    if (selected?.id === m.id) setSelected(null);
    setData((d) => d ? { ...d, messages: d.messages.filter((x) => x.id !== m.id) } : d);
  }

  async function schedule() {
    if (!selected) return;
    setSchedState("loading"); setSchedLink(null);
    try {
      const res = await fetch(`/api/inbox/${selected.id}/schedule`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) { setSchedState("error"); return; }
      if (json.data?.found) { setSchedState("added"); setSchedLink(json.data.htmlLink ?? null); }
      else setSchedState("none");
    } catch { setSchedState("error"); }
  }

  async function select(m: Msg) {
    setSelected(m); setReplyOpen(false); setReplyText(""); setReplyState("idle"); setSchedState("idle"); setSchedLink(null);
    if (!m.is_read && m.direction === "inbound") {
      fetch(`/api/inbox/${m.id}/read`, { method: "POST" }).catch(() => {});
      setData((d) => d ? { ...d, messages: d.messages.map((x) => x.id === m.id ? { ...x, is_read: true } : x), unread: Math.max(0, d.unread - 1) } : d);
    }
  }

  async function aiReply() {
    if (!selected) return;
    setAiLoading(true);
    try {
      const res = await fetch(`/api/inbox/${selected.id}/ai-reply`, { method: "POST" });
      const json = await res.json();
      if (res.ok && json.data?.draft) setReplyText(json.data.draft);
    } finally { setAiLoading(false); }
  }

  async function sendReply() {
    if (!selected || !replyText.trim()) return;
    setReplyState("sending");
    try {
      const res = await fetch(`/api/inbox/${selected.id}/reply`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: replyText }),
      });
      if (res.ok) { setReplyState("sent"); setReplyOpen(false); setReplyText(""); await load(); }
      else setReplyState("error");
    } catch { setReplyState("error"); }
  }

  const messages = (data?.messages ?? []).filter((m) => filter === "all" ? true : m.classification === filter);

  if (loading) {
    return <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading inbox…</div></main>;
  }

  // Not connected
  if (!data?.connected) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-brand text-white shadow-glow"><Mail className="h-5 w-5" /></div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Inbox</h1>
            <p className="mt-1 text-sm text-muted-foreground">Collect and reply to employer responses — sent as you, from your own email.</p>
          </div>
        </div>
        <div className="mt-8 rounded-2xl border border-border bg-card p-8 text-center">
          <Plug className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-3 font-semibold">Connect your Gmail</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            JobsAI reads recruiter replies into this inbox and lets you reply with AI — sent through your own account, so employers see a real email from you.
          </p>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- API route, needs a full navigation */}
          <a href="/api/inbox/connect" className="btn-cta mt-5 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm">
            <Mail className="h-4 w-4" /> Connect Gmail
          </a>
        </div>
        <div className="mt-6"><CcEmailCard /></div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inbox</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{data.email} {data.lastSynced && <>· synced {ago(data.lastSynced)} ago</>}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- API route, needs a full navigation */}
          <a href="/api/inbox/connect" title="Re-grant access (e.g. to enable Calendar)" className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
            <Plug className="h-4 w-4" /> Reconnect
          </a>
          <button onClick={tidy} disabled={syncing} title="Remove non-job emails" className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60">
            <Filter className="h-4 w-4" /> Tidy up
          </button>
          <button onClick={sync} disabled={syncing} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
          </button>
        </div>
      </div>

      <div className="mt-5"><CcEmailCard /></div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              filter === f ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-foreground/80 hover:bg-white/5")}>
            {f === "all" ? "All" : CLASS_LABELS[f]}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[360px_1fr]">
        {/* List */}
        <div className="min-w-0">
          {messages.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              <InboxIcon className="mx-auto h-7 w-7 opacity-60" />
              <p className="mt-2">No messages yet. Hit Refresh to pull recent replies.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {messages.map((m) => {
                const active = selected?.id === m.id;
                return (
                  <li key={m.id}>
                    <button onClick={() => select(m)}
                      className={cn("w-full rounded-xl border p-3 text-left transition-colors",
                        active ? "border-primary/60 bg-primary/5" : "border-border bg-card hover:border-primary/30")}>
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn("truncate text-sm", !m.is_read && m.direction === "inbound" ? "font-bold" : "font-medium")}>
                          {m.direction === "outbound" ? "You" : (m.from_name || m.from_email || "Unknown")}
                        </span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">{ago(m.received_at)}</span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{m.subject || "(no subject)"}</p>
                      <span className={cn("mt-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium", CLASS_TONE[m.classification])}>
                        {m.direction === "outbound" ? "Sent" : CLASS_LABELS[m.classification]}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Detail */}
        <div className="min-w-0">
          {selected ? (
            <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-bold tracking-tight">{selected.subject || "(no subject)"}</h2>
                <button onClick={() => del(selected)} title="Delete from inbox" className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {selected.from_name || selected.from_email}</span>
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {new Date(selected.received_at).toLocaleString()}</span>
                <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", CLASS_TONE[selected.classification])}>{CLASS_LABELS[selected.classification]}</span>
              </div>

              <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{selected.body_text || "(no content)"}</p>

              {selected.direction === "inbound" && selected.from_email && (
                <div className="mt-6 border-t border-border pt-5">
                  {!replyOpen ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <button onClick={() => setReplyOpen(true)} className="btn-cta inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm">
                        <Reply className="h-4 w-4" /> Reply
                      </button>
                      <button onClick={schedule} disabled={schedState === "loading"}
                        className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60">
                        {schedState === "loading" ? <><Loader2 className="h-4 w-4 animate-spin" /> Checking…</> : <><CalendarPlus className="h-4 w-4" /> Add to calendar</>}
                      </button>
                      {schedState === "added" && (
                        <a href={schedLink ?? "#"} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 hover:underline">
                          <Check className="h-3.5 w-3.5" /> Added — view event
                        </a>
                      )}
                      {schedState === "none" && <span className="text-xs text-muted-foreground">No specific time found in this email.</span>}
                      {schedState === "error" && <span className="inline-flex items-center gap-1 text-xs text-destructive"><AlertCircle className="h-3.5 w-3.5" /> Couldn&apos;t add</span>}
                    </div>
                  ) : (
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">Reply to <span className="text-foreground">{selected.from_email}</span> — sent from your Gmail</p>
                        <button onClick={aiReply} disabled={aiLoading} className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-3 py-1 text-xs font-medium text-white disabled:opacity-60">
                          {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} AI Reply
                        </button>
                      </div>
                      <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={6}
                        placeholder="Write your reply…"
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
                      <div className="mt-2 flex items-center gap-3">
                        <button onClick={sendReply} disabled={replyState === "sending" || !replyText.trim()} className="btn-cta inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm disabled:opacity-60">
                          {replyState === "sending" ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : <><Send className="h-4 w-4" /> Send</>}
                        </button>
                        <button onClick={() => setReplyOpen(false)} className="text-sm text-muted-foreground hover:text-foreground">Cancel</button>
                        {replyState === "sent" && <span className="inline-flex items-center gap-1 text-xs text-emerald-400"><Check className="h-3.5 w-3.5" /> Sent</span>}
                        {replyState === "error" && <span className="inline-flex items-center gap-1 text-xs text-destructive"><AlertCircle className="h-3.5 w-3.5" /> Failed — try again</span>}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="grid h-full place-items-center rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              <div><Mail className="mx-auto h-7 w-7 opacity-60" /><p className="mt-2">Select a message to read and reply.</p></div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

// ── "Also CC my email" — copy application/inbox emails to the user (or another address) ──
function CcEmailCard() {
  const { user } = useUser();
  const acctEmail = user?.primaryEmailAddress?.emailAddress ?? "";
  const [enabled, setEnabled] = useState(false);
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/preferences").then((r) => r.json()).then((j) => {
      if (!active) return;
      setEnabled(!!j.data?.cc_email_enabled);
      setEmail(j.data?.cc_email ?? "");
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  const persist = async (nextEnabled: boolean, nextEmail: string) => {
    setSaving(true); setSaved(false);
    try {
      await fetch("/api/preferences", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cc_email_enabled: nextEnabled, cc_email: nextEmail || acctEmail }),
      });
      setSaved(true); setTimeout(() => setSaved(false), 1500);
    } finally { setSaving(false); }
  };

  const toggle = () => {
    const v = !enabled;
    setEnabled(v);
    const e = email || acctEmail;
    if (!email) setEmail(acctEmail);
    persist(v, e);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">Also CC my email</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Get a copy of important application emails and replies JobsAI sends on your behalf — CC&apos;d straight to your inbox, plus saved here.
          </p>
        </div>
        <button
          role="switch"
          aria-checked={enabled}
          aria-label="Also CC my email"
          onClick={toggle}
          disabled={saving}
          className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", enabled ? "bg-primary" : "bg-muted")}
        >
          <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", enabled ? "translate-x-5" : "translate-x-0.5")} />
        </button>
      </div>

      {enabled && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => persist(true, email)}
            placeholder={acctEmail || "you@example.com"}
            className="min-w-[220px] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button onClick={() => persist(true, email)} disabled={saving}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4 text-desyn-success" /> : null}
            {saved ? "Saved" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}
