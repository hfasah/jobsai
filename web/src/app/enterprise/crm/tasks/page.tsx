"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, CheckSquare, Square, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { type CrmTask } from "@/lib/crm-shared";
import { fmtDate } from "@/components/enterprise/crm/crm-ui";

type Row = CrmTask & {
  company?: { id: string; name: string } | null;
  contact?: { id: string; first_name: string; last_name: string | null } | null;
};

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
const endOfToday = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime(); };

function TaskRow({ t, onToggle, onRemove }: { t: Row; onToggle: (t: Row) => void; onRemove: (t: Row) => void }) {
  const done = t.status === "done";
  return (
    <li className="group flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5">
      <button onClick={() => onToggle(t)} className="shrink-0 text-muted-foreground hover:text-primary">
        {done ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm", done && "text-muted-foreground line-through")}>{t.title}</p>
        <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
          {t.due_at && <span>Due {fmtDate(t.due_at)}</span>}
          {t.company && <Link href={`/enterprise/crm/companies/${t.company.id}`} className="hover:text-primary">· {t.company.name}</Link>}
          {t.contact && <Link href={`/enterprise/crm/contacts/${t.contact.id}`} className="hover:text-primary">· {t.contact.first_name} {t.contact.last_name ?? ""}</Link>}
        </div>
      </div>
      <button onClick={() => onRemove(t)} className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

function Section({ title, rows, tone, onToggle, onRemove }: { title: string; rows: Row[]; tone?: string; onToggle: (t: Row) => void; onRemove: (t: Row) => void }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <h2 className={cn("mb-2 text-xs font-semibold uppercase tracking-wide", tone ?? "text-muted-foreground")}>{title} ({rows.length})</h2>
      <ul className="space-y-1.5">{rows.map((t) => <TaskRow key={t.id} t={t} onToggle={onToggle} onRemove={onRemove} />)}</ul>
    </div>
  );
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetch("/api/enterprise/crm/tasks").then((r) => r.json()).then((j) => setTasks(j.data ?? [])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = async (t: Row) => {
    setTasks((ts) => ts.map((x) => x.id === t.id ? { ...x, status: t.status === "done" ? "open" : "done" } : x));
    await fetch(`/api/enterprise/crm/tasks/${t.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: t.status === "done" ? "open" : "done" }) });
    load();
  };
  const remove = async (t: Row) => { await fetch(`/api/enterprise/crm/tasks/${t.id}`, { method: "DELETE" }); load(); };

  const groups = useMemo(() => {
    const open = tasks.filter((t) => t.status === "open");
    const sot = startOfToday(), eot = endOfToday();
    const due = (t: Row) => (t.due_at ? new Date(t.due_at).getTime() : null);
    return {
      overdue: open.filter((t) => { const d = due(t); return d !== null && d < sot; }),
      today: open.filter((t) => { const d = due(t); return d !== null && d >= sot && d <= eot; }),
      upcoming: open.filter((t) => { const d = due(t); return d !== null && d > eot; }),
      noDate: open.filter((t) => due(t) === null),
      done: tasks.filter((t) => t.status === "done").slice(0, 20),
    };
  }, [tasks]);

  const noneOpen = groups.overdue.length + groups.today.length + groups.upcoming.length + groups.noDate.length === 0;

  return (
    <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-xl font-bold">Tasks</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Your follow-ups across every client.</p>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : tasks.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-border py-16 text-center">
            <CheckSquare className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No tasks yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">Add follow-ups from any company or contact.</p>
          </div>
        ) : (
          <div className="mt-5 space-y-6">
            <Section title="Overdue" rows={groups.overdue} tone="text-red-500" onToggle={toggle} onRemove={remove} />
            <Section title="Today" rows={groups.today} tone="text-amber-500" onToggle={toggle} onRemove={remove} />
            <Section title="Upcoming" rows={groups.upcoming} onToggle={toggle} onRemove={remove} />
            <Section title="No due date" rows={groups.noDate} onToggle={toggle} onRemove={remove} />
            {noneOpen && <p className="py-4 text-center text-sm text-muted-foreground">All caught up. 🎉</p>}
            <Section title="Completed" rows={groups.done} onToggle={toggle} onRemove={remove} />
          </div>
        )}
      </div>
    </main>
  );
}
