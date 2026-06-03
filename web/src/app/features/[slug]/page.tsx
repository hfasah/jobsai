import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Fragment } from "react";
import { ArrowRight, ArrowLeft, Sparkles, ChevronDown } from "lucide-react";

import { MarketingHeader } from "@/components/marketing/marketing-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { GradientBg } from "@/components/ui/gradient-bg";
import { SectionBadge } from "@/components/ui/section-badge";
import { AIImageSlot } from "@/components/ui/ai-image-slot";
import { gradientButtonVariants } from "@/components/ui/gradient-button";
import { FEATURE_BY_SLUG, FEATURE_GROUPS } from "@/lib/marketing-features";
import { FEATURE_CONTENT } from "@/lib/feature-content";
import { publicImageExists } from "@/lib/public-image";
import { APP_NAME } from "@/lib/constants";

// Pre-render every known feature slug.
export function generateStaticParams() {
  return FEATURE_GROUPS.flatMap((g) => g.items).map((it) => ({ slug: it.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const feature = FEATURE_BY_SLUG[slug];
  if (!feature) return { title: `Feature · ${APP_NAME}` };
  return { title: `${feature.label} · ${APP_NAME}`, description: feature.blurb };
}

export default async function FeaturePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const feature = FEATURE_BY_SLUG[slug];
  if (!feature) notFound();

  const Icon = feature.icon;
  const content = FEATURE_CONTENT[slug];
  const imgPath = `/marketing/features/${slug}.webp`;
  const imgReady = publicImageExists(imgPath);

  // "Explore other features" — siblings from the same group first, then the rest.
  const currentGroup = FEATURE_GROUPS.find((g) => g.items.some((it) => it.slug === slug));
  const siblings = currentGroup ? currentGroup.items.filter((it) => it.slug !== slug) : [];
  const siblingSlugs = new Set(siblings.map((s) => s.slug));
  const rest = FEATURE_GROUPS.flatMap((g) => g.items).filter(
    (it) => it.slug !== slug && !siblingSlugs.has(it.slug)
  );
  const explore = [...siblings, ...rest].slice(0, 8);

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <MarketingHeader />

      <main className="relative overflow-hidden">
        {/* Ambient glow */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[600px]"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, color-mix(in oklch, var(--desyn-purple) 28%, transparent), transparent 70%)",
          }}
        />
        <GradientBg variant="grid" className="opacity-30" />

        {content ? (
          /* ── Rich hero: copy left, image right ───────────────────────────── */
          <section className="relative px-4 pb-16 pt-14 sm:px-6 sm:pt-20">
            <div className="mx-auto max-w-6xl">
              <Link
                href="/#all-features"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" /> All features
              </Link>

              <div className="mt-8 grid items-center gap-10 lg:grid-cols-2">
                {/* Copy */}
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--cta)]">
                    {content.eyebrow}
                  </p>
                  <h1 className="mt-4 text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
                    {content.headline.map((seg, i) =>
                      seg.tone === "gradient" ? (
                        <span key={i} className="text-gradient">{seg.t}</span>
                      ) : seg.tone === "cta" ? (
                        <span key={i} className="text-[var(--cta)]">{seg.t}</span>
                      ) : (
                        <Fragment key={i}>{seg.t}</Fragment>
                      )
                    )}
                  </h1>
                  <p className="mt-6 max-w-xl text-lg text-muted-foreground">{content.subtext}</p>
                  <div className="mt-8 flex flex-wrap items-center gap-3">
                    <Link href="/sign-up" className="btn-cta inline-flex items-center gap-2 rounded-full px-7 py-3 text-base">
                      {content.ctaLabel}
                      <ArrowRight className="h-5 w-5" />
                    </Link>
                    <Link
                      href="/#pricing"
                      className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-card/60 px-6 py-3 text-base font-semibold text-foreground backdrop-blur transition-colors hover:bg-white/5"
                    >
                      See pricing
                    </Link>
                  </div>
                </div>

                {/* Image */}
                <div className="relative">
                  <AIImageSlot
                    path={imgPath}
                    ready={imgReady}
                    alt={`${feature.label} preview`}
                    prompt={`Marketing hero for "${feature.label}".`}
                    className="shadow-glow-purple"
                    priority
                  />
                </div>
              </div>
            </div>
          </section>
        ) : (
          /* ── Simple fallback hero ────────────────────────────────────────── */
          <section className="relative px-4 py-24 sm:px-6">
            <div className="relative mx-auto max-w-2xl text-center">
              <Link
                href="/#all-features"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" /> All features
              </Link>

              <div className="mx-auto mt-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-brand text-white shadow-glow">
                <Icon className="h-8 w-8" />
              </div>

              <div className="mt-6">
                <SectionBadge variant="soft">Feature</SectionBadge>
              </div>
              <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">{feature.label}</h1>
              <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">{feature.blurb}</p>

              <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-sm text-muted-foreground backdrop-blur">
                <Sparkles className="h-4 w-4 text-primary" />
                A deep-dive page is on the way — get started and use it today.
              </div>

              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                <Link href="/sign-up" className={gradientButtonVariants({ size: "lg" })}>
                  Start free
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <Link
                  href="/#pricing"
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-card/60 px-6 py-3 text-sm font-semibold text-foreground backdrop-blur transition-colors hover:bg-white/5"
                >
                  See pricing
                </Link>
              </div>

              <div className="relative mx-auto mt-14 max-w-4xl">
                <AIImageSlot
                  path={imgPath}
                  ready={imgReady}
                  alt={`${feature.label} preview`}
                  prompt={`Dark, modern SaaS dashboard UI showing "${feature.label}" — ${feature.blurb}`}
                  className="shadow-glow-purple"
                  priority
                />
              </div>
            </div>
          </section>
        )}

        {/* ── FAQ ─────────────────────────────────────────────────────────── */}
        {content && (
          <section className="relative border-t border-border/60 px-4 py-20 sm:px-6">
            <div className="mx-auto max-w-3xl">
              <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
                Frequently Asked <span className="text-[var(--cta)]">Questions</span>
              </h2>
              <div className="mt-10 space-y-3">
                {content.faqs.map(({ q, a }, i) => (
                  <details
                    key={q}
                    open={i === 0}
                    className="group rounded-2xl border border-border bg-card/60 px-5 py-4 transition-colors open:bg-card hover:border-primary/40"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-foreground sm:text-base">
                      <span>
                        <span className="text-[var(--cta)]">Q.</span> {q}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{a}</p>
                  </details>
                ))}
              </div>

              <div className="mt-12 text-center">
                <Link href="/sign-up" className="btn-cta inline-flex items-center gap-2 rounded-full px-7 py-3 text-base">
                  {content.ctaLabel}
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* ── Explore other features ──────────────────────────────────────── */}
        <section className="relative border-t border-border/60 px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Explore other <span className="text-gradient">features</span>
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Combine {feature.label} with the rest of JobsAI to automate your search end to end.
                </p>
              </div>
              <Link
                href="/#all-features"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                View all features <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {explore.map(({ slug: s, label, blurb, icon: ItemIcon }) => (
                <Link
                  key={s}
                  href={`/features/${s}`}
                  className="group flex flex-col gap-2 rounded-2xl border border-border bg-card/60 p-4 transition-colors hover:border-primary/40 hover:bg-card"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-gradient-brand group-hover:text-white">
                    <ItemIcon className="h-5 w-5" />
                  </span>
                  <span className="mt-1 flex items-center gap-1 text-sm font-semibold text-foreground">
                    {label}
                    <ArrowRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                  </span>
                  <span className="text-xs leading-relaxed text-muted-foreground">{blurb}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
