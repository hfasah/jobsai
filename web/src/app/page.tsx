import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/layout/site-header";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";

export default async function Home() {
  const user = await currentUser();
  if (user) redirect("/dashboard");

  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-wider text-desyn-accent">
            AI job search assistant
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Welcome to {APP_NAME}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">{APP_TAGLINE}</p>
          <p className="mt-6 text-sm text-muted-foreground">
            Sign up free to save your profile. Resume upload and job matching come in the next phases.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button nativeButton={false} render={<Link href="/sign-in" />}>
              Sign in
            </Button>
            <Button variant="outline" nativeButton={false} render={<Link href="/sign-up" />}>
              Get started
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}
