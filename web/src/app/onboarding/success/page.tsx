import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export default function UpgradeSuccessPage() {
  return (
    <div className="dark flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center text-foreground">
      <CheckCircle2 className="h-20 w-20 text-desyn-success" strokeWidth={1.5} />
      <h1 className="mt-6 text-3xl font-bold tracking-tight">Subscription successful</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        Thank you for subscribing! Your account has been upgraded and your monthly tokens
        are on the way. Voice and avatar interviews are unlocked.
      </p>
      <Link
        href="/dashboard"
        className="btn-cta mt-8 rounded-lg px-6 py-3 text-sm font-semibold"
      >
        Go to Dashboard
      </Link>
    </div>
  );
}
