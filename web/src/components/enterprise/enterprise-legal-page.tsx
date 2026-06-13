import { PublicEnterpriseHeader } from "@/components/enterprise/public-header";
import { PublicEnterpriseFooter } from "@/components/enterprise/public-footer";

export type LegalSection = { heading: string; body?: string[]; bullets?: string[] };

// Long-form legal layout for the PUBLIC ENTERPRISE site (Privacy, Terms). Uses
// the enterprise marketing chrome only — deliberately separate from the
// consumer LegalPage so enterprise clients never see the job-seeker popup or
// consumer CTAs.
export function EnterpriseLegalPage({
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
    <main className="min-h-screen bg-background text-foreground">
      <PublicEnterpriseHeader />

      <div className="px-4 py-16 sm:px-6">
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
      </div>

      <PublicEnterpriseFooter />
    </main>
  );
}
