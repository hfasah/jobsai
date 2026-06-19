"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { GuideMockup } from "@/components/enterprise/guide-mockup";
import type { GuideMock } from "@/lib/enterprise-guide-mocks";

type Step = { tag: string; title: string; body: string; mock: GuideMock };

const STEPS: Step[] = [
  {
    tag: "01 · Source",
    title: "AI finds your best-fit candidates",
    body: "Describe the role in plain English. JobsAI surfaces ranked matches from your database and rediscovers strong past applicants — with a fit reason for each.",
    mock: {
      title: "AI Sourcing — “Senior React engineers, remote”", icon: "✨", kind: "list",
      items: [
        { label: "Maya Chen", sub: "Senior Frontend Engineer · 8 yrs", badge: "94% match", highlight: true },
        { label: "David Okafor", sub: "Full-Stack Engineer · 6 yrs", badge: "89% match" },
        { label: "Priya Nair", sub: "React Engineer · 5 yrs", badge: "85% match" },
      ],
      annotation: "Ranked by fit, with reasons — add to a pipeline or start outreach in one click.",
    },
  },
  {
    tag: "02 · Reach",
    title: "Reach candidates on every channel",
    body: "Automated sequences across email, SMS, and WhatsApp keep candidates engaged — personalized by AI and timed for replies.",
    mock: {
      title: "Outreach sequence", icon: "📣", kind: "steps",
      steps: [
        { day: "Day 0", subject: "Intro email — personalized by AI", ai: true },
        { day: "Day 2", subject: "SMS follow-up", highlight: true },
        { day: "Day 4", subject: "WhatsApp nudge" },
        { day: "Day 7", subject: "Final email check-in", ai: true },
      ],
      annotation: "Multi-channel sequences run automatically and pause the moment a candidate replies.",
    },
  },
  {
    tag: "03 · Screen",
    title: "AI screens and scores every applicant",
    body: "AI phone & avatar interviews ask role-specific questions and return an explainable scorecard — so your team only meets the strongest.",
    mock: {
      title: "AI screen — Maya Chen", icon: "🎙️", kind: "form",
      fields: [
        { label: "Communication", value: "9 / 10" },
        { label: "Role fit", value: "8 / 10" },
        { label: "Experience match", value: "9 / 10", highlight: true },
        { label: "Recommendation", value: "Advance" },
      ],
      annotation: "Every answer is scored with a transcript — no scheduling, no bias from going first.",
    },
  },
  {
    tag: "04 · Pipeline",
    title: "Move everyone through one pipeline",
    body: "A Kanban pipeline with AI top-picks, team collaboration, and automation keeps every candidate and stage in sync.",
    mock: {
      title: "Pipeline — Senior React Engineer", icon: "🗂️", kind: "board",
      columns: [
        { title: "Applied", cards: ["+38 applicants"] },
        { title: "Screened", cards: ["Maya Chen", "David Okafor"], highlight: true },
        { title: "Interview", cards: ["Priya Nair"] },
        { title: "Offer", cards: ["—"] },
      ],
      annotation: "AI surfaces top picks; rules move candidates and send updates automatically.",
    },
  },
  {
    tag: "05 · Decide",
    title: "Offers and analytics, built in",
    body: "Generate and e-sign offers, then measure time-to-hire and funnel health with executive analytics — all in one place.",
    mock: {
      title: "Hiring analytics", icon: "📈", kind: "stats",
      stats: [
        { label: "Time-to-hire", value: "12 days", highlight: true },
        { label: "Offer acceptance", value: "92%" },
        { label: "Screens automated", value: "1,240" },
        { label: "Recruiter hours saved", value: "30/wk" },
      ],
      annotation: "See where time goes and where the funnel leaks — then fix it.",
    },
  },
];

export function ProductTour() {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2">
        {STEPS.map((s, idx) => (
          <button
            key={s.tag}
            onClick={() => setI(idx)}
            aria-label={s.title}
            className={cn("h-2 rounded-full transition-all", idx === i ? "w-8 bg-primary" : "w-2 bg-border hover:bg-muted-foreground/40")}
          />
        ))}
      </div>

      <div className="mt-8 grid items-center gap-10 lg:grid-cols-2">
        {/* Copy */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">{step.tag}</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{step.title}</h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{step.body}</p>

          <div className="mt-8 flex items-center gap-3">
            <button
              onClick={() => setI((n) => Math.max(0, n - 1))}
              disabled={i === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-3 text-sm font-semibold hover:bg-muted disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            {!last ? (
              <button
                onClick={() => setI((n) => Math.min(STEPS.length - 1, n + 1))}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-5 py-3 text-sm font-semibold text-white shadow-glow"
              >
                Next <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <Link href="/enterprise/demo" className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-5 py-3 text-sm font-semibold text-white shadow-glow">
                Book a live demo <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>

          <p className="mt-4 text-xs text-muted-foreground">Step {i + 1} of {STEPS.length}</p>
        </div>

        {/* Mock */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-lg shadow-primary/5 sm:p-6">
          <GuideMockup mock={step.mock} />
        </div>
      </div>

      {/* End CTA */}
      {last && (
        <div className="mt-12 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-transparent p-6 text-center sm:p-8">
          <h3 className="text-2xl font-bold tracking-tight">That&apos;s the whole loop — sourced to hired</h3>
          <p className="mx-auto mt-2 max-w-xl text-muted-foreground">Start free for 14 days (no card), or book a walkthrough tailored to your team.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link href="/enterprise-login" className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-white shadow-glow">Start free trial <ArrowRight className="h-4 w-4" /></Link>
            <Link href="/enterprise/demo" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold hover:bg-muted">Book a demo</Link>
          </div>
          <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground"><Check className="h-3.5 w-3.5 text-emerald-500" /> No login required to explore — this is a guided product tour.</p>
        </div>
      )}
    </div>
  );
}
