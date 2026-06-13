import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, ChevronRight } from "lucide-react";
import { GuideLayout } from "@/components/enterprise/guide-layout";
import { GuideArticleBody } from "@/components/enterprise/guide-article";
import { GUIDE_ARTICLES, getGuideArticle } from "@/lib/enterprise-guide";

export function generateStaticParams() {
  return GUIDE_ARTICLES.map((a) => ({ article: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ article: string }>;
}): Promise<Metadata> {
  const { article } = await params;
  const found = getGuideArticle(article);
  if (!found) return { title: "Guide — JobsAI Enterprise" };
  return {
    title: `${found.article.title} — JobsAI Enterprise Guide`,
    description: found.article.summary,
  };
}

export default async function GuideArticlePage({
  params,
}: {
  params: Promise<{ article: string }>;
}) {
  const { article } = await params;
  const found = getGuideArticle(article);
  if (!found) notFound();
  const { article: a, category } = found;

  // Prev/next across the flattened article order.
  const idx = GUIDE_ARTICLES.findIndex((x) => x.slug === a.slug);
  const prev = idx > 0 ? GUIDE_ARTICLES[idx - 1] : null;
  const next = idx < GUIDE_ARTICLES.length - 1 ? GUIDE_ARTICLES[idx + 1] : null;

  return (
    <GuideLayout activeSlug={a.slug}>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/enterprise/guide" className="hover:text-foreground">Guide</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span>{category.title}</span>
      </nav>

      {/* Header */}
      <header className="mt-3">
        <h1 className="flex items-center gap-2.5 text-3xl font-bold tracking-tight">
          <span>{a.icon}</span> {a.title}
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">{a.summary}</p>
      </header>

      <article className="mt-8">
        <GuideArticleBody sections={a.sections} />
      </article>

      {/* Prev / next */}
      <div className="mt-12 grid gap-3 border-t border-border pt-6 sm:grid-cols-2">
        {prev ? (
          <Link href={`/enterprise/guide/${prev.slug}`} className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40">
            <span className="flex items-center gap-1 text-xs text-muted-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Previous</span>
            <span className="mt-1 block font-medium group-hover:text-primary">{prev.icon} {prev.title}</span>
          </Link>
        ) : <span />}
        {next && (
          <Link href={`/enterprise/guide/${next.slug}`} className="group rounded-xl border border-border bg-card p-4 text-right transition-colors hover:border-primary/40 sm:col-start-2">
            <span className="flex items-center justify-end gap-1 text-xs text-muted-foreground">Next <ArrowRight className="h-3.5 w-3.5" /></span>
            <span className="mt-1 block font-medium group-hover:text-primary">{next.icon} {next.title}</span>
          </Link>
        )}
      </div>

      {/* Help footer */}
      <div className="mt-8 rounded-2xl border border-border bg-card/60 p-5 text-center">
        <p className="text-sm text-muted-foreground">Still stuck? Our team is happy to help.</p>
        <Link href="/enterprise/contact" className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-gradient-brand px-4 py-2 text-sm font-semibold text-white shadow-glow">
          Contact support
        </Link>
      </div>
    </GuideLayout>
  );
}
