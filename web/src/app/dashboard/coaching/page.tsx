"use client";

import { useEffect, useState } from "react";
import { Loader2, UserRound, CheckCircle2, Calendar, Video, Coins, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { promptUpgrade } from "@/lib/upgrade";

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

export default function CoachingPage() {
  const [data, setData] = useState<CoachingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [times, setTimes] = useState("");
  const [notes, setNotes] = useState("");
  const [done, setDone] = useState(false);

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
        body: JSON.stringify({ preferred_times: times, notes }),
      });
      const json = await res.json();
      if (res.status === 402 || json.upgrade_required) { promptUpgrade(json.error); return; }
      if (!res.ok) { alert(json.error ?? "Couldn't book. Please try again."); return; }
      setDone(true); setTimes(""); setNotes("");
      load();
    } finally {
      setBooking(false);
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…</div>;
  if (!data) return <div className="text-destructive">Could not load coaching.</div>;

  const freeNow = data.free_available > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Career Coaching</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A {data.session_minutes}-minute 1:1 video session with a real career coach — resume review, interview strategy, salary negotiation, or whatever you need.
        </p>
      </div>

      {/* Offer / cost card */}
      <div className="rounded-2xl border border-border bg-card p-6">
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
              <p className="mt-1 text-sm text-muted-foreground">
                Your {data.free_total > 1 ? `${data.free_total} sessions` : "free session"} this month — {data.free_used} used.
                Booking now uses your included session (no tokens).
              </p>
            ) : (
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 font-medium text-foreground"><Coins className="h-4 w-4 text-primary" /> {data.cost_tokens.toLocaleString()} tokens</span>
                <span>≈ ${data.cost_usd} per session</span>
                <span className="text-xs">· Balance: {data.balance.toLocaleString()} tokens</span>
              </p>
            )}
            {data.free_total > 0 && data.free_available === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">You&apos;ve used your included session this month — extra sessions cost {data.cost_tokens.toLocaleString()} tokens (≈ ${data.cost_usd}).</p>
            )}
          </div>
        </div>

        {done ? (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-desyn-success/30 bg-desyn-success/5 p-4 text-sm">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-desyn-success" />
            <div>
              <p className="font-medium text-foreground">Session requested!</p>
              <p className="text-muted-foreground">We&apos;ll confirm a time and email you a Zoom link + calendar invite. You can track it below.</p>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Your availability <span className="font-normal text-muted-foreground">(optional)</span></label>
              <input value={times} onChange={(e) => setTimes(e.target.value)}
                placeholder="e.g. Weekday evenings ET, or Tue/Thu afternoons"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">What would you like to focus on? <span className="font-normal text-muted-foreground">(optional)</span></label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                placeholder="Interview prep for a PM role, salary negotiation, resume review…"
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <button onClick={book} disabled={booking}
              className="btn-cta inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold disabled:opacity-60 sm:w-auto sm:px-8">
              {booking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {freeNow ? "Book my free session" : `Book session · ${data.cost_tokens.toLocaleString()} tokens`}
            </button>
          </div>
        )}

        <p className="mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Video className="h-3.5 w-3.5" /> Sessions are over Zoom — link &amp; calendar invite sent once your time is confirmed.
        </p>
      </div>

      {/* History */}
      {data.bookings.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 font-semibold">Your sessions</h2>
          <div className="space-y-2">
            {data.bookings.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{b.minutes}-min session</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(b.created_at).toLocaleDateString()} · {b.paid_with === "included" ? "Included" : `${b.tokens_spent.toLocaleString()} tokens`}
                    {b.scheduled_at ? ` · ${new Date(b.scheduled_at).toLocaleString()}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {b.zoom_link && b.status === "scheduled" && (
                    <a href={b.zoom_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted">
                      <Calendar className="h-3.5 w-3.5" /> Join
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
