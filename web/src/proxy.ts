import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

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
