import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import type { ParsedJson } from "@/types/resume";

// Creates a new resume document + version from a parsed profile (no file upload).
// Mirrors the LinkedIn-import flow; used to persist Builder/Optimizer output as a
// reusable, downloadable resume version. Returns the new ids.
export async function createResumeFromProfile(
  userId: string,
  parsed: ParsedJson,
  label: string,
  fileTag = "generated"
): Promise<{ documentId: string; versionId: string }> {
  const rawText = JSON.stringify(parsed);

  const { data: doc, error: docError } = await supabaseAdmin
    .from("resume_documents")
    .insert({ user_id: userId, label })
    .select("id")
    .single();
  if (docError || !doc) throw new Error("Failed to create resume document.");

  const checksum = createHash("sha256").update(rawText + Date.now()).digest("hex");
  const { data: version, error: versionError } = await supabaseAdmin
    .from("resume_versions")
    .insert({
      document_id: doc.id,
      version_number: 1,
      storage_key: `${fileTag}/${userId}/${doc.id}`,
      file_name: label,
      file_ext: fileTag,
      file_mime: "application/json",
      file_size_bytes: rawText.length,
      checksum_sha256: checksum,
      upload_status: "uploaded",
      parse_status: "parsed",
      text_char_count: rawText.length,
      processed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (versionError || !version) throw new Error("Failed to create version record.");

  await supabaseAdmin.from("resume_documents").update({ active_version_id: version.id }).eq("id", doc.id);

  // Make primary if the user has none yet.
  const { count } = await supabaseAdmin
    .from("resume_documents")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_primary", true)
    .eq("is_archived", false);
  if ((count ?? 0) === 0) {
    await supabaseAdmin.from("resume_documents").update({ is_primary: true }).eq("id", doc.id);
  }

  await supabaseAdmin.from("resume_texts").insert({
    version_id: version.id,
    plain_text: rawText,
    tokens_count: Math.ceil(rawText.length / 4),
  });

  await supabaseAdmin.from("resume_parsed_profile").insert({
    version_id: version.id,
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

  if (parsed.experience?.length) {
    await supabaseAdmin.from("resume_experiences").insert(
      parsed.experience.map((exp, idx) => ({
        version_id: version.id,
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

  if (parsed.education?.length) {
    await supabaseAdmin.from("resume_educations").insert(
      parsed.education.map((edu, idx) => ({
        version_id: version.id,
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

  if (parsed.skills?.length) {
    await supabaseAdmin.from("resume_skills").insert(
      parsed.skills.map((s) => ({
        version_id: version.id,
        skill: s.skill,
        category: s.category ?? null,
        confidence: s.confidence ?? null,
      }))
    );
  }

  return { documentId: doc.id, versionId: version.id };
}
