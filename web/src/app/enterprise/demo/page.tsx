import Link from "next/link";
import Script from "next/script";
import {
  Check, ArrowRight, Phone, LayoutGrid, FileSignature,
  BarChart3, Globe, ShieldCheck, Search, MessageSquare, Zap,
} from "lucide-react";
import { PublicEnterpriseHeader } from "@/components/enterprise/public-header";
import { PublicEnterpriseFooter } from "@/components/enterprise/public-footer";

// GoHighLevel / LeadConnector booking widget — owns scheduling, calendar
// invites, and reminder emails natively. The form_embed.js script auto-resizes
// the iframe (allowed via CSP: script-src + frame-src in next.config.ts).
const BOOKING_SRC = "https://api.leadconnectorhq.com/widget/booking/5HFMVFvz8AJQ4gjY7B9F";

export const metadata = {
  title: "Book a demo — JobsAI Enterprise",
  description: "Book a free, personalized walkthrough of the AI-powered Talent Acquisition Operating System — tailored to your team's hiring workflow and tech stack.",
};

const HERO_POINTS = [
  "30-minute personalized walkthrough",
  "See AI sourcing & screening on real scenarios",
  "Custom integration plan for your ATS",
  "No commitment — free, no card required",
];

const STATS = [
  { value: "30 min", label: "Tailored walkthrough" },
  { value: "14-day", label: "Free trial, no card" },
  { value: "1:1", label: "With a product expert" },
];

const HOW_IT_WORKS = [
  {
    n: 1,
    title: "Discovery",
    body: "We start by understanding your hiring workflow, where it breaks down, and the ATS and tools you use today — so the demo is built around your team, not a generic script.",
  },
  {
    n: 2,
    title: "Live walkthrough",
    body: "Watch AI source candidates, run a screening call, score answers, and move people through the pipeline in real time — using scenarios that match how you actually hire.",
  },
  {
    n: 3,
    title: "Custom rollout plan",
    body: "We map how JobsAI connects to your ATS, configure screening for your open roles, and outline an onboarding timeline. Most teams can be live within days.",
  },
];

const WILL_SEE = [
  { icon: Search, title: "AI sourcing & outreach", body: "Plain-English candidate search across your database, with autonomous multi-step outreach." },
  { icon: Phone, title: "AI voice & avatar screening", body: "Conversational AI that screens candidates and scores answers with explainable summaries." },
  { icon: LayoutGrid, title: "Pipeline & talent pools", body: "A Kanban pipeline and reusable talent pools to organize every candidate and role." },
  { icon: FileSignature, title: "Offers & e-signature", body: "Generate, send, and track offer letters with built-in e-signature." },
  { icon: BarChart3, title: "Analytics & compliance", body: "Executive dashboards plus GDPR/CCPA-ready audit logs, encryption, and data controls." },
  { icon: Globe, title: "White-label client portals", body: "Branded portals and career pages — perfect for staffing agencies serving clients." },
];

const WHY = [
  { icon: Zap, text: "Run sourcing, screening, and outreach from one workspace" },
  { icon: MessageSquare, text: "AI screens candidates so your team focuses on the best" },
  { icon: LayoutGrid, text: "Native sync with your existing ATS" },
  { icon: Globe, text: "White-label portals for the clients you serve" },
  { icon: ShieldCheck, text: "Enterprise compliance: encryption & audit logs" },
  { icon: Check, text: "Dedicated onboarding and support team" },
];

export default function EnterpriseDemoPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicEnterpriseHeader />

      {/* ── Hero: pitch + booking wizard ───────────────────────────────── */}
      <section className="border-b border-border bg-gradient-to-b from-primary/5 to-transparent">
        <div className="mx-auto grid max-w-6xl items-start gap-10 px-6 py-14 lg:grid-cols-2 lg:gap-12">
          <div className="lg:pt-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Free personalized walkthrough
            </span>
            <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              See <span className="text-primary">JobsAI Enterprise</span> in action
            </h1>
            <p className="mt-4 max-w-lg text-lg text-muted-foreground">
              Experience how AI sourcing, screening, and outreach come together in one talent acquisition platform — book a walkthrough tailored to your hiring workflow.
            </p>
            <ul className="mt-6 space-y-3">
              {HERO_POINTS.map((p) => (
                <li key={p} className="flex items-center gap-3 text-sm font-medium">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex gap-8 border-t border-border pt-6">
              {STATS.map((s) => (
                <div key={s.label}>
                  <p className="text-2xl font-bold text-primary">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div id="book" className="scroll-mt-24">
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg shadow-primary/5">
              <iframe
                src={BOOKING_SRC}
                title="Book a demo with JobsAI Enterprise"
                id="enterprise-demo-booking"
                scrolling="no"
                className="h-[760px] w-full border-0"
              />
            </div>
            <Script src="https://link.msgsndr.com/js/form_embed.js" strategy="afterInteractive" />
            <p className="mt-3 text-center text-sm text-muted-foreground">
              Prefer to dive in?{" "}
              <Link href="/enterprise-login" className="font-semibold text-primary hover:underline">
                Start your 14-day free trial <ArrowRight className="inline h-3.5 w-3.5" />
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* ── How the demo works ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">What to expect</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">How the demo works</h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            Your walkthrough takes about 30 minutes and is tailored to your team&apos;s specific hiring challenges and tech stack.
          </p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {HOW_IT_WORKS.map((s) => (
            <div key={s.n} className="rounded-2xl border border-border bg-card p-6">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-lg font-bold text-primary">{s.n}</span>
              <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── What you'll see ────────────────────────────────────────────── */}
      <section className="border-y border-border bg-muted/20">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">What you&apos;ll see in the demo</h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              A complete walkthrough of the platform built to automate your recruiting workflow end to end.
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {WILL_SEE.map((f) => (
              <div key={f.title} className="rounded-2xl border border-border bg-card p-6">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-brand text-white shadow-glow">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-bold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why teams choose + CTA ──────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Why teams choose <span className="text-primary">JobsAI Enterprise</span>
            </h2>
            <ul className="mt-6 space-y-3">
              {WHY.map((w) => (
                <li key={w.text} className="flex items-start gap-3 text-sm">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                    <w.icon className="h-3 w-3" />
                  </span>
                  {w.text}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-8">
            <h3 className="text-xl font-bold">Ready to transform your hiring?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Get a personalized demo tailored to your workflow — see exactly how JobsAI Enterprise fits your team before you commit.
            </p>
            <a
              href="#book"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-white shadow-glow"
            >
              Book your demo <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      <PublicEnterpriseFooter />
    </main>
  );
}
