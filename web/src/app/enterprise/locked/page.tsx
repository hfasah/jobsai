import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { getMyOrg, orgHasAccess } from "@/lib/enterprise";

// Shown when a recruiter's org exists but its subscription isn't active yet.
export default async function EnterpriseLockedPage() {
  const { userId } = await auth();
  if (!userId) redirect("/enterprise-login");

  const org = await getMyOrg(userId);
  // If the org is actually active (e.g. just activated), send them in.
  if (org && orgHasAccess((org as unknown as { access_status?: string }).access_status)) {
    redirect("/enterprise/dashboard");
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
        <Lock className="h-7 w-7" />
      </div>
      <h1 className="text-2xl font-bold text-foreground">
        {org ? `${org.name}'s workspace is pending activation` : "Workspace pending activation"}
      </h1>
      <p className="mt-3 text-muted-foreground">
        Your recruiting workspace has been created but isn&apos;t active yet. Enterprise
        access is activated once your subscription is confirmed.
      </p>
      <div className="mt-8 flex flex-col items-center gap-3">
        <a
          href="/enterprise/plans"
          className="rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground hover:opacity-90"
        >
          Choose a plan & start your trial
        </a>
        <a
          href="mailto:support@jobsai.work?subject=Activate%20my%20enterprise%20workspace"
          className="text-sm font-medium text-primary hover:underline"
        >
          Or contact us to activate
        </a>
        <p className="text-xs text-muted-foreground">
          Already subscribed? Activation is usually instant — refresh in a moment.
        </p>
      </div>
    </div>
  );
}
