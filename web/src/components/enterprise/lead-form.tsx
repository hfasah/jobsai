"use client";

import { useState } from "react";
import { ATTRIBUTION_KEY } from "@/components/enterprise/attribution-capture";

// Lead capture form rendered by the CMS leadForm block. Posts server-side into
// GoHighLevel (via /api/marketing/lead) with first-touch attribution attached,
// so the agency's automations fire the moment someone submits. The hidden
// "website" field is a honeypot: bots fill it, humans never see it.

interface LeadFormProps {
  heading?: string;
  subheading?: string;
  buttonLabel?: string;
  successMessage?: string;
  tag?: string;
  showPhone?: boolean;
}

export function LeadForm({ heading, subheading, buttonLabel, successMessage, tag, showPhone }: LeadFormProps) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [hp, setHp] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "sending") return;
    setState("sending");
    let attribution = null;
    try { attribution = JSON.parse(localStorage.getItem(ATTRIBUTION_KEY) ?? "null"); } catch { /* best-effort */ }
    const res = await fetch("/api/marketing/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, email, phone, tag, website: hp, attribution }),
    }).catch(() => null);
    setState(res?.ok ? "done" : "error");
  }

  if (state === "done") {
    return (
      <div className="rounded-2xl border border-border bg-card px-6 py-10 text-center">
        <p className="text-lg font-semibold">{successMessage || "Thanks. We received your details and will be in touch shortly."}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      {heading && <h3 className="text-xl font-bold">{heading}</h3>}
      {subheading && <p className="mt-1.5 text-sm text-muted-foreground">{subheading}</p>}
      <form onSubmit={submit} className="mt-5 space-y-3">
        <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" required
          className="h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm outline-none focus:ring-2 focus:ring-primary" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Work email" type="email" required
          className="h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm outline-none focus:ring-2 focus:ring-primary" />
        {showPhone && (
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" type="tel"
            className="h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm outline-none focus:ring-2 focus:ring-primary" />
        )}
        <input value={hp} onChange={(e) => setHp(e.target.value)} name="website" tabIndex={-1} autoComplete="off" aria-hidden="true"
          className="absolute -left-[9999px] h-0 w-0 opacity-0" />
        <button type="submit" disabled={state === "sending"}
          className="h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60">
          {state === "sending" ? "Sending…" : (buttonLabel || "Get started")}
        </button>
        {state === "error" && (
          <p className="text-sm text-red-400">Something went wrong sending your details. Please try again.</p>
        )}
      </form>
    </div>
  );
}
