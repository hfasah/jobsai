"use client";

import { useMemo, useState } from "react";
import {
  Check, ChevronLeft, ChevronRight, Clock, Loader2, ArrowRight, ArrowLeft,
  CalendarDays, User, Mail, Building2, CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Step = "details" | "date" | "time" | "confirm" | "done";

const STEPS: { key: Step; label: string }[] = [
  { key: "details", label: "Details" },
  { key: "date", label: "Date" },
  { key: "time", label: "Time" },
  { key: "confirm", label: "Confirm" },
];

const DURATION_MIN = 30;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EST_TZ = "America/New_York";

// Business hours: 9:30am–5:00pm local, every 15 minutes.
const SLOT_START = { h: 9, m: 30 };
const SLOT_END = { h: 17, m: 0 };

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isWeekend(d: Date) {
  const day = d.getDay();
  return day === 0 || day === 6;
}

export function DemoBooking({ source }: { source?: string }) {
  const [step, setStep] = useState<Step>("details");
  const [form, setForm] = useState({
    name: "", email: "", company: "", phone: "", team_size: "", current_ats: "", goals: "",
  });
  const [viewMonth, setViewMonth] = useState(() => startOfDay(new Date()));
  const [date, setDate] = useState<Date | null>(null);
  const [slot, setSlot] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // Captured once at mount so the slot list stays stable across re-renders.
  const [nowMs] = useState(() => Date.now());

  const tz = useMemo(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return "UTC"; }
  }, []);
  const tzAbbr = useMemo(() => {
    try {
      const parts = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" }).formatToParts(new Date());
      return parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
    } catch { return tz; }
  }, [tz]);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim());
  const detailsValid = form.name.trim().length > 1 && emailValid;

  const today = startOfDay(new Date(nowMs));
  const currentStepIdx = STEPS.findIndex((s) => s.key === step);

  // ── Calendar grid for the visible month ──────────────────────────────────
  const grid = useMemo(() => {
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewMonth]);

  const canGoPrevMonth = viewMonth.getFullYear() > today.getFullYear() ||
    (viewMonth.getFullYear() === today.getFullYear() && viewMonth.getMonth() > today.getMonth());

  const dayBookable = (d: Date) => !isWeekend(d) && d.getTime() >= today.getTime();

  // ── Time slots for the chosen date ───────────────────────────────────────
  const slots = useMemo(() => {
    if (!date) return [] as Date[];
    const out: Date[] = [];
    let h = SLOT_START.h, m = SLOT_START.m;
    while (h < SLOT_END.h || (h === SLOT_END.h && m <= SLOT_END.m)) {
      const t = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m);
      if (t.getTime() > nowMs + 60 * 60_000) out.push(t); // at least 1h lead time
      m += 15;
      if (m >= 60) { m = 0; h += 1; }
    }
    return out;
  }, [date, nowMs]);

  const localTime = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const estTime = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: EST_TZ });
  const longDate = (d: Date) => d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  async function confirm() {
    if (!slot) return;
    setSubmitting(true); setError("");
    try {
      const res = await fetch("/api/enterprise/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          starts_at: slot.toISOString(),
          timezone: tz,
          source: source ?? null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? "Could not book your demo."); setSubmitting(false); return; }
      setStep("done");
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-lg shadow-primary/5 sm:p-6">
      {step !== "done" && <Stepper currentIdx={currentStepIdx} />}

      {/* ── Step 1: Details ─────────────────────────────────────────────── */}
      {step === "details" && (
        <div className="mt-6">
          <h3 className="text-lg font-bold">Tell us about you</h3>
          <p className="mt-1 text-sm text-muted-foreground">We&apos;ll tailor the {DURATION_MIN}-minute walkthrough to your team.</p>
          <div className="mt-5 space-y-3">
            <Field icon={User} label="Full name" required>
              <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Jane Recruiter" className={inputCls} />
            </Field>
            <Field icon={Mail} label="Work email" required error={form.email.length > 0 && !emailValid ? "Enter a valid email" : undefined}>
              <input value={form.email} onChange={(e) => set("email", e.target.value)} type="email" placeholder="jane@company.com" className={inputCls} />
            </Field>
            <Field icon={Building2} label="Company">
              <input value={form.company} onChange={(e) => set("company", e.target.value)} placeholder="Acme Talent" className={inputCls} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Recruiter team size">
                <select value={form.team_size} onChange={(e) => set("team_size", e.target.value)} className={inputCls}>
                  <option value="">Select…</option>
                  <option>Just me</option>
                  <option>2–5</option>
                  <option>6–20</option>
                  <option>21–50</option>
                  <option>50+</option>
                </select>
              </Field>
              <Field label="Current ATS / tools">
                <input value={form.current_ats} onChange={(e) => set("current_ats", e.target.value)} placeholder="Bullhorn, Greenhouse…" className={inputCls} />
              </Field>
            </div>
            <Field label="What do you want to see?">
              <textarea value={form.goals} onChange={(e) => set("goals", e.target.value)} rows={2} placeholder="e.g. AI screening calls + ATS sync" className={cn(inputCls, "resize-none")} />
            </Field>
          </div>
          <NavButtons
            onNext={() => setStep("date")}
            nextLabel="Pick a Date"
            nextDisabled={!detailsValid}
          />
        </div>
      )}

      {/* ── Step 2: Date ────────────────────────────────────────────────── */}
      {step === "date" && (
        <div className="mt-6">
          <h3 className="text-lg font-bold">Pick a date</h3>
          <p className="mt-1 text-sm text-muted-foreground">Select a weekday for your {DURATION_MIN}-minute demo.</p>

          <div className="mt-5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => canGoPrevMonth && setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
              disabled={!canGoPrevMonth}
              className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-muted disabled:opacity-30"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-semibold">{viewMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
            <button
              type="button"
              onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
              className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-muted"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
            {WEEKDAYS.map((w) => <div key={w} className="py-1">{w}</div>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {grid.map((d, i) => {
              if (!d) return <div key={i} />;
              const bookable = dayBookable(d);
              const selected = date && sameDay(d, date);
              const isToday = sameDay(d, today);
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!bookable}
                  onClick={() => { setDate(d); setSlot(null); }}
                  className={cn(
                    "relative grid aspect-square place-items-center rounded-lg text-sm transition",
                    !bookable && "text-muted-foreground/30 cursor-default",
                    bookable && !selected && "hover:bg-muted",
                    selected && "bg-gradient-brand font-bold text-white shadow-glow",
                    isToday && !selected && "font-bold text-primary",
                  )}
                >
                  {d.getDate()}
                  {bookable && !selected && (
                    <span className="absolute bottom-1 h-1 w-1 rounded-full bg-primary/70" />
                  )}
                </button>
              );
            })}
          </div>

          <NavButtons
            onBack={() => setStep("details")}
            onNext={() => setStep("time")}
            nextLabel="Choose a Time"
            nextDisabled={!date}
          />
        </div>
      )}

      {/* ── Step 3: Time ────────────────────────────────────────────────── */}
      {step === "time" && date && (
        <div className="mt-6">
          <h3 className="text-lg font-bold">Pick a time</h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarDays className="h-4 w-4" /> {longDate(date)}
          </p>
          <p className="mt-1 text-xs font-medium text-primary">Times shown in your timezone ({tzAbbr}) — EST in parentheses</p>

          <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
            {slots.length === 0 && (
              <p className="rounded-xl border border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
                No times left on this day — try another date.
              </p>
            )}
            {slots.map((t) => {
              const selected = slot && t.getTime() === slot.getTime();
              return (
                <button
                  key={t.toISOString()}
                  type="button"
                  onClick={() => setSlot(t)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition",
                    selected ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border hover:bg-muted",
                  )}
                >
                  <Clock className={cn("h-4 w-4 shrink-0", selected ? "text-primary" : "text-muted-foreground")} />
                  <span className="font-semibold">{localTime(t)}</span>
                  <span className="text-muted-foreground">({estTime(t)} EST)</span>
                  {selected && <Check className="ml-auto h-4 w-4 text-primary" />}
                </button>
              );
            })}
          </div>

          <NavButtons
            onBack={() => setStep("date")}
            onNext={() => setStep("confirm")}
            nextLabel="Review & Confirm"
            nextDisabled={!slot}
          />
        </div>
      )}

      {/* ── Step 4: Confirm ─────────────────────────────────────────────── */}
      {step === "confirm" && slot && (
        <div className="mt-6">
          <h3 className="text-lg font-bold">Confirm your demo</h3>
          <p className="mt-1 text-sm text-muted-foreground">Review the details below and confirm your booking.</p>

          <div className="mt-5 space-y-3 rounded-xl border border-border bg-muted/30 p-4 text-sm">
            <Row icon={CalendarDays} label="Date & time" value={`${longDate(slot)}, ${slot.getFullYear()} · ${localTime(slot)} (${estTime(slot)} EST)`} />
            <Row icon={Clock} label="Duration" value={`${DURATION_MIN} minutes`} />
            <div className="border-t border-border" />
            <Row icon={User} label="Name" value={form.name} />
            <Row icon={Mail} label="Email" value={form.email} />
            {form.company && <Row icon={Building2} label="Company" value={form.company} />}
          </div>

          {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

          <NavButtons
            onBack={() => setStep("time")}
            onNext={confirm}
            nextLabel={submitting ? "Booking…" : "Confirm Booking"}
            nextDisabled={submitting}
            nextLoading={submitting}
            nextIcon={<Check className="h-4 w-4" />}
          />
        </div>
      )}

      {/* ── Done ────────────────────────────────────────────────────────── */}
      {step === "done" && slot && (
        <div className="py-6 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-gradient-brand shadow-glow">
            <CheckCircle2 className="h-7 w-7 text-white" />
          </div>
          <h3 className="mt-4 text-xl font-bold">You&apos;re booked, {form.name.split(/\s+/)[0]}!</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            We sent a confirmation and calendar invite to <strong className="text-foreground">{form.email}</strong> for{" "}
            <strong className="text-foreground">{longDate(slot)} at {localTime(slot)}</strong>. We&apos;ll share the meeting link before the call.
          </p>
          <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4 text-left text-sm">
            <Row icon={CalendarDays} label="Date & time" value={`${longDate(slot)} · ${localTime(slot)} (${estTime(slot)} EST)`} />
            <div className="mt-3" />
            <Row icon={Clock} label="Duration" value={`${DURATION_MIN} minutes`} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Bits ─────────────────────────────────────────────────────────────────
const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary";

function Stepper({ currentIdx }: { currentIdx: number }) {
  return (
    <div className="flex items-center">
      {STEPS.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold transition",
                  done && "bg-gradient-brand text-white",
                  active && "bg-primary/15 text-primary ring-1 ring-primary",
                  !done && !active && "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className={cn("text-xs font-medium", active || done ? "text-foreground" : "text-muted-foreground")}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <span className={cn("mx-2 h-px flex-1 transition", done ? "bg-primary" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Field({
  icon: Icon, label, required, error, children,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />} {label}{required && <span className="text-primary">*</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-500">{error}</span>}
    </label>
  );
}

function Row({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-semibold">{value}</p>
      </div>
    </div>
  );
}

function NavButtons({
  onBack, onNext, nextLabel, nextDisabled, nextLoading, nextIcon,
}: {
  onBack?: () => void; onNext: () => void; nextLabel: string;
  nextDisabled?: boolean; nextLoading?: boolean; nextIcon?: React.ReactNode;
}) {
  return (
    <div className="mt-6 flex gap-3">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-5 py-3 text-sm font-semibold hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-brand px-5 py-3 text-sm font-semibold text-white shadow-glow transition disabled:cursor-not-allowed disabled:opacity-50"
      >
        {nextLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (nextIcon ?? null)}
        {nextLabel}
        {!nextLoading && !nextIcon && <ArrowRight className="h-4 w-4" />}
      </button>
    </div>
  );
}
