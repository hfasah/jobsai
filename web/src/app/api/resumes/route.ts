import { auth } from "@clerk/nextjs/server";
import { blockNonJobSeeker } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { supabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase";
import { checkResumeGate } from "@/lib/billing";

function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export const maxDuration = 30;

const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_SIZE_BYTES = 20 * 1024 * 1024;

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
      { error: "Only PDF, DOC, and DOCX files are supported." },
      { status: 400 }
    );
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File is too large (max 20 MB)." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // ── Get or create resume document ──────────────────────────────────────────────
  let groupId: string;
  if (resumeGroupId) {
    groupId = resumeGroupId;
  } else {
    groupId = uuidv4();
    const { error: insertError } = await supabaseAdmin
      .from("resume_documents")
      .insert({
        id: groupId,
        user_id: userId,
        label: label.trim(),
        is_primary: false,
        is_archived: false,
      });
    if (insertError) {
      return NextResponse.json(
        { error: "Failed to create resume." },
        { status: 500 }
      );
    }
  }

  // ── Upload file to storage ─────────────────────────────────────────────────────
  const fileHash = createHash("sha256").update(buffer).digest("hex");
  const fileExt = file.name.split(".").pop()?.toLowerCase() || "pdf";
  const storagePath = `resumes/${userId}/${groupId}/${fileHash}.${fileExt}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, { upsert: true });

  if (uploadError) {
    return NextResponse.json(
      { error: "Failed to upload file." },
      { status: 500 }
    );
  }

  // ── Create resume version ──────────────────────────────────────────────────────
  const versionId = uuidv4();
  const checksum = sha256(buffer);
  const { error: versionError } = await supabaseAdmin
    .from("resume_versions")
    .insert({
      id: versionId,
      document_id: groupId,
      version_number: 1,
      file_name: file.name,
      file_ext: fileExt,
      file_size_bytes: file.size,
      file_mime: file.type,
      storage_key: storagePath,
      checksum_sha256: checksum,
      parse_status: "partial", // Mark as ready immediately
      uploaded_at: new Date().toISOString(),
    });

  if (versionError) {
    console.error("Resume version insert FAILED");
    console.error("Version ID:", versionId);
    console.error("Document ID:", groupId);
    console.error("File ext:", fileExt);
    console.error("Checksum:", checksum);
    console.error("Full error:", JSON.stringify(versionError, null, 2));
    return NextResponse.json(
      {
        error: "Failed to save resume version.",
        code: versionError.code,
        hint: versionError.hint,
        message: versionError.message,
      },
      { status: 500 }
    );
  }

  // ── Create minimal parsed profile so user can proceed ─────────────────────────
  await supabaseAdmin.from("resume_parsed_profile").upsert({
    version_id: versionId,
    parsed_json: {
      name: null,
      email: null,
      phone: null,
      location: null,
      headline: null,
      summary: null,
      links: {},
      years_experience: null,
      experience: [],
      education: [],
      skills: [],
      certifications: [],
      languages: [],
      confidence: { contact: 0, experience: 0, education: 0, skills: 0 },
      warnings: ["Resume uploaded. You can now add skills and experience to improve matches."],
    },
  });

  // ── Set as active version ──────────────────────────────────────────────────────
  await supabaseAdmin
    .from("resume_documents")
    .update({ active_version_id: versionId })
    .eq("id", groupId);

  // Fire text extraction in background (user doesn't wait)
  fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/resumes/versions/${versionId}/parse`, {
    method: "POST",
    keepalive: true,
  }).catch(() => {});

  return NextResponse.json({
    resume_version_id: versionId,
    resume_document_id: groupId,
  });
}
