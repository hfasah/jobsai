import { auth } from "@clerk/nextjs/server";
import { blockNonJobSeeker } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { generateLinkedInPost } from "@/lib/linkedin";
import { deductTokens, getTokenBalance, TOKEN_COSTS } from "@/lib/tokens";
import type { LinkedInPostTone, LinkedInPostFormat } from "@/types/linkedin";

export const maxDuration = 60;

const TONES: LinkedInPostTone[] = ["professional", "story", "contrarian", "educational", "celebratory"];
const FORMATS: LinkedInPostFormat[] = ["short", "standard", "article"];

// GET /api/linkedin/posts — list the user's writeups (newest first).
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roleBlock = await blockNonJobSeeker(userId); if (roleBlock) return roleBlock;

  const { data } = await supabaseAdmin
    .from("linkedin_posts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  return NextResponse.json({ data: data ?? [] });
}

// POST /api/linkedin/posts — generate a new writeup and save it as a draft.
// Body: { topic, tone?, format? }
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roleBlock = await blockNonJobSeeker(userId); if (roleBlock) return roleBlock;

  const body = await req.json().catch(() => ({}));
  const topic: string = (body.topic ?? "").trim();
  if (topic.length < 3) {
    return NextResponse.json({ error: "Tell us what the post should be about." }, { status: 400 });
  }
  const tone: LinkedInPostTone = TONES.includes(body.tone) ? body.tone : "professional";
  const format: LinkedInPostFormat = FORMATS.includes(body.format) ? body.format : "standard";

  const cost = TOKEN_COSTS.linkedin_post;
  const balance = await getTokenBalance(userId);
  if (balance < cost) {
    return NextResponse.json(
      {
        error: `You're out of tokens. A LinkedIn writeup costs ${cost} tokens and you have ${balance}. Upgrade your plan or top up to continue.`,
        upgrade_required: true,
        balance,
      },
      { status: 402 }
    );
  }

  // Personalize tone with the user's saved headline/field if we have one.
  const { data: profile } = await supabaseAdmin
    .from("linkedin_profiles")
    .select("headline")
    .eq("user_id", userId)
    .maybeSingle();

  let result;
  try {
    result = await generateLinkedInPost({ topic, tone, format, field: profile?.headline ?? null, userId });
  } catch (err) {
    console.error("LinkedIn post error:", err);
    return NextResponse.json({ error: "Generation failed. Please try again." }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin
    .from("linkedin_posts")
    .insert({
      user_id: userId,
      topic,
      tone,
      format,
      body: result.body,
      hashtags: result.hashtags,
      status: "draft",
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const spend = await deductTokens(userId, cost, "linkedin_post");

  return NextResponse.json({ data, balance: spend.balance }, { status: 201 });
}
