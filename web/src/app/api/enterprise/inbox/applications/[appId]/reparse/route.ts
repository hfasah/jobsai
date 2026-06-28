import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { extractText } from "@/lib/resume-extractor";
import { parseResumeText } from "@/lib/resume-parser";

export const maxDuration = 60;

type Ctx = { params: Promise<{ appId: string }> };

const mimeForKey = (key: string): string => {
  const ext = key.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === "doc") return "application/msword";
  return "";
};

// POST — re-parse a candidate from their stored résumé file: re-extract the text
// and pull a real name + phone, fixing entries that came in as an email handle
// or with empty résumé text. Org-scoped.
export async function POST(_req: Request, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { appId } = await params;

  const { data: app } = await supabaseAdmin
    .from("enterprise_applications")
    .select("id, resume_storage_key, candidate_email, candidate_name")
    .eq("id", appId)
    .eq("org_id", org.id)
    .maybeSingle();
  if (!app) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const key = app.resume_storage_key as string | null;
  if (!key) return NextResponse.json({ error: "No résumé file on file — upload one to re-parse." }, { status: 400 });

  const { data: blob, error: dlErr } = await supabaseAdmin.storage.from(STORAGE_BUCKET).download(key);
  if (dlErr || !blob) return NextResponse.json({ error: "Couldn't read the stored résumé file." }, { status: 500 });

  let text = "";
  try {
    text = (await extractText(Buffer.from(await blob.arrayBuffer()), mimeForKey(key))).text;
  } catch {
    return NextResponse.json({ error: "Couldn't extract text from the résumé file." }, { status: 422 });
  }
  if (text.trim().length < 50) return NextResponse.json({ error: "No readable text in the résumé file." }, { status: 422 });

  // Pull a real name / phone from the résumé.
  let name: string | null = null;
  let phone: string | null = null;
  let location: string | null = null;
  let skills: string[] = [];
  try {
    const parsed = await parseResumeText(text);
    name = parsed.name?.trim() || null;
    phone = parsed.phone?.trim() || null;
    location = parsed.location?.trim() || null;
    skills = Array.isArray(parsed.skills) ? parsed.skills.map((s) => String(s).trim()).filter(Boolean) : [];
  } catch { /* keep existing identity if the parser fails */ }

  const email = (app.candidate_email as string | null) ?? "";
  const handle = email.split("@")[0].toLowerCase();
  const update: Record<string, unknown> = { resume_text: text, updated_at: new Date().toISOString() };
  // Only overwrite the name if we parsed a real one (not the email handle).
  if (name && name.toLowerCase() !== handle) update.candidate_name = name;
  if (phone) update.candidate_phone = phone;
  if (location) update.candidate_location = location;
  if (skills.length) update.tags = skills.slice(0, 30);

  const { data, error } = await supabaseAdmin
    .from("enterprise_applications")
    .update(update)
    .eq("id", appId)
    .eq("org_id", org.id)
    .select("candidate_name, candidate_phone, candidate_location")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: { candidate_name: data.candidate_name, candidate_phone: data.candidate_phone } });
}
