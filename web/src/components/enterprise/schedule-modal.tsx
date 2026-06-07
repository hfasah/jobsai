"use client";

import { useState } from "react";
import { CalendarPlus, Loader2, X, Video, Phone, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

const PROVIDERS = [
  { id: "zoom", label: "Zoom" },
  { id: "teams", label: "Microsoft Teams" },
  { id: "google_meet", label: "Google Meet" },
  { id: "other", label: "Other link" },
];

export function ScheduleModal({
  candidate, jobId, onClose, onScheduled,
}: {
  candidate: { id?: string; name: string; email: string };
  jobId?: string;
  onClose: () => void;
  onScheduled?: () => void;
}) {
  const [form, setForm] = useState({
    title: `Interview — ${candidate.name}`,
    interview_type: "video",
    provider: "zoom",
    meeting_link: "",
    location: "",
    date: "", time: "",
    duration_min: 45,
    interviewers: "",
    interviewer_emails: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.date || !form.time) { setError("Pick a date and time."); return; }
    if (form.interview_type === "video" && !form.meeting_link.trim()) { setError("Paste the meeting link."); return; }
    setSaving(true); setError("");
    const scheduled_at = new Date(`${form.date}T${form.time}`).toISOString();
    const res = await fetch("/api/enterprise/schedule", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        candidate_name: candidate.name, candidate_email: candidate.email,
        application_id: candidate.id ?? null, job_id: jobId ?? null,
        title: form.title, interview_type: form.interview_type, provider: form.provider,
        meeting_link: form.meeting_link, location: form.location,
        scheduled_at, duration_min: Number(form.duration_min),
        interviewers: form.interviewers,
        interviewer_emails: form.interviewer_emails.split(/[,\s]+/).filter(Boolean),
        notes: form.notes,
      }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? "Failed."); setSaving(false); return; }
    setDone(true); setSaving(false);
    onScheduled?.();
  };

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold"><CalendarPlus className="h-5 w-5 text-primary" /> Schedule interview</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground hover:text-foreground" /></button>
        </div>

        {done ? (
          <div className="py-6 text-center">
            <p className="font-semibold">Interview scheduled ✓</p>
            <p className="mt-1 text-sm text-muted-foreground">A calendar invite was emailed to {candidate.name} and any interviewers. Reminders will go out automatically.</p>
            <button onClick={onClose} className="btn-cta mt-4 rounded-xl px-5 py-2 text-sm font-semibold">Done</button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">With <strong className="text-foreground">{candidate.name}</strong> · {candidate.email}</p>

            {/* type */}
            <div className="flex gap-2">
              {[{ id: "video", label: "Video", icon: Video }, { id: "phone", label: "Phone", icon: Phone }, { id: "onsite", label: "Onsite", icon: MapPin }].map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => set("interview_type", id)}
                  className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-medium", form.interview_type === id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}>
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>

            <input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Interview title"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />

            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              <input type="time" value={form.time} onChange={(e) => set("time", e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <select value={form.duration_min} onChange={(e) => set("duration_min", Number(e.target.value))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              {[15, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} minutes</option>)}
            </select>

            {/* meeting link or location */}
            {form.interview_type === "onsite" ? (
              <input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Office address / room"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            ) : form.interview_type === "video" ? (
              <div className="space-y-2">
                <select value={form.provider} onChange={(e) => set("provider", e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
                <input value={form.meeting_link} onChange={(e) => set("meeting_link", e.target.value)} placeholder="Paste the Zoom / Teams / Meet link"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            ) : null}

            <input value={form.interviewer_emails} onChange={(e) => set("interviewer_emails", e.target.value)} placeholder="Interviewer emails (comma-separated) — they get the invite too"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="Notes for the candidate (optional)"
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />

            {error && <p className="text-sm text-destructive">{error}</p>}
            <button onClick={submit} disabled={saving} className="btn-cta inline-flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />} Schedule & send invite
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
