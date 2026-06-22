import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Calendar, Clock } from "lucide-react";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { loadArticles, formatDate } from "@/lib/blog-store";

export const metadata: Metadata = {
  title: "Blog — JobsAI",
  description: "Practical, no-fluff articles on job search, resumes, interviews, and landing your next role — from the JobsAI team.",
  alternates: { canonical: "/blog" },
};

// ISR: new webhook-ingested articles appear within the revalidation window.
export const revalidate = 300;

export default async function BlogIndex() {
  const posts = await loadArticles();
  const [lead, ...rest] = posts;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <MarketingHeader />

      <section className="border-b border-border bg-gradient-to-b from-primary/5 to-transparent px-6 py-14 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Blog</p>
        <h1 className="mx-auto mt-2 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">Land your next role, faster</h1>
        <p className="mx-auto mt-3 max-w-2xl text-lg text-muted-foreground">
          Practical, no-fluff articles on job search, resumes, interviews, and getting hired.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        {posts.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground">New articles are on the way — check back soon.</p>
        ) : (
          <>
            {lead && (
              <Link href={`/blog/${lead.slug}`} className="group block rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-transparent p-6 transition-colors hover:border-primary/50 sm:p-8">
                <p className="text-xs font-bold uppercase tracking-widest text-primary">{lead.tag}</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{lead.title}</h2>
                <p className="mt-3 max-w-2xl text-muted-foreground">{lead.excerpt}</p>
                <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span>{lead.author}</span>
                  <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {formatDate(lead.date)}</span>
                  <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {lead.readMins} min</span>
                  <span className="inline-flex items-center gap-1.5 font-semibold text-primary">Read <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
                </div>
              </Link>
            )}

            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((p) => (
                <Link key={p.slug} href={`/blog/${p.slug}`} className="group flex flex-col rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40">
                  <p className="text-xs font-bold uppercase tracking-widest text-primary">{p.tag}</p>
                  <h3 className="mt-2 font-bold leading-snug">{p.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{p.excerpt}</p>
                  <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> {formatDate(p.date)}</span>
                    <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {p.readMins} min</span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}
