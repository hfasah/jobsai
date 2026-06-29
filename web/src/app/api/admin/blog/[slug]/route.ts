import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

// DELETE — remove a blog post by slug.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { slug } = await params;

  const { error } = await supabaseAdmin.from("blog_posts").delete().eq("slug", slug);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    revalidatePath("/enterprise/blog");
    revalidatePath(`/enterprise/blog/${slug}`);
  } catch { /* best-effort */ }

  return NextResponse.json({ ok: true });
}
