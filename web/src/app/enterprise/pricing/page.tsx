import Link from "next/link";
import { Check, Building2, Sparkles, ArrowRight } from "lucide-react";
import { PlanComparison } from "@/components/enterprise/plan-comparison";
import { PublicEnterpriseHeader } from "@/components/enterprise/public-header";

export const metadata = {
  title: "JobsAI Enterprise Pricing — AI-Powered Talent Acquisition Operating System",
  description: "Source. Engage. Screen. Interview. Hire. Plans from $299/mo with a 14-day free trial.",
};

const BOOK_DEMO = "https://api.leadconnectorhq.com/widget/booking/5HFMVFvz8AJQ4gjY7B9F";

const PLANS = [
  {
    name: "Professional", price: "$299", sub: "For startups, small HR teams, and growing recruiting firms.",
    highlights: ["ATS, career pages & candidate portal", "AI scoring, top picks & comparison", "Interview scheduling (Google/Microsoft)", "Offer letters & e-signature"],
    limits: "3 recruiters · 10 active jobs · 5,000 candidates", cta: "Start free trial", href: "/enterprise-login",
  },
  {
    name: "Agency", price: "$799", popular: true, sub: "For recruiting agencies, staffing firms, and executive search.",
    highlights: ["Everything in Professional", "Recruiting CRM, talent pools & outreach", "AI sourcing & advanced search", "Client portal, reporting & white label"],
    limits: "10 recruiters · 50 active jobs · 50,000 candidates", cta: "Start free trial", href: "/enterprise-login",
  },
  {
    name: "Business", price: "$1,499", sub: "For corporate HR and talent acquisition teams.",
    highlights: ["Everything in Agency", "Hiring manager workspace & workflows", "Executive analytics & SAML/SSO", "Compliance center (GDPR, audit, legal hold)"],
    limits: "25 recruiters · unlimited jobs & candidates", cta: "Start free trial", href: "/enterprise-login",
  },
  {
    name: "Enterprise", price: "Custom", sub: "For healthcare, banking, government, and large organizations.",
    highlights: ["Everything in Business", "Dedicated support + SLA", "Workday / ADP & custom integrations", "Private onboarding & security reviews"],
    limits: "Unlimited everything", cta: "Book a demo", href: BOOK_DEMO,
  },
];

const ADDONS = [
  { name: "AI Interview Suite", price: "+$199/mo", desc: "AI voice & avatar interviews, auto-scoring, transcripts." },
  { name: "Autonomous Recruiting Agent", price: "+$499/mo", desc: "24/7 sourcing, outreach, follow-ups & recommendations." },
  { name: "SMS & WhatsApp", price: "+$99/mo", desc: "Instant candidate messaging & automated reminders." },
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

      {/* Plan cards */}
      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-6 lg:grid-cols-4">
          {PLANS.map((p) => (
            <div key={p.name} className={`relative flex flex-col rounded-2xl border bg-card p-6 ${p.popular ? "border-primary shadow-glow" : "border-border"}`}>
              {p.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-brand px-3 py-0.5 text-[11px] font-semibold text-white">⭐ Most Popular</span>}
              <h2 className="text-lg font-bold">{p.name}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{p.sub}</p>
              <div className="mt-4">
                <span className="text-3xl font-bold">{p.price}</span>
                {p.price !== "Custom" && <span className="text-sm text-muted-foreground">/month</span>}
              </div>
              <ul className="mt-5 flex-1 space-y-2">
                {p.highlights.map((h) => <li key={h} className="flex items-start gap-2 text-sm text-muted-foreground"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{h}</li>)}
              </ul>
              <p className="mt-4 text-xs font-medium text-muted-foreground">{p.limits}</p>
              {p.href.startsWith("http")
                ? <a href={p.href} target="_blank" rel="noreferrer" className="mt-5 flex items-center justify-center rounded-xl border border-border bg-card py-2.5 text-sm font-semibold hover:bg-muted">{p.cta}</a>
                : <Link href={p.href} className={`mt-5 flex items-center justify-center rounded-xl py-2.5 text-sm font-semibold ${p.popular ? "bg-gradient-brand text-white shadow-glow" : "border border-border bg-card hover:bg-muted"}`}>{p.cta}</Link>}
            </div>
          ))}
        </div>
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      {/* Founding offer */}
      <section className="mx-auto max-w-4xl px-6 pb-16">
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-transparent p-8 text-center">
          <Sparkles className="mx-auto h-6 w-6 text-primary" />
          <h2 className="mt-3 text-2xl font-bold">Founding Customer Program</h2>
          <p className="mt-2 text-lg font-semibold text-primary">50% off for life</p>
          <p className="mt-1 text-sm text-muted-foreground">Available to the first 20 customers. Get full access while helping shape the future of AI-powered recruiting.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link href="/enterprise-login" className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-white shadow-glow">Start free trial <ArrowRight className="h-4 w-4" /></Link>
            <a href={BOOK_DEMO} target="_blank" rel="noreferrer" className="rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold hover:bg-muted">Book a demo</a>
          </div>
        </div>
      </section>
    </main>
  );
}
