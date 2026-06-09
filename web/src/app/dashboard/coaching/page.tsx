"use client";

import Link from "next/link";
import { UserRound, ArrowRight, Target, TrendingUp, Zap, ShieldCheck, Rocket, Gift } from "lucide-react";

const BOOKING_URL = "https://api.leadconnectorhq.com/widget/booking/CJnTYqv0W4TkC52ggN8E";

const BENEFITS: { icon: React.ElementType; lead: string; text: string }[] = [
  { icon: Target,      lead: "Land the job in fewer interviews",      text: "your coach reveals exactly what hiring managers want to hear, plus the small things that quietly get people rejected." },
  { icon: TrendingUp,  lead: "Negotiate thousands more",              text: "one tactic can add $10K+ to your offer. A single session can pay for itself many times over." },
  { icon: Zap,         lead: "Skip months of rejection",              text: "get in 30 minutes the shortcut it takes most people 6 months of trial and error to figure out." },
  { icon: ShieldCheck, lead: "Walk in unshakably confident",          text: "rehearse your toughest questions live with a real pro, so the real interview feels easy." },
  { icon: Rocket,      lead: "Leave with a game plan, not just tips", text: "a personalized, step-by-step roadmap to your next offer, built around you and your target role." },
];

export default function CoachingPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 py-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Career Success Coach</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A free 30-minute 1:1 video session with a real career coach. Resume review, interview strategy, salary negotiation, or whatever you need most.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-brand text-white">
            <UserRound className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">Free 30-min 1:1 coaching session</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-desyn-success/15 px-2 py-0.5 text-[11px] font-semibold text-desyn-success">
                <Gift className="h-3 w-3" /> No cost · No tokens
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick a time that works for you. Your coach will review your profile beforehand.
            </p>
          </div>
        </div>

        {/* Why it's worth it */}
        <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="mb-3 text-sm font-semibold">Why one session is worth it</p>
          <ul className="space-y-2.5">
            {BENEFITS.map((b, i) => {
              const Icon = b.icon;
              return (
                <li key={i} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-muted-foreground">
                    <strong className="text-foreground">{b.lead}:</strong> {b.text}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs font-medium text-primary">
            Most people never get this kind of insider help. 30 minutes could change your entire job search.
          </p>
        </div>

        {/* CTA */}
        <a
          href={BOOKING_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-cta mt-5 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold shadow-glow"
        >
          <UserRound className="h-5 w-5" />
          Book My Free 30-Min Call
          <ArrowRight className="h-5 w-5" />
        </a>
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Free · No credit card · Pick a time instantly
        </p>

        {/* Prep tip */}
        <p className="mt-3 rounded-lg border border-border bg-background/40 px-3 py-2.5 text-center text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Get the most from your 30 minutes:</span> upload your{" "}
          <Link href="/dashboard/resumes" className="font-medium text-primary hover:underline">résumé</Link>, complete your{" "}
          <Link href="/dashboard/apply-profile" className="font-medium text-primary hover:underline">Apply Profile</Link>, and fill in your{" "}
          <Link href="/dashboard/preferences" className="font-medium text-primary hover:underline">Preferences</Link> first, so your coach can review them beforehand and you dive straight into what matters.
        </p>
      </div>
    </div>
  );
}
