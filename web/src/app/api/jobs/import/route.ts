import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

import { supabaseAdmin } from "@/lib/supabase";
import { extractText } from "@/lib/resume-extractor";
import { parseJobText, scoreMatch } from "@/lib/job-parser";
import type { ParsedJson } from "@/types/resume";

// ─── URL scraping via Jina.ai Reader ─────────────────────────────────────────
async function fetchUrlContent(url: string): Promise<string> {
  const jinaUrl = `https://r.jina.ai/${url}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-No-Cache": "true",
    "X-Return-Format": "text",
  };
  if (process.env.JINA_API_KEY) {
    headers["Authorization"] = `Bearer ${process.env.JINA_API_KEY}`;
  }

  const res = await fetch(jinaUrl, {
    headers,
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) throw new Error(`Jina fetch failed: ${res.status}`);

  const json = (await res.json()) as { data?: { content?: string } };
  const content = json.data?.content?.trim();
  if (!content) throw new Error("No content extracted from URL");
  return content;
}

const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/html",
];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MIN_CHARS = 300;

// POST /api/jobs/import — paste text or upload a file
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contentType = req.headers.get("content-type") ?? "";
  let rawText = "";
  let sourceType: "text" | "file" = "text";
  let sourceUrl: string | null = null;
  let force = false;

  if (contentType.includes("multipart/form-data")) {
    // File upload
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    sourceUrl = (formData.get("source_url") as string | null) ?? null;
    force = formData.get("force") === "true";

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type. Use PDF, DOCX, TXT, or HTML." },
        { status: 415 }
      );
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: "File exceeds 5 MB limit." }, { status: 413 });
    }

    sourceType = "file";
    const buffer = Buffer.from(await file.arrayBuffer());

    if (file.type === "text/plain" || file.type === "text/html") {
      rawText = buffer.toString("utf-8");
    } else {
      try {
        const extracted = await extractText(buffer, file.type);
        rawText = extracted.text;
      } catch (err) {
        console.error("Job file extraction failed:", file.type, err);
        return NextResponse.json(
          { error: "Could not read text from file. Try pasting the description." },
          { status: 422 }
        );
      }
    }
  } else {
    const body = await req.json().catch(() => ({}));
    sourceUrl = (body.source_url as string | null) ?? null;
    force = body.force === true;

    if (body.url) {
      // ── URL import ──────────────────────────────────────────────────────────
      const targetUrl = (body.url as string).trim();
      try {
        new URL(targetUrl); // basic validity check
      } catch {
        return NextResponse.json({ error: "Invalid URL." }, { status: 400 });
      }
      sourceUrl = targetUrl;
      try {
        rawText = await fetchUrlContent(targetUrl);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("URL fetch error:", msg);
        return NextResponse.json(
          { error: "Could not fetch the URL. Make sure it is publicly accessible and try again." },
          { status: 422 }
        );
      }
    } else {
      // ── Text paste ──────────────────────────────────────────────────────────
      rawText = (body.text as string | null)?.trim() ?? "";
    }
  }

  if (rawText.trim().length < MIN_CHARS) {
    return NextResponse.json(
      { error: `Job description too short (min ${MIN_CHARS} characters).`, code: "text_insufficient_content" },
      { status: 400 }
    );
  }

  // Dedupe: SHA-256 of canonicalized text
  const canonical = rawText.replace(/\s+/g, " ").trim().toLowerCase();
  const contentHash = createHash("sha256").update(canonical).digest("hex");

  if (!force) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: existing } = await supabaseAdmin
      .from("jobs")
      .select("id")
      .eq("user_id", userId)
      .eq("content_hash", contentHash)
      .gte("created_at", sevenDaysAgo)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { job_id: existing.id, status: "ready", dedup: true },
        { status: 200 }
      );
    }
  }

  // Create job record
  const { data: job, error: jobError } = await supabaseAdmin
    .from("jobs")
    .insert({
      user_id: userId,
      source_type: sourceType,
      status: "processing",
      content_hash: contentHash,
      raw_text: rawText,
      source_url: sourceUrl,
    })
    .select("id")
    .single();

  if (jobError || !job) {
    return NextResponse.json({ error: "Failed to create job." }, { status: 500 });
  }

  const response = NextResponse.json(
    { job_id: job.id, status: "processing", dedup: false },
    { status: 202 }
  );

  processJob(job.id, userId, rawText).catch(console.error);
  return response;
}

async function processJob(jobId: string, userId: string, rawText: string) {
  try {
    // 1. Parse job
    const parsed = await parseJobText(rawText);

    await supabaseAdmin.from("job_parsed").upsert({
      job_id: jobId,
      title: parsed.title ?? null,
      company: parsed.company ?? null,
      location: parsed.location ?? null,
      employment_type: parsed.employment_type ?? null,
      seniority: parsed.seniority ?? null,
      compensation: parsed.compensation ?? null,
      posting_url: parsed.posting_url ?? null,
      summary: parsed.summary ?? null,
      skills: parsed.skills ?? [],
      responsibilities: parsed.responsibilities ?? [],
      requirements: parsed.requirements ?? [],
      parsed_json: parsed,
    });

    await supabaseAdmin
      .from("jobs")
      .update({ detected_language: parsed.detected_language ?? null })
      .eq("id", jobId);

    // 2. Find the user's primary resume's active version → score the match
    const { data: primaryDoc } = await supabaseAdmin
      .from("resume_documents")
      .select("active_version_id")
      .eq("user_id", userId)
      .eq("is_primary", true)
      .eq("is_archived", false)
      .maybeSingle();

    const activeVersionId = primaryDoc?.active_version_id;

    if (activeVersionId) {
      const { data: profile } = await supabaseAdmin
        .from("resume_parsed_profile")
        .select("parsed_json")
        .eq("version_id", activeVersionId)
        .maybeSingle();

      if (profile?.parsed_json) {
        const score = await scoreMatch(profile.parsed_json as ParsedJson, parsed);
        await supabaseAdmin.from("job_matches").upsert(
          {
            job_id: jobId,
            resume_version_id: activeVersionId,
            match_score: Math.round(score.match_score ?? 0),
            matched_keywords: score.matched_keywords ?? [],
            missing_keywords: score.missing_keywords ?? [],
            explanation: score.explanation ?? null,
            scored_json: score,
          },
          { onConflict: "job_id,resume_version_id" }
        );
      }
    }

    await supabaseAdmin.from("jobs").update({ status: "ready" }).eq("id", jobId);
  } catch (err) {
    console.error("Job processing error:", err);
    await supabaseAdmin
      .from("jobs")
      .update({
        status: "failed",
        parse_error_msg: err instanceof Error ? err.message : "Unknown error",
      })
      .eq("id", jobId);
  }
}
