"use client";

// Public "pick a time" booking page (Calendly-style). Candidates see live open
// slots — the recruiter's work hours minus their Google Calendar busy times —
// pick one, leave name+email, and get a calendar invite with a Meet link.
import { useEffect, useMemo, useState } from "react";
import { Calendar, CheckCircle2, ChevronLeft, Clock, Loader2, Video } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageData {
  org_name: string;
  title: string;
  duration_min: number;
  timezone: string;
  slots: string[];
  calendar_checked: boolean;
}
type PageState = "loading" | "pick" | "form" | "submitting" | "confirmed" | "error";

export default function BookingPickerPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<PageData | null>(null);
  const [state, setState] = useState<PageState>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [slot, setSlot] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState<{ starts_at: string; meet_link: string | null } | null>(null);

  useEffect(() => { params.then((p) => setToken(p.token)); }, [params]);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/enterprise/book/p/${token}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error || !j.data) { setErrorMsg(j.error ?? "Failed to load."); setState("error"); return; }
        setData(j.data);
        setState("pick");
      })
      .catch(() => { setErrorMsg("Failed to load booking page."); setState("error"); });
  }, [token]);

  // Slots grouped by local day (viewer's clock — that's what candidates expect).
  const days = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const s of data?.slots ?? []) {
      const label = new Date(s).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
      map.set(label, [...(map.get(label) ?? []), s]);
    }
    return [...map.entries()];
  }, [data]);

  // Derived, not synced-in-an-effect: fall back to the first day whenever the
  // stored selection is empty or no longer present after a slots refresh.
  const activeDay = day && days.some(([l]) => l === day) ? day : (days[0]?.[0] ?? null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slot || !name.trim() || !email.trim()) return;
    setState("submitting");
    const res = await fetch(`/api/enterprise/book/p/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ starts_at: slot, name, email, phone, notes }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (j.taken) {
        // Someone grabbed it — refresh slots and send them back to the picker.
        setErrorMsg("That time was just taken — please pick another.");
        const r = await fetch(`/api/enterprise/book/p/${token}`).then((x) => x.json()).catch(() => null);
        if (r?.data) setData(r.data);
        setSlot(null);
        setState("pick");
        return;
      }
      setErrorMsg(j.error ?? "Could not book — try again.");
      setState("form");
      return;
    }
    setConfirmed({ starts_at: j.data.starts_at, meet_link: j.data.meet_link });
    setState("confirmed");
  };

  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-lg">
        {state === "loading" && (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        )}

        {state === "error" && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <Calendar className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
          </div>
        )}

        {data && (state === "pick" || state === "form" || state === "submitting") && (
          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-primary">{data.org_name}</p>
            <h1 className="mt-1 text-xl font-bold">{data.title}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> {data.duration_min} minutes · Google Meet · times shown in your timezone
            </p>
            {errorMsg && state === "pick" && (
              <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-500">{errorMsg}</p>
            )}

            {state === "pick" && (
              days.length === 0 ? (
                <p className="mt-6 rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  No open times right now — check back soon.
                </p>
              ) : (
                <>
                  <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
                    {days.map(([label, daySlots]) => (
                      <button
                        key={label}
                        onClick={() => setDay(label)}
                        className={cn(
                          "shrink-0 rounded-xl border px-3 py-2 text-xs font-medium",
                          activeDay === label ? "border-primary/60 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {label}
                        <span className="ml-1 opacity-60">({daySlots.length})</span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {(days.find(([l]) => l === activeDay)?.[1] ?? []).map((s) => (
                      <button
                        key={s}
                        onClick={() => { setSlot(s); setErrorMsg(""); setState("form"); }}
                        className="rounded-xl border border-border py-2 text-sm font-medium hover:border-primary/60 hover:text-primary"
                      >
                        {fmtTime(s)}
                      </button>
                    ))}
                  </div>
                </>
              )
            )}

            {(state === "form" || state === "submitting") && slot && (
              <form onSubmit={submit} className="mt-5">
                <button type="button" onClick={() => setState("pick")} className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <ChevronLeft className="h-3.5 w-3.5" /> Pick a different time
                </button>
                <div className="mb-4 rounded-xl border border-primary/40 bg-primary/5 px-3 py-2.5 text-sm font-medium">
                  {new Date(slot).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} · {fmtTime(slot)}
                </div>
                <div className="space-y-3">
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email" required
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything you'd like to mention (optional)" rows={2}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                {errorMsg && <p className="mt-2 text-xs text-red-400">{errorMsg}</p>}
                <button type="submit" disabled={state === "submitting"}
                  className="btn-cta mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60">
                  {state === "submitting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
                  Confirm booking
                </button>
              </form>
            )}
          </div>
        )}

        {state === "confirmed" && confirmed && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-green-400" />
            <h1 className="text-xl font-bold">You&apos;re booked!</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {new Date(confirmed.starts_at).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} at {fmtTime(confirmed.starts_at)}.
              A calendar invite is on its way to your email.
            </p>
            {confirmed.meet_link && (
              <a href={confirmed.meet_link} target="_blank" rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-primary/40 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10">
                <Video className="h-4 w-4" /> Google Meet link
              </a>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
