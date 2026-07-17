"use client";

// Master inbox / AI SDR — unified reply threads across campaigns and sourcing
// outreach, with AI intent labels, filters, assignment, manual override, and a
// reply composer. Positive intents surface at the top; deliverability/auto
// actions already ran server-side (this is where humans act on them).
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Inbox, Loader2, Send, Star, CalendarClock, UserX, MailX, Share2, Moon,
  Check, CircleDot, Search, RefreshCw, ChevronDown, Flame, Bot, Pencil,
  HelpCircle, UserRoundX,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Intent =
  | "interested" | "not_interested" | "out_of_office" | "referral"
  | "unsubscribe" | "meeting_requested" | "question" | "wrong_person" | "neutral";

type InterestLevel = "none" | "low" | "medium" | "high" | "very_high";

// Only medium+ is worth a chip — low/none would just be noise on cold replies.
const INTEREST_META: Record<InterestLevel, { label: string; cls: string } | null> = {
  none: null,
  low: null,
  medium:    { label: "Medium interest",    cls: "border-amber-500/30 bg-amber-500/10 text-amber-400" },
  high:      { label: "High interest",       cls: "border-orange-500/40 bg-orange-500/10 text-orange-400" },
  very_high: { label: "Very high interest",  cls: "border-red-500/40 bg-red-500/15 text-red-400" },
};

const INTENT_META: Record<Intent, { label: string; cls: string; icon: typeof Star }> = {
  interested:        { label: "Interested",     cls: "border-green-500/30 bg-green-500/10 text-green-400",   icon: Star },
  meeting_requested: { label: "Meeting",        cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400", icon: CalendarClock },
  referral:          { label: "Referral",       cls: "border-sky-500/30 bg-sky-500/10 text-sky-400",        icon: Share2 },
  question:          { label: "Question",       cls: "border-violet-500/30 bg-violet-500/10 text-violet-400", icon: HelpCircle },
  neutral:           { label: "Neutral",        cls: "border-border bg-muted/30 text-muted-foreground",     icon: CircleDot },
  out_of_office:     { label: "Out of office",  cls: "border-amber-500/30 bg-amber-500/10 text-amber-400",  icon: Moon },
  not_interested:    { label: "Not interested", cls: "border-slate-500/30 bg-slate-500/10 text-slate-400",  icon: UserX },
  wrong_person:      { label: "Wrong person",   cls: "border-slate-500/30 bg-slate-500/10 text-slate-400",  icon: UserRoundX },
  unsubscribe:       { label: "Unsubscribed",   cls: "border-red-500/30 bg-red-500/10 text-red-400",        icon: MailX },
};
const INTENT_ORDER: Intent[] = ["interested", "meeting_requested", "question", "referral", "neutral", "out_of_office", "not_interested", "wrong_person", "unsubscribe"];

interface ThreadRow {
  id: string; candidate_email: string; candidate_name: string | null; application_id: string | null;
  intent: Intent | null; intent_confidence: number | null; intent_manual: boolean;
  interest_score: number | null; interest_level: InterestLevel | null;
  ai_summary: string | null; status: "open" | "snoozed" | "done"; assignee_user_id: string | null;
  last_inbound_at: string | null; reply_count: number; unread: boolean; has_ai_draft?: boolean;
}
interface AiDraft { id: string; draft_subject: string | null; draft_body: string; model: string | null }
interface Message { id: string; direction: "inbound" | "outbound"; from_email: string | null; subject: string | null; body: string | null; created_at: string; sent_via: string | null }

function IntentBadge({ intent, confidence, manual }: { intent: Intent | null; confidence: number | null; manual: boolean }) {
  const meta = INTENT_META[intent ?? "neutral"];
  const Icon = meta.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium", meta.cls)}>
      <Icon className="h-3 w-3" /> {meta.label}
      {!manual && confidence != null && confidence < 0.6 && <span className="opacity-60">?</span>}
      {manual && <span className="opacity-60">•</span>}
    </span>
  );
}

function InterestBadge({ level }: { level: InterestLevel | null }) {
  const meta = level ? INTEREST_META[level] : null;
  if (!meta) return null;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold", meta.cls)}>
      <Flame className="h-3 w-3" /> {meta.label}
    </span>
  );
}

function InboxInner() {
  const params = useSearchParams();
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [counts, setCounts] = useState({ open: 0, unread: 0 });
  const [me, setMe] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(params.get("thread"));
  const [detail, setDetail] = useState<{ thread: ThreadRow; messages: Message[]; suppressed?: boolean } | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [aiDraft, setAiDraft] = useState<AiDraft | null>(null);
  const [resubBusy, setResubBusy] = useState(false);
  const [resubMsg, setResubMsg] = useState<string | null>(null);
  const [draftBusy, setDraftBusy] = useState(false);

  const [filterStatus, setFilterStatus] = useState<"open" | "done" | "all">("open");
  const [filterIntent, setFilterIntent] = useState<Intent | "">("");
  const [filterAssignee, setFilterAssignee] = useState<"" | "me" | "unassigned">("");
  const [sort, setSort] = useState<"recent" | "interest">("recent");
  const [query, setQuery] = useState("");

  const loadList = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (filterStatus !== "all") qs.set("status", filterStatus);
    if (filterIntent) qs.set("intent", filterIntent);
    if (filterAssignee) qs.set("assignee", filterAssignee);
    if (sort === "interest") qs.set("sort", "interest");
    if (query.trim()) qs.set("q", query.trim());
    const res = await fetch(`/api/enterprise/outreach/inbox?${qs}`);
    const json = await res.json();
    if (res.ok) {
      setThreads(json.data.threads ?? []);
      setCounts(json.data.counts ?? { open: 0, unread: 0 });
      setMe(json.data.me ?? "");
    }
    setLoading(false);
  }, [filterStatus, filterIntent, filterAssignee, sort, query]);

  useEffect(() => { loadList(); }, [loadList]);

  const openThread = useCallback(async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setReply("");
    setReplyError(null);
    setAiDraft(null);
    const res = await fetch(`/api/enterprise/outreach/inbox/${id}`);
    const json = await res.json();
    if (res.ok) {
      setDetail(json.data);
      // reflect read state in the list without a refetch
      setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, unread: false } : t)));
    }
    // Fetch any pending AI SDR draft for this thread.
    fetch(`/api/enterprise/outreach/inbox/${id}/ai-draft`)
      .then((r) => r.json())
      .then((j) => setAiDraft(j.data ?? null))
      .catch(() => {});
  }, []);

  const actOnDraft = async (action: "send" | "dismiss", body?: string) => {
    if (!selectedId) return;
    setDraftBusy(true);
    const res = await fetch(`/api/enterprise/outreach/inbox/${selectedId}/ai-draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, body }),
    });
    setDraftBusy(false);
    if (res.ok) {
      setReplyError(null);
      setAiDraft(null);
      if (action === "send") { openThread(selectedId); loadList(); }
    } else {
      // Surface why (e.g. the agreed slot could not be booked) — a silent
      // failure reads as a dead button.
      const j = await res.json().catch(() => null);
      setReplyError((j as { error?: string } | null)?.error ?? `Could not ${action} the draft (HTTP ${res.status}).`);
    }
  };

  useEffect(() => {
    const initial = params.get("thread");
    if (initial) openThread(initial);
  }, [params, openThread]);

  const patchThread = async (id: string, patch: Record<string, unknown>) => {
    await fetch(`/api/enterprise/outreach/inbox/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    loadList();
    if (detail?.thread.id === id) openThread(id);
  };

  const sendReply = async () => {
    if (!selectedId || !reply.trim()) return;
    setSending(true);
    setReplyError(null);
    const res = await fetch(`/api/enterprise/outreach/inbox/${selectedId}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: reply }),
    });
    const json = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) { setReplyError(json.error ?? "Could not send."); return; }
    setReply("");
    openThread(selectedId);
  };

  return (
    <main className="flex h-full flex-1 overflow-hidden">
      {/* List column */}
      <div className="flex w-full max-w-sm shrink-0 flex-col border-r border-border">
        <div className="border-b border-border p-3">
          <h1 className="mb-2 flex items-center gap-2 text-lg font-bold">
            <Inbox className="h-5 w-5 text-primary" /> AI SDR Inbox
            {counts.unread > 0 && (
              <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[11px] font-semibold text-primary">{counts.unread} new</span>
            )}
            <button onClick={loadList} className="ml-auto text-muted-foreground hover:text-foreground" aria-label="Refresh"><RefreshCw className="h-3.5 w-3.5" /></button>
          </h1>
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or email"
              className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {(["open", "done", "all"] as const).map((s) => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", filterStatus === s ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}>
                {s}
              </button>
            ))}
            <span className="mx-1 text-border">|</span>
            {(["", "me", "unassigned"] as const).map((a) => (
              <button key={a} onClick={() => setFilterAssignee(a)}
                className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", filterAssignee === a ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}>
                {a === "" ? "Everyone" : a === "me" ? "Mine" : "Unassigned"}
              </button>
            ))}
            <span className="mx-1 text-border">|</span>
            <button onClick={() => setSort((s) => (s === "interest" ? "recent" : "interest"))}
              className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", sort === "interest" ? "bg-orange-500/15 text-orange-400" : "text-muted-foreground hover:text-foreground")}>
              <Flame className="h-3 w-3" /> Hottest
            </button>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <button onClick={() => setFilterIntent("")}
              className={cn("rounded-full border px-1.5 py-0.5 text-[10px]", filterIntent === "" ? "border-primary/40 text-primary" : "border-border text-muted-foreground")}>
              All intents
            </button>
            {INTENT_ORDER.map((i) => (
              <button key={i} onClick={() => setFilterIntent(filterIntent === i ? "" : i)}
                className={cn("rounded-full border px-1.5 py-0.5 text-[10px]", filterIntent === i ? INTENT_META[i].cls : "border-border text-muted-foreground hover:text-foreground")}>
                {INTENT_META[i].label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && threads.length === 0 ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : threads.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <Inbox className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No replies yet.</p>
              <p className="mt-1 text-xs text-muted-foreground">When candidates reply to your outreach, they land here — auto-classified and de-duplicated.</p>
            </div>
          ) : (
            threads.map((t) => (
              <button
                key={t.id}
                onClick={() => openThread(t.id)}
                className={cn(
                  "flex w-full flex-col gap-1 border-b border-border/60 px-3 py-2.5 text-left transition-colors",
                  selectedId === t.id ? "bg-primary/5" : "hover:bg-muted/30",
                )}
              >
                <div className="flex items-center gap-2">
                  {t.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  <span className={cn("truncate text-sm", t.unread ? "font-semibold" : "font-medium")}>
                    {t.candidate_name || t.candidate_email}
                  </span>
                  <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                    {t.last_inbound_at ? new Date(t.last_inbound_at).toLocaleDateString() : ""}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <IntentBadge intent={t.intent} confidence={t.intent_confidence} manual={t.intent_manual} />
                  <InterestBadge level={t.interest_level} />
                  {t.has_ai_draft && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      <Bot className="h-3 w-3" /> AI draft
                    </span>
                  )}
                  {t.assignee_user_id && <span className="rounded bg-muted px-1 py-0.5 text-[9px] text-muted-foreground">{t.assignee_user_id === me ? "you" : "assigned"}</span>}
                  {t.reply_count > 1 && <span className="text-[10px] text-muted-foreground">{t.reply_count} replies</span>}
                </div>
                {t.ai_summary && <p className="truncate text-xs text-muted-foreground">{t.ai_summary}</p>}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Detail column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {!detail ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            {selectedId ? <Loader2 className="h-5 w-5 animate-spin" /> : "Select a conversation"}
          </div>
        ) : (
          <>
            {/* Thread header + actions */}
            <div className="border-b border-border p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-base font-semibold">{detail.thread.candidate_name || detail.thread.candidate_email}</h2>
                    <InterestBadge level={detail.thread.interest_level} />
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{detail.thread.candidate_email}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <IntentSelect current={detail.thread.intent} onPick={(intent) => patchThread(detail.thread.id, { intent })} />
                  <button
                    onClick={() => patchThread(detail.thread.id, { assignee_user_id: detail.thread.assignee_user_id === me ? null : "me" })}
                    className={cn("rounded-lg border px-2 py-1 text-[11px] font-medium", detail.thread.assignee_user_id === me ? "border-primary/40 text-primary" : "border-border text-muted-foreground hover:text-foreground")}
                  >
                    {detail.thread.assignee_user_id === me ? "Assigned to you" : "Assign to me"}
                  </button>
                  <button
                    onClick={() => patchThread(detail.thread.id, { status: detail.thread.status === "done" ? "open" : "done" })}
                    className={cn("rounded-lg border px-2 py-1 text-[11px] font-medium", detail.thread.status === "done" ? "border-green-500/40 text-green-400" : "border-border text-muted-foreground hover:text-foreground")}
                  >
                    <Check className="mr-1 inline h-3 w-3" />{detail.thread.status === "done" ? "Done" : "Mark done"}
                  </button>
                </div>
              </div>
              {detail.thread.ai_summary && (
                <p className="mt-2 rounded-lg bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">AI:</span> {detail.thread.ai_summary}
                </p>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {detail.messages.length === 0 && <p className="text-center text-xs text-muted-foreground">No message history captured.</p>}
              {detail.messages.map((m) => (
                <div key={m.id} className={cn("flex", m.direction === "outbound" ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[80%] rounded-2xl px-3 py-2 text-sm", m.direction === "outbound" ? "bg-primary/10 text-foreground" : "bg-muted/50")}>
                    {m.subject && <p className="mb-0.5 text-[11px] font-semibold text-muted-foreground">{m.subject}</p>}
                    <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
                      {new Date(m.created_at).toLocaleString()}
                      {m.sent_via === "ai_sdr" && <span className="inline-flex items-center gap-0.5 text-primary/70"><Bot className="h-2.5 w-2.5" /> AI SDR</span>}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Composer */}
            <div className="border-t border-border p-3">
              {(detail.thread.intent === "unsubscribe" || detail.suppressed) ? (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-400">
                  <p>This contact is on the Do-Not-Contact list — auto-replies and sends are blocked.</p>
                  <button
                    onClick={async () => {
                      if (!selectedId) return;
                      setResubBusy(true);
                      setResubMsg(null);
                      const res = await fetch(`/api/enterprise/outreach/inbox/${selectedId}/resubscribe`, { method: "POST" });
                      const j = await res.json().catch(() => ({}));
                      setResubBusy(false);
                      if (res.ok) {
                        setResubMsg(`Undone — removed ${j.data?.suppressions_removed ?? 0} block(s), restored ${j.data?.enrollments_restored ?? 0} enrollment(s).`);
                        openThread(selectedId);
                        loadList();
                      } else {
                        setResubMsg(j.error ?? `Undo failed (${res.status}).`);
                      }
                    }}
                    disabled={resubBusy}
                    className="mt-1.5 rounded-lg border border-red-500/40 px-3 py-1 font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-60"
                  >
                    {resubBusy ? "Undoing…" : "Undo — they didn't unsubscribe"}
                  </button>
                  {resubMsg && <p className="mt-1.5 text-[11px]">{resubMsg}</p>}
                </div>
              ) : (
                <>
                  {aiDraft && (
                    <div className="mb-2 rounded-xl border border-primary/40 bg-primary/5 p-2.5">
                      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-primary">
                        <Bot className="h-3.5 w-3.5" /> AI SDR suggests a reply
                      </div>
                      <p className="mb-2 max-h-32 overflow-y-auto whitespace-pre-wrap text-xs text-foreground/90">{aiDraft.draft_body}</p>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => actOnDraft("send")}
                          disabled={draftBusy}
                          className="btn-cta inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold disabled:opacity-60"
                        >
                          {draftBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Approve &amp; send
                        </button>
                        <button
                          onClick={() => { setReply(aiDraft.draft_body); actOnDraft("dismiss"); }}
                          disabled={draftBusy}
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-60"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                        <button
                          onClick={() => actOnDraft("dismiss")}
                          disabled={draftBusy}
                          className="rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-red-400 disabled:opacity-60"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  )}
                  {replyError && <p className="mb-1.5 text-xs text-red-400">{replyError}</p>}
                  <div className="flex items-end gap-2">
                    <textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendReply(); }}
                      rows={2}
                      placeholder="Write a reply…  (⌘/Ctrl+Enter to send)"
                      className="flex-1 resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                      onClick={sendReply}
                      disabled={sending || !reply.trim()}
                      className="btn-cta inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-60"
                    >
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function IntentSelect({ current, onPick }: { current: Intent | null; onPick: (i: Intent) => void }) {
  const [open, setOpen] = useState(false);
  const meta = INTENT_META[current ?? "neutral"];
  return (
    <span className="relative">
      <button onClick={() => setOpen((o) => !o)} className={cn("inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium", meta.cls)}>
        <meta.icon className="h-3 w-3" /> {meta.label} <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-30 w-40 rounded-xl border border-border bg-card p-1 shadow-2xl" onMouseLeave={() => setOpen(false)}>
          {INTENT_ORDER.map((i) => (
            <button key={i} onClick={() => { onPick(i); setOpen(false); }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-muted/50">
              <span className={cn("inline-flex h-4 w-4 items-center justify-center rounded-full", INTENT_META[i].cls)}>
                {(() => { const I = INTENT_META[i].icon; return <I className="h-2.5 w-2.5" />; })()}
              </span>
              {INTENT_META[i].label}
            </button>
          ))}
          <p className="px-2 pb-1 pt-1.5 text-[9px] text-muted-foreground">Overriding sets the label manually.</p>
        </div>
      )}
    </span>
  );
}

export default function OutreachInboxPage() {
  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <InboxInner />
    </Suspense>
  );
}
