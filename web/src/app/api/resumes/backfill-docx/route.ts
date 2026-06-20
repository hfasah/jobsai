import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase";
import { renderResumeDocx, DOCX_MIME } from "@/lib/resume-docx";
import type { ParsedJson } from "@/types/resume";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Generated resumes (Builder/Optimizer output) use these storage_key prefixes;
// real uploads use "resumes/…". Only generated ones may be missing a .docx.
const GENERATED_PREFIXES = ["optimized/", "generated/", "tailored/"];

// POST /api/resumes/backfill-docx — regenerate the downloadable .docx for the
// current user's generated/optimized resumes. These were created before DOCX
// export existed, so their storage_key points at no file → download fails.
// Idempotent: re-renders + upserts, safe to run repeatedly.
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: docs } = await supabaseAdmin
    .from("resume_documents")
    .select("id")
    .eq("user_id", userId);
  const docIds = (docs ?? []).map((d) => d.id);
  if (docIds.length === 0) return NextResponse.json({ backfilled: 0, total: 0 });

  const { data: versions } = await supabaseAdmin
    .from("resume_versions")
    .select("id, storage_key")
    .in("document_id", docIds);

  const generated = (versions ?? []).filter((v) =>
    GENERATED_PREFIXES.some((p) => (v.storage_key ?? "").startsWith(p)),
  );

  let backfilled = 0;
  const errors: string[] = [];
  for (const v of generated) {
    const { data: prof } = await supabaseAdmin
      .from("resume_parsed_profile")
      .select("parsed_json")
      .eq("version_id", v.id)
      .maybeSingle();
    if (!prof?.parsed_json) continue;
    try {
      const buffer = await renderResumeDocx(prof.parsed_json as ParsedJson);
      const { error: upErr } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .upload(v.storage_key, buffer, { contentType: DOCX_MIME, upsert: true });
      if (upErr) {
        errors.push(`${v.id}: ${upErr.message}`);
        continue;
      }
      await supabaseAdmin
        .from("resume_versions")
        .update({ file_mime: DOCX_MIME, file_size_bytes: buffer.length, file_ext: "docx" })
        .eq("id", v.id);
      backfilled++;
    } catch (e) {
      errors.push(`${v.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({ backfilled, total: generated.length, errors: errors.slice(0, 5) });
}
