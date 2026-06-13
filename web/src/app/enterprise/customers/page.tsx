import Link from "next/link";
import { Sparkles, ArrowRight, Quote, Check } from "lucide-react";
import { PublicEnterpriseHeader } from "@/components/enterprise/public-header";

export const metadata = {
  title: "Customers — JobsAI Enterprise",
  description: "Join the founding customers shaping the AI-Powered Talent Acquisition Operating System.",
};

const BOOKING = "https://api.leadconnectorhq.com/widget/booking/5HFMVFvz8AJQ4gjY7B9F";

const PERKS = [
  "50% off for life",
  "Direct line to the product team",
  "Influence the roadmap",
  "Priority onboarding & support",
  "Featured as a launch case study",
];

export default function EnterpriseCustomersPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicEnterpriseHeader />

      <section className="border-b border-border bg-gradient-to-b from-primary/5 to-transparent px-6 py-16 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Founding Customers</p>
        <h1 className="mx-auto mt-2 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">Help shape the future of AI recruiting</h1>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">We&apos;re onboarding our first cohort of recruiting teams. Join them, lock in founding pricing, and become one of our first success stories.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/enterprise-login" className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-white shadow-glow">Start free trial <ArrowRight className="h-4 w-4" /></Link>
          <a href={BOOKING} target="_blank" rel="noreferrer" className="rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold hover:bg-muted">Book a demo</a>
        </div>
      </section>

      {/* Founding program */}
      <section className="mx-auto max-w-4xl px-6 py-14">
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-transparent p-8">
          <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /><h2 className="text-xl font-bold">Founding Customer Program — 50% off for life</h2></div>
          <p className="mt-2 text-sm text-muted-foreground">Available to the first 20 customers. In exchange for feedback and a case study, you get full access at half price, forever.</p>
          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            {PERKS.map((p) => <li key={p} className="flex items-start gap-2 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{p}</li>)}
          </ul>
        </div>
      </section>

      {/* Stories (placeholder slots — fill with real founding customers) */}
      <section className="mx-auto max-w-6xl px-6 pb-14">
        <h2 className="mb-2 text-center text-2xl font-bold">Customer stories</h2>
        <p className="mb-8 text-center text-sm text-muted-foreground">Our founding cohort is onboarding now — their results will appear here soon.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col rounded-2xl border border-dashed border-border bg-card/50 p-6">
              <Quote className="h-6 w-6 text-muted-foreground/40" />
              <p className="mt-3 flex-1 text-sm text-muted-foreground">Your team&apos;s results here — time-to-hire, sourcing volume, or hours saved.</p>
              <div className="mt-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-muted" />
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">Founding customer</p>
                  <p className="text-xs text-muted-foreground">Your company</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Want to be featured? <a href={BOOKING} target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline">Talk to us →</a>
        </p>
      </section>
    </main>
  );
}
