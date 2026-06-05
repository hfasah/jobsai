import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { v4 as uuidv4 } from "uuid";

export const maxDuration = 60; // seconds — extend for OpenAI parsing

import { supabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase";
import { extractText } from "@/lib/resume-extractor";
import { parseResumeText } from "@/lib/resume-parser";
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

  // Parse synchronously so it completes within the serverless function lifetime.
  // Vercel terminates fire-and-forget work after the response is sent on Hobby.
  await parseInBackground(version.id, documentId, buffer, file.type).catch(console.error);

  return NextResponse.json(
    {
      resume_version_id: version.id,
      resume_document_id: documentId,
      status: "pending",
    },
    { status: 202 }
  );
}

async function parseInBackground(
  versionId: string,
  documentId: string,
  buffer: Buffer,
  mimeType: string
) {
  // Mark as extracting
  await supabaseAdmin
    .from("resume_versions")
    .update({ parse_status: "extracting_text" })
    .eq("id", versionId);

  let plainText = "";
  let pages: number | null = null;
  let ocrUsed = false;

  try {
    const extracted = await extractText(buffer, mimeType);
    plainText = extracted.text;
    pages = extracted.pages;
    ocrUsed = extracted.ocrUsed;

    await supabaseAdmin
      .from("resume_versions")
      .update({ pages_count: pages, ocr_used: ocrUsed })
      .eq("id", versionId);

    if (!plainText) {
      await supabaseAdmin
        .from("resume_versions")
        .update({
          parse_status: "failed",
          parse_error_code: "NO_TEXT_DETECTED",
          parse_error_msg: "No readable text found. Try a DOCX or text-based PDF.",
        })
        .eq("id", versionId);
      return;
    }

    // Store raw text
    await supabaseAdmin.from("resume_texts").upsert({
      version_id: versionId,
      plain_text: plainText,
      tokens_count: Math.ceil(plainText.length / 4),
    });

  } catch (err) {
    const code = err instanceof Error ? err.message : "EXTRACTION_FAILED";
    await supabaseAdmin
      .from("resume_versions")
      .update({ parse_status: "failed", parse_error_code: code })
      .eq("id", versionId);
    return;
  }

  // Parse with OpenAI
  try {
    const parsed = await parseResumeText(plainText);

    const isPartial =
      !parsed.name && !parsed.email && (!parsed.experience || parsed.experience.length === 0);

    // Store parsed profile
    await supabaseAdmin.from("resume_parsed_profile").upsert({
      version_id: versionId,
      full_name: parsed.name ?? null,
      email: parsed.email ?? null,
      phone: parsed.phone ?? null,
      location: parsed.location ?? null,
      headline: parsed.headline ?? null,
      summary: parsed.summary ?? null,
      links: parsed.links ?? {},
      years_experience: parsed.years_experience ?? null,
      parsed_json: parsed,
    });

    // Store normalized experiences
    if (parsed.experience?.length) {
      await supabaseAdmin.from("resume_experiences").delete().eq("version_id", versionId);
      await supabaseAdmin.from("resume_experiences").insert(
        parsed.experience.map((exp, idx) => ({
          version_id: versionId,
          idx,
          title: exp.title ?? null,
          company: exp.company ?? null,
          employment_type: exp.employment_type ?? null,
          location: exp.location ?? null,
          start_date: exp.start_date ?? null,
          end_date: exp.end_date ?? null,
          is_current: exp.is_current ?? false,
          description: exp.description ?? null,
        }))
      );
    }

    // Store normalized education
    if (parsed.education?.length) {
      await supabaseAdmin.from("resume_educations").delete().eq("version_id", versionId);
      await supabaseAdmin.from("resume_educations").insert(
        parsed.education.map((edu, idx) => ({
          version_id: versionId,
          idx,
          school: edu.school ?? null,
          degree: edu.degree ?? null,
          field_of_study: edu.field_of_study ?? null,
          start_date: edu.start_date ?? null,
          end_date: edu.end_date ?? null,
          grade: edu.grade ?? null,
          description: edu.description ?? null,
        }))
      );
    }

    // Store skills
    if (parsed.skills?.length) {
      await supabaseAdmin.from("resume_skills").delete().eq("version_id", versionId);
      await supabaseAdmin.from("resume_skills").insert(
        parsed.skills.map((s) => ({
          version_id: versionId,
          skill: s.skill,
          category: s.category ?? null,
          confidence: s.confidence ?? null,
        }))
      );
    }

    await supabaseAdmin
      .from("resume_versions")
      .update({
        parse_status: isPartial ? "partial" : "parsed",
        processed_at: new Date().toISOString(),
        text_char_count: plainText.length,
      })
      .eq("id", versionId);

  } catch (err) {
    console.error("Parse error:", err);
    await supabaseAdmin
      .from("resume_versions")
      .update({
        parse_status: "failed",
        parse_error_code: "STRUCTURE_EXTRACTION_FAILED",
        parse_error_msg: err instanceof Error ? err.message : "Unknown error",
      })
      .eq("id", versionId);
  }
}
