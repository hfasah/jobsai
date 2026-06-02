import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";

import { SiteHeader } from "@/components/layout/site-header";

export default async function DashboardPage() {
  const user = await currentUser();
  const firstName = user?.firstName ?? "there";

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-10 sm:px-6">
        <p className="text-sm font-medium uppercase tracking-wider text-desyn-accent">
          Your workspace
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Welcome back, {firstName}
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Your AI-powered job application assistant. Upload your resume to get started.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/dashboard/resumes"
            className="rounded-xl border border-border bg-card p-5 hover:shadow-sm transition-shadow"
          >
            <p className="font-semibold">Resumes</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload and manage your resumes. AI parses your profile automatically.
            </p>
          </Link>
          <Link
            href="/dashboard/jobs"
            className="rounded-xl border border-border bg-card p-5 hover:shadow-sm transition-shadow"
          >
            <p className="font-semibold">Jobs & Matching</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Import a job description and see how well your resume matches.
            </p>
          </Link>
          <Link
            href="/dashboard/applications"
            className="rounded-xl border border-border bg-card p-5 hover:shadow-sm transition-shadow"
          >
            <p className="font-semibold">Applications</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Track each application through your pipeline, from saved to offer.
            </p>
          </Link>
          <Link
            href="/dashboard/analytics"
            className="rounded-xl border border-border bg-card p-5 hover:shadow-sm transition-shadow"
          >
            <p className="font-semibold">Analytics</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Match trends, pipeline health, skill gaps, and AI usage at a glance.
            </p>
          </Link>
          <Link
            href="/dashboard/preferences"
            className="rounded-xl border border-border bg-card p-5 hover:shadow-sm transition-shadow"
          >
            <p className="font-semibold">Preferences</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Set your target roles, location, salary, and filters for auto job discovery.
            </p>
          </Link>
        </div>
      </main>
    </>
  );
}
