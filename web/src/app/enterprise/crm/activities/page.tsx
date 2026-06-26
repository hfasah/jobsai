"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2, Activity as ActivityIcon, Phone, Mail, CalendarDays, Link2, StickyNote,
  CheckSquare, FileSignature, UserPlus, Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ACTIVITY_TYPES, labelFor, type CrmActivity } from "@/lib/crm-shared";
import { relativeTime } from "@/components/enterprise/crm/crm-ui";

const ICON: Record<string, typeof Phone> = {
  call: Phone, email: Mail, meeting: CalendarDays, linkedin: Link2, note: StickyNote,
  task: CheckSquare, proposal_sent: FileSignature, client_intake: UserPlus,
  candidate_submitted: Send, interview_scheduled: CalendarDays, offer_update: FileSignature,
};

type Row = CrmActivity & {
  company?: { id: string; name: string } | null;
  contact?: { id: string; first_name: string; last_name: string | null } | null;
};

export default function ActivitiesPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const load = useCallback(() => {
    const qs = filter === "all" ? "" : `?type=${filter}`;
    fetch(`/api/enterprise/crm/activities${qs}`).then((r) => r.json()).then((j) => setItems(j.data ?? [])).finally(() => setLoading(false));
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  return (
    <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-xl font-bold">Activities</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Everything logged across your clients.</p>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {["all", ...ACTIVITY_TYPES].map((t) => (
            <button key={t} onClick={() => setFilter(t)}
              className={cn("rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                filter === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
              {t === "all" ? "All" : labelFor(t)}
            </button>
          ))}
        </div>

        <div className="mt-5">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border py-16 text-center">
              <ActivityIcon className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No activity yet.</p>
              <p className="mt-1 text-xs text-muted-foreground">Log calls, emails, and notes from any client or contact.</p>
            </div>
          ) : (
            <ol className="space-y-3">
              {items.map((a) => {
                const Icon = ICON[a.type] ?? StickyNote;
                return (
                  <li key={a.id} className="flex gap-3 rounded-xl border border-border bg-card p-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                        <span className="font-semibold">{labelFor(a.type)}</span>
                        {a.company && <Link href={`/enterprise/crm/companies/${a.company.id}`} className="text-muted-foreground hover:text-primary">{a.company.name}</Link>}
                        {a.contact && <Link href={`/enterprise/crm/contacts/${a.contact.id}`} className="text-muted-foreground hover:text-primary">· {a.contact.first_name} {a.contact.last_name ?? ""}</Link>}
                        <span className="text-muted-foreground">· {relativeTime(a.occurred_at)}</span>
                      </div>
                      {a.subject && <p className="mt-0.5 text-sm font-medium">{a.subject}</p>}
                      {a.body && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </main>
  );
}
