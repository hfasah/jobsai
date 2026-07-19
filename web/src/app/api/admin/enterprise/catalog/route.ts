import { NextResponse } from "next/server";
import { requireAdminPerm } from "@/lib/admin";
import { loadCatalog } from "@/lib/enterprise-catalog";

export const dynamic = "force-dynamic";

// GET — pricing catalog (plans, features, plan→feature map) for the quote builder.
export async function GET() {
  const admin = await requireAdminPerm("enterprise");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const catalog = await loadCatalog();
  return NextResponse.json(catalog);
}
