import Link from "next/link";
import { Check, Minus, ArrowRight, Sparkles, Trophy, ShieldCheck, ChevronRight } from "lucide-react";
import { PublicEnterpriseHeader } from "@/components/enterprise/public-header";
import { PublicEnterpriseFooter } from "@/components/enterprise/public-footer";
import { CAPABILITIES, comparisonFaqs, type Comparison } from "@/lib/enterprise-comparisons";

const BOOK_DEMO = "/enterprise/demo";

function CmpCell({ value }: { value: boolean | "partial" }) {
  if (value === "partial") {
    return <span className="mx-auto inline-flex items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-500">Limited</span>;
  }
  return value
    ? <Check className="mx-auto h-4 w-4 text-emerald-500" />
    : <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" />;
}

export function ComparisonDetail({ item, others }: { item: Comparison; others: Comparison[] }) {
  const faqs = comparisonFaqs(item);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicEnterpriseHeader />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border px-6 py-16 text-center">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[380px]"
          style={{ background: "radial-gradient(60% 50% at 50% 0%, color-mix(in oklch, var(--primary) 18%, transparent), transparent 70%)" }}
        />
        <div className="relative mx-auto max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Trophy className="h-3.5 w-3.5" /> Compare
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">{item.headline}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">{item.intro}</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/enterprise-login" className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-white shadow-glow">
              Start free trial <ArrowRight className="h-4 w-4" />
            </Link>
            <a href={BOOK_DEMO} target="_blank" rel="noreferrer" className="rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold hover:bg-muted">Book a demo</a>
          </div>
        </div>
      </section>

      {/* Verdict / TL;DR */}
      <section className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-transparent p-6">
          <p className="flex items-center gap-2 text-sm font-semibold text-primary"><Sparkles className="h-4 w-4" /> The short version</p>
          <p className="mt-2 leading-relaxed text-foreground">{item.verdict}</p>
        </div>
      </section>

      {/* Capability comparison */}
      <section className="mx-auto max-w-4xl px-6 pb-4">
        <h2 className="mb-6 text-center text-2xl font-bold">JobsAI Enterprise vs {item.competitor}</h2>
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left font-semibold">Capability</th>
                <th className="px-4 py-3 text-center font-semibold text-primary">JobsAI&nbsp;⭐</th>
                <th className="px-4 py-3 text-center font-semibold">{item.competitor}</th>
              </tr>
            </thead>
            <tbody>
              {CAPABILITIES.map((label, i) => (
                <tr key={label} className={i % 2 ? "bg-muted/20" : ""}>
                  <td className="px-4 py-2.5 text-left text-muted-foreground">{label}</td>
                  <td className="bg-primary/5 px-4 py-2.5"><Check className="mx-auto h-4 w-4 text-emerald-500" /></td>
                  <td className="px-4 py-2.5"><CmpCell value={item.rows[i]?.cmp ?? false} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Based on each product&apos;s publicly described positioning. &ldquo;Limited&rdquo; means available only in part, as an add-on, or via integrations. Competitor capabilities may change.
        </p>
      </section>

      {/* Why JobsAI */}
      <section className="mx-auto max-w-5xl px-6 py-14">
        <h2 className="mb-8 text-center text-2xl font-bold">Why teams choose JobsAI over {item.competitor}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {item.why.map((w) => (
            <div key={w.title} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Check className="h-4 w-4" /></div>
              <h3 className="mt-3 font-semibold">{w.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{w.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Honest: what the competitor is good at */}
      <section className="mx-auto max-w-3xl px-6 pb-14">
        <div className="rounded-2xl border border-border bg-card/60 p-6">
          <p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-muted-foreground" /> Where {item.competitor} is strong</p>
          <p className="mt-2 leading-relaxed text-muted-foreground">{item.competitorStrength}</p>
          <p className="mt-3 text-sm text-muted-foreground">
            If that single capability is all you need, {item.competitor} is a fine choice. If you want it <em>and</em> the rest of the hiring lifecycle in one platform, that&apos;s JobsAI.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 pb-14">
        <h2 className="mb-5 text-center text-2xl font-bold">Frequently asked</h2>
        <div className="space-y-2.5">
          {faqs.map((f) => (
            <details key={f.q} className="group rounded-2xl border border-border bg-card/60 px-5 py-4 open:bg-card">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold sm:text-base">
                {f.q}
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-6 pb-14">
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-transparent p-8 text-center">
          <h2 className="text-2xl font-bold">See why teams switch to JobsAI</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">Start a 14-day free trial, or get a live walkthrough tailored to your hiring workflow.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link href="/enterprise-login" className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-white shadow-glow">Start free trial <ArrowRight className="h-4 w-4" /></Link>
            <a href={BOOK_DEMO} target="_blank" rel="noreferrer" className="rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold hover:bg-muted">Book a demo</a>
          </div>
        </div>
      </section>

      {/* Other comparisons */}
      <section className="mx-auto max-w-4xl px-6 pb-16">
        <h2 className="mb-4 text-center text-lg font-semibold">More comparisons</h2>
        <div className="flex flex-wrap justify-center gap-2">
          {others.map((o) => (
            <Link key={o.slug} href={`/enterprise/compare/${o.slug}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:border-primary/40 hover:text-primary">
              JobsAI vs {o.competitor} <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          ))}
        </div>
      </section>

      <PublicEnterpriseFooter />
    </main>
  );
}
