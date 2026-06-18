import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { loadCatalog } from "@/lib/enterprise-catalog";

export const dynamic = "force-dynamic";

// GET — pricing catalog (plans, features, plan→feature map) for the quote builder.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const catalog = await loadCatalog();
  return NextResponse.json(catalog);
}
