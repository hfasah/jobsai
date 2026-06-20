import { auth } from "@clerk/nextjs/server";
import { blockNonJobSeeker } from "@/lib/roles";
import { NextRequest, NextResponse, after } from "next/server";
import { createHash } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { supabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase";
import { checkResumeGate } from "@/lib/billing";
import { runResumeParse } from "@/lib/resume-parse-pipeline";

function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export const maxDuration = 60; // upload + after() parse pipeline (extract + LLM)

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

  // Self-heal stalled parses. A version stuck in an in-progress state long past
  // any legitimate duration means its background parse (after()) was killed
  // mid-run — otherwise it would have reached parsed/partial/failed. Mark it
  // failed so the card stops showing "Analyzing" forever and the user can
  // retry by re-uploading. Normal parse is ~5s; 3 min is far beyond worst case
  // (the parser itself times out at 30s).
  const STALE_MS = 3 * 60 * 1000;
  const stalled = ((data ?? []) as Array<{
    active_version?: { id: string; parse_status: string; uploaded_at?: string | null } | null;
  }>)
    .map((d) => d.active_version)
    .filter((v): v is { id: string; parse_status: string; uploaded_at?: string | null } =>
      !!v &&
      (v.parse_status === "pending" || v.parse_status === "extracting_text") &&
      Date.now() - (v.uploaded_at ? new Date(v.uploaded_at).getTime() : 0) > STALE_MS);

  if (stalled.length) {
    const ids = stalled.map((v) => v.id);
    await supabaseAdmin
      .from("resume_versions")
      .update({ parse_status: "failed", parse_error_code: "PARSE_STALLED" })
      .in("id", ids);
    // reflect immediately in this response (same objects referenced in `data`)
    for (const v of stalled) v.parse_status = "failed";
  }

  // Backfill legacy generic names. Older uploads were all forced to the default
  // "My Resume"; we now name from the uploaded file. For those legacy rows the
  // original file name is still stored on the active version — derive a real
  // label from it so existing cards stop all reading "My Resume". Only touches
  // the exact legacy default, so user-chosen names are never overwritten.
  const toRename: Array<{ id: string; label: string; row: { label?: string | null } }> = [];
  for (const d of (data ?? []) as Array<{
    id: string;
    label?: string | null;
    active_version?: { file_name?: string | null } | null;
  }>) {
    if (d.label !== "My Resume") continue;
    const fileName = d.active_version?.file_name?.replace(/\.[^/.]+$/, "").trim();
    if (fileName) toRename.push({ id: d.id, label: fileName, row: d });
  }

  if (toRename.length) {
    await Promise.all(
      toRename.map((t) =>
        supabaseAdmin.from("resume_documents").update({ label: t.label }).eq("id", t.id),
      ),
    );
    for (const t of toRename) t.row.label = t.label; // reflect in this response
  }

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
  const providedLabel = (formData.get("label") as string | null)?.trim();
  const resumeGroupId = formData.get("resume_group_id") as string | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  // Default the resume name to the uploaded file's name (minus extension) so it
  // keeps the name it was uploaded with, instead of a generic "My Resume".
  const label =
    providedLabel || file.name.replace(/\.[^/.]+$/, "").trim() || "My Resume";
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

  // Run the full parse pipeline after the response is sent. `after()` keeps the
  // serverless function alive for the work (unlike a fire-and-forget fetch/promise,
  // which Vercel kills once the response returns), so extraction + structured parse
  // actually complete instead of leaving the resume stuck on "partial".
  after(() => runResumeParse(versionId));

  return NextResponse.json({
    resume_version_id: versionId,
    resume_document_id: groupId,
  });
}
