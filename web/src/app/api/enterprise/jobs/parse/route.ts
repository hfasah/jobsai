import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getMyOrg } from "@/lib/enterprise";
import { extractText } from "@/lib/resume-extractor";
import { parseJobFromText } from "@/lib/job-intake";

export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// POST — parse a pasted or uploaded (PDF/Word) job description / hiring-manager
// request into structured fields, to pre-fill the "Post a new job" form.
// Accepts multipart { file } (PDF/DOC/DOCX) or { text }, or JSON { text }.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  let text = "";
  const contentType = req.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      const pasted = form.get("text");
      if (file instanceof File) {
        if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large (max 10 MB)." }, { status: 400 });
        const buf = Buffer.from(await file.arrayBuffer());
        text = (await extractText(buf, file.type)).text;
      } else if (typeof pasted === "string") {
        text = pasted;
      }
    } else {
      const body = await req.json().catch(() => ({}));
      text = String(body.text ?? "");
    }
  } catch {
    return NextResponse.json({ error: "Couldn't read that input. Paste text or upload a PDF/Word file." }, { status: 422 });
  }

  text = text.trim();
  if (text.length < 30) {
    return NextResponse.json({ error: "Paste a job description or upload a PDF/Word file." }, { status: 400 });
  }

  try {
    const parsed = await parseJobFromText(text, { orgId: org.id, userId });
    return NextResponse.json({ data: parsed });
  } catch (err) {
    console.error("Job parse error:", err);
    return NextResponse.json({ error: "Couldn't parse that job. Try pasting the text directly." }, { status: 500 });
  }
}
