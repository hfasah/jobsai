import Link from "next/link";
import { GradientBg } from "@/components/ui/gradient-bg";
import { SectionBadge } from "@/components/ui/section-badge";
import { FEATURE_GROUPS, featureHref } from "@/lib/marketing-features";

// The full product surface, grouped by job-to-be-done. Every tile links to its
// own feature page (/features/<slug>). Lives near the bottom of the landing page.
export function FeatureDirectory() {
  return (
    <section id="all-features" className="relative overflow-hidden border-t border-border/60 px-4 py-24 sm:px-6">
      <GradientBg variant="mesh" className="opacity-25" />
      <div className="relative mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <SectionBadge variant="soft">Everything in one place</SectionBadge>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            The complete <span className="text-gradient">job-search toolkit</span>
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            Discovery, applying, documents, intelligence, and interview prep — every tool JobsAI
            ships, all under one login.
          </p>
        </div>

        <div className="space-y-14">
          {FEATURE_GROUPS.map((group) => (
            <div key={group.heading}>
              <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border/60 pb-3">
                <h3 className="text-lg font-bold text-foreground">{group.heading}</h3>
                <p className="text-sm text-muted-foreground">{group.tagline}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map(({ slug, label, blurb, icon: Icon }) => (
                  <Link
                    key={slug}
                    href={featureHref(slug)}
                    className="group flex items-start gap-3 rounded-2xl border border-border bg-card/60 p-4 transition-colors hover:border-primary/40 hover:bg-card"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-gradient-brand group-hover:text-white">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="text-sm font-semibold text-foreground">{label}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{blurb}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
