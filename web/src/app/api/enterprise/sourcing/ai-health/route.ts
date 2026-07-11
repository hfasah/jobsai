import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getMyOrg } from "@/lib/enterprise";
import { getAIClient } from "@/lib/ai-client";
import { AI_TIERS } from "@/lib/ai-models";

export const maxDuration = 20;

// TEMP diagnostic: runs the fast-tier LLM call the sourcing parser uses and
// reports whether it works + the exact error (no secrets). Visit
// /api/enterprise/sourcing/ai-health while signed in. Remove after debugging.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const provider = AI_TIERS.fast.provider;
  const model = AI_TIERS.fast.model;
  const started = Date.now();
  try {
    const client = getAIClient(provider);
    const completion = await client.chat.completions.create(
      {
        model,
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 50,
        messages: [
          { role: "system", content: "Reply ONLY with JSON." },
          { role: "user", content: 'Return {"ok": true} as JSON.' },
        ],
      },
      { timeout: 12000, maxRetries: 0 },
    );
    const content = completion.choices[0]?.message?.content ?? "";
    return NextResponse.json({
      ok: true,
      provider,
      model,
      ms: Date.now() - started,
      content: content.slice(0, 200),
    });
  } catch (e) {
    // Surface the real reason (status + message) without leaking the key.
    const err = e as { status?: number; message?: string; code?: string; name?: string };
    return NextResponse.json({
      ok: false,
      provider,
      model,
      ms: Date.now() - started,
      status: err.status ?? null,
      code: err.code ?? null,
      name: err.name ?? null,
      message: (err.message ?? String(e)).slice(0, 400),
    });
  }
}
