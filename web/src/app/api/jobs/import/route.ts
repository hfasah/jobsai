import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

import { supabaseAdmin } from "@/lib/supabase";
import { extractText } from "@/lib/resume-extractor";
import { fetchUrlContent, processJob } from "@/lib/job-import";
import { checkJobImportGate } from "@/lib/billing";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/html",
];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const MIN_CHARS = 300;

// POST /api/jobs/import — paste text, upload a file, or import from URL
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gate = await checkJobImportGate(userId);
  if (!gate.allowed) {
    return NextResponse.json({ error: gate.reason, upgrade_required: true }, { status: 402 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  let rawText = "";
  let sourceType: "text" | "file" = "text";
  let sourceUrl: string | null = null;
  let force = false;

  if (contentType.includes("multipart/form-data")) {
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
      const targetUrl = (body.url as string).trim();
      try { new URL(targetUrl); } catch {
        return NextResponse.json({ error: "Invalid URL." }, { status: 400 });
      }
      sourceUrl = targetUrl;
      const fallbackText = (body.text as string | null)?.trim() ?? "";
      try {
        rawText = await fetchUrlContent(targetUrl);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("URL fetch error:", msg);
        // Many boards/ATSes block scrapers (JS-heavy pages, 403, etc.). If the
        // caller already has the listing text (e.g. from Job Search results),
        // use it instead of failing — we still keep the canonical source_url.
        if (fallbackText.length >= MIN_CHARS) {
          rawText = fallbackText;
        } else {
          return NextResponse.json(
            { error: "Couldn't read that URL (the site may block automated access or need sign-in). Open the posting, copy the description, and use the “Paste” tab instead." },
            { status: 422 }
          );
        }
      }
    } else {
      rawText = (body.text as string | null)?.trim() ?? "";
    }
  }

  if (rawText.trim().length < MIN_CHARS) {
    return NextResponse.json(
      { error: `Job description too short (min ${MIN_CHARS} characters).`, code: "text_insufficient_content" },
      { status: 400 }
    );
  }

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
      return NextResponse.json({ job_id: existing.id, status: "ready", dedup: true });
    }
  }

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

  processJob(job.id, userId, rawText).catch(console.error);

  return NextResponse.json({ job_id: job.id, status: "processing", dedup: false }, { status: 202 });
}
