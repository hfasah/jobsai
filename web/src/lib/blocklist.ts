// Shared block-list matcher. A job is blocked if its company name matches an
// excluded company, or its source domain (or that domain's root) is blocked.

function hostOf(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function normDomain(d: string): string {
  return d.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
}

export function isBlockedJob(
  company: string | null | undefined,
  url: string | null | undefined,
  excludedCompanies: string[] = [],
  blockedDomains: string[] = []
): boolean {
  const c = (company ?? "").toLowerCase().trim();

  // Company-name match.
  if (c && excludedCompanies.some((e) => e.trim() && c.includes(e.toLowerCase().trim()))) return true;

  const host = hostOf(url);
  for (const raw of blockedDomains) {
    const dd = normDomain(raw);
    if (!dd) continue;
    // Domain match against the job's source host.
    if (host && (host === dd || host.endsWith(`.${dd}`) || host.includes(dd))) return true;
    // Root of the domain appearing in the company name (e.g. "acme.com" → "Acme Corp").
    const root = dd.split(".")[0];
    if (c && root.length > 2 && c.includes(root)) return true;
  }
  return false;
}
