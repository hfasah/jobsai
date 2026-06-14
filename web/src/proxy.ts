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
  "/enterprise/home(.*)",
  "/enterprise/built-for(.*)",
  "/enterprise/industries(.*)",
  "/enterprise/onboard(.*)",
  "/enterprise/plans(.*)",
  "/enterprise/pricing(.*)",
  "/enterprise/demo(.*)",
  "/enterprise/customers(.*)",
  "/enterprise/about(.*)",
  "/enterprise/contact(.*)",
  "/enterprise/guide(.*)",
  "/enterprise/partners(.*)",
  "/enterprise/intake(.*)",
  "/enterprise/compare(.*)",
  "/enterprise/privacy(.*)",
  "/enterprise/terms(.*)",
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
      `${supabaseUrl}/rest/v1/enterprise_members?user_id=eq.${encodeURIComponent(userId)}&select=enterprise_orgs(access_status,trial_ends_at,stripe_subscription_id)&limit=1`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Accept: "application/json",
        },
      },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as { enterprise_orgs?: { access_status?: string; trial_ends_at?: string | null; stripe_subscription_id?: string | null } | null }[];
    if (rows.length === 0) return "NO_MEMBERSHIP";
    const org = rows[0]?.enterprise_orgs;
    if (!org) return null;
    // Admin-provisioned trials have no Stripe subscription to expire them, so
    // enforce the trial end here: once it passes, the org is locked until they
    // subscribe. Stripe-managed trials are left to the billing webhook.
    if (org.access_status === "trialing" && !org.stripe_subscription_id && org.trial_ends_at && new Date(org.trial_ends_at) < new Date()) {
      return "trial_expired";
    }
    return org.access_status ?? null;
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
  // Partner referral attribution: ?r=CODE drops a 90-day cookie, then we
  // redirect to the clean URL so the param doesn't linger. (Constants are
  // inlined to keep this edge-safe — no supabase import.)
  const ref = req.nextUrl.searchParams.get("r");
  if (ref && /^[A-Za-z0-9_-]{4,32}$/.test(ref)) {
    const cleanUrl = req.nextUrl.clone();
    cleanUrl.searchParams.delete("r");
    const refRes = NextResponse.redirect(cleanUrl);
    refRes.cookies.set("jobsai_ref", ref, { maxAge: 60 * 60 * 24 * 90, path: "/", sameSite: "lax" });
    return refRes;
  }

  const hostname = req.headers.get("host")?.split(":")[0] ?? "";

  // Enterprise portal domain: the root is the enterprise marketing landing page.
  // Redirect (not rewrite) so the client pathname is /enterprise/home — keeps the
  // workspace shell off it and suppresses the job-seeker popup correctly.
  if (hostname === ENTERPRISE_PORTAL_HOST && req.nextUrl.pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = "/enterprise/home";
    return NextResponse.redirect(url);
  }

  // The enterprise portal must never serve the consumer job-seeker app; route
  // those paths back through /launch (which sends them to the enterprise side).
  if (hostname === ENTERPRISE_PORTAL_HOST && /^\/(dashboard|onboarding)(\/|$)/.test(req.nextUrl.pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = "/launch";
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
