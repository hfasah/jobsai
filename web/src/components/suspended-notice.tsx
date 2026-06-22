import { ShieldAlert } from "lucide-react";
import { SignOutButton } from "@clerk/nextjs";

// Shown in place of the dashboard when an admin has suspended the account
// (Clerk privateMetadata.suspended). Blocks access to the job-seeker app.
export function SuspendedNotice({ email }: { email?: string }) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10">
        <ShieldAlert className="h-7 w-7 text-red-500" />
      </div>
      <h1 className="mt-5 text-2xl font-bold">Your account is suspended</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Access to JobsAI has been temporarily suspended{email ? ` for ${email}` : ""}. If you
        think this is a mistake, please contact our support team and we&apos;ll help sort it out.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <a
          href="mailto:support@jobsai.work?subject=Account%20suspended"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Contact support
        </a>
        <SignOutButton>
          <button className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-accent">
            Sign out
          </button>
        </SignOutButton>
      </div>
    </div>
  );
}
