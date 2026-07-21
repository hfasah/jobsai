import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight, Sparkles, Target, Compass, Rocket, FileText, Mic,
  Heart, ShieldCheck, Globe, BarChart3, Lightbulb, Search, GraduationCap,
} from "lucide-react";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { SiteFooter } from "@/components/marketing/site-footer";

export const metadata: Metadata = {
  title: "About JobsAI — Apply Less. Interview More.",
  description:
    "JobsAI is your AI job-search copilot: it finds matching jobs, tailors your resume, applies for you, and preps you for interviews — so you spend your energy where it counts.",
  alternates: { canonical: "/about" },
};

const WHAT_WE_DO = [
  { icon: Search, title: "AI Job Discovery", body: "Scans thousands of listings daily and surfaces the roles that actually match your skills, experience, and goals." },
  { icon: Rocket, title: "Auto Apply", body: "Applies to matching jobs for you — fully autonomous, hybrid, or review-first. Your search keeps moving while you sleep." },
  { icon: FileText, title: "Resume Tailoring & Cover Letters", body: "Adapts your real experience to each job description so you get past ATS screens — adaptation, never invention." },
  { icon: Mic, title: "Interview Practice", body: "AI voice and avatar interviews with feedback, so the first time you answer the hard question isn't in the real room." },
  { icon: GraduationCap, title: "Career Coaching", body: "Real strategy sessions when you want a human in the loop — direction, positioning, and honest feedback." },
  { icon: BarChart3, title: "One Place for Everything", body: "Applications, matches, interviews, and follow-ups tracked together — no more spreadsheet archaeology." },
];

const VALUES = [
  {
    icon: Target,
    title: "Job Seekers First",
    body: "Every decision starts with one question: does this get you hired faster? Your outcome comes before our roadmap.",
  },
  {
    icon: Heart,
    title: "Human-Centered AI",
    body: "AI should carry the busywork, not replace your judgment. You stay in control of every application that goes out in your name.",
  },
  {
    icon: ShieldCheck,
    title: "Honesty by Default",
    body: "Your resume is adapted, never fabricated. Your data is yours. When something goes wrong on our side, we tell you and fix it.",
  },
  {
    icon: Lightbulb,
    title: "Relentless Innovation",
    body: "The job market keeps changing, and so do we — from smarter matching to interview practice that feels like the real thing.",
  },
  {
    icon: Globe,
    title: "Access for Everyone",
    body: "A world-class job search shouldn't require insider connections or expensive coaches. Great tools, priced for people between jobs.",
  },
  {
    icon: BarChart3,
    title: "Outcomes Over Activity",
    body: "We measure interviews landed and offers signed — not applications fired into the void. Quality beats volume, always.",
  },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <MarketingHeader />

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-16 pt-20 text-center">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
          style={{ background: "radial-gradient(60% 50% at 50% 0%, color-mix(in oklch, var(--primary) 18%, transparent), transparent 70%)" }}
        />
        <div className="relative mx-auto max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Compass className="h-3.5 w-3.5" /> Our Mission
          </span>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-6xl">
            Apply Less.{" "}
            <span className="bg-gradient-brand bg-clip-text text-transparent">Interview More.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            Searching for a job shouldn&apos;t be a full-time job. JobsAI is your AI copilot that finds the right
            roles, tailors your resume, applies for you, and gets you ready for the interview — so you spend your
            energy where it actually counts.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/sign-up" className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-7 py-3 text-sm font-semibold text-white shadow-glow">
              Get started <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/#pricing" className="rounded-xl border border-border bg-card px-7 py-3 text-sm font-semibold hover:bg-muted">
              See pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Why we built JobsAI */}
      <section className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">Why we built JobsAI</h2>
        <div className="mt-6 space-y-4 leading-relaxed text-muted-foreground">
          <p>
            Anyone who has looked for work recently knows the grind: hours scrolling job boards, rewriting the same
            resume for the tenth time, filling in endless application forms, writing cover letters nobody may read —
            and then, silence. The modern job search asks for full-time effort and gives back very little signal.
          </p>
          <p>
            Meanwhile, employers were adopting AI to screen candidates at scale. Job seekers were bringing a keyboard
            to an algorithm fight. We built JobsAI to level that field — to give every candidate the same intelligence,
            speed, and polish that the other side of the table already has.
          </p>
          <p>
            Today JobsAI discovers matching roles every morning, tailors your story to each one honestly, submits
            applications on your behalf, and coaches you through the interviews that follow. You stay in control;
            the machine does the grind.
          </p>
        </div>
      </section>

      {/* What we do */}
      <section className="border-y border-border bg-card/40 px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">What JobsAI does for you</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {WHAT_WE_DO.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-border bg-card p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">What we stand for</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {VALUES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* For recruiters */}
      <section className="mx-auto max-w-3xl px-6 pb-8 text-center">
        <p className="text-sm text-muted-foreground">
          Hiring instead of hunting?{" "}
          <a href="https://app.jobsai.work/enterprise" className="font-semibold text-primary hover:underline">
            JobsAI Enterprise
          </a>{" "}
          is our AI talent-acquisition platform for recruiters, agencies, and HR teams.
        </p>
      </section>

      {/* Final CTA */}
      <section className="px-6 pb-20 pt-8 text-center">
        <div className="mx-auto max-w-2xl rounded-3xl border border-primary/30 bg-gradient-to-b from-primary/10 to-transparent px-8 py-12">
          <Sparkles className="mx-auto h-8 w-8 text-primary" />
          <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">Your next role may already be waiting</h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Upload your resume and let JobsAI start working for you today — 7-day free trial, 500 free credits, cancel anytime.
          </p>
          <Link href="/sign-up" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-8 py-3 text-sm font-semibold text-white shadow-glow">
            Start free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
