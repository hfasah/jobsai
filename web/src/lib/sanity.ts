// Zero-dependency Sanity content client for the marketing surface.
//
// Marketing content (landing pages, banners, FAQ copy) lives in Sanity and is
// fetched read-only over the public content API — no SDK, no token, no server
// secrets. Pages cache via ISR tags; the Sanity publish webhook hits
// /api/revalidate to refresh them within seconds of an edit.
//
// Unconfigured environments (no NEXT_PUBLIC_SANITY_PROJECT_ID) degrade
// gracefully: every query returns null, CMS pages 404, banners render nothing.

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";

export const sanityConfigured = Boolean(projectId);

export async function sanityFetch<T>(
  query: string,
  params: Record<string, string> = {},
  opts: { tags?: string[]; revalidate?: number } = {},
): Promise<T | null> {
  if (!projectId) return null;

  // Visual-editing preview: when Next draft mode is on (enabled by
  // /api/preview from the Studio's Presentation pane), read DRAFT content
  // with the preview token and no caching, so editors see unpublished edits.
  let drafts = false;
  try {
    const { draftMode } = await import("next/headers");
    drafts = (await draftMode()).isEnabled;
  } catch { /* outside a request context (e.g. build) — published view */ }
  const previewToken = process.env.SANITY_PREVIEW_TOKEN;

  const search = new URLSearchParams({ query });
  for (const [k, v] of Object.entries(params)) search.set(`$${k}`, JSON.stringify(v));
  if (drafts && previewToken) search.set("perspective", "previewDrafts");
  const url = `https://${projectId}.api.sanity.io/v2024-01-01/data/query/${dataset}?${search.toString()}`;
  try {
    const res = await fetch(url, drafts && previewToken
      ? { cache: "no-store", headers: { Authorization: `Bearer ${previewToken}` } }
      : { next: { revalidate: opts.revalidate ?? 3600, ...(opts.tags ? { tags: opts.tags } : {}) } });
    if (!res.ok) {
      console.error("[sanity] query failed:", res.status, await res.text().catch(() => ""));
      return null;
    }
    const json = (await res.json()) as { result: T | null };
    return json.result ?? null;
  } catch (e) {
    console.error("[sanity] fetch error:", e instanceof Error ? e.message : e);
    return null;
  }
}

// Builds a CDN URL from a Sanity image asset reference like
// "image-<id>-<WxH>-<format>". Returns null for anything unexpected.
export function sanityImageUrl(ref: string | undefined, width = 1200): string | null {
  if (!ref || !projectId) return null;
  const m = ref.match(/^image-([a-f0-9]+)-(\d+x\d+)-(\w+)$/);
  if (!m) return null;
  return `https://cdn.sanity.io/images/${projectId}/${dataset}/${m[1]}-${m[2]}.${m[3]}?w=${width}&auto=format`;
}
