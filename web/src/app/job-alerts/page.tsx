"use client";

import { useState } from "react";
import Link from "next/link";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Bell, Briefcase, MapPin, CheckCircle2, Loader2, Zap } from "lucide-react";

const FREQUENCIES = [
  { value: "daily",   label: "Daily digest" },
  { value: "weekly",  label: "Weekly roundup" },
  { value: "instant", label: "Instant (as found)" },
];

const JOB_TYPES = [
  { value: "any",        label: "Any" },
  { value: "full_time",  label: "Full-time" },
  { value: "part_time",  label: "Part-time" },
  { value: "contract",   label: "Contract" },
  { value: "remote",     label: "Remote" },
];

export default function JobAlertsPage() {
  const [form, setForm] = useState({ name: "", email: "", job_titles: "", locations: "", job_type: "any", frequency: "weekly" });
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    try {
      const res = await fetch("/api/job-alerts/subscribe", {
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
    <>
      <MarketingHeader />
      <main className="flex-1 bg-background">

        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border/60 px-4 py-20 text-center sm:px-6">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
          <div className="relative mx-auto max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Bell className="h-3 w-3" /> Job Alerts
            </span>
            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
              Get matched jobs<br />
              <span className="text-gradient">delivered to you</span>
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Tell us what you&apos;re looking for. We&apos;ll send matching jobs straight to your inbox, daily or weekly.
            </p>
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-5">

          {/* Benefits */}
          <div className="space-y-5 lg:col-span-2">
            {[
              { icon: Bell,     title: "Personalised alerts",    body: "Jobs matched to your titles, location, and type preferences." },
              { icon: Briefcase, title: "Thousands of roles",    body: "We scan thousands of listings daily across the US, Canada, UK and EU." },
              { icon: Zap,      title: "Apply with one click",   body: "See a match? Sign up and let JobsAI auto-apply for you." },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}

            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-sm font-semibold text-foreground">Want full auto-apply?</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Alerts are free. For AI to apply on your behalf, create a free JobsAI account.
              </p>
              <Link href="/sign-up" className="btn-cta mt-4 inline-flex rounded-xl px-5 py-2.5 text-sm font-semibold">
                Get started free
              </Link>
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-3">
            {state === "sent" ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-desyn-success/30 bg-desyn-success/5 px-8 py-20 text-center">
                <CheckCircle2 className="h-12 w-12 text-desyn-success" />
                <h2 className="mt-4 text-xl font-bold">You&apos;re subscribed!</h2>
                <p className="mt-2 text-muted-foreground">
                  We&apos;ll send {form.frequency} job alerts to <strong>{form.email}</strong>.
                </p>
                <p className="mt-4 text-sm text-muted-foreground">
                  Want AI to apply for you automatically?{" "}
                  <Link href="/sign-up" className="text-primary hover:underline">Create a free account</Link>.
                </p>
              </div>
            ) : (
              <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-8 space-y-5">
                <h2 className="text-xl font-bold">Set up your job alerts</h2>
                <p className="text-sm text-muted-foreground">No account needed. Just your email.</p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Name (optional)</label>
                    <input value={form.name} onChange={(e) => set("name", e.target.value)}
                      placeholder="Your name"
                      className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Email address</label>
                    <input required type="email" value={form.email} onChange={(e) => set("email", e.target.value)}
                      placeholder="you@email.com"
                      className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    <Briefcase className="inline h-3.5 w-3.5 mr-1" />
                    Job titles (comma separated)
                  </label>
                  <input value={form.job_titles} onChange={(e) => set("job_titles", e.target.value)}
                    placeholder="e.g. Software Engineer, Product Manager, Data Analyst"
                    className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    <MapPin className="inline h-3.5 w-3.5 mr-1" />
                    Locations (comma separated)
                  </label>
                  <input value={form.locations} onChange={(e) => set("locations", e.target.value)}
                    placeholder="e.g. Toronto, Remote, London"
                    className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground" />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Job type</label>
                    <div className="flex flex-wrap gap-2">
                      {JOB_TYPES.map((t) => (
                        <button key={t.value} type="button" onClick={() => set("job_type", t.value)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${form.job_type === t.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Alert frequency</label>
                    <div className="flex flex-col gap-2">
                      {FREQUENCIES.map((f) => (
                        <button key={f.value} type="button" onClick={() => set("frequency", f.value)}
                          className={`rounded-xl border px-3 py-2 text-left text-xs font-medium transition-colors ${form.frequency === f.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}>
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {state === "error" && (
                  <p className="text-sm text-destructive">Something went wrong. Please try again.</p>
                )}

                <button type="submit" disabled={state === "sending"}
                  className="btn-cta inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold disabled:opacity-60">
                  {state === "sending" && <Loader2 className="h-4 w-4 animate-spin" />}
                  {state === "sending" ? "Subscribing…" : "Get job alerts"}
                </button>

                <p className="text-center text-xs text-muted-foreground">
                  Free forever. Unsubscribe anytime by replying to any alert email.
                </p>
              </form>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
