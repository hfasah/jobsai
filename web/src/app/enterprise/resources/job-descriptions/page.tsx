import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { PublicEnterpriseHeader } from "@/components/enterprise/public-header";
import { PublicEnterpriseFooter } from "@/components/enterprise/public-footer";
import { JD_ROLES, jdByCategory } from "@/lib/job-descriptions";

export const metadata: Metadata = {
  title: "Job Description Templates by Role | JobsAI Enterprise",
  description: "Free, ready-to-edit job description templates for every role — responsibilities, requirements, and qualifications — plus AI tools to post and screen faster.",
  alternates: { canonical: "/enterprise/resources/job-descriptions" },
};

export default function JobDescriptionsIndex() {
  const groups = jdByCategory();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicEnterpriseHeader />

      <section className="border-b border-border bg-gradient-to-b from-primary/5 to-transparent px-6 py-14 text-center">
        <Link href="/enterprise/resources" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Resources
        </Link>
        <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">Job description templates by role</h1>
        <p className="mx-auto mt-3 max-w-2xl text-lg text-muted-foreground">
          Free, ready-to-edit JD templates for {JD_ROLES.length}+ roles — responsibilities, requirements, and qualifications. Copy, tweak the [bracketed] fields, and post.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="space-y-10">
          {groups.map((g) => (
            <div key={g.category}>
              <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">{g.category}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {g.roles.map((r) => (
                  <Link key={r.slug} href={`/enterprise/resources/job-descriptions/${r.slug}`}
                    className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40">
                    <h3 className="flex items-center justify-between font-bold">{r.title} <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" /></h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{r.blurb}</p>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-transparent p-6 text-center sm:p-8">
          <h2 className="text-2xl font-bold tracking-tight">Post the role, then auto-screen applicants</h2>
          <p className="mx-auto mt-2 max-w-xl text-muted-foreground">Publish with JobsAI, distribute to job boards, and let AI phone screens rank applicants for you.</p>
          <Link href="/enterprise/demo" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-white shadow-glow">Book a demo <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>

      <PublicEnterpriseFooter />
    </main>
  );
}
