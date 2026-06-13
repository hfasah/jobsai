import Link from "next/link";
import {
  ArrowRight, Database, Users, Sparkles, Mic, Zap, BarChart3, ShieldCheck, Lock,
  Building2, Briefcase, Landmark, Check,
} from "lucide-react";
import { PublicEnterpriseHeader } from "@/components/enterprise/public-header";
import { RoiCalculator } from "@/components/enterprise/roi-calculator";

export const metadata = {
  title: "JobsAI Enterprise — AI-Powered Talent Acquisition Operating System",
  description: "Source, engage, screen, interview, and hire top talent from a single AI-powered platform. 14-day free trial.",
};

const BOOK_DEMO = "https://api.leadconnectorhq.com/widget/booking/5HFMVFvz8AJQ4gjY7B9F";

const FEATURES = [
  { icon: Database, name: "Applicant Tracking System", desc: "Kanban pipeline, candidate database, career pages, and resume parsing." },
  { icon: Users, name: "Recruiting CRM", desc: "Talent pools, nurturing, and outreach campaigns to engage candidates." },
  { icon: Sparkles, name: "AI Sourcing", desc: "Autonomous candidate discovery, talent rediscovery, and recommendations." },
  { icon: Mic, name: "AI Interviews", desc: "AI voice & avatar interviews with automated scoring and transcripts." },
  { icon: Zap, name: "Workflow Automation", desc: "Automate stage moves, follow-ups, and recruiting operations." },
  { icon: BarChart3, name: "Executive Analytics", desc: "Funnel reporting, time-to-hire, and recruiter productivity metrics." },
  { icon: ShieldCheck, name: "Compliance Center", desc: "GDPR management, retention policies, audit logs, and legal hold." },
  { icon: Lock, name: "Enterprise Security", desc: "SAML/SSO, advanced RBAC, and security review assistance." },
];

const SOLUTIONS = [
  { icon: Users, name: "Recruiting Agencies", desc: "Manage multiple clients with white label, client portals, and reporting." },
  { icon: Briefcase, name: "Staffing Firms", desc: "High-volume sourcing, AI screening, and automated outreach at scale." },
  { icon: Building2, name: "Corporate HR", desc: "Hiring manager workspace, workflow automation, and executive analytics." },
  { icon: Landmark, name: "Talent Acquisition Teams", desc: "SSO, compliance, and governance for enterprise hiring." },
];

const PLATFORM = ["ATS", "Recruiting CRM", "AI Sourcing", "AI Screening", "AI Interviews", "Workflow Automation", "Offer Management", "Analytics", "Compliance", "Enterprise Security"];

export default function EnterpriseHome() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicEnterpriseHeader />

      {/* Hero */}
      <section className="border-b border-border bg-gradient-to-b from-primary/5 to-transparent px-6 py-20 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">JobsAI Enterprise</p>
        <h1 className="mx-auto mt-3 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          AI-Powered Talent Acquisition Operating System
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Source, engage, screen, interview, and hire top talent from a single AI-powered platform.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/enterprise-login" className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-7 py-3 text-sm font-semibold text-white shadow-glow">Start 14-day free trial <ArrowRight className="h-4 w-4" /></Link>
          <a href={BOOK_DEMO} target="_blank" rel="noreferrer" className="rounded-xl border border-border bg-card px-7 py-3 text-sm font-semibold hover:bg-muted">Book a demo</a>
        </div>
      </section>

      {/* Problem → Solution */}
      <section className="mx-auto max-w-4xl px-6 py-16 text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">The problem</p>
        <h2 className="mt-2 text-2xl font-bold">Recruiting teams juggle six+ disconnected tools</h2>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">Separate point solutions for sourcing, screening, interviewing, scheduling, analytics, and compliance — slow, expensive, and hard to govern.</p>
        <div className="mt-8 inline-flex items-center gap-3 rounded-full bg-gradient-brand px-6 py-2 text-sm font-semibold text-white shadow-glow">One platform for everything <ArrowRight className="h-4 w-4" /></div>
      </section>

      {/* Features */}
      <section id="features" className="border-y border-border bg-muted/20 px-6 py-16 scroll-mt-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-2 text-center text-2xl font-bold">Everything recruiting, AI-powered</h2>
          <p className="mb-10 text-center text-sm text-muted-foreground">One operating system from first touch to signed offer.</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.name} className="rounded-2xl border border-border bg-card p-5">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><f.icon className="h-5 w-5 text-primary" /></div>
                <h3 className="font-semibold">{f.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solutions */}
      <section id="solutions" className="mx-auto max-w-6xl px-6 py-16 scroll-mt-16">
        <h2 className="mb-2 text-center text-2xl font-bold">Built for how you hire</h2>
        <p className="mb-10 text-center text-sm text-muted-foreground">Purpose-built for agencies, staffing firms, and enterprise HR.</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SOLUTIONS.map((s) => (
            <div key={s.name} className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand"><s.icon className="h-5 w-5 text-white" /></div>
              <h3 className="font-semibold">{s.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ROI */}
      <section id="roi" className="border-y border-border bg-muted/20 px-6 py-16 scroll-mt-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-2 text-center text-2xl font-bold">Calculate your ROI</h2>
          <p className="mb-8 text-center text-sm text-muted-foreground">See how much your team could save by automating recruiting.</p>
          <RoiCalculator />
        </div>
      </section>

      {/* Why one platform */}
      <section className="mx-auto max-w-4xl px-6 py-16 text-center">
        <h2 className="text-2xl font-bold">Why JobsAI Enterprise?</h2>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">Replace your recruiting stack with one AI-powered platform — and cut time-to-hire, cost, and tool sprawl.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {PLATFORM.map((p) => <span key={p} className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-sm"><Check className="h-3.5 w-3.5 text-emerald-500" />{p}</span>)}
        </div>
      </section>

      {/* Founding + CTA */}
      <section className="mx-auto max-w-4xl px-6 pb-20">
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-transparent p-8 text-center">
          <Sparkles className="mx-auto h-6 w-6 text-primary" />
          <h2 className="mt-3 text-2xl font-bold">Founding Customer Program — 50% off for life</h2>
          <p className="mt-2 text-sm text-muted-foreground">Available to the first 20 customers. Get full access while helping shape the future of AI-powered recruiting.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link href="/enterprise-login" className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-7 py-3 text-sm font-semibold text-white shadow-glow">Start free trial <ArrowRight className="h-4 w-4" /></Link>
            <Link href="/enterprise/pricing" className="rounded-xl border border-border bg-card px-7 py-3 text-sm font-semibold hover:bg-muted">View pricing</Link>
            <a href={BOOK_DEMO} target="_blank" rel="noreferrer" className="rounded-xl border border-border bg-card px-7 py-3 text-sm font-semibold hover:bg-muted">Book a demo</a>
          </div>
        </div>
      </section>

      <footer className="border-t border-border px-6 py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} JobsAI Enterprise · <Link href="/enterprise/pricing" className="hover:underline">Pricing</Link> · <Link href="/enterprise-login" className="hover:underline">Sign in</Link>
      </footer>
    </main>
  );
}
