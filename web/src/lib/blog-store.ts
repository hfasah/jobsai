// Unified blog loader: merges the curated structured posts (src/lib/blog.ts)
// with posts ingested from the webhook (blog_posts table). Curated posts render
// from structured sections; ingested posts render their HTML body.

import { supabaseAdmin } from "@/lib/supabase";
import { POSTS, type BlogPost, type BlogSection } from "@/lib/blog";

export type Article = {
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  date: string; // ISO
  readMins: number;
  tag: string;
  coverImage?: string | null;
  // Body is either structured (curated) or HTML (ingested).
  intro?: string;
  sections?: BlogSection[];
  takeaways?: string[];
  bodyHtml?: string;
};

type DbRow = {
  slug: string;
  title: string;
  excerpt: string | null;
  content_html: string | null;
  cover_image_url: string | null;
  author: string | null;
  tag: string | null;
  read_mins: number | null;
  published_at: string;
};

const SELECT = "slug,title,excerpt,content_html,cover_image_url,author,tag,read_mins,published_at";

function fromStatic(p: BlogPost): Article {
  return {
    slug: p.slug, title: p.title, excerpt: p.excerpt, author: p.author,
    date: p.date, readMins: p.readMins, tag: p.tag,
    intro: p.intro, sections: p.sections, takeaways: p.takeaways,
  };
}

function fromDb(r: DbRow): Article {
  return {
    slug: r.slug, title: r.title, excerpt: r.excerpt ?? "",
    author: r.author ?? "The JobsAI Team", date: r.published_at,
    readMins: r.read_mins ?? 5, tag: r.tag ?? "Article",
    coverImage: r.cover_image_url, bodyHtml: r.content_html ?? "",
  };
}

// All posts, newest first. Ingested posts win on slug collision.
export async function loadArticles(): Promise<Article[]> {
  let db: Article[] = [];
  try {
    const { data } = await supabaseAdmin
      .from("blog_posts").select(SELECT)
      .order("published_at", { ascending: false }).limit(500);
    db = (data as DbRow[] | null ?? []).map(fromDb);
  } catch {
    // table may not exist yet (migration 116 not run) — fall back to curated only
  }
  const seen = new Set(db.map((a) => a.slug));
  const merged = [...db, ...POSTS.map(fromStatic).filter((a) => !seen.has(a.slug))];
  merged.sort((a, b) => +new Date(b.date) - +new Date(a.date));
  return merged;
}

export async function loadArticle(slug: string): Promise<Article | null> {
  try {
    const { data } = await supabaseAdmin
      .from("blog_posts").select(SELECT).eq("slug", slug).maybeSingle();
    if (data) return fromDb(data as DbRow);
  } catch {
    // ignore — fall through to curated
  }
  const s = POSTS.find((p) => p.slug === slug);
  return s ? fromStatic(s) : null;
}
