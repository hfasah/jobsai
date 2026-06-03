import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowRight, ArrowLeft, Sparkles } from "lucide-react";

import { MarketingHeader } from "@/components/marketing/marketing-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { GradientBg } from "@/components/ui/gradient-bg";
import { SectionBadge } from "@/components/ui/section-badge";
import { AIImageSlot } from "@/components/ui/ai-image-slot";
import { gradientButtonVariants } from "@/components/ui/gradient-button";
import { FEATURE_BY_SLUG, FEATURE_GROUPS } from "@/lib/marketing-features";
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

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <MarketingHeader />

      <main className="relative overflow-hidden px-4 py-24 sm:px-6">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, color-mix(in oklch, var(--desyn-purple) 28%, transparent), transparent 70%)",
          }}
        />
        <GradientBg variant="grid" className="opacity-30" />

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
        </div>

        {/* Product shot — drop a real image at /public/marketing/features/<slug>.png, then set ready */}
        <div className="relative mx-auto mt-14 max-w-4xl">
          <AIImageSlot
            path={`/marketing/features/${slug}.webp`}
            ready={publicImageExists(`/marketing/features/${slug}.webp`)}
            alt={`${feature.label} preview`}
            prompt={`Dark, modern SaaS dashboard UI showing "${feature.label}" — ${feature.blurb} Purple/magenta accents, clean cards, no real logos.`}
            className="shadow-glow-purple"
            priority
          />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
