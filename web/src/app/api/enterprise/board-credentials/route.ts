import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

// Never return the raw secrets to the client — just whether they're set.
function redact(row: Record<string, unknown>) {
  return {
    ...row,
    api_key: row.api_key ? "set" : null,
    api_secret: row.api_secret ? "set" : null,
  };
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { data } = await supabaseAdmin
    .from("enterprise_board_credentials").select("*").eq("org_id", org.id).order("created_at");
  return NextResponse.json({ data: (data ?? []).map(redact) });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  if (!body.board?.trim()) return NextResponse.json({ error: "Board name is required." }, { status: 400 });
  const direction = ["post", "pull", "both"].includes(body.direction) ? body.direction : "post";
  if ((direction === "pull" || direction === "both") && !body.feed_url?.trim()) {
    return NextResponse.json({ error: "A feed URL is required to pull jobs." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.from("enterprise_board_credentials").insert({
    org_id: org.id,
    board: body.board.trim(),
    label: body.label ?? body.board.trim(),
    direction,
    api_key: body.api_key ?? null,
    api_secret: body.api_secret ?? null,
    account_id: body.account_id ?? null,
    feed_url: body.feed_url ?? null,
    config: body.config ?? {},
  }).select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: redact(data) }, { status: 201 });
}
