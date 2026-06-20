import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getAIClient } from "@/lib/ai-client";
import { AI_TIERS } from "@/lib/ai-models";

export const maxDuration = 30;

// POST /api/translate  { texts: string[], target: string (English language name) }
// General batch text translator used by the enterprise on-demand page translator.
// Returns { translations: string[] } in the same order/length as the input.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const texts: string[] = Array.isArray(body.texts)
    ? body.texts.map((t: unknown) => String(t)).slice(0, 100)
    : [];
  const target: string = String(body.target ?? "").trim();

  // Nothing to do (no strings, or already English) — echo back unchanged.
  if (texts.length === 0 || !target || /^english$/i.test(target)) {
    return NextResponse.json({ translations: texts });
  }

  const system = `You translate short UI labels and document text into ${target}.
Return ONLY a JSON object: {"t": [ ...translations... ]} with EXACTLY ${texts.length} items, in the same order as the input "strings".
Rules:
- Translate the meaning naturally and concisely (these are UI labels, menu items, and document snippets).
- Keep UNCHANGED: proper nouns, brand/product/company/people names, technical terms and acronyms, code, file names, emails, URLs, and numbers.
- Preserve any leading/trailing whitespace of each string.
- Never add, drop, merge, or reorder items.`;

  try {
    const client = getAIClient(AI_TIERS.fast.provider);
    const res = await client.chat.completions.create({
      model: AI_TIERS.fast.model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify({ strings: texts }) },
      ],
    });
    const parsed = JSON.parse(res.choices[0]?.message?.content ?? "{}");
    const out: unknown[] = Array.isArray(parsed.t) ? parsed.t : [];
    // Fall back to the original string for any missing/empty item, so the UI
    // never blanks out even if the model returns the wrong count.
    const translations = texts.map((orig, i) =>
      typeof out[i] === "string" && (out[i] as string).length ? (out[i] as string) : orig,
    );
    return NextResponse.json({ translations });
  } catch (err) {
    console.error("translate error:", err);
    // Graceful: return originals rather than failing the page.
    return NextResponse.json({ translations: texts });
  }
}
