import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowLeft, Check, FileText, MessagesSquare } from "lucide-react";
import { PublicEnterpriseHeader } from "@/components/enterprise/public-header";
import { PublicEnterpriseFooter } from "@/components/enterprise/public-footer";
import { JD_ROLES, getJD } from "@/lib/job-descriptions";
import { getRole } from "@/lib/interview-questions";

export function generateStaticParams() {
  return JD_ROLES.map((r) => ({ role: r.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ role: string }> }): Promise<Metadata> {
  const { role } = await params;
  const r = getJD(role);
  if (!r) return { title: "Job description templates — JobsAI Enterprise" };
  const title = `${r.title} Job Description Template | JobsAI Enterprise`;
  return {
    title,
    description: `${r.blurb} ${r.summary}`.slice(0, 155),
    alternates: { canonical: `/enterprise/resources/job-descriptions/${r.slug}` },
    openGraph: { title, description: r.blurb },
  };
}

function Bullets({ heading, items }: { heading: string; items: string[] }) {
  return (
    <div>
      <h2 className="text-xl font-bold tracking-tight">{heading}</h2>
      <ul className="mt-4 space-y-2">
        {items.map((b, i) => (
          <li key={i} className="flex items-start gap-3 text-sm leading-relaxed">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> {b}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function JDRolePage({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  const r = getJD(role);
  if (!r) notFound();

  const hasQuestions = !!getRole(r.slug);
  const related = JD_ROLES.filter((x) => x.category === r.category && x.slug !== r.slug).slice(0, 4);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicEnterpriseHeader />

      <section className="border-b border-border bg-gradient-to-b from-primary/5 to-transparent px-6 py-14">
        <div className="mx-auto max-w-3xl">
          <Link href="/enterprise/resources/job-descriptions" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Job description templates
          </Link>
          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-primary">{r.category}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{r.title} job description template</h1>
          <p className="mt-3 text-lg text-muted-foreground">Copy, edit the [bracketed] fields, and post. A clear, ready-to-use {r.title.toLowerCase()} JD.</p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-12">
        <div className="space-y-10">
          <div>
            <h2 className="text-xl font-bold tracking-tight">About the role</h2>
            <p className="mt-3 rounded-xl border border-border bg-card p-4 text-sm leading-relaxed text-muted-foreground">{r.summary}</p>
          </div>
          <Bullets heading="Responsibilities" items={r.responsibilities} />
          <Bullets heading="Requirements" items={r.requirements} />
          <Bullets heading="Nice to have" items={r.preferred} />
        </div>

        {/* CTA */}
        <div className="mt-12 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-transparent p-6 sm:p-8">
          <div className="flex items-center gap-2 text-primary"><FileText className="h-5 w-5" /><span className="text-sm font-bold uppercase tracking-wide">Post &amp; hire faster</span></div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight">Post this role and screen applicants with AI</h2>
          <p className="mt-2 text-muted-foreground">
            Publish your {r.title.toLowerCase()} role with JobsAI, distribute it to job boards, and let AI phone screens rank applicants — so your team only meets the strongest.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/enterprise/demo" className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-white shadow-glow">Book a demo <ArrowRight className="h-4 w-4" /></Link>
            {hasQuestions && (
              <Link href={`/enterprise/resources/interview-questions/${r.slug}`} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold hover:bg-muted">
                <MessagesSquare className="h-4 w-4" /> {r.title} interview questions
              </Link>
            )}
          </div>
        </div>

        {related.length > 0 && (
          <div className="mt-12">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">More {r.category} templates</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {related.map((x) => (
                <Link key={x.slug} href={`/enterprise/resources/job-descriptions/${x.slug}`} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 text-sm font-semibold hover:border-primary/40">
                  {x.title} JD template <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      <PublicEnterpriseFooter />
    </main>
  );
}
