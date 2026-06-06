"use client";

import { useState } from "react";
import Link from "next/link";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Mail, MessageSquare, Clock, CheckCircle2, Loader2 } from "lucide-react";
import { GradientBg } from "@/components/ui/gradient-bg";

const CATEGORIES = [
  { value: "general",  label: "General enquiry" },
  { value: "billing",  label: "Billing and subscriptions" },
  { value: "technical", label: "Technical issue" },
  { value: "feature",  label: "Feature request" },
  { value: "account",  label: "Account and access" },
  { value: "enterprise", label: "Enterprise and partnerships" },
];

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", category: "general", message: "" });
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setState(res.ok ? "sent" : "error");
    } catch {
      setState("error");
    }
  };

  return (
    <div className="dark bg-background text-foreground flex flex-col min-h-screen">
      <MarketingHeader />
      <main className="flex-1">

        {/* Hero */}
        <section className="relative overflow-hidden border-b border-white/10 px-4 py-20 text-center sm:px-6">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(70% 55% at 50% 0%, color-mix(in oklch, var(--desyn-purple) 28%, transparent), transparent 70%), radial-gradient(50% 40% at 15% 20%, color-mix(in oklch, var(--desyn-brand) 18%, transparent), transparent 65%), radial-gradient(45% 40% at 85% 20%, color-mix(in oklch, var(--desyn-cyan) 14%, transparent), transparent 60%)",
            }}
          />
          <GradientBg variant="grid" className="opacity-20" />
          <div className="relative mx-auto max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--cta)]/40 bg-[var(--cta)]/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-[var(--cta)]">
              <MessageSquare className="h-3 w-3" /> Support
            </span>
            <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
              We&apos;re <span className="text-gradient">here to help</span>
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Have a question, issue, or idea? Send us a message and we&apos;ll get back to you within one business day.
            </p>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-3">

          {/* Info column */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-card/80 p-6 backdrop-blur">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mt-4 font-semibold">Email support</h3>
              <p className="mt-1 text-sm text-muted-foreground">Send us an email any time.</p>
              <a href="mailto:support@jobsai.work" className="mt-2 block text-sm font-medium text-primary hover:underline">
                support@jobsai.work
              </a>
            </div>

            <div className="rounded-2xl border border-white/10 bg-card/80 p-6 backdrop-blur">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mt-4 font-semibold">Response time</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                We typically respond within one business day. Priority support is available on Premium and Career Accelerator plans.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-card/80 p-6 backdrop-blur">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mt-4 font-semibold">Common topics</h3>
              <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                {["Auto-apply not working", "Resume parsing issues", "Billing questions", "Cancel subscription", "Feature requests"].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-primary" />{t}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-2">
            {state === "sent" ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-desyn-success/30 bg-desyn-success/5 px-8 py-20 text-center">
                <CheckCircle2 className="h-12 w-12 text-desyn-success" />
                <h2 className="mt-4 text-xl font-bold">Message received!</h2>
                <p className="mt-2 text-muted-foreground">
                  Thanks for reaching out. We&apos;ll get back to you at <strong>{form.email}</strong> within one business day.
                </p>
                <Link href="/" className="btn-cta mt-8 inline-flex rounded-xl px-6 py-3 text-sm font-semibold">
                  Back to home
                </Link>
              </div>
            ) : (
              <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-card/80 p-8 space-y-5 backdrop-blur">
                <h2 className="text-xl font-bold">Send a message</h2>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Name</label>
                    <input required value={form.name} onChange={(e) => set("name", e.target.value)}
                      placeholder="Your name"
                      className="h-11 w-full rounded-xl border border-white/10 bg-background/60 px-4 text-sm outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
                    <input required type="email" value={form.email} onChange={(e) => set("email", e.target.value)}
                      placeholder="you@email.com"
                      className="h-11 w-full rounded-xl border border-white/10 bg-background/60 px-4 text-sm outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground" />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Category</label>
                    <select value={form.category} onChange={(e) => set("category", e.target.value)}
                      className="h-11 w-full rounded-xl border border-white/10 bg-background/60 px-4 text-sm outline-none focus:ring-2 focus:ring-primary/50">
                      {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Subject</label>
                    <input value={form.subject} onChange={(e) => set("subject", e.target.value)}
                      placeholder="Brief description"
                      className="h-11 w-full rounded-xl border border-white/10 bg-background/60 px-4 text-sm outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Message</label>
                  <textarea required value={form.message} onChange={(e) => set("message", e.target.value)}
                    placeholder="Describe your question or issue in detail..."
                    rows={6}
                    className="w-full rounded-xl border border-white/10 bg-background/60 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground resize-none" />
                </div>

                {state === "error" && (
                  <p className="text-sm text-destructive">Something went wrong. Please email us directly at support@jobsai.work</p>
                )}

                <button type="submit" disabled={state === "sending"}
                  className="btn-cta inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold disabled:opacity-60">
                  {state === "sending" && <Loader2 className="h-4 w-4 animate-spin" />}
                  {state === "sending" ? "Sending…" : "Send message"}
                </button>

                <p className="text-center text-xs text-muted-foreground">
                  We reply to every message within one business day.
                </p>
              </form>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
