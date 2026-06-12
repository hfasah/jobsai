import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { orgHasAccess } from "@/lib/enterprise";

const APP_HOST = (process.env.NEXT_PUBLIC_APP_URL ?? "https://jobsai.work")
  .replace(/^https?:\/\//, "")
  .replace(/\/$/, "");

// Domain that serves the enterprise/recruiter experience. Its root should land
// on the recruiter sign-in, not the consumer marketing page. Keyed off this
// specific host so jobsai.work (consumer) is unaffected.
const ENTERPRISE_PORTAL_HOST = "app.jobsai.work";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/onboarding(.*)",
  "/admin(.*)",
]);

// Enterprise workspace pages require an org with an active/comped subscription.
// Segment-scoped so it never matches /enterprise-login or /enterprise-signup.
const isEnterprisePage = createRouteMatcher(["/enterprise", "/enterprise/(.*)"]);
// …except these, which must stay reachable for pending orgs and candidates:
// onboarding (create workspace), the locked screen, invite acceptance, and the
// public token-based candidate flows (booking, references, interviews, offers).
const isEnterprisePreAccess = createRouteMatcher([
  "/enterprise/onboard(.*)",
  "/enterprise/plans(.*)",
  "/enterprise/locked(.*)",
  "/enterprise/invite(.*)",
  "/enterprise/book(.*)",
  "/enterprise/confirm(.*)",
  "/enterprise/reference(.*)",
  "/enterprise/interview(.*)",
  "/enterprise/offer-sign(.*)",
]);

// Resolve the signed-in user's org access status. Returns the status string,
// "NO_MEMBERSHIP" if they belong to no org, or null on any error (fail-open so
// a transient/pre-migration failure never locks people out of their workspace).
async function getOrgAccessStatus(userId: string): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/enterprise_members?user_id=eq.${encodeURIComponent(userId)}&select=enterprise_orgs(access_status)&limit=1`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Accept: "application/json",
        },
      },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as { enterprise_orgs?: { access_status?: string } | null }[];
    if (rows.length === 0) return "NO_MEMBERSHIP";
    return rows[0]?.enterprise_orgs?.access_status ?? null;
  } catch {
    return null;
  }
}

async function resolveCustomDomain(hostname: string): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/enterprise_orgs?custom_domain=eq.${encodeURIComponent(hostname)}&select=slug&limit=1`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Accept: "application/json",
        },
      },
    );
    if (!res.ok) return null;
    const rows = await res.json() as { slug: string }[];
    return rows[0]?.slug ?? null;
  } catch {
    return null;
  }
}

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const hostname = req.headers.get("host")?.split(":")[0] ?? "";

  // Enterprise portal domain: send the homepage to the recruiter sign-in.
  if (hostname === ENTERPRISE_PORTAL_HOST && req.nextUrl.pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = "/enterprise-login";
    return NextResponse.redirect(url);
  }

  const isKnownHost =
    hostname === APP_HOST ||
    hostname.endsWith(`.${APP_HOST}`) ||
    hostname === "localhost" ||
    hostname.endsWith(".vercel.app") ||
    hostname.endsWith(".localhost");

  if (!isKnownHost && hostname) {
    const slug = await resolveCustomDomain(hostname);
    if (slug) {
      const url = req.nextUrl.clone();
      const path = url.pathname === "/" ? "" : url.pathname;
      url.pathname = `/careers/${slug}${path}`;
      return NextResponse.rewrite(url);
    }
  }

  // Gate the enterprise workspace behind an active/comped org subscription.
  if (isEnterprisePage(req) && !isEnterprisePreAccess(req)) {
    const { userId } = await auth();
    if (userId) {
      const status = await getOrgAccessStatus(userId);
      if (status === "NO_MEMBERSHIP") {
        const url = req.nextUrl.clone();
        url.pathname = "/enterprise/onboard";
        return NextResponse.redirect(url);
      }
      // status === null => fail-open (don't lock out on transient errors).
      if (status && !orgHasAccess(status)) {
        const url = req.nextUrl.clone();
        url.pathname = "/enterprise/locked";
        return NextResponse.redirect(url);
      }
    }
  }

  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
