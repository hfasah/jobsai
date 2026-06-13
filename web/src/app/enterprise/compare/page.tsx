import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Trophy, Check } from "lucide-react";
import { PublicEnterpriseHeader } from "@/components/enterprise/public-header";
import { PublicEnterpriseFooter } from "@/components/enterprise/public-footer";
import { COMPARISONS } from "@/lib/enterprise-comparisons";

export const metadata: Metadata = {
  title: "Compare — JobsAI Enterprise vs. the alternatives",
  description:
    "See how JobsAI Enterprise — the AI-native talent acquisition platform — compares to Loxo, Ashby, Pin, Greenhouse, Lever, and Teamtailor.",
};

const PILLARS = [
  "ATS + CRM in one",
  "AI sourcing & screening",
  "AI voice & avatar interviews",
  "Outreach & email sequences",
  "Analytics & compliance",
];

export default function CompareIndexPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicEnterpriseHeader />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border px-6 py-16 text-center">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[360px]"
          style={{ background: "radial-gradient(60% 50% at 50% 0%, color-mix(in oklch, var(--primary) 18%, transparent), transparent 70%)" }}
        />
        <div className="relative mx-auto max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Trophy className="h-3.5 w-3.5" /> Compare
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
            How JobsAI compares
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Evaluating recruiting platforms? JobsAI Enterprise is AI-native and all-in-one — sourcing,
            screening, AI interviews, outreach, and hiring in one system. See how it stacks up against
            the tools you&apos;re considering.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {PILLARS.map((p) => (
              <span key={p} className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-sm">
                <Check className="h-3.5 w-3.5 text-emerald-500" />{p}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison cards */}
      <section className="mx-auto max-w-5xl px-6 py-14">
        <div className="grid gap-4 sm:grid-cols-2">
          {COMPARISONS.map((c) => (
            <Link
              key={c.slug}
              href={`/enterprise/compare/${c.slug}`}
              className="group flex items-start justify-between gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
            >
              <div className="min-w-0">
                <h2 className="font-semibold">JobsAI vs {c.competitor}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{c.category}</p>
                <p className="mt-2 text-sm text-muted-foreground">{c.tagline}</p>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-primary" />
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-6 pb-16">
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-transparent p-8 text-center">
          <h2 className="text-2xl font-bold">The easiest way to compare? Try it.</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">Start a 14-day free trial and see the whole platform in action — no credit card required.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link href="/enterprise-login" className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-white shadow-glow">Start free trial <ArrowRight className="h-4 w-4" /></Link>
            <a href="/enterprise/demo" target="_blank" rel="noreferrer" className="rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold hover:bg-muted">Book a demo</a>
          </div>
        </div>
      </section>

      <PublicEnterpriseFooter />
    </main>
  );
}
