// Server-side PostHog query helper for the admin Traffic page. Uses a read-only
// personal API key (POSTHOG_API_KEY) + project id to run HogQL against the
// PostHog query API. Returns null/empty on any failure so the admin page can
// degrade gracefully rather than error.

export interface TrafficStats {
  visitors24h: number;
  visitors7d: number;
  views24h: number;
  views7d: number;
  avgSessionSec: number | null;
  topCountries: { country: string; views: number }[];
}

function cfg() {
  const apiKey = process.env.POSTHOG_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  const host = process.env.POSTHOG_API_HOST || "https://us.posthog.com";
  return apiKey && projectId ? { apiKey, projectId, host } : null;
}

export function trafficConfigured() {
  return cfg() !== null;
}

async function hogql(query: string): Promise<unknown[][]> {
  const c = cfg();
  if (!c) throw new Error("PostHog API not configured");
  const res = await fetch(`${c.host}/api/projects/${c.projectId}/query/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${c.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`PostHog ${res.status}`);
  const json = (await res.json()) as { results?: unknown[][] };
  return json.results ?? [];
}

export async function getTrafficStats(): Promise<TrafficStats | null> {
  if (!cfg()) return null;

  // Pageview counts + unique visitors (24h and 7d), one query.
  const counts = await hogql(`
    SELECT
      uniqIf(person_id, timestamp > now() - INTERVAL 1 DAY) AS visitors_24h,
      uniq(person_id) AS visitors_7d,
      countIf(timestamp > now() - INTERVAL 1 DAY) AS views_24h,
      count() AS views_7d
    FROM events
    WHERE event = '$pageview' AND timestamp > now() - INTERVAL 7 DAY
  `).catch(() => null);

  if (!counts) return null; // core query failed → treat as unavailable

  const [v24, v7, p24, p7] = (counts[0] ?? [0, 0, 0, 0]).map((n) => Number(n) || 0);

  // Average session duration (seconds). Compute per-session span from raw events
  // (max - min timestamp grouped by $session_id) and average it — avoids relying
  // on the special `sessions` table schema. Best-effort; null if it errors.
  const durRows = await hogql(`
    SELECT round(avg(dur)) FROM (
      SELECT dateDiff('second', min(timestamp), max(timestamp)) AS dur
      FROM events
      WHERE timestamp > now() - INTERVAL 7 DAY AND properties.$session_id IS NOT NULL
      GROUP BY properties.$session_id
    )
  `).catch(() => null);
  const avgSessionSec = durRows && durRows[0] && durRows[0][0] != null ? Number(durRows[0][0]) || null : null;

  // Top countries (7d) — best-effort.
  const countryRows = await hogql(`
    SELECT properties.$geoip_country_name AS country, count() AS views
    FROM events
    WHERE event = '$pageview' AND timestamp > now() - INTERVAL 7 DAY
      AND properties.$geoip_country_name IS NOT NULL
    GROUP BY country ORDER BY views DESC LIMIT 8
  `).catch(() => []);
  const topCountries = countryRows.map((r) => ({
    country: String(r[0] ?? "Unknown"),
    views: Number(r[1]) || 0,
  }));

  return {
    visitors24h: v24, visitors7d: v7,
    views24h: p24, views7d: p7,
    avgSessionSec, topCountries,
  };
}
