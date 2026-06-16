import Link from "next/link";
import { Check, Building2, Sparkles } from "lucide-react";
import { PlanComparison } from "@/components/enterprise/plan-comparison";
import { EnterprisePricingCards } from "@/components/enterprise/pricing-cards";
import { PublicEnterpriseHeader } from "@/components/enterprise/public-header";
import { PublicEnterpriseFooter } from "@/components/enterprise/public-footer";

export const metadata = {
  title: "JobsAI Enterprise Pricing — AI-Powered Talent Acquisition Operating System",
  description: "Monthly or annual billing (save 20%). Plans from $299/mo ($239/mo billed annually) with a 14-day free trial.",
};

const BOOK_DEMO = "/enterprise/demo";

// Founding offer — 50% off your first year on annual plans, first 25 members.
const FOUNDING = [
  { plan: "Professional", normal: "$299", founding: "$149" },
  { plan: "Agency", normal: "$799", founding: "$399" },
  { plan: "Business", normal: "$1,499", founding: "$749" },
];

const ADDONS = [
  { name: "AI Interview Suite", price: "+$199/mo", desc: "AI voice & avatar interviews, auto-scoring, transcripts." },
  { name: "Autonomous Recruiting Agent", price: "+$499/mo", desc: "24/7 sourcing, outreach, follow-ups & recommendations." },
  { name: "SMS & WhatsApp", price: "+$99/mo", desc: "Instant candidate messaging & automated reminders." },
  { name: "White Label Plus", price: "+$199/mo", desc: "Custom domain, branding removal & custom email branding." },
  { name: "Additional Recruiters", price: "+$29/user/mo", desc: "Add seats beyond your plan limit." },
];

const WHY = ["ATS", "Recruiting CRM", "AI Sourcing", "AI Screening", "AI Interviews", "Workflow Automation", "Offer Management", "Analytics", "Compliance", "Enterprise Security"];

export default function PublicPricingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicEnterpriseHeader />
      {/* Hero */}
      <section className="border-b border-border bg-gradient-to-b from-primary/5 to-transparent px-6 py-16 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-brand"><Building2 className="h-6 w-6 text-white" /></div>
        <p className="text-xs font-bold uppercase tracking-widest text-primary">JobsAI Enterprise</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">The AI-Powered Talent Acquisition Operating System</h1>
        <p className="mt-3 text-lg text-muted-foreground">Source. Engage. Screen. Interview. Hire — in one platform.</p>
        <p className="mt-1 text-sm text-muted-foreground">All plans include a 14-day free trial.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/enterprise-login" className="rounded-xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-white shadow-glow">Start free trial</Link>
          <a href={BOOK_DEMO} target="_blank" rel="noreferrer" className="rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold hover:bg-muted">Book a demo</a>
        </div>
      </section>

      {/* Founding Customer banner */}
      <section className="mx-auto max-w-6xl px-6 pt-12">
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-transparent p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-bold text-primary"><Sparkles className="h-4 w-4" /> Limited-Time Offer</p>
              <p className="mt-1 text-lg font-bold">Founding offer — 50% off your first year.</p>
              <p className="text-sm text-muted-foreground">Lock in founding pricing on annual plans. Limited to the first 25 members — closing soon.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {FOUNDING.map((f) => (
                <div key={f.plan} className="rounded-xl border border-border bg-card px-3 py-2 text-center">
                  <p className="text-[11px] text-muted-foreground">{f.plan}</p>
                  <p className="text-sm"><span className="text-muted-foreground line-through">{f.normal}</span> <span className="font-bold text-primary">{f.founding}</span></p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Plan cards + monthly/annual toggle */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <EnterprisePricingCards />
      </section>

      {/* Comparison table */}
      <section className="mx-auto max-w-6xl px-6 pb-14">
        <h2 className="mb-6 text-center text-2xl font-bold">Compare every plan</h2>
        <PlanComparison />
      </section>

      {/* Add-ons */}
      <section className="border-y border-border bg-muted/20 px-6 py-14">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-2 text-center text-2xl font-bold">Premium add-ons</h2>
          <p className="mb-8 text-center text-sm text-muted-foreground">Available on any plan — add or remove anytime from inside your workspace.</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {ADDONS.map((a) => (
              <div key={a.name} className="rounded-2xl border border-border bg-card p-5">
                <h3 className="font-semibold">{a.name}</h3>
                <p className="mt-1 text-sm font-bold text-primary">{a.price}</p>
                <p className="mt-2 text-sm text-muted-foreground">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why */}
      <section className="mx-auto max-w-4xl px-6 py-14 text-center">
        <h2 className="text-2xl font-bold">Why JobsAI Enterprise?</h2>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">Most recruiting teams juggle separate tools for sourcing, screening, interviewing, scheduling, analytics, and compliance. JobsAI Enterprise brings it all into one AI-powered platform.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {WHY.map((w) => <span key={w} className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-sm"><Check className="h-3.5 w-3.5 text-emerald-500" />{w}</span>)}
        </div>
      </section>

      <PublicEnterpriseFooter />
    </main>
  );
}
