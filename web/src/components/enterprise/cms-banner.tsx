import Link from "next/link";
import { sanityFetch } from "@/lib/sanity";

// CMS-scheduled promo banner for public enterprise marketing pages. Marketing
// creates a siteBanner document in Sanity with a start/end window; it appears
// and disappears on schedule with no deploy. Renders nothing when no banner is
// active or Sanity is unconfigured. The 5-minute revalidate bounds how stale a
// window edge can be; the publish webhook refreshes it immediately on edits.

interface BannerDoc {
  message?: string;
  code?: string;
  linkHref?: string;
  linkLabel?: string;
  theme?: string;
}

const THEME_BG: Record<string, string> = {
  emerald: "bg-emerald-600",
  indigo: "bg-indigo-600",
  amber: "bg-amber-600",
};

export async function CmsBanner() {
  const now = new Date().toISOString();
  const banner = await sanityFetch<BannerDoc>(
    `*[_type == "siteBanner" && enabled == true && startAt <= $now && endAt >= $now] | order(startAt desc)[0]{message, code, linkHref, linkLabel, theme}`,
    { now },
    { tags: ["sanity:siteBanner"], revalidate: 300 },
  );
  if (!banner?.message) return null;

  return (
    <div className={`${THEME_BG[banner.theme ?? ""] ?? THEME_BG.emerald} px-4 py-2.5 text-center text-sm font-semibold text-white`}>
      {banner.message}
      {banner.code && (
        <span className="mx-2 rounded bg-white/20 px-2 py-0.5 font-mono tracking-widest">{banner.code}</span>
      )}
      {banner.linkHref && banner.linkLabel && (
        <Link href={banner.linkHref} className="ml-2 underline underline-offset-2">{banner.linkLabel}</Link>
      )}
    </div>
  );
}
