import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase";

// POST /api/resumes/versions/[versionId]/download-url
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { versionId } = await params;

  const { data: version } = await supabaseAdmin
    .from("resume_versions")
    .select("storage_key, resume_documents!resume_versions_document_id_fkey!inner(user_id)")
    .eq("id", versionId)
    .eq("resume_documents!resume_versions_document_id_fkey.user_id", userId)
    .is("deleted_at", null)
    .single();

  if (!version) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: signed, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(version.storage_key, 300); // 5 min TTL

  if (error || !signed) {
    return NextResponse.json({ error: "Could not generate download URL" }, { status: 500 });
  }

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  return NextResponse.json({ url: signed.signedUrl, expires_at: expiresAt });
}
