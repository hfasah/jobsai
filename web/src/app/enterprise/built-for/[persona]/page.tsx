import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Check, ArrowRight } from "lucide-react";
import { PublicEnterpriseHeader } from "@/components/enterprise/public-header";
import { PERSONAS, getPersona } from "@/lib/enterprise-personas";

export function generateStaticParams() {
  return PERSONAS.map((p) => ({ persona: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ persona: string }>;
}): Promise<Metadata> {
  const { persona } = await params;
  const p = getPersona(persona);
  if (!p) return { title: "Built For — JobsAI Enterprise" };
  return {
    title: `For ${p.name} — JobsAI Enterprise`,
    description: p.intro,
  };
}

export default async function PersonaPage({
  params,
}: {
  params: Promise<{ persona: string }>;
}) {
  const { persona } = await params;
  const p = getPersona(persona);
  if (!p) notFound();

  const others = PERSONAS.filter((x) => x.slug !== p.slug);

  return (
    <div className="min-h-screen bg-background">
      <PublicEnterpriseHeader />

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pt-16 pb-10 text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">Built for {p.name}</p>
        <h1 className="text-3xl font-bold sm:text-4xl">{p.headline}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">{p.intro}</p>
        <div className="mt-7 flex items-center justify-center gap-3">
          <Link href="/enterprise-login" className="rounded-xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-white shadow-glow">
            Start free trial
          </Link>
          <Link href="/enterprise/demo" className="rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold hover:bg-muted">
            Book a demo
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <h2 className="mb-6 text-center text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          What you get
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {p.features.map((f) => (
            <div key={f.name} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Check className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">{f.name}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Other personas */}
      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Also built for</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((o) => (
              <Link
                key={o.slug}
                href={`/enterprise/built-for/${o.slug}`}
                className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:border-primary/40"
              >
                <span>
                  <span className="block text-sm font-semibold">{o.name}</span>
                  <span className="block text-xs text-muted-foreground">{o.tagline}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/50 group-hover:text-primary" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h2 className="text-2xl font-bold">See JobsAI Enterprise for {p.name.toLowerCase()}</h2>
        <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
          Start a free trial or book a walkthrough tailored to your team.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link href="/enterprise-login" className="rounded-xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-white shadow-glow">
            Start free trial
          </Link>
          <Link href="/enterprise/pricing" className="rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold hover:bg-muted">
            View pricing
          </Link>
        </div>
      </section>
    </div>
  );
}
