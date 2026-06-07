"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CalendarDays, Loader2, Video, Phone, MapPin, ExternalLink, X, Clock, CheckCircle2, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Interview {
  id: string; candidate_name: string; candidate_email: string; title: string;
  interview_type: string; provider: string | null; meeting_link: string | null; location: string | null;
  scheduled_at: string; duration_min: number; interviewers: string | null; interviewer_emails: string[];
  status: string; notes: string | null;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  scheduled: { label: "Awaiting confirm", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  confirmed: { label: "Confirmed", color: "bg-green-500/15 text-green-400 border-green-500/30" },
  completed: { label: "Completed", color: "bg-muted text-muted-foreground border-border" },
  cancelled: { label: "Cancelled", color: "bg-red-500/15 text-red-400 border-red-500/30" },
  no_show:   { label: "No-show", color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
};

const TYPE_ICON: Record<string, React.ElementType> = { video: Video, phone: Phone, onsite: MapPin };

export default function SchedulePage() {
  const [items, setItems] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"upcoming" | "all">("upcoming");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/enterprise/schedule?scope=${scope}`);
    const j = await res.json();
    setItems(j.data ?? []);
    setLoading(false);
  }, [scope]);
  useEffect(() => { load(); }, [load]);

  const update = async (id: string, patch: Record<string, unknown>) => {
    await fetch(`/api/enterprise/schedule/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    setItems((it) => it.map((x) => x.id === id ? { ...x, ...patch } as Interview : x));
  };
  const cancel = async (id: string) => {
    if (!confirm("Cancel this interview and notify the candidate?")) return;
    await fetch(`/api/enterprise/schedule/${id}`, { method: "DELETE" });
    setItems((it) => it.map((x) => x.id === id ? { ...x, status: "cancelled" } : x));
  };

  // group by date
  const groups: Record<string, Interview[]> = {};
  for (const i of items) {
    const d = new Date(i.scheduled_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    (groups[d] ??= []).push(i);
  }

  return (
    <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><CalendarDays className="h-6 w-6 text-primary" /> Interview Schedule</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Booked interviews with calendar invites, reminders, and one-click join.</p>
          </div>
          <div className="inline-flex rounded-xl border border-border bg-muted/40 p-1">
            {(["upcoming", "all"] as const).map((s) => (
              <button key={s} onClick={() => setScope(s)} className={cn("rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors", scope === s ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>{s}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-16 text-center">
            <CalendarDays className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No interviews scheduled.</p>
            <p className="mt-1 text-xs text-muted-foreground">Schedule one from a candidate&apos;s card in any job&apos;s pool.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groups).map(([date, list]) => (
              <div key={date}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{date}</p>
                <div className="space-y-2">
                  {list.map((i) => {
                    const Icon = TYPE_ICON[i.interview_type] ?? Video;
                    const meta = STATUS_META[i.status] ?? STATUS_META.scheduled;
                    const time = new Date(i.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                    const past = new Date(i.scheduled_at).getTime() < Date.now();
                    const canceled = i.status === "cancelled";
                    return (
                      <div key={i.id} className={cn("rounded-2xl border border-border bg-card p-4", canceled && "opacity-60")}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-primary shrink-0" />
                              <p className="font-medium truncate">{i.candidate_name}</p>
                              <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", meta.color)}>{meta.label}</span>
                            </div>
                            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="h-3 w-3" /> {time} · {i.duration_min} min · {i.title}</p>
                            {i.interviewers && <p className="text-xs text-muted-foreground">Interviewers: {i.interviewers}</p>}
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            {!canceled && (i.meeting_link || i.location) && (
                              <a href={i.meeting_link || undefined} target="_blank" rel="noopener noreferrer"
                                className="btn-cta inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold">
                                {i.interview_type === "onsite" ? <MapPin className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />}
                                {i.interview_type === "onsite" ? "Location" : "Join"}
                              </a>
                            )}
                          </div>
                        </div>
                        {!canceled && (
                          <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-border pt-2.5">
                            {past && i.status !== "completed" && (
                              <>
                                <button onClick={() => update(i.id, { status: "completed" })} className="inline-flex items-center gap-1 rounded-lg bg-green-500/10 px-2.5 py-1 text-[11px] font-medium text-green-400 hover:bg-green-500/20"><CheckCircle2 className="h-3 w-3" /> Completed</button>
                                <button onClick={() => update(i.id, { status: "no_show" })} className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-400 hover:bg-amber-500/20"><AlertCircle className="h-3 w-3" /> No-show</button>
                              </>
                            )}
                            <button onClick={() => cancel(i.id)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /> Cancel</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
