import { MarketingHeader } from "@/components/marketing/marketing-header";
import { SiteFooter } from "@/components/marketing/site-footer";

export type LegalSection = { heading: string; body?: string[]; bullets?: string[] };

// Shared layout for long-form legal pages (Privacy, Terms). Dark, readable prose.
export function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro?: string;
  sections: LegalSection[];
}) {
  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <MarketingHeader />

      <main className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: {updated}</p>
          {intro && <p className="mt-6 leading-relaxed text-muted-foreground">{intro}</p>}

          <div className="mt-10 space-y-8">
            {sections.map((s, i) => (
              <section key={s.heading}>
                <h2 className="text-lg font-bold text-foreground">
                  {i + 1}. {s.heading}
                </h2>
                {s.body?.map((p, j) => (
                  <p key={j} className="mt-3 text-sm leading-relaxed text-muted-foreground">{p}</p>
                ))}
                {s.bullets && (
                  <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
                    {s.bullets.map((b, k) => <li key={k}>{b}</li>)}
                  </ul>
                )}
              </section>
            ))}
          </div>

          <p className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
            Questions about this policy? Contact us at{" "}
            <a href="mailto:support@jobsai.work" className="text-primary hover:underline">support@jobsai.work</a>.
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
