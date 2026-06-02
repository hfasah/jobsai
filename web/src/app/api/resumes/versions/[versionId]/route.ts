import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/resumes/versions/[versionId] — full version detail with parsed data
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { versionId } = await params;

  // Verify ownership via document (use explicit FK to avoid ambiguous relationship)
  const { data: version, error } = await supabaseAdmin
    .from("resume_versions")
    .select(`
      *,
      resume_documents!resume_versions_document_id_fkey!inner (user_id),
      parsed_profile:resume_parsed_profile (*),
      experiences:resume_experiences (*),
      educations:resume_educations (*),
      skills:resume_skills (*)
    `)
    .eq("id", versionId)
    .eq("resume_documents!resume_versions_document_id_fkey.user_id", userId)
    .is("deleted_at", null)
    .single();

  if (error || !version) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Sort experiences and educations by idx client-side
  if (version.experiences) version.experiences.sort((a: { idx: number }, b: { idx: number }) => a.idx - b.idx);
  if (version.educations) version.educations.sort((a: { idx: number }, b: { idx: number }) => a.idx - b.idx);

  return NextResponse.json({ data: version });
}

// DELETE /api/resumes/versions/[versionId] — soft delete version
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { versionId } = await params;

  // Verify ownership
  const { data: version } = await supabaseAdmin
    .from("resume_versions")
    .select("id, document_id, resume_documents!resume_versions_document_id_fkey!inner(user_id)")
    .eq("id", versionId)
    .eq("resume_documents!resume_versions_document_id_fkey.user_id", userId)
    .is("deleted_at", null)
    .single();

  if (!version) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Don't allow deleting the only version
  const { count } = await supabaseAdmin
    .from("resume_versions")
    .select("id", { count: "exact", head: true })
    .eq("document_id", version.document_id)
    .is("deleted_at", null);

  if ((count ?? 0) <= 1) {
    return NextResponse.json(
      { error: "Cannot delete the only version. Delete the resume instead." },
      { status: 400 }
    );
  }

  await supabaseAdmin
    .from("resume_versions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", versionId);

  return new NextResponse(null, { status: 204 });
}
