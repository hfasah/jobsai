import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export default function UpgradeSuccessPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center text-foreground">
      <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-desyn-success">
        <CheckCircle2 className="h-12 w-12 text-desyn-success" strokeWidth={2} />
      </div>
      <h1 className="mt-6 text-3xl font-bold tracking-tight">Subscription Successful</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        Thank you for subscribing! Your account has been upgraded — auto-apply, resume tailoring,
        and all your tokens are ready to go.
      </p>
      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
        <Link href="/dashboard" className="btn-cta rounded-xl px-8 py-3 text-sm font-semibold">
          Go to Dashboard
        </Link>
        <Link href="/dashboard/billing" className="rounded-xl border border-border px-8 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          View my account
        </Link>
      </div>
    </div>
  );
}
