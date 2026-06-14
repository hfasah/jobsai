"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Loader2, Mail, Clock, Send, Sparkles, User, Bot, ShieldCheck, Inbox, MailOpen, SendHorizontal, CheckCircle2, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

interface Ticket {
  id: string; name: string; email: string; subject: string;
  message: string; category: string; status: string;
  admin_reply: string | null; created_at: string; replied_at: string | null;
  read_at: string | null; last_inbound_at: string | null;
}

interface Message {
  id: string; direction: "inbound" | "outbound"; author: "customer" | "ai" | "admin";
  subject: string | null; body: string; created_at: string;
}

const STATUS_BADGE: Record<string, string> = {
  open:     "bg-amber-500/15 text-amber-400",
  resolved: "bg-emerald-500/15 text-emerald-400",
  closed:   "bg-muted text-muted-foreground",
};

const AUTHOR_META: Record<Message["author"], { label: string; icon: typeof User; cls: string }> = {
  customer: { label: "Customer", icon: User, cls: "border-border bg-muted/30" },
  ai:       { label: "AI auto-reply", icon: Bot, cls: "border-primary/20 bg-primary/5" },
  admin:    { label: "You (admin)", icon: ShieldCheck, cls: "border-emerald-500/20 bg-emerald-500/5" },
};

type FolderKey = "unread" | "open" | "sent" | "resolved" | "all";
const FOLDERS: { key: FolderKey; label: string; icon: typeof Inbox }[] = [
  { key: "unread", label: "Unread", icon: MailOpen },
  { key: "open", label: "Inbox", icon: Inbox },
  { key: "sent", label: "Sent", icon: SendHorizontal },
  { key: "resolved", label: "Resolved", icon: CheckCircle2 },
  { key: "all", label: "All", icon: Layers },
];

const isUnread = (t: Ticket) =>
  !!t.last_inbound_at && (!t.read_at || new Date(t.last_inbound_at) > new Date(t.read_at));

const inFolder = (t: Ticket, f: FolderKey) =>
  f === "all" ? true
  : f === "unread" ? isUnread(t)
  : f === "open" ? t.status === "open"
  : f === "sent" ? !!t.replied_at
  : t.status === "resolved";

function prettyCategory(c: string) {
  return (c || "general").replace(/^enterprise_/, "").replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export default function AdminSupport() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [folder, setFolder] = useState<FolderKey>("unread");
  const [grouped, setGrouped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [resolveOnSend, setResolveOnSend] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/support?status=all`);
    const json = await res.json();
    setTickets(json.tickets ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c: Record<FolderKey, number> = { unread: 0, open: 0, sent: 0, resolved: 0, all: tickets.length };
    for (const t of tickets) {
      if (isUnread(t)) c.unread++;
      if (t.status === "open") c.open++;
      if (t.replied_at) c.sent++;
      if (t.status === "resolved") c.resolved++;
    }
    return c;
  }, [tickets]);

  const filtered = useMemo(() => tickets.filter((t) => inFolder(t, folder)), [tickets, folder]);

  const groups = useMemo(() => {
    if (!grouped) return null;
    const map = new Map<string, Ticket[]>();
    for (const t of filtered) {
      const k = t.category || "general";
      (map.get(k) ?? map.set(k, []).get(k)!).push(t);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [filtered, grouped]);

  const loadThread = useCallback(async (id: string) => {
    setThreadLoading(true);
    const res = await fetch(`/api/admin/support/${id}`);
    const json = await res.json();
    if (json.ticket) setSelected(json.ticket);
    setMessages(json.messages ?? []);
    setThreadLoading(false);
  }, []);

  const openTicket = (t: Ticket) => {
    setSelected(t);
    setMessages([]);
    setReply("");
    setResolveOnSend(false);
    // Optimistically mark read locally; the thread GET marks it read server-side.
    setTickets((prev) => prev.map((x) => x.id === t.id ? { ...x, read_at: new Date().toISOString() } : x));
    loadThread(t.id);
  };

  const draftWithAI = async () => {
    if (!selected) return;
    setDrafting(true);
    const res = await fetch(`/api/admin/support/${selected.id}/draft`, { method: "POST" });
    const json = await res.json();
    if (json.draft) setReply(json.draft);
    setDrafting(false);
  };

  const sendReply = async () => {
    if (!selected || !reply.trim()) return;
    setSending(true);
    await fetch(`/api/admin/support/${selected.id}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply, status: resolveOnSend ? "resolved" : "open" }),
    });
    setSending(false);
    setReply("");
    await Promise.all([loadThread(selected.id), load()]);
  };

  const renderRow = (t: Ticket) => {
    const unread = isUnread(t);
    return (
      <li key={t.id}>
        <button onClick={() => openTicket(t)}
          className={cn("w-full text-left px-4 py-3 transition-colors hover:bg-muted/30",
            selected?.id === t.id && "bg-primary/5 border-l-2 border-primary")}>
          <div className="flex items-center justify-between gap-2">
            <p className={cn("truncate text-sm", unread ? "font-bold" : "font-medium")}>
              {unread && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-primary align-middle" />}
              {t.name}
            </p>
            <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize", STATUS_BADGE[t.status] ?? STATUS_BADGE.open)}>
              {t.status}
            </span>
          </div>
          <p className={cn("mt-0.5 truncate text-xs", unread ? "text-foreground" : "text-muted-foreground")}>{t.subject}</p>
          <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{t.email}</span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{timeAgo(t.last_inbound_at ?? t.created_at)}</span>
          </div>
        </button>
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Support Inbox</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every contact email, AI auto-reply, and your replies — managed here.</p>
        </div>
        <button onClick={() => setGrouped((g) => !g)}
          className={cn("inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
            grouped ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted")}>
          <Layers className="h-3.5 w-3.5" /> Group by category
        </button>
      </div>

      {/* Folder tabs */}
      <div className="flex flex-wrap gap-2">
        {FOLDERS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setFolder(key)}
            className={cn("inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
              folder === key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted")}>
            <Icon className="h-3.5 w-3.5" /> {label}
            <span className={cn("rounded-full px-1.5 text-[10px]", folder === key ? "bg-primary/20" : "bg-muted")}>{counts[key]}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Ticket list */}
        <div className="lg:col-span-2 overflow-hidden rounded-2xl border border-border bg-card">
          {loading ? (
            <div className="flex h-40 items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
              Nothing in {FOLDERS.find((f) => f.key === folder)?.label}.
            </div>
          ) : groups ? (
            <div className="divide-y divide-border">
              {groups.map(([cat, items]) => (
                <div key={cat}>
                  <p className="bg-muted/40 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {prettyCategory(cat)} · {items.length}
                  </p>
                  <ul className="divide-y divide-border">{items.map(renderRow)}</ul>
                </div>
              ))}
            </div>
          ) : (
            <ul className="divide-y divide-border">{filtered.map(renderRow)}</ul>
          )}
        </div>

        {/* Thread + reply */}
        <div className="lg:col-span-3">
          {!selected ? (
            <div className="flex h-64 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground text-sm">
              Select a ticket to view the conversation and reply
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="font-bold">{selected.subject}</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">{selected.name} · {selected.email}</p>
                  <span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize", STATUS_BADGE[selected.status])}>
                    {selected.status}
                  </span>
                </div>
                <span className="rounded-lg bg-muted px-2.5 py-1 text-xs text-muted-foreground">{prettyCategory(selected.category)}</span>
              </div>

              {/* Thread */}
              {threadLoading ? (
                <div className="flex h-24 items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : (
                <div className="space-y-3">
                  {messages.map((m) => {
                    const meta = AUTHOR_META[m.author];
                    const Icon = meta.icon;
                    return (
                      <div key={m.id} className={cn("rounded-xl border p-4", meta.cls)}>
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-xs font-semibold">
                            <Icon className="h-3.5 w-3.5" /> {meta.label}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{timeAgo(m.created_at)}</span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.body}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Reply box */}
              <div className="border-t border-border pt-4">
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium">Reply to {selected.name}</label>
                  <button onClick={draftWithAI} disabled={drafting}
                    title="Generate a reply with AI (includes relevant How-To Guide links)"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50">
                    {drafting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    Generate with AI
                  </button>
                </div>
                <textarea value={reply} onChange={(e) => setReply(e.target.value)}
                  placeholder={`Hi ${selected.name},\n\n`}
                  rows={6}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
                <div className="mt-3 flex items-center gap-3">
                  <button onClick={sendReply} disabled={sending || !reply.trim()}
                    className="btn-cta inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold disabled:opacity-50">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {sending ? "Sending…" : "Send reply"}
                  </button>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input type="checkbox" checked={resolveOnSend} onChange={(e) => setResolveOnSend(e.target.checked)} className="rounded border-border" />
                    Mark resolved
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
