import { SignUp } from "@clerk/nextjs";

import { SiteHeader } from "@/components/layout/site-header";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function SignUpPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <SignUp appearance={clerkAppearance} />
      </main>
    </>
  );
}
