"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CalendarDays, Loader2, Video, Phone, MapPin, X, Clock, CheckCircle2, AlertCircle,
  Plus, Settings2, Check, Link2, Calendar, Copy, Trash2, MessageSquare, Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScheduleModal } from "@/components/enterprise/schedule-modal";
import BookingLinkCard from "@/components/enterprise/booking-link-card";

interface Interview {
  id: string; candidate_name: string; candidate_email: string; title: string;
  interview_type: string; provider: string | null; meeting_link: string | null; location: string | null;
  scheduled_at: string; duration_min: number; interviewers: string | null; interviewer_emails: string[];
  status: string; notes: string | null;
}

interface AvailabilitySlot {
  id: string; starts_at: string; ends_at: string | null; duration_min: number;
  booked: boolean; booking_token: string; job_id: string | null;
  booked_by_name: string | null; booked_by_email: string | null;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  scheduled: { label: "Awaiting confirm", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  confirmed: { label: "Confirmed", color: "bg-green-500/15 text-green-400 border-green-500/30" },
  completed: { label: "Completed", color: "bg-muted text-muted-foreground border-border" },
  cancelled: { label: "Cancelled", color: "bg-red-500/15 text-red-400 border-red-500/30" },
  no_show:   { label: "No-show", color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
};

const TYPE_ICON: Record<string, React.ElementType> = { video: Video, phone: Phone, onsite: MapPin };

const APP_URL = typeof window !== "undefined" ? window.location.origin : "https://jobsai.work";

export default function SchedulePage() {
  const [tab, setTab] = useState<"interviews" | "availability">("interviews");
  const [items, setItems] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"upcoming" | "all">("upcoming");
  const [newOpen, setNewOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [feedbackForm, setFeedbackForm] = useState({ overall_rating: 0, hire_rec: "", technical_rating: 0, communication_rating: 0, culture_rating: 0, notes: "" });
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSaved, setFeedbackSaved] = useState(false);
  const [profile, setProfile] = useState({ default_meeting_link: "", calendar_provider: "zoom" });
  const [profileSaved, setProfileSaved] = useState(false);

  // Availability slots state
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [newSlot, setNewSlot] = useState({ starts_at: "", duration_min: 45 });
  const [addingSlot, setAddingSlot] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/enterprise/my-profile").then((r) => r.json()).then((j) => { if (j.data) setProfile(j.data); }).catch(() => {});
  }, []);

  const loadSlots = useCallback(async () => {
    setSlotsLoading(true);
    const r = await fetch("/api/enterprise/availability");
    const j = await r.json();
    setSlots(j.data ?? []);
    setSlotsLoading(false);
  }, []);

  useEffect(() => { if (tab === "availability") loadSlots(); }, [tab, loadSlots]);

  const addSlot = async () => {
    if (!newSlot.starts_at) return;
    setAddingSlot(true);
    await fetch("/api/enterprise/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slots: [{ starts_at: newSlot.starts_at, duration_min: newSlot.duration_min }] }),
    });
    setNewSlot({ starts_at: "", duration_min: 45 });
    await loadSlots();
    setAddingSlot(false);
  };

  const deleteSlot = async (id: string) => {
    await fetch("/api/enterprise/availability", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setSlots((s) => s.filter((x) => x.id !== id));
  };

  const copyLink = (token: string, id: string) => {
    navigator.clipboard.writeText(`${APP_URL}/enterprise/book/${token}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const saveProfile = async () => {
    await fetch("/api/enterprise/my-profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) });
    setProfileSaved(true); setTimeout(() => setProfileSaved(false), 2000);
  };

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

  const openFeedback = (id: string) => {
    setFeedbackForm({ overall_rating: 0, hire_rec: "", technical_rating: 0, communication_rating: 0, culture_rating: 0, notes: "" });
    setFeedbackSaved(false);
    setFeedbackId(id);
  };

  const submitFeedback = async () => {
    if (!feedbackId) return;
    setSubmittingFeedback(true);
    await fetch(`/api/enterprise/schedule/${feedbackId}/feedback`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(feedbackForm),
    });
    setItems((it) => it.map((x) => x.id === feedbackId ? { ...x, status: "completed" } : x));
    setFeedbackSaved(true);
    setSubmittingFeedback(false);
    setTimeout(() => setFeedbackId(null), 1200);
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
          <div className="flex items-center gap-2">
            <button onClick={() => setSettingsOpen((o) => !o)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><Settings2 className="h-4 w-4" /> My link</button>
            <button onClick={() => setNewOpen(true)} className="btn-cta inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold"><Plus className="h-4 w-4" /> Schedule interview</button>
          </div>
        </div>

        {/* Standing booking page (pick-a-time link candidates can self-book on) */}
        <BookingLinkCard />

        {/* Tabs */}
        <div className="mb-5 inline-flex rounded-xl border border-border bg-muted/40 p-1 gap-1">
          <button onClick={() => setTab("interviews")} className={cn("rounded-lg px-4 py-1.5 text-sm font-medium transition-colors", tab === "interviews" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
            Interviews
          </button>
          <button onClick={() => setTab("availability")} className={cn("flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors", tab === "availability" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
            <Calendar className="h-3.5 w-3.5" /> Availability Slots
          </button>
        </div>

        {/* Availability Slots tab */}
        {tab === "availability" && (
          <div>
            {/* Add slot form */}
            <div className="mb-5 rounded-2xl border border-border bg-card p-4">
              <h2 className="mb-3 text-sm font-semibold">Add Open Slot</h2>
              <p className="mb-3 text-xs text-muted-foreground">Create a time slot and share the booking link with candidates — they self-book their preferred time.</p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-48">
                  <label className="mb-1 block text-xs text-muted-foreground">Date & Time</label>
                  <input
                    type="datetime-local"
                    value={newSlot.starts_at}
                    onChange={(e) => setNewSlot((s) => ({ ...s, starts_at: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Duration</label>
                  <select
                    value={newSlot.duration_min}
                    onChange={(e) => setNewSlot((s) => ({ ...s, duration_min: Number(e.target.value) }))}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {[15, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} min</option>)}
                  </select>
                </div>
                <button
                  onClick={addSlot}
                  disabled={addingSlot || !newSlot.starts_at}
                  className="btn-cta inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  {addingSlot ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Add Slot
                </button>
              </div>
            </div>

            {/* Slots list */}
            {slotsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : slots.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border py-12 text-center">
                <Calendar className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No open slots yet. Add one above.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {slots.map((s) => {
                  const dt = new Date(s.starts_at);
                  const bookingUrl = `${APP_URL}/enterprise/book/${s.booking_token}`;
                  return (
                    <div key={s.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                          {" · "}
                          {dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          <span className="ml-2 text-xs text-muted-foreground">{s.duration_min} min</span>
                        </p>
                        {s.booked ? (
                          <p className="text-xs text-green-400">Booked by {s.booked_by_name} ({s.booked_by_email})</p>
                        ) : (
                          <p className="truncate text-xs text-muted-foreground">{bookingUrl}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {!s.booked && (
                          <button
                            onClick={() => copyLink(s.booking_token, s.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                          >
                            {copiedId === s.id ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                            {copiedId === s.id ? "Copied!" : "Copy link"}
                          </button>
                        )}
                        {!s.booked && (
                          <button onClick={() => deleteSlot(s.id)} className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "interviews" && <>

        {/* My default meeting link */}
        {settingsOpen && (
          <div className="mb-5 rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold"><Link2 className="h-4 w-4 text-primary" /> Your default meeting link</h2>
            <p className="mb-3 text-xs text-muted-foreground">Saved to your profile and pre-filled into every interview you schedule. Use your Zoom personal room, Teams/Meet link, or a booking link.</p>
            <div className="flex flex-wrap gap-2">
              <select value={profile.calendar_provider} onChange={(e) => setProfile((p) => ({ ...p, calendar_provider: e.target.value }))}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                {[["zoom", "Zoom"], ["teams", "Microsoft Teams"], ["google_meet", "Google Meet"], ["outlook", "Outlook"], ["google_calendar", "Google Calendar"], ["other", "Other"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <input value={profile.default_meeting_link} onChange={(e) => setProfile((p) => ({ ...p, default_meeting_link: e.target.value }))} placeholder="https://zoom.us/j/your-room"
                className="min-w-48 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              <button onClick={saveProfile} className="btn-cta inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold">
                {profileSaved ? <Check className="h-4 w-4" /> : null} {profileSaved ? "Saved" : "Save"}
              </button>
            </div>
          </div>
        )}

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
                                <button onClick={() => openFeedback(i.id)} className="inline-flex items-center gap-1 rounded-lg bg-green-500/10 px-2.5 py-1 text-[11px] font-medium text-green-400 hover:bg-green-500/20"><CheckCircle2 className="h-3 w-3" /> Completed + feedback</button>
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
        </>}

      </div>

      {newOpen && <ScheduleModal onClose={() => setNewOpen(false)} onScheduled={load} />}

      {/* Post-interview feedback modal */}
      {feedbackId && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setFeedbackId(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold"><MessageSquare className="h-4 w-4 text-primary" /> Interview Feedback</h2>
              <button onClick={() => setFeedbackId(null)}><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>

            {feedbackSaved ? (
              <div className="py-6 text-center">
                <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-green-400" />
                <p className="font-semibold">Feedback saved</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Overall rating */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Overall rating</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} onClick={() => setFeedbackForm((f) => ({ ...f, overall_rating: n }))}
                        className={cn("flex h-9 w-9 items-center justify-center rounded-lg border text-sm transition-colors",
                          feedbackForm.overall_rating >= n ? "border-amber-400 bg-amber-400/10 text-amber-400" : "border-border text-muted-foreground")}>
                        <Star className="h-4 w-4" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Hire recommendation */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hire recommendation</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[["strong_yes", "Strong Yes"], ["yes", "Yes"], ["maybe", "Maybe"], ["no", "No"]].map(([v, l]) => (
                      <button key={v} onClick={() => setFeedbackForm((f) => ({ ...f, hire_rec: v }))}
                        className={cn("rounded-lg border py-1.5 text-xs font-medium transition-colors",
                          feedbackForm.hire_rec === v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dimension ratings */}
                <div className="grid grid-cols-3 gap-2">
                  {[["technical_rating", "Technical"], ["communication_rating", "Comms"], ["culture_rating", "Culture"]].map(([key, label]) => (
                    <div key={key}>
                      <label className="mb-1 block text-xs text-muted-foreground text-center">{label}</label>
                      <select value={(feedbackForm as Record<string, unknown>)[key] as number}
                        onChange={(e) => setFeedbackForm((f) => ({ ...f, [key]: Number(e.target.value) }))}
                        className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary">
                        <option value={0}>—</option>
                        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}/5</option>)}
                      </select>
                    </div>
                  ))}
                </div>

                {/* Notes */}
                <textarea
                  value={feedbackForm.notes}
                  onChange={(e) => setFeedbackForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  placeholder="Interviewer notes (shared with hiring team)…"
                  className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />

                <button onClick={submitFeedback} disabled={submittingFeedback || (!feedbackForm.overall_rating && !feedbackForm.hire_rec)}
                  className="btn-cta inline-flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60">
                  {submittingFeedback ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Save feedback &amp; mark completed
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
