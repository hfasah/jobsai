import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// POST /api/resumes/[groupId]/set-primary
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groupId } = await params;

  // Verify ownership
  const { data: doc } = await supabaseAdmin
    .from("resume_documents")
    .select("id")
    .eq("id", groupId)
    .eq("user_id", userId)
    .single();

  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Unset all primaries for user, then set this one
  await supabaseAdmin
    .from("resume_documents")
    .update({ is_primary: false })
    .eq("user_id", userId);

  const { error } = await supabaseAdmin
    .from("resume_documents")
    .update({ is_primary: true })
    .eq("id", groupId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
