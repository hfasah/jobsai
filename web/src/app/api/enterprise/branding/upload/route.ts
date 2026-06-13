import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { requirePermission } from "@/lib/enterprise-permissions";

const BUCKET = "enterprise-branding";

// Upload a logo or hero/cover image to a public bucket and return its URL.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requirePermission(userId, "can_manage_settings");
  if (denied) return denied;

  const org = (await getMyOrg(userId)) as { id: string } | null;
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const fd = await req.formData().catch(() => null);
  const file = fd?.get("file") as File | null;
  const kind = (fd?.get("kind") as string) === "cover" ? "cover" : "logo";
  if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "File must be an image." }, { status: 400 });
  if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: "Image must be under 4MB." }, { status: 400 });

  // Ensure the public bucket exists (no-op if it already does).
  await supabaseAdmin.storage.createBucket(BUCKET, { public: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const path = `${org.id}/${kind}-${Date.now()}.${ext}`;
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, buffer, {
    upsert: true,
    contentType: file.type || "image/png",
  });
  if (error) return NextResponse.json({ error: `Upload failed: ${error.message}` }, { status: 500 });

  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
