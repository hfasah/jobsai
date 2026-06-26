"use client";

import { useState } from "react";
import {
  Phone, Mail, CalendarDays, Link2, StickyNote, CheckSquare, Square,
  FileSignature, UserPlus, Send, Loader2, Plus, Trash2,
} from "lucide-react";
import { ACTIVITY_TYPES, labelFor, type CrmActivity, type CrmTask } from "@/lib/crm-shared";
import { cn } from "@/lib/utils";
import { TextInput, TextArea, relativeTime, fmtDate, isOverdue } from "./crm-ui";

const ACTIVITY_ICON: Record<string, typeof Phone> = {
  call: Phone, email: Mail, meeting: CalendarDays, linkedin: Link2, note: StickyNote,
  task: CheckSquare, proposal_sent: FileSignature, client_intake: UserPlus,
  candidate_submitted: Send, interview_scheduled: CalendarDays, offer_update: FileSignature,
};

type Scope = { company_id?: string; contact_id?: string };

// ─── Activity timeline + quick composer ──────────────────────────────────────
export function ActivityTimeline({ scope, activities, onChanged }: { scope: Scope; activities: CrmActivity[]; onChanged: () => void }) {
  const [type, setType] = useState("note");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const log = async () => {
    if (!subject.trim() && !body.trim()) return;
    setSaving(true);
    const res = await fetch("/api/enterprise/crm/activities", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...scope, type, subject, body }),
    });
    setSaving(false);
    if (res.ok) { setSubject(""); setBody(""); setType("note"); onChanged(); }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card/40 p-3">
        <div className="mb-2 flex flex-wrap gap-1">
          {ACTIVITY_TYPES.filter((t) => t !== "task").map((t) => {
            const Icon = ACTIVITY_ICON[t] ?? StickyNote;
            return (
              <button key={t} onClick={() => setType(t)}
                className={cn("inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors",
                  type === t ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>
                <Icon className="h-3 w-3" /> {labelFor(t)}
              </button>
            );
          })}
        </div>
        <TextInput value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={`${labelFor(type)} summary…`} className="mb-2" />
        <TextArea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Details (optional)…" className="mb-2 min-h-[56px]" />
        <button onClick={log} disabled={saving || (!subject.trim() && !body.trim())}
          className="btn-cta inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Log activity
        </button>
      </div>

      {activities.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No activity logged yet.</p>
      ) : (
        <ol className="space-y-3">
          {activities.map((a) => {
            const Icon = ACTIVITY_ICON[a.type] ?? StickyNote;
            return (
              <li key={a.id} className="flex gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">{labelFor(a.type)}</span>
                    <span className="text-xs text-muted-foreground">· {relativeTime(a.occurred_at)}</span>
                  </div>
                  {a.subject && <p className="text-sm font-medium">{a.subject}</p>}
                  {a.body && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p>}
                  {a.next_step && <p className="mt-0.5 text-xs text-muted-foreground"><span className="font-medium">Next:</span> {a.next_step}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

// ─── Tasks panel (inline add + toggle complete) ──────────────────────────────
export function TasksPanel({ scope, tasks, onChanged }: { scope: Scope; tasks: CrmTask[]; onChanged: () => void }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const res = await fetch("/api/enterprise/crm/tasks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...scope, title, due_at: due ? new Date(due).toISOString() : null }),
    });
    setSaving(false);
    if (res.ok) { setTitle(""); setDue(""); onChanged(); }
  };

  const toggle = async (t: CrmTask) => {
    await fetch(`/api/enterprise/crm/tasks/${t.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: t.status === "done" ? "open" : "done" }),
    });
    onChanged();
  };

  const remove = async (t: CrmTask) => {
    await fetch(`/api/enterprise/crm/tasks/${t.id}`, { method: "DELETE" });
    onChanged();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-card/40 p-3">
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New follow-up task…" className="min-w-[180px] flex-1" />
        <TextInput type="date" value={due} onChange={(e) => setDue(e.target.value)} className="w-auto" />
        <button onClick={add} disabled={saving || !title.trim()}
          className="btn-cta inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
        </button>
      </div>

      {tasks.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No tasks yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {tasks.map((t) => {
            const done = t.status === "done";
            return (
              <li key={t.id} className="group flex items-center gap-2.5 rounded-lg border border-border px-3 py-2">
                <button onClick={() => toggle(t)} className="shrink-0 text-muted-foreground hover:text-primary">
                  {done ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm", done && "text-muted-foreground line-through")}>{t.title}</p>
                  {t.due_at && (
                    <p className={cn("text-xs", !done && isOverdue(t.due_at) ? "text-red-500" : "text-muted-foreground")}>
                      Due {fmtDate(t.due_at)}
                    </p>
                  )}
                </div>
                <button onClick={() => remove(t)} className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
