import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/resumes/[groupId] — document + all versions
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groupId } = await params;

  const { data: doc, error } = await supabaseAdmin
    .from("resume_documents")
    .select("*")
    .eq("id", groupId)
    .eq("user_id", userId)
    .single();

  if (error || !doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: versions } = await supabaseAdmin
    .from("resume_versions")
    .select("*")
    .eq("document_id", groupId)
    .is("deleted_at", null)
    .order("version_number", { ascending: false });

  return NextResponse.json({ data: { ...doc, versions: versions ?? [] } });
}

// PATCH /api/resumes/[groupId] — rename label
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groupId } = await params;
  const body = await req.json().catch(() => ({}));
  const label = body.label as string | undefined;
  if (!label?.trim()) return NextResponse.json({ error: "Label required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("resume_documents")
    .update({ label: label.trim() })
    .eq("id", groupId)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE /api/resumes/[groupId] — soft delete entire document
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groupId } = await params;

  // Check if resume is still parsing — prevent deletion during parsing
  const { data: doc, error: fetchError } = await supabaseAdmin
    .from("resume_documents")
    .select("active_version_id, resume_versions!resume_documents_active_version_id_fkey(parse_status)")
    .eq("id", groupId)
    .eq("user_id", userId)
    .single();

  if (fetchError || !doc) {
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  }

  // Check if active version is still parsing
  const activeVersion = Array.isArray(doc.resume_versions) 
    ? doc.resume_versions[0] 
    : doc.resume_versions;
  const parseStatus = activeVersion?.parse_status;

  if (parseStatus === "pending" || parseStatus === "extracting_text") {
    return NextResponse.json(
      { error: "Your resume is still being analyzed. Please wait for it to complete before deleting." },
      { status: 409 }
    );
  }

  const { error } = await supabaseAdmin
    .from("resume_documents")
    .update({ is_archived: true })
    .eq("id", groupId)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}

}
