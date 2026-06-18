import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Calendar, Clock } from "lucide-react";
import { PublicEnterpriseHeader } from "@/components/enterprise/public-header";
import { PublicEnterpriseFooter } from "@/components/enterprise/public-footer";
import { POSTS, getPost, sortedPosts, formatDate } from "@/lib/blog";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.jobsai.work").replace(/\/$/, "");

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = getPost(slug);
  if (!p) return { title: "Blog — JobsAI Enterprise" };
  const title = `${p.title} | JobsAI Enterprise`;
  return {
    title,
    description: p.excerpt,
    alternates: { canonical: `/enterprise/blog/${p.slug}` },
    openGraph: { type: "article", title, description: p.excerpt, publishedTime: p.date },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = getPost(slug);
  if (!p) notFound();

  const related = sortedPosts().filter((x) => x.slug !== p.slug).slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: p.title,
    description: p.excerpt,
    datePublished: p.date,
    author: { "@type": "Organization", name: p.author },
    publisher: { "@type": "Organization", name: "JobsAI Enterprise" },
    mainEntityOfPage: `${APP_URL}/enterprise/blog/${p.slug}`,
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicEnterpriseHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <article className="mx-auto max-w-3xl px-6 py-14">
        <Link href="/enterprise/blog" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Blog
        </Link>
        <p className="mt-6 text-xs font-bold uppercase tracking-widest text-primary">{p.tag}</p>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{p.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span>{p.author}</span>
          <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {formatDate(p.date)}</span>
          <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {p.readMins} min read</span>
        </div>

        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">{p.intro}</p>

        <div className="mt-8 space-y-8">
          {p.sections.map((s, i) => (
            <section key={i}>
              {s.heading && <h2 className="text-xl font-bold tracking-tight">{s.heading}</h2>}
              {s.paragraphs?.map((para, j) => (
                <p key={j} className="mt-3 leading-relaxed text-muted-foreground">{para}</p>
              ))}
              {s.bullets && (
                <ul className="mt-3 space-y-2">
                  {s.bullets.map((b, j) => (
                    <li key={j} className="flex items-start gap-3 text-sm leading-relaxed"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> {b}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        {p.takeaways && p.takeaways.length > 0 && (
          <div className="mt-10 rounded-2xl border border-border bg-card p-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Key takeaways</h2>
            <ul className="mt-3 space-y-2">
              {p.takeaways.map((t, i) => (
                <li key={i} className="flex items-start gap-3 text-sm leading-relaxed"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {t}</li>
              ))}
            </ul>
          </div>
        )}

        {/* CTA */}
        <div className="mt-10 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-transparent p-6 sm:p-8">
          <h2 className="text-2xl font-bold tracking-tight">See it in your workflow</h2>
          <p className="mt-2 text-muted-foreground">JobsAI Enterprise runs sourcing, AI screening, and the whole interview pipeline in one place. Book a walkthrough tailored to your team.</p>
          <Link href="/enterprise/demo" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-white shadow-glow">Book a demo <ArrowRight className="h-4 w-4" /></Link>
        </div>

        {related.length > 0 && (
          <div className="mt-12">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Keep reading</h2>
            <div className="mt-4 grid gap-3">
              {related.map((x) => (
                <Link key={x.slug} href={`/enterprise/blog/${x.slug}`} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary/40">
                  <span className="text-sm font-semibold">{x.title}</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>

      <PublicEnterpriseFooter />
    </main>
  );
}
