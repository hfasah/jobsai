"use client";

// "Your booking page" — the recruiter's standing pick-a-time link + settings
// (duration, hours, calendars). Candidates who open the link see live slots
// (work hours minus Google Calendar busy) and book straight onto the calendar.
import { useEffect, useState } from "react";
import { Calendar, Check, ClipboardCopy, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LinkData {
  id: string;
  url: string;
  title: string;
  duration_min: number;
  buffer_min: number;
  window_days: number;
  work_start: number;
  work_end: number;
  timezone: string;
  business_days_only: boolean;
  create_on_calendar_id: string;
  conflict_calendar_ids: string[];
  active: boolean;
}

export default function BookingLinkCard() {
  const [link, setLink] = useState<LinkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", duration_min: 30, work_start: 9, work_end: 17, timezone: "", business_days_only: true, create_on_calendar_id: "primary", conflict_ids: "primary", active: true });

  useEffect(() => {
    fetch("/api/enterprise/booking-link")
      .then((r) => r.json())
      .then((j) => {
        if (j.data) {
          const d = j.data as LinkData;
          setLink(d);
          setForm({
            title: d.title, duration_min: d.duration_min, work_start: d.work_start, work_end: d.work_end,
            timezone: d.timezone, business_days_only: d.business_days_only,
            create_on_calendar_id: d.create_on_calendar_id, conflict_ids: d.conflict_calendar_ids.join(", "),
            active: d.active,
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true); setSaved(false);
    const res = await fetch("/api/enterprise/booking-link", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title, duration_min: Number(form.duration_min), work_start: Number(form.work_start),
        work_end: Number(form.work_end), timezone: form.timezone, business_days_only: form.business_days_only,
        create_on_calendar_id: form.create_on_calendar_id,
        conflict_calendar_ids: form.conflict_ids.split(",").map((s) => s.trim()).filter(Boolean),
        active: form.active,
      }),
    });
    const j = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok && j.data) { setLink(j.data as LinkData); setSaved(true); setTimeout(() => setSaved(false), 2000); }
  };

  const copy = () => {
    if (!link) return;
    navigator.clipboard.writeText(link.url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };

  if (loading) return null;
  if (!link) return null;

  return (
    <section className="mb-6 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Calendar className="h-4 w-4 text-primary" /> Your booking page
        </h2>
        {!link.active && <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">Off</span>}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">
            {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <ClipboardCopy className="h-3.5 w-3.5" />} Copy link
          </button>
          <a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">
            <ExternalLink className="h-3.5 w-3.5" /> Preview
          </a>
          <button onClick={() => setOpen((v) => !v)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">
            {open ? "Hide settings" : "Settings"}
          </button>
        </div>
      </div>
      <p className="mt-1.5 break-all text-xs text-muted-foreground">{link.url}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Candidates pick from your live availability (your Google Calendar conflicts are blocked out) and the meeting lands on your
        calendar with a Meet link. Use <code className="rounded bg-muted px-1">{"{{booking_link}}"}</code> in campaign emails — the AI SDR shares it automatically when a reply shows interest.
      </p>

      {open && (
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-3">
          <label className="text-xs">
            <span className="mb-1 block font-semibold uppercase tracking-wide text-muted-foreground">Meeting title</span>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-semibold uppercase tracking-wide text-muted-foreground">Duration (min)</span>
            <input type="number" min={10} max={120} value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: Number(e.target.value) })}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-semibold uppercase tracking-wide text-muted-foreground">Timezone</span>
            <input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-semibold uppercase tracking-wide text-muted-foreground">Work hours (start–end)</span>
            <span className="flex items-center gap-1.5">
              <input type="number" min={0} max={23} value={form.work_start} onChange={(e) => setForm({ ...form, work_start: Number(e.target.value) })}
                className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
              <span className="text-muted-foreground">–</span>
              <input type="number" min={1} max={24} value={form.work_end} onChange={(e) => setForm({ ...form, work_end: Number(e.target.value) })}
                className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </span>
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-semibold uppercase tracking-wide text-muted-foreground">Create events on</span>
            <input value={form.create_on_calendar_id} onChange={(e) => setForm({ ...form, create_on_calendar_id: e.target.value })}
              placeholder="primary" className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-semibold uppercase tracking-wide text-muted-foreground">Check conflicts on</span>
            <input value={form.conflict_ids} onChange={(e) => setForm({ ...form, conflict_ids: e.target.value })}
              placeholder="primary, team@group.calendar.google.com" className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={form.business_days_only} onChange={(e) => setForm({ ...form, business_days_only: e.target.checked })} />
            Business days only
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            Booking page active
          </label>
          <div className="col-span-2 flex items-end justify-end sm:col-span-1">
            <button onClick={save} disabled={saving}
              className={cn("btn-cta inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-60")}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : null}
              {saved ? "Saved" : "Save"}
            </button>
          </div>
        </div>
      )}
      <p className="mt-2 text-[10px] text-muted-foreground">
        &ldquo;Create events on&rdquo; / &ldquo;check conflicts on&rdquo; take Google calendar IDs (find them in Google Calendar → calendar settings). <code className="rounded bg-muted px-1">primary</code> is your main calendar.
      </p>
    </section>
  );
}
