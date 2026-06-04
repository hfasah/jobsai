import Link from "next/link";
import type { Metadata } from "next";
import { Search, TrendingUp, AlertCircle, ArrowRight } from "lucide-react";

import { MarketingHeader } from "@/components/marketing/marketing-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SalaryComparisonCard } from "@/components/marketing/salary-comparison-card";
import { GradientBg } from "@/components/ui/gradient-bg";
import { getSalaryComparison, POPULAR_ROLES } from "@/lib/salaries";
import { APP_NAME } from "@/lib/constants";

export const revalidate = 3600;

function titleFrom(sp: Record<string, string | string[] | undefined>): string {
  const t = sp.title;
  const v = Array.isArray(t) ? t[0] : t;
  return (v ?? "Software Engineer").trim() || "Software Engineer";
}

export async function generateMetadata(
  { searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }
): Promise<Metadata> {
  const title = titleFrom(await searchParams);
  return {
    title: `${title} Salary — US, UK, Canada & EU · ${APP_NAME}`,
    description: `Compare the average ${title} salary across the United States, Canada, the United Kingdom, and the EU, with live currency conversion.`,
  };
}

export default async function PublicSalariesPage(
  { searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }
) {
  const title = titleFrom(await searchParams);
  const data = await getSalaryComparison(title);

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <MarketingHeader />

      <main className="relative overflow-hidden px-4 py-16 sm:px-6">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
          style={{ background: "radial-gradient(60% 50% at 50% 0%, color-mix(in oklch, var(--desyn-purple) 26%, transparent), transparent 70%)" }}
        />
        <GradientBg variant="grid" className="opacity-30" />

        <div className="relative mx-auto max-w-3xl">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-brand text-white shadow-glow">
              <TrendingUp className="h-5 w-5" />
            </span>
            <span className="text-sm font-semibold uppercase tracking-[0.15em] text-[var(--cta)]">Salaries</span>
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">
            <span className="text-gradient">{title}</span> salary, compared
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            The average advertised {title} salary across the US, Canada, the UK, and the EU — on one page, with live currency conversion.
          </p>

          {/* Search (server form GET — crawlable, no JS needed) */}
          <form action="/salaries" method="GET" className="mt-7 flex flex-col gap-2 sm:flex-row">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                name="title"
                defaultValue={title}
                placeholder="Browse salary information for any job title"
                className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <button type="submit" className="btn-cta inline-flex h-11 items-center justify-center gap-2 rounded-xl px-6 text-sm">
              <Search className="h-4 w-4" /> Search
            </button>
          </form>

          {!data.configured && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-[var(--cta)]/30 bg-[var(--cta)]/10 p-3 text-sm">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cta)]" />
              <p className="text-muted-foreground">Live salary data is being connected — check back shortly.</p>
            </div>
          )}

          {/* Comparison */}
          <div className="mt-6">
            <SalaryComparisonCard data={data} jobsHref="/sign-up" />
          </div>

          {/* Popular roles (internal links for SEO) */}
          <section className="mt-10">
            <h2 className="text-sm font-semibold">Explore salaries by role</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {POPULAR_ROLES.map((role) => (
                <Link
                  key={role}
                  href={`/salaries?title=${encodeURIComponent(role)}`}
                  className="group flex items-center justify-between rounded-lg border border-border bg-card/60 px-4 py-2.5 text-sm text-foreground/90 transition-colors hover:border-primary/40 hover:bg-card"
                >
                  {role} salary
                  <ArrowRight className="h-4 w-4 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                </Link>
              ))}
            </div>
          </section>

          {/* CTA */}
          <div className="mt-12 rounded-2xl border border-border bg-card p-6 text-center">
            <h2 className="text-xl font-bold tracking-tight">Know your worth, then land the role.</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              {APP_NAME} auto-applies to matching jobs and preps you to win the interview.
            </p>
            <Link href="/sign-up" className="btn-cta mt-5 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm">
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
