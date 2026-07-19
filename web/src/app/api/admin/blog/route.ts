import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminPerm } from "@/lib/admin";

export const dynamic = "force-dynamic";

const SELECT = "id,slug,title,excerpt,content_html,cover_image_url,author,tag,read_mins,published_at,source,updated_at";

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// GET — all blog posts (newest first), for the admin list.
export async function GET() {
  const admin = await requireAdminPerm("blog");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data, error } = await supabaseAdmin
    .from("blog_posts").select(SELECT).order("published_at", { ascending: false }).limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

// POST — create or update a post (upsert on slug). Body: { slug?, title, excerpt?,
// content_html, cover_image_url?, author?, tag?, published_at? }.
export async function POST(req: NextRequest) {
  const admin = await requireAdminPerm("blog");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const title = (b.title as string | undefined)?.trim();
  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
  const contentHtml = (b.content_html as string | undefined) ?? "";
  if (!stripHtml(contentHtml)) return NextResponse.json({ error: "Article body is required." }, { status: 400 });

  const slug = (b.slug as string | undefined)?.trim() ? slugify(b.slug as string) : slugify(title);
  const excerpt = (b.excerpt as string | undefined)?.trim() || stripHtml(contentHtml).slice(0, 180);
  const words = stripHtml(contentHtml).split(/\s+/).filter(Boolean).length;
  const readMins = Math.max(1, Math.round(words / 200));
  const publishedAt = b.published_at ? new Date(b.published_at as string).toISOString() : new Date().toISOString();

  const { data, error } = await supabaseAdmin.from("blog_posts").upsert(
    {
      slug, title,
      excerpt,
      content_html: contentHtml,
      cover_image_url: (b.cover_image_url as string | undefined)?.trim() || null,
      author: (b.author as string | undefined)?.trim() || "The JobsAI Team",
      tag: (b.tag as string | undefined)?.trim() || "Article",
      read_mins: readMins,
      published_at: publishedAt,
      source: "admin",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "slug" },
  ).select(SELECT).single();
  if (error) {
    const hint = /relation .*blog_posts.* does not exist|schema cache/i.test(error.message)
      ? " (has migration 116 been run?)" : "";
    return NextResponse.json({ error: `${error.message}${hint}` }, { status: 500 });
  }

  try {
    revalidatePath("/enterprise/blog");
    revalidatePath(`/enterprise/blog/${slug}`);
  } catch { /* best-effort */ }

  return NextResponse.json({ data });
}
