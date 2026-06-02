import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  Zap,
  FileText,
  Send,
  BarChart3,
  Mail,
  CheckCircle2,
  ArrowRight,
  Bot,
  Search,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/layout/site-header";
import { APP_NAME } from "@/lib/constants";

export default async function Home() {
  const user = await currentUser();
  if (user) redirect("/dashboard");

  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-background px-4 pb-20 pt-24 sm:px-6 sm:pt-32">
          {/* background mesh */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(80% 60% at 50% -10%, oklch(0.42 0.12 250 / 0.08), transparent 70%), radial-gradient(60% 50% at 80% 60%, oklch(0.62 0.14 175 / 0.06), transparent 60%)",
            }}
          />

          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
              <Zap className="h-3.5 w-3.5 text-desyn-accent" />
              Fully automated job applications — powered by AI
            </div>

            <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              Land your dream job{" "}
              <span className="text-gradient">without lifting a finger</span>
            </h1>

            <p className="mt-6 text-lg text-muted-foreground sm:text-xl">
              {APP_NAME} discovers matching jobs, tailors your resume, writes
              cover letters, and auto-applies — you just show up for the
              interview.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Button
                size="lg"
                className="h-11 px-6 text-base"
                render={<Link href="/sign-up" />}
              >
                Start for free
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-11 px-6 text-base"
                render={<Link href="#how-it-works" />}
              >
                See how it works
                <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </div>

            {/* social-proof stats */}
            <div className="mt-14 flex flex-wrap items-center justify-center gap-8 text-center">
              {[
                { value: "10,000+", label: "Applications sent" },
                { value: "94%", label: "ATS pass rate" },
                { value: "3×", label: "More interviews" },
              ].map(({ value, label }) => (
                <div key={label}>
                  <p className="text-3xl font-bold text-foreground">{value}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────────────────── */}
        <section
          id="how-it-works"
          className="border-t border-border bg-card px-4 py-20 sm:px-6"
        >
          <div className="mx-auto max-w-5xl">
            <div className="mb-12 text-center">
              <p className="mb-2 text-sm font-medium uppercase tracking-wider text-desyn-accent">
                How it works
              </p>
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Three steps, then relax
              </h2>
            </div>

            <div className="grid gap-8 sm:grid-cols-3">
              {[
                {
                  step: "01",
                  icon: FileText,
                  title: "Upload your resume",
                  body: "Drop your existing resume and we parse your skills, experience, and preferences in seconds.",
                },
                {
                  step: "02",
                  icon: SlidersHorizontal,
                  title: "Set your targets",
                  body: "Tell us your desired roles, locations, and salary range. Enable auto-apply and we'll do the rest.",
                },
                {
                  step: "03",
                  icon: Send,
                  title: "We apply while you sleep",
                  body: "Every morning we discover fresh openings, tailor your resume, and submit applications automatically.",
                },
              ].map(({ step, icon: Icon, title, body }) => (
                <div key={step} className="relative rounded-xl border border-border bg-background p-6">
                  <span className="font-display text-5xl font-bold text-border select-none">
                    {step}
                  </span>
                  <div className="mt-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-foreground">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────────────────────── */}
        <section
          id="features"
          className="border-t border-border bg-background px-4 py-20 sm:px-6"
        >
          <div className="mx-auto max-w-5xl">
            <div className="mb-12 text-center">
              <p className="mb-2 text-sm font-medium uppercase tracking-wider text-desyn-accent">
                Everything you need
              </p>
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Your full job search — automated
              </h2>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: Search,
                  title: "AI Job Discovery",
                  body: "We scan thousands of boards daily and surface roles that match your profile — no more manual searching.",
                },
                {
                  icon: FileText,
                  title: "Resume Tailoring",
                  body: "Every application gets a version of your resume rewritten to match the exact job description.",
                },
                {
                  icon: Send,
                  title: "Auto-Apply",
                  body: "One-click or fully automatic submission to Lever, Ashby, Greenhouse, and more platforms.",
                },
                {
                  icon: BarChart3,
                  title: "ATS Scanner",
                  body: "See your ATS score before you apply and get actionable fixes to pass automated screening.",
                },
                {
                  icon: Mail,
                  title: "Cover Letter Generator",
                  body: "AI writes a personalised cover letter for every role — aligned with your tone and the company's voice.",
                },
                {
                  icon: Bot,
                  title: "Interview Prep",
                  body: "Role-specific practice questions with model answers generated from the job description.",
                },
              ].map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="group rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
                >
                  <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/15">
                    <Icon className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground">{title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Testimonials ─────────────────────────────────────────────────── */}
        <section className="border-t border-border bg-card px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <div className="mb-12 text-center">
              <p className="mb-2 text-sm font-medium uppercase tracking-wider text-desyn-accent">
                Real results
              </p>
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                What our users say
              </h2>
            </div>

            <div className="grid gap-5 sm:grid-cols-3">
              {[
                {
                  quote:
                    "I went from 2 callbacks a month to 8 in the first week. The resume tailoring alone is worth it.",
                  name: "Marcus T.",
                  role: "Senior Software Engineer",
                  initials: "MT",
                },
                {
                  quote:
                    "JobsAI applied to 40 relevant roles while I was on vacation. Came back to 5 interview requests.",
                  name: "Priya S.",
                  role: "Product Manager",
                  initials: "PS",
                },
                {
                  quote:
                    "The ATS scanner caught that my resume was scoring 32% on keywords. Fixed it in 10 minutes.",
                  name: "Daniel R.",
                  role: "Data Scientist",
                  initials: "DR",
                },
              ].map(({ quote, name, role, initials }) => (
                <figure
                  key={name}
                  className="rounded-xl border border-border bg-background p-6"
                >
                  <blockquote className="text-sm text-foreground leading-relaxed">
                    &ldquo;{quote}&rdquo;
                  </blockquote>
                  <figcaption className="mt-4 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {initials}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{name}</p>
                      <p className="text-xs text-muted-foreground">{role}</p>
                    </div>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ──────────────────────────────────────────────────────── */}
        <section
          id="pricing"
          className="border-t border-border bg-background px-4 py-20 sm:px-6"
        >
          <div className="mx-auto max-w-5xl">
            <div className="mb-12 text-center">
              <p className="mb-2 text-sm font-medium uppercase tracking-wider text-desyn-accent">
                Pricing
              </p>
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Start free, scale when ready
              </h2>
            </div>

            <div className="grid gap-5 sm:grid-cols-3">
              {/* Free */}
              <div className="rounded-xl border border-border bg-card p-6">
                <p className="text-sm font-medium text-muted-foreground">Free</p>
                <p className="mt-2 text-4xl font-bold text-foreground">$0</p>
                <p className="mt-1 text-xs text-muted-foreground">Forever free</p>
                <Button
                  variant="outline"
                  className="mt-6 w-full"
                  render={<Link href="/sign-up" />}
                >
                  Get started
                </Button>
                <ul className="mt-6 space-y-2.5 text-sm text-muted-foreground">
                  {[
                    "1 resume upload",
                    "5 job imports / month",
                    "ATS scanner",
                    "Resume tailoring",
                    "Cover letter generator",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-desyn-success" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Pro — highlighted */}
              <div className="relative rounded-xl border-2 border-primary bg-card p-6 shadow-lg">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                  Most popular
                </span>
                <p className="text-sm font-medium text-muted-foreground">Pro</p>
                <p className="mt-2 text-4xl font-bold text-foreground">$19</p>
                <p className="mt-1 text-xs text-muted-foreground">per month</p>
                <Button
                  className="mt-6 w-full"
                  render={<Link href="/sign-up" />}
                >
                  Start Pro
                </Button>
                <ul className="mt-6 space-y-2.5 text-sm text-muted-foreground">
                  {[
                    "Unlimited resumes",
                    "100 auto-applications / month",
                    "Daily job discovery",
                    "Email notifications",
                    "Priority support",
                    "LinkedIn import (coming soon)",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-desyn-success" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Business */}
              <div className="rounded-xl border border-border bg-card p-6">
                <p className="text-sm font-medium text-muted-foreground">Business</p>
                <p className="mt-2 text-4xl font-bold text-foreground">$49</p>
                <p className="mt-1 text-xs text-muted-foreground">per month</p>
                <Button
                  variant="outline"
                  className="mt-6 w-full"
                  render={<Link href="/sign-up" />}
                >
                  Start Business
                </Button>
                <ul className="mt-6 space-y-2.5 text-sm text-muted-foreground">
                  {[
                    "Everything in Pro",
                    "Unlimited auto-applications",
                    "Browser-based form filling",
                    "Greenhouse & Workday support",
                    "AI mock interviews",
                    "Dedicated onboarding",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-desyn-success" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────────── */}
        <section className="border-t border-border bg-card px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-2xl">
            <div className="mb-12 text-center">
              <p className="mb-2 text-sm font-medium uppercase tracking-wider text-desyn-accent">
                FAQ
              </p>
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Common questions
              </h2>
            </div>

            <div className="divide-y divide-border">
              {[
                {
                  q: "Which job platforms does JobsAI support?",
                  a: "We discover jobs from RemoteOK, Adzuna, and direct company boards. We auto-submit on Lever and Ashby. Greenhouse, Workday, and others get browser-based form filling with the Business plan.",
                },
                {
                  q: "Will employers know my application was automated?",
                  a: "No. Your application is submitted with your real name, resume, and a personalised cover letter. It looks identical to a manual application.",
                },
                {
                  q: "What if a job requires a manual submission?",
                  a: "We flag it as 'manual required', prepare your tailored resume and cover letter, and notify you by email so you can submit in under 2 minutes.",
                },
                {
                  q: "Can I review applications before they're sent?",
                  a: "Yes — you can enable an approval step in your preferences so every application needs your sign-off before we submit.",
                },
                {
                  q: "Is my resume data secure?",
                  a: "All data is encrypted at rest and in transit. We use Supabase (SOC 2 Type II) for storage and never share your data with third parties.",
                },
              ].map(({ q, a }) => (
                <details key={q} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-sm font-medium text-foreground">
                    {q}
                    <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                    {a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ─────────────────────────────────────────────────────── */}
        <section className="border-t border-border bg-background px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Ready to land your{" "}
              <span className="text-gradient">next job?</span>
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Join thousands of job seekers who let AI handle the grind.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button
                size="lg"
                className="h-11 px-8 text-base"
                render={<Link href="/sign-up" />}
              >
                Get started — it&apos;s free
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <footer className="border-t border-border bg-card px-4 py-8 sm:px-6">
          <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm font-semibold text-foreground">
              <span className="text-desyn-brand">JobsAI</span>
            </p>
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} JobsAI. All rights reserved.
            </p>
            <div className="flex items-center gap-5 text-xs text-muted-foreground">
              <Link href="/sign-in" className="hover:text-foreground transition-colors">
                Sign in
              </Link>
              <Link href="/sign-up" className="hover:text-foreground transition-colors">
                Get started
              </Link>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
