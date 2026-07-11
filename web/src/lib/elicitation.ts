import { supabaseAdmin } from "@/lib/supabase";
import type { ParsedJson, ParsedExperience } from "@/types/resume";

// ─── Resume elicitation (Phase 1: enrichment plumbing) ────────────────────────
// Our tailoring prompts are correctly forbidden from inventing facts, so they can
// only reframe what's already on the resume. The intake interview asks the user
// targeted questions to surface their real specifics; the answers live in
// `accomplishment_facts` and are folded back into the parsed profile here, so the
// EXISTING tailor/build prompts have richer (still truthful) material to work with.

/**
 * Stable identity for an experience entry, so elicited facts stay attached across
 * resume re-parses and re-uploads. The intake flow (Phase 2+) must key answers
 * with this same function.
 */
export function experienceKey(
  e: Pick<ParsedExperience, "company" | "title" | "start_date">
): string {
  return [e.company ?? "", e.title ?? "", e.start_date ?? ""]
    .map((s) => s.trim().toLowerCase())
    .join("|");
}

interface FactRow {
  experience_key: string;
  answer: string;
}

/**
 * Folds the user's confirmed accomplishment facts into a parsed resume profile,
 * attaching them to the matching experience entry as `candidate_facts`, which the
 * downstream tailor/build prompts treat as TRUE, user-attested specifics.
 *
 * Phase 1 contract — this is a safe no-op by default:
 *   • No facts for the user (the case for everyone until they finish the intake)
 *     → the profile is returned UNCHANGED, with no added fields.
 *   • The `accomplishment_facts` table not existing yet → the query errors softly
 *     (supabase returns null data, not a throw) → also returned unchanged.
 * So resume generation behaves exactly as before until the intake writes rows.
 */
export async function enrichProfile(userId: string, profile: ParsedJson): Promise<ParsedJson> {
  const experiences = profile.experience;
  if (!experiences?.length) return profile;

  const { data: facts } = await supabaseAdmin
    .from("accomplishment_facts")
    .select("experience_key, answer")
    .eq("user_id", userId);
  if (!facts?.length) return profile;

  // Group answers by experience key.
  const byKey = new Map<string, string[]>();
  for (const f of facts as FactRow[]) {
    const key = (f.experience_key ?? "").trim();
    const answer = (f.answer ?? "").trim();
    if (!key || !answer) continue;
    (byKey.get(key) ?? byKey.set(key, []).get(key)!).push(answer);
  }
  if (byKey.size === 0) return profile;

  // Attach to matching experiences without mutating the originals.
  return {
    ...profile,
    experience: experiences.map((e) => {
      const matched = byKey.get(experienceKey(e));
      return matched?.length ? { ...e, candidate_facts: matched } : e;
    }),
  };
}
