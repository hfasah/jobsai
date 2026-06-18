import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowLeft, Check, Phone } from "lucide-react";
import { PublicEnterpriseHeader } from "@/components/enterprise/public-header";
import { PublicEnterpriseFooter } from "@/components/enterprise/public-footer";
import { ROLES, getRole } from "@/lib/interview-questions";

export function generateStaticParams() {
  return ROLES.map((r) => ({ role: r.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ role: string }> }): Promise<Metadata> {
  const { role } = await params;
  const r = getRole(role);
  if (!r) return { title: "Interview questions — JobsAI Enterprise" };
  const title = `${r.title} Interview Questions | JobsAI Enterprise`;
  return {
    title,
    description: `${r.blurb} ${r.intro}`.slice(0, 155),
    alternates: { canonical: `/enterprise/resources/interview-questions/${r.slug}` },
    openGraph: { title, description: r.blurb },
  };
}

export default async function RoleQuestionsPage({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  const r = getRole(role);
  if (!r) notFound();

  const related = ROLES.filter((x) => x.category === r.category && x.slug !== r.slug).slice(0, 4);
  const totalQuestions = r.sections.reduce((n, s) => n + s.questions.length, 0);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicEnterpriseHeader />

      <section className="border-b border-border bg-gradient-to-b from-primary/5 to-transparent px-6 py-14">
        <div className="mx-auto max-w-3xl">
          <Link href="/enterprise/resources/interview-questions" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Interview questions
          </Link>
          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-primary">{r.category}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{r.title} interview questions</h1>
          <p className="mt-3 text-lg text-muted-foreground">{r.intro}</p>
          <p className="mt-3 text-sm text-muted-foreground">{totalQuestions} questions across {r.sections.length} stages.</p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-12">
        <div className="space-y-10">
          {r.sections.map((s) => (
            <div key={s.heading}>
              <h2 className="text-xl font-bold tracking-tight">{s.heading}</h2>
              <ol className="mt-4 space-y-3">
                {s.questions.map((q, i) => (
                  <li key={i} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                    <span className="text-sm leading-relaxed">{q}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-transparent p-6 sm:p-8">
          <div className="flex items-center gap-2 text-primary"><Phone className="h-5 w-5" /><span className="text-sm font-bold uppercase tracking-wide">Screen faster with AI</span></div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight">Screen {r.title.toLowerCase()} candidates automatically</h2>
          <p className="mt-2 text-muted-foreground">
            JobsAI&apos;s AI phone screens ask questions like these, score every answer, and rank candidates — so your team only meets the strongest. Run it on your next {r.title.toLowerCase()} req.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/enterprise/demo" className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-white shadow-glow">Book a demo <ArrowRight className="h-4 w-4" /></Link>
            <Link href="/enterprise-login" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold hover:bg-muted">Start free trial</Link>
          </div>
        </div>

        {related.length > 0 && (
          <div className="mt-12">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">More {r.category} roles</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {related.map((x) => (
                <Link key={x.slug} href={`/enterprise/resources/interview-questions/${x.slug}`} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 text-sm font-semibold hover:border-primary/40">
                  {x.title} interview questions <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </div>
        )}

        <p className="mt-10 flex items-center gap-2 text-xs text-muted-foreground">
          <Check className="h-3.5 w-3.5 text-emerald-500" /> Free to use — share these with your hiring team.
        </p>
      </section>

      <PublicEnterpriseFooter />
    </main>
  );
}
