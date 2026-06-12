"use client";

import { useEffect, useState } from "react";
import { Calendar, Clock, CheckCircle2, Loader2, Building2 } from "lucide-react";

interface SlotInfo {
  id: string;
  starts_at: string;
  ends_at: string | null;
  duration_min: number;
  job: { id: string; title: string; location: string } | null;
  org_name: string;
}

type PageState = "loading" | "form" | "submitting" | "confirmed" | "taken" | "error";

export default function BookingPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState<string | null>(null);
  const [slot, setSlot] = useState<SlotInfo | null>(null);
  const [pageState, setPageState] = useState<PageState>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    params.then((p) => setToken(p.token));
  }, [params]);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/enterprise/book/${token}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) {
          if (json.error.includes("already been booked")) { setPageState("taken"); return; }
          setErrorMsg(json.error);
          setPageState("error");
          return;
        }
        setSlot(json.slot);
        setPageState("form");
      })
      .catch(() => { setErrorMsg("Failed to load booking info."); setPageState("error"); });
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setPageState("submitting");

    const res = await fetch(`/api/enterprise/book/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidate_name: name, candidate_email: email, candidate_phone: phone, notes }),
    });
    const json = await res.json();
    if (!res.ok) {
      if (res.status === 409) { setPageState("taken"); return; }
      setErrorMsg(json.error ?? "Booking failed.");
      setPageState("form");
      return;
    }
    setPageState("confirmed");
  };

  const dt = slot ? new Date(slot.starts_at) : null;
  const dateStr = dt?.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const timeStr = dt?.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" });

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <span className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-purple-500 bg-clip-text text-transparent">
            JobsAI
          </span>
        </div>

        {pageState === "loading" && (
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          </div>
        )}

        {pageState === "error" && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center text-red-400">
            {errorMsg || "Something went wrong."}
          </div>
        )}

        {pageState === "taken" && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-8 text-center">
            <Calendar className="mx-auto mb-3 h-12 w-12 text-amber-400" />
            <h2 className="mb-2 text-xl font-bold text-white">Slot Already Booked</h2>
            <p className="text-sm text-amber-300">This interview slot has already been taken. Please contact your recruiter for another available time.</p>
          </div>
        )}

        {(pageState === "form" || pageState === "submitting") && slot && (
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
            {/* Header */}
            <div className="border-b border-white/10 bg-violet-600/20 px-6 py-5">
              <div className="mb-1 flex items-center gap-2 text-violet-300">
                <Building2 className="h-4 w-4" />
                <span className="text-sm font-medium">{slot.org_name}</span>
              </div>
              <h1 className="text-lg font-bold text-white">
                {slot.job?.title ?? "Interview Invitation"}
              </h1>
            </div>

            {/* Slot info */}
            <div className="flex gap-6 border-b border-white/10 px-6 py-4">
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <Calendar className="h-4 w-4 text-violet-400" />
                <div>
                  <p className="font-semibold text-white">{dateStr}</p>
                  <p className="text-xs text-gray-400">{timeStr}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <Clock className="h-4 w-4 text-violet-400" />
                <span>{slot.duration_min} min</span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={submit} className="space-y-4 p-6">
              <p className="text-sm text-gray-400">Fill in your details to confirm this interview slot.</p>

              {errorMsg && (
                <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{errorMsg}</p>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Full Name *
                </label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Email Address *
                </label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Phone Number (optional)
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 555 000 0000"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Notes (optional)
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any questions or notes for the interviewer?"
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                />
              </div>

              <button
                type="submit"
                disabled={pageState === "submitting"}
                className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-60 hover:from-violet-500 hover:to-purple-500 transition-all"
              >
                {pageState === "submitting" ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Confirming…
                  </span>
                ) : (
                  "Confirm Interview"
                )}
              </button>
            </form>
          </div>
        )}

        {pageState === "confirmed" && slot && (
          <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-8 text-center">
            <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-green-400" />
            <h2 className="mb-2 text-2xl font-bold text-white">You're Booked!</h2>
            <p className="mb-4 text-sm text-gray-300">
              Your interview with <strong>{slot.org_name}</strong> has been confirmed.
            </p>
            <div className="mb-4 rounded-xl bg-white/5 px-4 py-3 text-sm">
              <p className="font-semibold text-white">{dateStr}</p>
              <p className="text-gray-400">{timeStr} · {slot.duration_min} minutes</p>
            </div>
            <p className="text-xs text-gray-500">
              A confirmation email with a calendar invite has been sent to your inbox.
            </p>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-gray-600">
          Powered by <span className="text-violet-400">JobsAI</span>
        </p>
      </div>
    </div>
  );
}
