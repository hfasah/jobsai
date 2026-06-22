// Consumer blog loader. Reads articles from the shared `blog_posts` table (the
// same rows the enterprise webhook at app.jobsai.work ingests), so jobsai.work/blog
// shows the published articles. HTML body content; no curated structured posts here.

import { supabaseAdmin } from "@/lib/supabase";

export type Article = {
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  date: string; // ISO
  readMins: number;
  tag: string;
  coverImage?: string | null;
  bodyHtml: string;
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

function fromDb(r: DbRow): Article {
  return {
    slug: r.slug, title: r.title, excerpt: r.excerpt ?? "",
    author: r.author ?? "The JobsAI Team", date: r.published_at,
    readMins: r.read_mins ?? 5, tag: r.tag ?? "Article",
    coverImage: r.cover_image_url, bodyHtml: r.content_html ?? "",
  };
}

export async function loadArticles(): Promise<Article[]> {
  try {
    const { data } = await supabaseAdmin
      .from("blog_posts").select(SELECT)
      .order("published_at", { ascending: false }).limit(500);
    return (data as DbRow[] | null ?? []).map(fromDb);
  } catch {
    return []; // table may not exist yet
  }
}

export async function loadArticle(slug: string): Promise<Article | null> {
  try {
    const { data } = await supabaseAdmin
      .from("blog_posts").select(SELECT).eq("slug", slug).maybeSingle();
    return data ? fromDb(data as DbRow) : null;
  } catch {
    return null;
  }
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}
