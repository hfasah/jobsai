import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserBilling } from "@/lib/billing";

// Card-required model: the setup wizard (resume upload, preferences, apply
// profile) is real product value and sits outside /dashboard, so it needs the
// same gate — no active or trialing subscription, no setup. New users start
// their trial first, then set up.
export default async function OnboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const billing = await getUserBilling(userId);
  const subscribed = ["active", "trialing", "past_due"].includes(billing.subscription_status ?? "");
  if (!subscribed) redirect("/start-trial");

  return <>{children}</>;
}
