import Link from "next/link";
import {
  ArrowRight, Workflow, Sparkles, Users, Target, Compass, Building2,
  Layers, BarChart3, ShieldCheck, Mic, Send, Check,
} from "lucide-react";
import { PublicEnterpriseHeader } from "@/components/enterprise/public-header";
import { PublicEnterpriseFooter } from "@/components/enterprise/public-footer";

export const metadata = {
  title: "About — JobsAI Enterprise",
  description:
    "JobsAI Enterprise is the AI-powered talent acquisition operating system — Applicant Tracking, Recruiting CRM, AI Sourcing, AI Interviews, Workflow Automation, and Analytics in one unified workspace.",
};

const BOOK_DEMO = "/enterprise/demo";

const CAPABILITIES = [
  { icon: Send, text: "Create and distribute jobs across multiple channels" },
  { icon: Sparkles, text: "Source and rediscover qualified candidates using AI" },
  { icon: Target, text: "Automatically score, rank, and recommend top applicants" },
  { icon: Mic, text: "Conduct AI-powered voice and avatar interviews" },
  { icon: Workflow, text: "Automate outreach, follow-ups, and recruiting workflows" },
  { icon: Users, text: "Collaborate with hiring managers and recruiting teams" },
  { icon: Layers, text: "Generate offer letters and collect electronic signatures" },
  { icon: BarChart3, text: "Measure hiring performance with executive analytics" },
  { icon: ShieldCheck, text: "Maintain enterprise-grade security, compliance, and governance" },
];

const SERVED = [
  "Recruiting Agencies",
  "Staffing Firms",
  "Corporate HR Teams",
  "Talent Acquisition Organizations",
  "High-Growth Companies",
  "Enterprise Hiring Teams",
];

const UNIFIES = [
  "Applicant Tracking", "Recruiting CRM", "AI Sourcing", "AI Interviews",
  "Workflow Automation", "Hiring Intelligence", "Analytics", "Enterprise Governance",
];

export default function EnterpriseAboutPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicEnterpriseHeader />

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
            On a Mission to Transform{" "}
            <span className="bg-gradient-brand bg-clip-text text-transparent">Talent Acquisition</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            JobsAI Enterprise is an AI-powered talent acquisition operating system built to help organizations
            attract, source, screen, interview, and hire top talent faster than ever before.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/enterprise-login" className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-7 py-3 text-sm font-semibold text-white shadow-glow">
              Start free trial <ArrowRight className="h-4 w-4" />
            </Link>
            <a href={BOOK_DEMO} target="_blank" rel="noreferrer" className="rounded-xl border border-border bg-card px-7 py-3 text-sm font-semibold hover:bg-muted">
              Book a demo
            </a>
          </div>
        </div>
      </section>

      {/* Who We Are */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Who We Are</h2>
            <div className="mt-4 space-y-4 leading-relaxed text-muted-foreground">
              <p>
                We believe recruiting teams should spend less time on administrative work and more time building
                relationships with exceptional candidates. That&apos;s why we created a platform that combines
                Applicant Tracking, Recruiting CRM, AI Sourcing, AI Interviews, Workflow Automation, Hiring
                Intelligence, Analytics, and Enterprise Governance into one unified system.
              </p>
              <p>
                Today, recruiters and HR teams often manage hiring across multiple disconnected tools — ATS
                platforms, sourcing tools, scheduling software, interview systems, spreadsheets, reporting
                dashboards, and communication platforms. JobsAI Enterprise brings everything together into a
                single AI-powered workspace designed to streamline the entire hiring lifecycle.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="text-sm font-semibold">One unified system replaces</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {UNIFIES.map((u) => (
                <span key={u} className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium">
                  <Check className="h-3 w-3 text-emerald-500" /> {u}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* What We Do */}
      <section className="border-t border-border bg-card/30 px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Everything your hiring team needs, in one place
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              JobsAI Enterprise helps organizations run the entire hiring lifecycle from a single workspace.
            </p>
          </div>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <p className="text-sm leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Vision */}
      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <Sparkles className="h-3.5 w-3.5" /> Our Vision
        </span>
        <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-4xl">
          The future of recruiting is not more software —{" "}
          <span className="bg-gradient-brand bg-clip-text text-transparent">it is intelligent automation</span>.
        </h2>
        <p className="mx-auto mt-5 max-w-2xl leading-relaxed text-muted-foreground">
          Our vision is to build the operating system that powers modern talent acquisition, where AI handles
          repetitive recruiting tasks, surfaces the best candidates, accelerates hiring decisions, and empowers
          recruiting teams to focus on what matters most: people.
        </p>
      </section>

      {/* Who We Serve */}
      <section className="border-t border-border px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" /> Who We Serve
            </span>
            <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">Trusted across talent teams</h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              Whether you&apos;re hiring your next employee or managing thousands of applications across multiple
              teams, JobsAI Enterprise provides the intelligence, automation, and infrastructure needed to scale
              recruiting operations efficiently.
            </p>
          </div>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SERVED.map((s) => (
              <div key={s} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Users className="h-4 w-4" />
                </span>
                <p className="text-sm font-semibold">{s}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission + CTA */}
      <section className="mx-auto max-w-3xl px-6 pb-20">
        <div className="rounded-3xl border border-primary/30 bg-gradient-to-r from-primary/10 to-transparent p-8 text-center sm:p-12">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-3 py-1 text-xs font-semibold text-white shadow-glow">
            <Target className="h-3.5 w-3.5" /> Our Mission
          </span>
          <p className="mx-auto mt-5 max-w-2xl text-xl font-medium leading-relaxed sm:text-2xl">
            To help organizations hire better talent, faster — through intelligent automation, AI-powered
            decision-making, and a unified recruiting experience.
          </p>
          <p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            JobsAI Enterprise
          </p>
          <p className="mt-2 text-base text-muted-foreground">The AI-Powered Talent Acquisition Operating System</p>
          <p className="mt-1 bg-gradient-brand bg-clip-text text-lg font-bold text-transparent">
            Source. Engage. Screen. Interview. Hire.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/enterprise-login" className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-7 py-3 text-sm font-semibold text-white shadow-glow">
              Start hiring smarter <ArrowRight className="h-4 w-4" />
            </Link>
            <a href={BOOK_DEMO} target="_blank" rel="noreferrer" className="rounded-xl border border-border bg-card px-7 py-3 text-sm font-semibold hover:bg-muted">
              Talk to our team
            </a>
          </div>
        </div>
      </section>

      <PublicEnterpriseFooter />
    </main>
  );
}
