// Shared normalization helpers used by providers, merge and dedup.
// Pure functions — no imports, trivially unit-testable.

// "https://www.linkedin.com/in/Jane-Doe/" -> "jane-doe"
export function linkedinHandle(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .match(/^linkedin\.com\/in\/([^/?#]+)/);
  return m ? m[1] : null;
}

export function normalizeLinkedinUrl(url: string | null | undefined): string | null {
  const handle = linkedinHandle(url);
  return handle ? `https://linkedin.com/in/${handle}` : null;
}

export function normEmail(email: string | null | undefined): string | null {
  const e = (email ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

// Loose token normalization for skills/titles: lowercase, strip punctuation,
// collapse whitespace. "Node.JS" and "nodejs" compare equal.
export function normToken(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9+#]/g, "");
}

export function dedupeStrings(values: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const t = (v ?? "").trim();
    if (!t) continue;
    const key = normToken(t);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

export function nameCompanyKey(name: string | null | undefined, company: string | null | undefined): string | null {
  const n = (name ?? "").trim().toLowerCase();
  const c = (company ?? "").trim().toLowerCase();
  return n && c ? `${n}|${c}` : null;
}

export function titleCase(s: string | null | undefined): string | null {
  const t = (s ?? "").trim();
  if (!t) return null;
  if (t !== t.toLowerCase() && t !== t.toUpperCase()) return t; // already mixed case
  return t.replace(/\b\w/g, (ch) => ch.toUpperCase());
}
