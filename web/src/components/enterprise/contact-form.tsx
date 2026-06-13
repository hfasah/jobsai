"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";

const CATEGORIES = [
  { value: "enterprise_sales", label: "Talk to sales" },
  { value: "enterprise_demo", label: "Request a demo" },
  { value: "enterprise_partnership", label: "Partnerships" },
  { value: "enterprise_support", label: "Technical support" },
  { value: "enterprise_billing", label: "Billing & contracts" },
  { value: "enterprise_other", label: "Something else" },
];

export function EnterpriseContactForm() {
  const [form, setForm] = useState({ name: "", email: "", company: "", subject: "", category: "enterprise_sales", message: "" });
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    try {
      // Reuse the shared contact endpoint. Company goes into the subject so it
      // shows up on the support ticket / notification email.
      const subject = [form.company && `[${form.company}]`, form.subject || "Enterprise enquiry"].filter(Boolean).join(" ");
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, subject, category: form.category, message: form.message }),
      });
      setState(res.ok ? "sent" : "error");
    } catch {
      setState("error");
    }
  };

  if (state === "sent") {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-8 py-20 text-center">
        <CheckCircle2 className="h-12 w-12 text-emerald-500" />
        <h2 className="mt-4 text-xl font-bold">Message received!</h2>
        <p className="mt-2 text-muted-foreground">
          Thanks for reaching out. We&apos;ll get back to you at <strong>{form.email}</strong> within one business day.
        </p>
        <Link href="/enterprise/home" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-white shadow-glow">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-2xl border border-border bg-card p-8">
      <h2 className="text-xl font-bold">Send us a message</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Name</label>
          <input required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Your name"
            className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Work email</label>
          <input required type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="you@company.com"
            className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Company</label>
          <input value={form.company} onChange={(e) => set("company", e.target.value)} placeholder="Company name"
            className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">How can we help?</label>
          <select value={form.category} onChange={(e) => set("category", e.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-primary/50">
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">Subject</label>
        <input value={form.subject} onChange={(e) => set("subject", e.target.value)} placeholder="Brief description"
          className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground" />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">Message</label>
        <textarea required value={form.message} onChange={(e) => set("message", e.target.value)} rows={6}
          placeholder="Tell us about your team, hiring volume, and what you're looking for…"
          className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground" />
      </div>

      {state === "error" && (
        <p className="text-sm text-destructive">Something went wrong. Please email us directly at support@jobsai.work</p>
      )}

      <button type="submit" disabled={state === "sending"}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand py-3 text-sm font-semibold text-white shadow-glow disabled:opacity-60">
        {state === "sending" && <Loader2 className="h-4 w-4 animate-spin" />}
        {state === "sending" ? "Sending…" : "Send message"}
      </button>

      <p className="text-center text-xs text-muted-foreground">We reply to every message within one business day.</p>
    </form>
  );
}
