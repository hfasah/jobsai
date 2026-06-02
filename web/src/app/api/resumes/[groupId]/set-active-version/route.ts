import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// POST /api/resumes/[groupId]/set-active-version  { version_id }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groupId } = await params;
  const body = await req.json().catch(() => ({}));
  const versionId = body.version_id as string | undefined;
  if (!versionId) return NextResponse.json({ error: "version_id required" }, { status: 400 });

  // Verify the document belongs to the user
  const { data: doc } = await supabaseAdmin
    .from("resume_documents")
    .select("id")
    .eq("id", groupId)
    .eq("user_id", userId)
    .single();

  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Verify the version belongs to this document and isn't deleted
  const { data: version } = await supabaseAdmin
    .from("resume_versions")
    .select("id")
    .eq("id", versionId)
    .eq("document_id", groupId)
    .is("deleted_at", null)
    .single();

  if (!version) {
    return NextResponse.json({ error: "Version not found in this resume" }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from("resume_documents")
    .update({ active_version_id: versionId })
    .eq("id", groupId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
