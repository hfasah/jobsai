// Checks whether a job posting URL is still live before we send the browser agent.
// Returns 'expired' only on clear signals — we never block on network timeouts.

const TIMEOUT_MS = 8000;

// Patterns that indicate a redirect to a generic / logged-out page (job is gone)
const EXPIRED_REDIRECT_PATTERNS = [
  /linkedin\.com\/jobs\/?(\?.*)?$/,
  /linkedin\.com\/home/,
  /linkedin\.com\/authwall/,
  /indeed\.com\/?(\?.*)?$/,
  /indeed\.com\/jobs\/?(\?.*)?$/,
  /glassdoor\.com\/?(\?.*)?$/,
  /lever\.co\/?(\?.*)?$/,
  /greenhouse\.io\/?(\?.*)?$/,
];

function looksExpiredByRedirect(originalUrl: string, finalUrl: string): boolean {
  if (finalUrl === originalUrl) return false;
  return EXPIRED_REDIRECT_PATTERNS.some((p) => p.test(finalUrl));
}

export type AvailabilityResult = "available" | "expired" | "unknown";

export async function checkJobAvailability(url: string): Promise<AvailabilityResult> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; JobsAI/1.0; checking job availability)",
      },
    });

    clearTimeout(timer);

    // Definitive gone
    if (res.status === 404 || res.status === 410 || res.status === 301) {
      return "expired";
    }

    // Redirected to a generic page = job pulled
    if (looksExpiredByRedirect(url, res.url)) {
      return "expired";
    }

    return "available";
  } catch {
    // Network error, timeout, CORS — don't block the apply
    return "unknown";
  }
}

export function expiredMessage(company?: string | null): string {
  return company
    ? `${company} is no longer accepting applications for this position. The role has likely been filled or the posting was closed.`
    : "This employer is no longer accepting applications for this position. The role has likely been filled or the posting was closed.";
}
