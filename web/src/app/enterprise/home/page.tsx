import Link from "next/link";
import {
  ArrowRight, Database, Users, Sparkles, Mic, Zap, BarChart3, ShieldCheck, Lock,
  Building2, Briefcase, Landmark, Check, Phone, PlugZap, ClipboardCheck, MessageSquare,
} from "lucide-react";
import { PublicEnterpriseHeader } from "@/components/enterprise/public-header";
import { PublicEnterpriseFooter } from "@/components/enterprise/public-footer";
import { AudienceToggle } from "@/components/enterprise/audience-toggle";
import { RoiCalculator } from "@/components/enterprise/roi-calculator";

export const metadata = {
  // `absolute` bypasses the layout's "%s | JobsAI Enterprise" template (which
  // otherwise double-stamps the brand and pushes the title past 60 chars).
  title: { absolute: "JobsAI Enterprise: Talent Acquisition Operating System" }, // 55 chars
  description:
    "JobsAI Enterprise orchestrates sourcing, engagement, screening, evidence, submissions, hiring, and redeployment in one AI platform. 14-day free trial.", // 150 chars
  alternates: { canonical: "/enterprise/home" },
};

const BOOK_DEMO = "/enterprise/demo";

const FEATURES = [
  { icon: Database, name: "Applicant Tracking System", desc: "Kanban pipeline, candidate database, career pages, and resume parsing." },
  { icon: Users, name: "Recruiting CRM", desc: "Talent pools, nurturing, and outreach campaigns to engage candidates." },
  { icon: Sparkles, name: "AI Sourcing", desc: "Autonomous candidate discovery, talent rediscovery, and recommendations." },
  { icon: MessageSquare, name: "Multi-channel outreach", desc: "Reach candidates by email, SMS, and WhatsApp, with automated sequences and reminders." },
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

// Structured data (JSON-LD) for rich results: the WebPage + the SoftwareApplication it describes.
const JSON_LD = [
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": "https://app.jobsai.work#webpage",
    url: "https://app.jobsai.work",
    name: "JobsAI Enterprise: Talent Acquisition Operating System",
    inLanguage: "en",
    isPartOf: { "@type": "WebSite", url: "https://app.jobsai.work", name: "JobsAI" },
    mainEntity: { "@id": "https://app.jobsai.work#jobsai-enterprise" },
    description:
      "JobsAI Enterprise is an AI-powered talent acquisition platform to source, engage, screen, interview, and hire top talent faster. Start a 14-day free trial.",
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": "https://app.jobsai.work#jobsai-enterprise",
    url: "https://app.jobsai.work",
    name: "JobsAI Enterprise",
    applicationCategory: "HR Software",
    operatingSystem: "Web",
    brand: { "@type": "Brand", name: "JobsAI" },
    description:
      "AI-Powered Talent Acquisition Operating System for sourcing, screening, interviewing, and hiring top talent with a single AI-powered platform. Start a 14-day free trial.",
    featureList: [
      "Applicant Tracking System (ATS)",
      "Kanban pipeline and resume parsing",
      "AI Sourcing with autonomous candidate discovery",
      "AI Interviews with automated scoring and transcripts",
      "Workflow Automation",
      "Executive Analytics",
      "Compliance Center",
      "Enterprise Security",
      "One platform from first touch to signed offer",
    ],
    offers: {
      "@type": "Offer",
      url: "https://app.jobsai.work",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      description: "14-day free trial",
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": "https://app.jobsai.work#webpage" },
  },
];

export default function EnterpriseHome() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <PublicEnterpriseHeader />

      {/* Hero */}
      <section className="border-b border-border bg-gradient-to-b from-primary/5 to-transparent px-6 py-20 text-center">
        <div className="mb-6 flex justify-center">
          <AudienceToggle active="employers" />
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-primary">JobsAI Enterprise</p>
        <h1 className="mx-auto mt-3 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          The AI-Powered Talent Acquisition Operating System
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Orchestrate sourcing, engagement, screening, evidence, submissions, hiring, and redeployment, all in one intelligent platform.
        </p>
        <p className="mt-3 text-sm font-medium text-muted-foreground">All plans include a 14-day free trial.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/enterprise-login" className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-7 py-3 text-sm font-semibold text-white shadow-glow">Start 14-day free trial <ArrowRight className="h-4 w-4" /></Link>
          <Link href="/enterprise/tour" className="rounded-xl border border-border bg-card px-7 py-3 text-sm font-semibold hover:bg-muted">Take a tour</Link>
          <a href={BOOK_DEMO} target="_blank" rel="noreferrer" className="rounded-xl border border-border bg-card px-7 py-3 text-sm font-semibold hover:bg-muted">Book a demo</a>
        </div>
      </section>

      {/* Problem → Solution */}
      <section className="mx-auto max-w-4xl px-6 py-16 text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">The problem</p>
        <h2 className="mt-2 text-2xl font-bold">Recruiting teams juggle six+ disconnected tools</h2>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">Separate point solutions for sourcing, screening, interviewing, scheduling, analytics, and compliance: slow, expensive, and hard to govern.</p>
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

      {/* Interview automation + ATS */}
      <section className="border-t border-border bg-background px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-primary">Interview automation</p>
            <h2 className="mx-auto mt-2 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">Automate your entire interview pipeline</h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              From the first AI phone screen to deep, full-assessment rounds, JobsAI runs every stage of your funnel (screening, scoring, and scheduling on autopilot) so your team spends its time on finalists, not logistics.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              { icon: Phone, title: "AI phone screens", desc: "Conversational AI calls candidates, asks role-specific questions, and scores every answer in real time." },
              { icon: Mic, title: "Avatar & assessment rounds", desc: "Deeper AI voice and avatar interviews with structured, full assessments for your shortlist." },
              { icon: ClipboardCheck, title: "Scorecards & handoff", desc: "Ranked, explainable scorecards flow straight into your pipeline for the final human decision." },
            ].map((s, i) => (
              <div key={s.title} className="relative rounded-2xl border border-border bg-card p-6">
                <span className="absolute right-4 top-4 text-xs font-bold text-muted-foreground/40">0{i + 1}</span>
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-brand text-white"><s.icon className="h-5 w-5" /></span>
                <h3 className="mt-4 font-bold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>

          {/* ATS integration */}
          <div className="mt-6 grid items-center gap-6 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-transparent p-6 sm:p-8 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <div className="flex items-center gap-2 text-primary"><PlugZap className="h-5 w-5" /><span className="text-sm font-bold uppercase tracking-wide">Integrates with your ATS</span></div>
              <h3 className="mt-2 text-2xl font-bold tracking-tight">Plug into your stack in one click</h3>
              <p className="mt-2 text-muted-foreground">
                Connect your existing ATS, HRMS, or job board in one click (Greenhouse, Lever, Workday, Bullhorn, and more) with two-way sync that keeps candidates and stages aligned everywhere.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm font-semibold">Don&apos;t have a stack?</p>
              <p className="mt-1 text-sm text-muted-foreground">A full <strong className="text-foreground">built-in ATS is included</strong> with every plan. Start free for 14 days, cancel anytime.</p>
              <Link href="/enterprise-login" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-5 py-2.5 text-sm font-semibold text-white shadow-glow">
                Start free trial <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
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
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">Replace your recruiting stack with one AI-powered platform, and cut time-to-hire, cost, and tool sprawl.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {PLATFORM.map((p) => <span key={p} className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-sm"><Check className="h-3.5 w-3.5 text-emerald-500" />{p}</span>)}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-6 pb-20">
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-transparent p-8 text-center">
          <Sparkles className="mx-auto h-6 w-6 text-primary" />
          <h2 className="mt-3 text-2xl font-bold">Ready to transform your hiring?</h2>
          <p className="mt-2 text-sm text-muted-foreground">Start a 14-day free trial (cancel anytime) or book a walkthrough with our team.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link href="/enterprise-login" className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-7 py-3 text-sm font-semibold text-white shadow-glow">Start free trial <ArrowRight className="h-4 w-4" /></Link>
            <Link href="/enterprise/pricing" className="rounded-xl border border-border bg-card px-7 py-3 text-sm font-semibold hover:bg-muted">View pricing</Link>
            <a href={BOOK_DEMO} target="_blank" rel="noreferrer" className="rounded-xl border border-border bg-card px-7 py-3 text-sm font-semibold hover:bg-muted">Book a demo</a>
          </div>
        </div>
      </section>

      <PublicEnterpriseFooter />
    </main>
  );
}
