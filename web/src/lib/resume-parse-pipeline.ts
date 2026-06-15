import { supabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase";
import { extractText } from "@/lib/resume-extractor";
import { parseResumeText } from "@/lib/resume-parser";
import type { ParsedJson } from "@/types/resume";

// Persist the structured profile extracted from a resume's text. Idempotent:
// clears any prior parsed rows for the version first, so re-parsing is safe.
async function persistParsedProfile(versionId: string, parsed: ParsedJson) {
  await supabaseAdmin.from("resume_parsed_profile").delete().eq("version_id", versionId);
  await supabaseAdmin.from("resume_parsed_profile").insert({
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

  await supabaseAdmin.from("resume_experiences").delete().eq("version_id", versionId);
  if (parsed.experience?.length) {
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

  await supabaseAdmin.from("resume_educations").delete().eq("version_id", versionId);
  if (parsed.education?.length) {
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

  await supabaseAdmin.from("resume_skills").delete().eq("version_id", versionId);
  if (parsed.skills?.length) {
    await supabaseAdmin.from("resume_skills").insert(
      parsed.skills.map((s) => ({
        version_id: versionId,
        skill: s.skill,
        category: s.category ?? null,
        confidence: s.confidence ?? null,
      }))
    );
  }
}

async function markFailed(versionId: string, code: string) {
  await supabaseAdmin
    .from("resume_versions")
    .update({ parse_status: "failed", parse_error_code: code })
    .eq("id", versionId);
}

// Full resume parse pipeline: download file -> extract text -> structured LLM
// parse -> persist profile -> set status. Built to run via `after()` so it
// survives on serverless after the HTTP response is sent. Idempotent and safe
// to call more than once; no-ops if the version is already fully "parsed".
//
// Status outcomes:
//   parsed  — text extracted AND structured profile produced
//   partial — text extracted but structured parse yielded nothing usable, or
//             the LLM step failed (resume still usable from its text)
//   failed  — could not download the file or no text could be extracted
export async function runResumeParse(versionId: string): Promise<void> {
  const { data: version } = await supabaseAdmin
    .from("resume_versions")
    .select("id, storage_key, file_mime, parse_status")
    .eq("id", versionId)
    .single();

  if (!version || version.parse_status === "parsed") return;

  try {
    await supabaseAdmin
      .from("resume_versions")
      .update({ parse_status: "extracting_text" })
      .eq("id", versionId);

    const { data: fileData } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .download(version.storage_key);
    if (!fileData) {
      await markFailed(versionId, "DOWNLOAD_FAILED");
      return;
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const extracted = await extractText(buffer, version.file_mime ?? "application/pdf");
    const plainText = extracted.text;

    if (!plainText) {
      await markFailed(versionId, "NO_TEXT_DETECTED");
      return;
    }

    await supabaseAdmin.from("resume_texts").upsert({
      version_id: versionId,
      plain_text: plainText,
      tokens_count: Math.ceil(plainText.length / 4),
    });

    // Structured parse. If it fails, keep the resume as a usable text-only
    // "partial" rather than failing the whole upload.
    try {
      const parsed = await parseResumeText(plainText);
      await persistParsedProfile(versionId, parsed);

      const isPartial =
        !parsed.name &&
        !parsed.email &&
        (!parsed.experience || parsed.experience.length === 0);

      await supabaseAdmin
        .from("resume_versions")
        .update({
          parse_status: isPartial ? "partial" : "parsed",
          pages_count: extracted.pages,
          ocr_used: extracted.ocrUsed,
          processed_at: new Date().toISOString(),
        })
        .eq("id", versionId);
    } catch (parseErr) {
      console.error("Structured resume parse failed:", parseErr);
      await supabaseAdmin
        .from("resume_versions")
        .update({
          parse_status: "partial",
          pages_count: extracted.pages,
          ocr_used: extracted.ocrUsed,
          parse_error_code: "STRUCTURED_PARSE_FAILED",
          processed_at: new Date().toISOString(),
        })
        .eq("id", versionId);
    }
  } catch (err) {
    console.error("Resume parse pipeline error:", err);
    await markFailed(versionId, "PARSE_PIPELINE_ERROR");
  }
}
