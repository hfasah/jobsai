import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { loadResumeProfile, isContextError } from "@/lib/job-context";
import { optimizeLinkedInProfile } from "@/lib/linkedin";
import { deductTokens, getTokenBalance, TOKEN_COSTS } from "@/lib/tokens";

export const maxDuration = 60;

// GET /api/linkedin/profile — load the user's saved optimized profile (or null).
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabaseAdmin
    .from("linkedin_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  return NextResponse.json({ data: data ?? null });
}

// POST /api/linkedin/profile — generate/regenerate the optimized profile from the
// user's primary resume. Charged on success.
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cost = TOKEN_COSTS.linkedin_optimize;
  const balance = await getTokenBalance(userId);
  if (balance < cost) {
    return NextResponse.json(
      {
        error: `You're out of tokens. Optimizing your LinkedIn profile costs ${cost} tokens and you have ${balance}. Upgrade your plan or top up to continue.`,
        upgrade_required: true,
        balance,
      },
      { status: 402 }
    );
  }

  const ctx = await loadResumeProfile(userId);
  if (isContextError(ctx)) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  let result;
  try {
    result = await optimizeLinkedInProfile(ctx.resumeProfile, userId);
  } catch (err) {
    console.error("LinkedIn optimize error:", err);
    return NextResponse.json({ error: "Optimization failed. Please try again." }, { status: 500 });
  }

  const row = {
    user_id: userId,
    source_resume_version_id: ctx.resumeVersionId,
    headline: result.headline ?? null,
    about: result.about ?? null,
    experience_rewrites: result.experience_rewrites ?? [],
    skills: result.skills ?? [],
    score: typeof result.score === "number" ? result.score : null,
    suggestions: result.suggestions ?? [],
    generated_json: result,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("linkedin_profiles")
    .upsert(row, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const spend = await deductTokens(userId, cost, "linkedin_optimize");

  return NextResponse.json({ data, balance: spend.balance });
}

// PATCH /api/linkedin/profile — save the user's manual edits to the saved profile.
export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.headline === "string") patch.headline = body.headline;
  if (typeof body.about === "string") patch.about = body.about;
  if (Array.isArray(body.skills)) patch.skills = body.skills;
  if (Array.isArray(body.experience_rewrites)) patch.experience_rewrites = body.experience_rewrites;

  const { data, error } = await supabaseAdmin
    .from("linkedin_profiles")
    .update(patch)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "No saved profile to update yet." }, { status: 404 });
  return NextResponse.json({ data });
}
