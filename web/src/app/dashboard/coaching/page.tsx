"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, UserRound, CheckCircle2, Calendar, Video, Coins, ArrowRight, Clock, Target, TrendingUp, Zap, ShieldCheck, Rocket } from "lucide-react";
import { cn, fmtTokens } from "@/lib/utils";
import { promptBuyTokens } from "@/lib/upgrade";

interface Booking {
  id: string; plan: string; paid_with: string; tokens_spent: number; minutes: number;
  status: string; preferred_times: string | null; scheduled_at: string | null; zoom_link: string | null; created_at: string;
}
interface CoachingData {
  cost_tokens: number; cost_usd: number; session_minutes: number; balance: number; plan: string;
  free_total: number; free_used: number; free_available: number; bookings: Booking[];
}

const STATUS_STYLE: Record<string, string> = {
  requested: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  scheduled: "bg-primary/15 text-primary",
  completed: "bg-desyn-success/15 text-desyn-success",
  cancelled: "bg-muted text-muted-foreground",
};

const TIMES = ["09:00", "11:00", "13:00", "15:00", "17:00"];

// Why book a session: value-led upsell points.
const BENEFITS: { icon: React.ElementType; lead: string; text: string }[] = [
  { icon: Target,      lead: "Land the job in fewer interviews", text: "your coach reveals exactly what hiring managers want to hear, plus the small things that quietly get people rejected." },
  { icon: TrendingUp,  lead: "Negotiate thousands more",         text: "one tactic can add $10K+ to your offer. A single session can pay for itself many times over." },
  { icon: Zap,         lead: "Skip months of rejection",         text: "get in 45 minutes the shortcut it takes most people 6 months of trial and error to figure out." },
  { icon: ShieldCheck, lead: "Walk in unshakably confident",     text: "rehearse your toughest questions live with a real pro, so the real interview feels easy." },
  { icon: Rocket,      lead: "Leave with a game plan, not just tips", text: "a personalized, step-by-step roadmap to your next offer, built around you and your target role." },
];

function nextBusinessDays(n: number): Date[] {
  const days: Date[] = [];
  const d = new Date(); d.setHours(0, 0, 0, 0);
  while (days.length < n) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) days.push(new Date(d));
  }
  return days;
}
function slotDate(day: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const dt = new Date(day); dt.setHours(h, m, 0, 0); return dt;
}
const fmtDay = (d: Date) => d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const fmtTime = (hhmm: string) => slotDate(new Date(), hhmm).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

type Phase = "offer" | "scheduling" | "confirmed";

export default function CoachingPage() {
  const [data, setData] = useState<CoachingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>("offer");
  const [booking, setBooking] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [notes, setNotes] = useState("");
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null);

  const days = nextBusinessDays(10);
  const [selDay, setSelDay] = useState(0);

  const load = () => {
    setLoading(true);
    fetch("/api/coaching").then((r) => r.json()).then((j) => setData(j.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const book = async () => {
    setBooking(true);
    try {
      const res = await fetch("/api/coaching", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      const json = await res.json();
      if (res.status === 402 || json.upgrade_required) { promptBuyTokens(json.error); return; }
      if (!res.ok) { alert(json.error ?? "Couldn't book. Please try again."); return; }
      setBookingId(json.data.id);
      setPhase("scheduling");
    } finally {
      setBooking(false);
    }
  };

  const pickSlot = async (when: Date) => {
    if (!bookingId) return;
    setScheduling(true);
    try {
      const res = await fetch("/api/coaching", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId, scheduled_at: when.toISOString() }),
      });
      const json = await res.json();
      if (!res.ok) { alert(json.error ?? "Couldn't schedule. Please try again."); return; }
      setConfirmedAt(when.toISOString());
      setPhase("confirmed");
      load();
    } finally {
      setScheduling(false);
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…</div>;
  if (!data) return <div className="text-destructive">Could not load coaching.</div>;

  const freeNow = data.free_available > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Career Success Coach</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A {data.session_minutes}-minute 1:1 video session with a real career coach. Resume review, interview strategy, salary negotiation, or whatever you need most.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        {/* ── Offer + book ── */}
        {phase === "offer" && (
          <>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-brand text-white">
                <UserRound className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">{data.session_minutes}-min 1:1 coaching session</h2>
                  {freeNow && <span className="rounded-full bg-desyn-success/15 px-2 py-0.5 text-[11px] font-semibold text-desyn-success">Included with your plan</span>}
                </div>
                {freeNow ? (
                  <p className="mt-1 text-sm text-muted-foreground">Your free session this month: {data.free_used} of {data.free_total} used. Booking now uses your included session (no tokens).</p>
                ) : (
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5 font-medium text-foreground"><Coins className="h-4 w-4 text-primary" /> {fmtTokens(data.cost_tokens)} tokens</span>
                    <span className="text-xs">· Balance: {fmtTokens(data.balance)}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Why it's worth it (upsell) */}
            <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <p className="mb-3 text-sm font-semibold">Why one session is worth it</p>
              <ul className="space-y-2.5">
                {BENEFITS.map((b, i) => {
                  const Icon = b.icon;
                  return (
                    <li key={i} className="flex items-start gap-2.5 text-sm">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary"><Icon className="h-3.5 w-3.5" /></span>
                      <span className="text-muted-foreground"><strong className="text-foreground">{b.lead}:</strong> {b.text}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-xs font-medium text-primary">Most people never get this kind of insider help. 45 minutes could change your entire job search.</p>
            </div>

            <div className="mt-5">
              <label className="mb-1.5 block text-sm font-medium">What would you like to focus on? <span className="font-normal text-muted-foreground">(optional)</span></label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                placeholder="Interview prep for a PM role, salary negotiation, resume review…"
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>

            {/* Conspicuous CTA */}
            <button onClick={book} disabled={booking}
              className="btn-cta mt-5 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold shadow-glow disabled:opacity-60">
              {booking ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserRound className="h-5 w-5" />}
              {freeNow ? "Book a Career Success Coach · Free" : `Book a Career Success Coach · ${fmtTokens(data.cost_tokens)} tokens`}
              {!booking && <ArrowRight className="h-5 w-5" />}
            </button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <Video className="h-3.5 w-3.5" /> Pay, then pick a time. Zoom link &amp; calendar invite sent on confirmation.
            </p>
            <p className="mt-3 rounded-lg border border-border bg-background/40 px-3 py-2.5 text-center text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Get the most from your 45 minutes:</span> upload your{" "}
              <Link href="/dashboard/resumes" className="font-medium text-primary hover:underline">résumé</Link>, complete your{" "}
              <Link href="/dashboard/apply-profile" className="font-medium text-primary hover:underline">Apply Profile</Link>, and fill in your{" "}
              <Link href="/dashboard/preferences" className="font-medium text-primary hover:underline">Preferences</Link> first, so your coach can review them beforehand and you dive straight into what matters.
            </p>
          </>
        )}

        {/* ── Slot picker (after paying) ── */}
        {phase === "scheduling" && (
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Choose a time slot</h2>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">Your session is reserved. Pick a time that works ({Intl.DateTimeFormat().resolvedOptions().timeZone}).</p>

            {/* Day selector */}
            <div className="-mx-1 flex gap-2 overflow-x-auto pb-2">
              {days.map((d, i) => (
                <button key={i} onClick={() => setSelDay(i)}
                  className={cn("shrink-0 rounded-xl border px-3 py-2 text-center text-xs transition-colors",
                    selDay === i ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted")}>
                  <span className="block font-semibold">{fmtDay(d).split(", ")[0]}</span>
                  <span className="block">{d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                </button>
              ))}
            </div>

            {/* Time slots */}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TIMES.map((t) => (
                <button key={t} onClick={() => pickSlot(slotDate(days[selDay], t))} disabled={scheduling}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium transition-colors hover:border-primary hover:bg-primary/10 disabled:opacity-60">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" /> {fmtTime(t)}
                </button>
              ))}
            </div>
            {scheduling && <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Reserving your slot…</p>}
          </div>
        )}

        {/* ── Confirmed ── */}
        {phase === "confirmed" && (
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-desyn-success" />
            <div>
              <h2 className="font-semibold text-foreground">You&apos;re booked!</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {confirmedAt && <>Your session is set for <span className="font-medium text-foreground">{new Date(confirmedAt).toLocaleString(undefined, { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>. </>}
                We&apos;ll email your Zoom link and a calendar invite shortly. You can see it under &quot;Your sessions&quot; below.
              </p>
              <button onClick={() => { setPhase("offer"); setNotes(""); setBookingId(null); setConfirmedAt(null); }}
                className="mt-3 text-sm font-medium text-primary hover:underline">Book another session</button>
            </div>
          </div>
        )}
      </div>

      {/* History */}
      {data.bookings.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 font-semibold">Your sessions</h2>
          <div className="space-y-2">
            {data.bookings.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{b.scheduled_at ? new Date(b.scheduled_at).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : `${b.minutes}-min session`}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.paid_with === "included" ? "Included" : `${b.tokens_spent.toLocaleString()} tokens`} · requested {new Date(b.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {b.zoom_link && b.status === "scheduled" && (
                    <a href={b.zoom_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted">
                      <Video className="h-3.5 w-3.5" /> Join
                    </a>
                  )}
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", STATUS_STYLE[b.status] ?? "bg-muted text-muted-foreground")}>{b.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
