"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Mail, Clock, CheckCircle2, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface Ticket {
  id: string; name: string; email: string; subject: string;
  message: string; category: string; status: string;
  admin_reply: string | null; created_at: string; replied_at: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  open:     "bg-amber-500/15 text-amber-400",
  resolved: "bg-emerald-500/15 text-emerald-400",
  closed:   "bg-muted text-muted-foreground",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export default function AdminSupport() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [statusFilter, setStatusFilter] = useState("open");
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/support?status=${statusFilter}`);
    const json = await res.json();
    setTickets(json.tickets ?? []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const sendReply = async () => {
    if (!selected || !reply.trim()) return;
    setSending(true);
    await fetch(`/api/admin/support/${selected.id}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply, status: "resolved" }),
    });
    setSending(false);
    setReply("");
    setSelected(null);
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Support Inbox</h1>
          <p className="mt-1 text-sm text-muted-foreground">support@jobsai.work</p>
        </div>
        <div className="flex gap-2">
          {["open", "resolved", "all"].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn("rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                statusFilter === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted")}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Ticket list */}
        <div className="lg:col-span-2 overflow-hidden rounded-2xl border border-border bg-card">
          {loading ? (
            <div className="flex h-40 items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading…
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
              No {statusFilter} tickets.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {tickets.map((t) => (
                <li key={t.id}>
                  <button onClick={() => { setSelected(t); setReply(""); }}
                    className={cn("w-full text-left px-4 py-3 transition-colors hover:bg-muted/30",
                      selected?.id === t.id && "bg-primary/5 border-l-2 border-primary")}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold truncate">{t.name}</p>
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize", STATUS_BADGE[t.status] ?? STATUS_BADGE.open)}>
                        {t.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground truncate">{t.subject}</p>
                    <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{t.email}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{timeAgo(t.created_at)}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Ticket detail + reply */}
        <div className="lg:col-span-3">
          {!selected ? (
            <div className="flex h-64 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground text-sm">
              Select a ticket to view and reply
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="font-bold">{selected.subject}</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {selected.name} · {selected.email} · {timeAgo(selected.created_at)}
                  </p>
                  <span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize", STATUS_BADGE[selected.status])}>
                    {selected.status}
                  </span>
                </div>
                <span className="rounded-lg bg-muted px-2.5 py-1 text-xs capitalize text-muted-foreground">{selected.category}</span>
              </div>

              {/* Message */}
              <div className="rounded-xl bg-muted/30 p-4 text-sm whitespace-pre-wrap">
                {selected.message}
              </div>

              {/* Previous reply */}
              {selected.admin_reply && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-xs font-semibold text-primary mb-2 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Your previous reply
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{selected.admin_reply}</p>
                </div>
              )}

              {/* Reply box */}
              <div>
                <label className="block text-sm font-medium mb-2">Reply to {selected.name}</label>
                <textarea value={reply} onChange={(e) => setReply(e.target.value)}
                  placeholder={`Hi ${selected.name},\n\n`}
                  rows={6}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
                <div className="mt-3 flex gap-3">
                  <button onClick={sendReply} disabled={sending || !reply.trim()}
                    className="btn-cta inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold disabled:opacity-50">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {sending ? "Sending…" : "Send reply"}
                  </button>
                  <button onClick={() => setSelected(null)}
                    className="rounded-xl border border-border px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
