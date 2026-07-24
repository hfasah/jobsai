// Aggregator-URL resolver. Job boards like Adzuna hand out redirect/tracking
// links (adzuna.com/land/ad/…) that geo-gate the viewer BEFORE the employer is
// reached — hence "this job is not available in your region" when applying.
// Resolving the wrapper to the real employer/ATS URL lets us apply on the actual
// posting, so the EMPLOYER decides eligibility (and we can use a deterministic
// ATS adapter). Always safe: returns the original URL if it can't resolve.

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Redirect/tracking wrapper hosts (not real employer/ATS destinations).
const AGGREGATOR_HOSTS = [
  /(^|\.)adzuna\.[a-z.]+$/i,
  /(^|\.)jooble\.org$/i,
  /(^|\.)talent\.com$/i,
  /(^|\.)neuvoo\./i,
  /(^|\.)whatjobs\.com$/i,
  /(^|\.)jobrapido\.com$/i,
  /(^|\.)go\.indeed\.com$/i,
];

export function isAggregatorUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    return AGGREGATOR_HOSTS.some((re) => re.test(new URL(url).hostname));
  } catch {
    return false;
  }
}

// Follow the wrapper to its real destination. Tries HTTP redirects first (cheap),
// then a meta-refresh / JS-redirect in the body (some aggregators use those).
export async function resolveAggregatorUrl(url: string): Promise<string> {
  if (!isAggregatorUrl(url)) return url;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html,application/xhtml+xml,*/*;q=0.8", "Accept-Language": "en-US,en;q=0.9" },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
    // HTTP-level redirect landed us somewhere real.
    if (res.url && !isAggregatorUrl(res.url)) return res.url;

    // Otherwise look for a client-side redirect in the HTML.
    const html = await res.text().catch(() => "");
    const meta = html.match(/<meta[^>]+http-equiv=["']?refresh["']?[^>]+url=([^"'>\s]+)/i);
    const js = html.match(/(?:window\.location(?:\.href)?|location\.replace\()\s*=?\s*["']([^"']+)["']/i);
    const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
    for (const m of [meta, js, canonical]) {
      const dest = m?.[1];
      if (dest && /^https?:\/\//.test(dest) && !isAggregatorUrl(dest)) return dest;
    }
  } catch {
    // Bot-blocked (403) or timeout — fall back to the original wrapper URL.
  }
  return url;
}
