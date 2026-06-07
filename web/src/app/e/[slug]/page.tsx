import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getMyMembership } from "@/lib/enterprise";

// Custom per-enterprise login link: /e/{company-slug}
// Always routes a signed-in member straight into their workspace, regardless of
// the default user-account landing. Signed-out users sign in, then come back.
export default async function EnterpriseEntry({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { userId } = await auth();
  // Unauthenticated → the dedicated enterprise (email-only) sign-in
  if (!userId) redirect(`/enterprise-login?redirect_url=${encodeURIComponent(`/e/${slug}`)}`);

  const membership = await getMyMembership(userId);
  redirect(membership ? "/enterprise/dashboard" : "/dashboard");
}
