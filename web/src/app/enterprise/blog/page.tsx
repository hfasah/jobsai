import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Calendar, Clock } from "lucide-react";
import { PublicEnterpriseHeader } from "@/components/enterprise/public-header";
import { PublicEnterpriseFooter } from "@/components/enterprise/public-footer";
import { formatDate } from "@/lib/blog";
import { loadArticles } from "@/lib/blog-store";

export const metadata: Metadata = {
  title: { absolute: "JobsAI Enterprise Blog — AI hiring & recruiting" }, // 47 chars
  description:
    "Practical, no-fluff articles on AI screening, structured interviews, job descriptions, and recruiting operations from the JobsAI Enterprise team.", // 145 chars
  alternates: { canonical: "/enterprise/blog" },
};

// Re-render periodically so webhook-ingested posts appear (the webhook also
// revalidates this path on each new article).
export const revalidate = 300;

export default async function BlogIndex() {
  const posts = await loadArticles();
  const [lead, ...rest] = posts;

  const APP = "https://app.jobsai.work";
  const blogLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "@id": `${APP}/enterprise/blog`,
    url: `${APP}/enterprise/blog`,
    name: "JobsAI Enterprise Blog",
    description: "Practical, no-fluff articles on AI screening, structured interviews, job descriptions, and recruiting operations from the JobsAI Enterprise team.",
    inLanguage: "en-US",
    blogPost: posts.map((p) => ({
      "@type": "BlogPosting",
      url: `${APP}/enterprise/blog/${p.slug}`,
      headline: p.title,
      description: p.excerpt,
      datePublished: p.date,
      dateModified: p.date,
      author: { "@type": "Organization", name: "JobsAI Enterprise" },
    })),
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(blogLd) }} />
      <PublicEnterpriseHeader />

      <section className="border-b border-border bg-gradient-to-b from-primary/5 to-transparent px-6 py-14 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Blog</p>
        <h1 className="mx-auto mt-2 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">Recruiting, smarter</h1>
        <p className="mx-auto mt-3 max-w-2xl text-lg text-muted-foreground">
          Practical, no-fluff articles on AI screening, structured interviews, job descriptions, and recruiting operations.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        {lead && (
          <Link href={`/enterprise/blog/${lead.slug}`} className="group block overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-transparent transition-colors hover:border-primary/50">
            <div className={lead.coverImage ? "grid sm:grid-cols-2" : ""}>
              {lead.coverImage && (
                <div className="relative aspect-video overflow-hidden sm:order-2 sm:aspect-auto sm:min-h-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={lead.coverImage} alt="" loading="eager"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                </div>
              )}
              <div className="p-6 sm:p-8">
                <p className="text-xs font-bold uppercase tracking-widest text-primary">{lead.tag}</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{lead.title}</h2>
                <p className="mt-3 max-w-2xl text-muted-foreground">{lead.excerpt}</p>
                <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span>{lead.author}</span>
                  <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {formatDate(lead.date)}</span>
                  <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {lead.readMins} min</span>
                  <span className="inline-flex items-center gap-1.5 font-semibold text-primary">Read <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
                </div>
              </div>
            </div>
          </Link>
        )}

        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((p) => (
            <Link key={p.slug} href={`/enterprise/blog/${p.slug}`} className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary/40">
              {p.coverImage && (
                <div className="relative aspect-[16/9] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.coverImage} alt="" loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
                </div>
              )}
              <div className="flex flex-1 flex-col p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-primary">{p.tag}</p>
                <h3 className="mt-2 font-bold leading-snug">{p.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{p.excerpt}</p>
                <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> {formatDate(p.date)}</span>
                  <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {p.readMins} min</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <PublicEnterpriseFooter />
    </main>
  );
}
