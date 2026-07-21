// Pre-flight checks before launching a paid Skyvern browser-agent run.
//
// Skyvern bills per step CONSUMED, success or not — and a failed run is a
// double loss: we pay for the steps AND refund the user's credits. The failure
// classes are predictable (login-wall boards, domains that have never once
// succeeded), so we refuse to pay for runs we already know will fail.
// Applied in the auto-apply cron BEFORE any credits are deducted; a skipped
// job simply stays manual_required ("your cover letter is ready").

import { supabaseAdmin } from "@/lib/supabase";

// Boards that hard-require a logged-in session or block automation outright —
// a browser agent without stored credentials cannot complete these.
const STATIC_DOOMED: string[] = [
  "linkedin.com",
  "indeed.com",
  "glassdoor.com",
];

// Learned rule: a domain with this many agent attempts and ZERO successes is
// treated as doomed until something changes (a later success on the domain
// resets the stats naturally). Two strikes: we never pay a third time to
// confirm a pattern.
const LEARN_MIN_ATTEMPTS = 2;
const LOOKBACK_DAYS = 90;

export function domainOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export interface AgentDomainStats {
  byDomain: Map<string, { attempts: number; submitted: number }>;
}

/**
 * Build per-domain agent outcome stats for the last 90 days. Loaded once per
 * cron run and consulted per job. Plain queries joined in code (no embeds).
 */
export async function loadAgentDomainStats(): Promise<AgentDomainStats> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();
  const byDomain = new Map<string, { attempts: number; submitted: number }>();

  const { data: attempts, error: aErr } = await supabaseAdmin
    .from("apply_attempts")
    .select("job_id, status")
    .eq("platform", "agent")
    .in("status", ["submitted", "failed"])
    .gte("created_at", since)
    .limit(10000);
  if (aErr) {
    console.error("[agent-preflight] attempts query failed:", aErr.message);
    return { byDomain }; // fail open on stats — static list still applies
  }
  const jobIds = [...new Set((attempts ?? []).map((a) => a.job_id))];
  if (jobIds.length === 0) return { byDomain };

  const urlByJob = new Map<string, string>();
  for (let i = 0; i < jobIds.length; i += 100) {
    const { data: jobs, error: jErr } = await supabaseAdmin
      .from("jobs")
      .select("id, source_url")
      .in("id", jobIds.slice(i, i + 100));
    if (jErr) {
      console.error("[agent-preflight] jobs query failed:", jErr.message);
      continue;
    }
    for (const j of jobs ?? []) if (j.source_url) urlByJob.set(j.id, j.source_url);
  }

  for (const a of attempts ?? []) {
    const url = urlByJob.get(a.job_id);
    const domain = url ? domainOf(url) : null;
    if (!domain) continue;
    const s = byDomain.get(domain) ?? { attempts: 0, submitted: 0 };
    s.attempts++;
    if (a.status === "submitted") s.submitted++;
    byDomain.set(domain, s);
  }
  return { byDomain };
}

export interface PreflightVerdict {
  skip: boolean;
  reason?: string;
}

function isDoomedDomain(domain: string): boolean {
  return STATIC_DOOMED.some((d) => domain === d || domain.endsWith(`.${d}`));
}

/** Should we refuse to spend money launching an agent at this URL? */
export function agentPreflight(url: string | null | undefined, stats: AgentDomainStats): PreflightVerdict {
  if (!url) return { skip: true, reason: "no posting URL" };
  const domain = domainOf(url);
  if (!domain) return { skip: true, reason: "unparseable posting URL" };

  if (isDoomedDomain(domain)) {
    return { skip: true, reason: `${domain} requires a login the agent can't complete` };
  }

  const s = stats.byDomain.get(domain);
  if (s && s.attempts >= LEARN_MIN_ATTEMPTS && s.submitted === 0) {
    return { skip: true, reason: `${domain} has failed ${s.attempts}/${s.attempts} recent agent attempts` };
  }

  return { skip: false };
}

/** Does this domain have at least one successful agent submission on record? */
export function isProvenDomain(url: string, stats: AgentDomainStats): boolean {
  const domain = domainOf(url);
  if (!domain) return false;
  return (stats.byDomain.get(domain)?.submitted ?? 0) > 0;
}

/**
 * Free HTTP liveness probe before a PAID browser run: dead postings (404/410)
 * and links that redirect into a login-wall domain never launch. Bot-blocked
 * responses (403/999 — e.g. Adzuna land pages) count as ALIVE: a real browser
 * can pass where a plain fetch can't, so we only skip on certain death.
 */
export async function postingLivenessCheck(url: string): Promise<PreflightVerdict> {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (res.status === 404 || res.status === 410) {
      return { skip: true, reason: `posting is gone (${res.status})` };
    }
    const finalDomain = domainOf(res.url);
    if (finalDomain && isDoomedDomain(finalDomain)) {
      return { skip: true, reason: `posting redirects to ${finalDomain} (login required)` };
    }
    return { skip: false };
  } catch {
    // Network hiccup or hard bot-block on the probe — not proof of death.
    return { skip: false };
  }
}
