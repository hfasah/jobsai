import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { getMyOrg } from "@/lib/enterprise";
import { sanitizeFilters } from "@/lib/sourcing/filters";

// Saved searches. Visibility: 'private' (creator only) or 'shared' (whole
// workspace). Listing returns the caller's own + shared ones.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "global_sourcing");
  if (gate) return gate;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { data } = await supabaseAdmin
    .from("sourcing_searches")
    .select("id, name, query_text, filters, mode, weights, visibility, last_run_at, run_count, created_by, created_at")
    .eq("org_id", org.id)
    .or(`created_by.eq.${userId},visibility.eq.shared`)
    .order("updated_at", { ascending: false })
    .limit(100);

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "global_sourcing");
  if (gate) return gate;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  if (!name) return NextResponse.json({ error: "name is required." }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("sourcing_searches")
    .insert({
      org_id: org.id,
      created_by: userId,
      name,
      query_text: typeof body.query === "string" ? body.query.slice(0, 1000) : null,
      filters: sanitizeFilters(body.filters),
      mode: ["external", "internal", "combined"].includes(body.mode) ? body.mode : "external",
      weights: body.weights && typeof body.weights === "object" ? body.weights : null,
      visibility: body.visibility === "shared" ? "shared" : "private",
    })
    .select("id, name, visibility")
    .single();
  if (error || !data) return NextResponse.json({ error: "Could not save search." }, { status: 500 });
  return NextResponse.json({ data });
}
