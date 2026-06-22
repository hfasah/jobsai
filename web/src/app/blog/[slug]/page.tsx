import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Calendar, Clock } from "lucide-react";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { loadArticle, loadArticles, formatDate } from "@/lib/blog-store";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://jobsai.work").replace(/\/$/, "");

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await loadArticle(slug);
  if (!p) return { title: "Blog — JobsAI" };
  const title = `${p.title} | JobsAI`;
  return {
    title,
    description: p.excerpt,
    alternates: { canonical: `/blog/${p.slug}` },
    openGraph: { type: "article", title, description: p.excerpt, publishedTime: p.date, ...(p.coverImage ? { images: [p.coverImage] } : {}) },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await loadArticle(slug);
  if (!p) notFound();

  const related = (await loadArticles()).filter((x) => x.slug !== p.slug).slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: p.title,
    description: p.excerpt,
    datePublished: p.date,
    ...(p.coverImage ? { image: p.coverImage } : {}),
    author: { "@type": "Organization", name: p.author },
    publisher: { "@type": "Organization", name: "JobsAI" },
    mainEntityOfPage: `${APP_URL}/blog/${p.slug}`,
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <MarketingHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <article className="mx-auto max-w-3xl px-6 py-14">
        <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Blog
        </Link>
        <p className="mt-6 text-xs font-bold uppercase tracking-widest text-primary">{p.tag}</p>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{p.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span>{p.author}</span>
          <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {formatDate(p.date)}</span>
          <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {p.readMins} min read</span>
        </div>

        {p.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.coverImage} alt={p.title} className="mt-6 w-full rounded-2xl border border-border object-cover" />
        )}
        <div className="blog-content mt-8" dangerouslySetInnerHTML={{ __html: p.bodyHtml }} />

        {/* CTA */}
        <div className="mt-10 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-transparent p-6 sm:p-8">
          <h2 className="text-2xl font-bold tracking-tight">Let AI run your job search</h2>
          <p className="mt-2 text-muted-foreground">JobsAI tailors every application, applies for you, and preps you for each interview. Get started in minutes.</p>
          <Link href="/sign-up" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-white shadow-glow">Get started free <ArrowRight className="h-4 w-4" /></Link>
        </div>

        {related.length > 0 && (
          <div className="mt-12">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Keep reading</h2>
            <div className="mt-4 grid gap-3">
              {related.map((x) => (
                <Link key={x.slug} href={`/blog/${x.slug}`} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary/40">
                  <span className="text-sm font-semibold">{x.title}</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>

      <SiteFooter />
    </main>
  );
}
