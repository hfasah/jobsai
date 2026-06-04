// Tailoring sometimes returns experience entries without dates. Backfill them
// from the source resume by matching on title + company, so the tailored resume
// and its preview always show date ranges. Used at save time (tailor route) and
// as a render-time fallback for already-saved tailored resumes.

type Exp = {
  title?: string;
  company?: string;
  start_date?: string | null;
  end_date?: string | null;
  is_current?: boolean;
};

const norm = (s?: string) => (s ?? "").toLowerCase().trim();

export function fillExperienceDates<T extends Exp>(tailored: T[], source: Exp[]): T[] {
  if (!source.length) return tailored;
  return tailored.map((t) => {
    if (t.start_date || t.end_date) return t; // already has a date
    const match =
      source.find((s) => norm(s.title) === norm(t.title) && norm(s.company) === norm(t.company)) ??
      source.find((s) => norm(s.company) !== "" && norm(s.company) === norm(t.company));
    if (!match) return t;
    return {
      ...t,
      start_date: t.start_date ?? match.start_date ?? null,
      end_date: t.end_date ?? match.end_date ?? null,
      is_current: t.is_current ?? match.is_current,
    };
  });
}
