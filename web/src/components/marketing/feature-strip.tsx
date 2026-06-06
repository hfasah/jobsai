import Link from "next/link";
import type { ReactNode } from "react";
import type { FeatureItem } from "@/lib/marketing-features";
import { featureHref } from "@/lib/marketing-features";

// A compact cross-link strip of feature cards. Used as the "Explore other
// features" footer on feature pages and as a quick-discovery strip on the home
// page. Self-contained <section>; caller supplies the items and copy.
export function FeatureStrip({
  heading,
  subtext,
  items,
  viewAllHref = "/#all-features",
  className,
}: {
  heading: ReactNode;
  subtext?: string;
  items: FeatureItem[];
  viewAllHref?: string;
  className?: string;
}) {
  return (
    <section className={`relative border-t border-border/60 px-4 py-20 sm:px-6 ${className ?? ""}`}>
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{heading}</h2>
            {subtext && <p className="mt-2 text-sm text-muted-foreground">{subtext}</p>}
          </div>
          <Link
            href={viewAllHref}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            View all features
          </Link>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {items.map(({ slug, label, blurb, icon: ItemIcon }) => (
            <Link
              key={slug}
              href={featureHref(slug)}
              className="group flex flex-col gap-2 rounded-2xl border border-border bg-card/60 p-4 transition-colors hover:border-primary/40 hover:bg-card"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-gradient-brand group-hover:text-white">
                <ItemIcon className="h-5 w-5" />
              </span>
              <span className="mt-1 text-sm font-semibold text-foreground">{label}</span>
              <span className="text-xs leading-relaxed text-muted-foreground">{blurb}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
