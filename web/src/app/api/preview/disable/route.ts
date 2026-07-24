import { NextRequest } from "next/server";
import { draftMode } from "next/headers";
import { redirect } from "next/navigation";

// Turns draft-mode preview back off (linked from nowhere critical; handy when
// someone previews in a full tab and wants the published view again).

export async function GET(req: NextRequest) {
  (await draftMode()).disable();
  const path = req.nextUrl.searchParams.get("path") ?? "/enterprise/home";
  redirect(path.startsWith("/") ? path : "/enterprise/home");
}
