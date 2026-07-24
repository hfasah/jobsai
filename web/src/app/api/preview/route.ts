import { NextRequest, NextResponse } from "next/server";
import { draftMode } from "next/headers";
import { redirect } from "next/navigation";

// Enables Next draft mode for the Sanity Studio's Presentation (visual
// editing) pane: editors see DRAFT content in the preview before publishing.
// Secret-gated; the Studio appends the target path it wants to preview.

export async function GET(req: NextRequest) {
  const secret = process.env.SANITY_PREVIEW_SECRET;
  if (!secret || req.nextUrl.searchParams.get("secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  (await draftMode()).enable();
  const path =
    req.nextUrl.searchParams.get("sanity-preview-pathname") ??
    req.nextUrl.searchParams.get("path") ??
    "/enterprise/home";
  redirect(path.startsWith("/") ? path : "/enterprise/home");
}
