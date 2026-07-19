import { NextRequest, NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminPerm } from "@/lib/admin";
import { runResumeParse } from "@/lib/resume-parse-pipeline";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Stuck states that should be re-driven through the parse pipeline. "parsed" and
// "failed" are terminal and left alone.
const STUCK_STATES = ["pending", "extracting_text", "partial"];

// POST /api/admin/resumes/reparse-partials — admin backfill. Re-runs the resume
// parse pipeline over versions stuck in a non-final state (default: all "stuck"
// states). Optional query params:
//   ?userId=<clerk_user_id>  scope to one user
//   ?limit=<n>               batch size (default 10, max 50)
// Runs the batch via after() so the response returns immediately.
export async function POST(req: NextRequest) {
  const admin = await requireAdminPerm("ops");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const userId = req.nextUrl.searchParams.get("userId");
  const limit = Math.min(
    Math.max(parseInt(req.nextUrl.searchParams.get("limit") ?? "10", 10) || 10, 1),
    50
  );

  let query = supabaseAdmin
    .from("resume_versions")
    .select("id, resume_documents!resume_versions_document_id_fkey!inner(user_id)")
    .in("parse_status", STUCK_STATES)
    .is("deleted_at", null)
    .order("uploaded_at", { ascending: false })
    .limit(limit);

  if (userId) {
    query = query.eq("resume_documents!resume_versions_document_id_fkey.user_id", userId);
  }

  const { data: versions, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (versions ?? []).map((v) => v.id);

  // Re-parse the batch after the response is sent. runResumeParse never throws
  // (it records failures itself), so a bad one can't break the rest.
  after(async () => {
    await Promise.all(ids.map((id) => runResumeParse(id)));
  });

  return NextResponse.json({ ok: true, queued: ids.length, version_ids: ids });
}
