import { SignIn } from "@clerk/nextjs";

import { SiteHeader } from "@/components/layout/site-header";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function SignInPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <SignIn appearance={clerkAppearance} />
      </main>
    </>
  );
}
