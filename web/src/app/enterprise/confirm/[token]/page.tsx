"use client";

import { use, useEffect, useState } from "react";
import { CalendarCheck, Loader2, CheckCircle2, Video, MapPin, Clock } from "lucide-react";

export default function ConfirmInterviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<{ title: string; candidate_name: string; scheduled_at: string; duration_min: number; meeting_link: string | null; interview_type: string; location: string | null; status: string; org_name: string } | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState<"confirmed" | "cancelled" | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/enterprise/confirm/${token}`).then((r) => r.json()).then((j) => {
      if (j.data) { setData(j.data); if (["confirmed", "cancelled"].includes(j.data.status)) setDone(j.data.status); }
      else setError(j.error ?? "Not found.");
    });
  }, [token]);

  const respond = async (decline: boolean) => {
    setBusy(true);
    const res = await fetch(`/api/enterprise/confirm/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decline }) });
    const j = await res.json();
    if (res.ok) setDone(j.status);
    setBusy(false);
  };

  if (error) return <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">{error}</div>;
  if (!data) return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const when = new Date(data.scheduled_at).toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-brand shadow-glow">
          <CalendarCheck className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-xl font-bold">Interview with {data.org_name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{data.title}</p>

        <div className="mt-5 space-y-2 rounded-xl border border-border bg-background/40 p-4 text-left text-sm">
          <p className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> {when} · {data.duration_min} min</p>
          {data.interview_type === "onsite"
            ? data.location && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> {data.location}</p>
            : data.meeting_link && <p className="flex items-center gap-2"><Video className="h-4 w-4 text-primary" /> <a href={data.meeting_link} className="text-primary underline break-all">{data.meeting_link}</a></p>}
        </div>

        {done === "confirmed" ? (
          <div className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 py-3 text-sm font-medium text-green-400">
            <CheckCircle2 className="h-4 w-4" /> Confirmed — see you there!
          </div>
        ) : done === "cancelled" ? (
          <p className="mt-5 text-sm text-muted-foreground">You declined this interview. The team has been notified.</p>
        ) : (
          <div className="mt-5 flex gap-2">
            <button onClick={() => respond(false)} disabled={busy} className="btn-cta flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Confirm
            </button>
            <button onClick={() => respond(true)} disabled={busy} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted">Can't make it</button>
          </div>
        )}
      </div>
    </div>
  );
}
