import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

// POST /api/blog-webhook?key=SECRET
//
// Receives a published article from an external content provider (BabyLoveGrowth)
// and upserts it into blog_posts so it appears on /enterprise/blog automatically.
// Auth: a shared secret in the ?key= query param (their UI only accepts a URL),
// also accepted via the x-webhook-secret header. Field names are matched
// defensively across common variants, and the full payload is stored in `raw`.

function pick(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}
function firstOfArray(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj?.[k];
    if (Array.isArray(v) && typeof v[0] === "string" && v[0].trim()) return v[0].trim();
  }
  return undefined;
}
function slugify(s: string): string {
  return s.toLowerCase().replace(/<[^>]+>/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}
function stripHtml(h: string): string {
  return h.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
function toIso(v: string | undefined): string {
  if (v) { const d = new Date(v); if (!isNaN(d.getTime())) return d.toISOString(); }
  return new Date().toISOString();
}

export async function POST(req: NextRequest) {
  const secret = process.env.BLOG_WEBHOOK_SECRET;
  const key = req.nextUrl.searchParams.get("key") ?? req.headers.get("x-webhook-secret");
  if (!secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  if (key !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  // Some providers wrap the article in { article } / { data } / { post }.
  const a = ((body.article ?? body.data ?? body.post ?? body) as Record<string, unknown>) || {};

  const title = pick(a, ["title", "name", "headline", "seo_title", "meta_title"]);
  if (!title) return NextResponse.json({ error: "Missing article title" }, { status: 400 });

  const slug = pick(a, ["slug", "permalink", "url_slug"]) ?? slugify(title);
  const contentHtml = pick(a, ["content_html", "html", "html_content", "content", "body", "article_html", "contentHtml"]) ?? "";
  const excerpt = pick(a, ["excerpt", "summary", "meta_description", "description", "seo_description", "metaDescription"])
    ?? stripHtml(contentHtml).slice(0, 180);
  const cover = pick(a, ["cover_image_url", "featured_image_url", "cover_image", "featured_image", "image_url", "image", "og_image", "thumbnail", "coverImage"]) ?? null;
  const author = pick(a, ["author", "author_name", "byline", "authorName"]) ?? "The JobsAI Team";
  const tag = pick(a, ["tag", "category"]) ?? firstOfArray(a, ["tags", "keywords", "categories"]) ?? "Article";
  const publishedAt = toIso(pick(a, ["published_at", "publishedAt", "date", "published_date", "created_at", "createdAt"]));
  const words = stripHtml(contentHtml).split(/\s+/).filter(Boolean).length;
  const readMins = Math.max(1, Math.round(words / 200));

  const { error } = await supabaseAdmin.from("blog_posts").upsert(
    {
      slug, title, excerpt, content_html: contentHtml, cover_image_url: cover,
      author, tag, read_mins: readMins, published_at: publishedAt,
      source: "babylovegrowth", raw: body, updated_at: new Date().toISOString(),
    },
    { onConflict: "slug" },
  );
  if (error) {
    console.error("[blog-webhook] upsert failed:", error);
    const hint = /relation .*blog_posts.* does not exist|schema cache/i.test(error.message)
      ? " (has migration 116 been run?)" : "";
    return NextResponse.json({ error: `${error.message}${hint}` }, { status: 500 });
  }

  try {
    revalidatePath("/enterprise/blog");
    revalidatePath(`/enterprise/blog/${slug}`);
  } catch { /* best-effort cache refresh */ }

  return NextResponse.json({ ok: true, slug });
}
