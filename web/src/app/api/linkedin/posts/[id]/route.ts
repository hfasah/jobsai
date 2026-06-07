import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import type { LinkedInPostStatus } from "@/types/linkedin";

const STATUSES: LinkedInPostStatus[] = ["draft", "scheduled", "posted"];

// PATCH /api/linkedin/posts/[id] — edit body/hashtags, schedule, or mark as posted.
// Body: { body?, hashtags?, status?, scheduled_at? }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body.body === "string") patch.body = body.body;
  if (Array.isArray(body.hashtags)) {
    patch.hashtags = body.hashtags.map((h: string) => String(h).replace(/^#/, "").trim()).filter(Boolean);
  }

  if (typeof body.status === "string" && STATUSES.includes(body.status as LinkedInPostStatus)) {
    patch.status = body.status;
    // Stamp posted_at the moment a post is marked posted; clear it otherwise.
    patch.posted_at = body.status === "posted" ? new Date().toISOString() : null;
    if (body.status !== "scheduled") patch.scheduled_at = null;
  }

  if ("scheduled_at" in body) {
    patch.scheduled_at = body.scheduled_at ? new Date(body.scheduled_at).toISOString() : null;
    if (patch.scheduled_at && !patch.status) patch.status = "scheduled";
  }

  const { data, error } = await supabaseAdmin
    .from("linkedin_posts")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  return NextResponse.json({ data });
}

// DELETE /api/linkedin/posts/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { error } = await supabaseAdmin
    .from("linkedin_posts")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
