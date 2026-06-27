import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

type Ctx = { params: Promise<{ appId: string }> };

// GET — download a candidate's original resume file (as-sent) via a short-lived
// signed URL. Org-scoped. Falls back to an external resume_url when there's no
// stored file (e.g. careers-portal uploads).
export async function GET(_req: Request, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { appId } = await params;

  const { data: app } = await supabaseAdmin
    .from("enterprise_applications")
    .select("resume_storage_key, resume_url")
    .eq("id", appId)
    .eq("org_id", org.id)
    .maybeSingle();
  if (!app) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const key = app.resume_storage_key as string | null;
  if (key) {
    const { data, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(key, 300, { download: true }); // 5-min TTL, force download
    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: "Couldn't generate a download link." }, { status: 500 });
    }
    return NextResponse.redirect(data.signedUrl);
  }

  const url = app.resume_url as string | null;
  if (url && /^https?:\/\//i.test(url)) return NextResponse.redirect(url);

  return NextResponse.json({ error: "No resume file on file." }, { status: 404 });
}
