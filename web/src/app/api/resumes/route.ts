import { auth } from "@clerk/nextjs/server";
import { blockNonJobSeeker } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { v4 as uuidv4 } from "uuid";

export const maxDuration = 60; // seconds — extend for OpenAI parsing

import { supabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase";
import { checkResumeGate } from "@/lib/billing";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

// GET /api/resumes — list all resume documents for the current user
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roleBlock = await blockNonJobSeeker(userId); if (roleBlock) return roleBlock;

  const { data, error } = await supabaseAdmin
    .from("resume_documents")
    .select(`
      *,
      active_version:resume_versions!resume_documents_active_version_id_fkey (
        id, version_number, file_name, file_ext, file_size_bytes,
        parse_status, pages_count, uploaded_at, processed_at
      )
    `)
    .eq("user_id", userId)
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}

// POST /api/resumes — upload a new resume (multipart/form-data)
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roleBlock = await blockNonJobSeeker(userId); if (roleBlock) return roleBlock;

  // Only gate new document groups, not additional versions of existing resumes
  // We check the gate here; if they pass resume_group_id it's a new version → skip
  const contentTypeCheck = req.headers.get("content-type") ?? "";
  if (contentTypeCheck.includes("multipart/form-data")) {
    const clonedReq = req.clone();
    const fd = await clonedReq.formData().catch(() => null);
    const isNewGroup = !fd?.get("resume_group_id");
    if (isNewGroup) {
      const gate = await checkResumeGate(userId);
      if (!gate.allowed) {
        return NextResponse.json(
          { error: gate.reason, upgrade_required: true },
          { status: 402 }
        );
      }
    }
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const label = (formData.get("label") as string | null) ?? "My Resume";
  const resumeGroupId = formData.get("resume_group_id") as string | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Unsupported file type. Use PDF, DOC, or DOCX." },
      { status: 415 }
    );
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "File exceeds 20 MB limit." }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const checksum = createHash("sha256").update(buffer).digest("hex");
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "pdf";

  // Resolve or create the document group
  let documentId: string;

  if (resumeGroupId) {
    // Verify ownership
    const { data: doc, error } = await supabaseAdmin
      .from("resume_documents")
      .select("id")
      .eq("id", resumeGroupId)
      .eq("user_id", userId)
      .single();

    if (error || !doc) {
      return NextResponse.json({ error: "Resume document not found." }, { status: 404 });
    }

    // Duplicate detection within group
    const { data: dupe } = await supabaseAdmin
      .from("resume_versions")
      .select("id")
      .eq("document_id", resumeGroupId)
      .eq("checksum_sha256", checksum)
      .is("deleted_at", null)
      .maybeSingle();

    if (dupe) {
      return NextResponse.json(
        { error: "Identical file already exists.", existing_id: dupe.id },
        { status: 409 }
      );
    }

    documentId = resumeGroupId;
  } else {
    // Create new document group
    const { data: newDoc, error } = await supabaseAdmin
      .from("resume_documents")
      .insert({ user_id: userId, label })
      .select("id")
      .single();

    if (error || !newDoc) {
      return NextResponse.json({ error: "Failed to create resume document." }, { status: 500 });
    }
    documentId = newDoc.id;
  }

  // Get next version number
  const { count } = await supabaseAdmin
    .from("resume_versions")
    .select("id", { count: "exact", head: true })
    .eq("document_id", documentId)
    .is("deleted_at", null);

  const versionNumber = (count ?? 0) + 1;

  // Upload file to Supabase Storage
  const storageKey = `${userId}/${documentId}/${uuidv4()}.${ext}`;
  const { error: storageError } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(storageKey, buffer, { contentType: file.type, upsert: false });

  if (storageError) {
    return NextResponse.json({ error: "File upload failed." }, { status: 500 });
  }

  // Create version record
  const { data: version, error: versionError } = await supabaseAdmin
    .from("resume_versions")
    .insert({
      document_id: documentId,
      version_number: versionNumber,
      storage_key: storageKey,
      file_name: file.name,
      file_ext: ext,
      file_mime: file.type,
      file_size_bytes: file.size,
      checksum_sha256: checksum,
      upload_status: "uploaded",
      parse_status: "pending",
    })
    .select("id")
    .single();

  if (versionError || !version) {
    return NextResponse.json({ error: "Failed to create version record." }, { status: 500 });
  }

  // Set as active version on the document
  await supabaseAdmin
    .from("resume_documents")
    .update({ active_version_id: version.id, label })
    .eq("id", documentId);

  // If no primary resume yet, make this one primary
  const { count: primaryCount } = await supabaseAdmin
    .from("resume_documents")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_primary", true)
    .eq("is_archived", false);

  if ((primaryCount ?? 0) === 0) {
    await supabaseAdmin
      .from("resume_documents")
      .update({ is_primary: true })
      .eq("id", documentId);
  }

  // Parsing is triggered separately by the client via POST /api/resumes/versions/[id]/parse
  // so upload returns immediately and the user is not blocked waiting for OpenAI.
  return NextResponse.json(
    {
      resume_version_id: version.id,
      resume_document_id: documentId,
      status: "pending",
    },
    { status: 202 }
  );
}

