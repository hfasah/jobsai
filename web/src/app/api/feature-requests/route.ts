import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 30;

// POST /api/feature-requests
// Submit a new feature request
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { title, description, category } = body as any;

  if (!title?.trim() || !description?.trim()) {
    return NextResponse.json(
      { error: "Title and description are required" },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("feature_requests")
      .insert({
        user_id: userId,
        title: title.trim(),
        description: description.trim(),
        category: category?.trim() || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (err) {
    console.error("Feature request error:", err);
    return NextResponse.json(
      { error: "Failed to submit request" },
      { status: 500 }
    );
  }
}

// GET /api/feature-requests?status=submitted&sort=upvotes
// Fetch feature requests
export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");
  const sort = req.nextUrl.searchParams.get("sort") ?? "upvotes";
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "50");

  try {
    let query = supabaseAdmin
      .from("feature_requests")
      .select("*");

    if (status) {
      query = query.eq("status", status);
    }

    // Sort
    if (sort === "upvotes") {
      query = query.order("upvotes", { ascending: false });
    } else if (sort === "newest") {
      query = query.order("created_at", { ascending: false });
    }

    const { data, error } = await query.limit(limit);

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (err) {
    console.error("Fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch requests" },
      { status: 500 }
    );
  }
}
